import { Inject, Injectable } from "@nestjs/common";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";

const ALGORITHM = "HS256" as const;
// Une session d'exploitation est plus courte que celle d'un utilisateur : elle
// ouvre sur les comptes des autres, et un poste laissé ouvert est un risque
// qu'on ne prend pas pour économiser une connexion.
const ACCESS_TTL_S = 30 * 60;
const REFRESH_TTL_MS = 12 * 60 * 60_000;

// Une clé de signature distincte de celle des utilisateurs. Un JWT ne consulte
// aucune table : il porte sa preuve en lui-même, et une garde qui vérifie une
// signature ne sait rien de l'URL par laquelle il est arrivé. Sous un secret
// commun, un jeton d'utilisateur — qui porte un « sub » comme un autre — aurait
// donc passé la garde d'administration, deux tables séparées ou non.
//
// Trois choses que la clé distincte donne et que la marque de type ne donne
// pas : le jeton étranger échoue **à la signature**, avant qu'on lise sa charge ;
// la compromission d'un secret n'ouvre pas l'autre monde ; et l'une des deux
// clés peut tourner sans invalider les sessions de l'autre.
//
// La marque de type reste, en ceinture et bretelles : elle dit l'intention, et
// elle protégerait encore si les deux clés venaient un jour à se confondre.
const TYPE = "adm" as const;

export type PaireAdmin = { accessToken: string; refreshToken: string; expiresIn: number };

// Le client de transaction porte les mêmes délégués que le service, sans les
// méthodes de connexion. On ne jette rien depuis l'intérieur d'une transaction :
// un throw y déclenche un retour arrière, ce qui annulerait la révocation de
// lignée qu'on veut au contraire faire tenir. La transaction rend donc une
// issue neutre, et on ne jette qu'une fois validée.
type TransactionPrisma = Omit<PrismaService, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

type Issue =
  | { ok: true; paire: PaireAdmin & { role: string } }
  | { ok: false; raison: "session_expired" | "refresh_reused" };

@Injectable()
export class AdminTokenService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject("ADMIN_JWT_SECRET") private readonly secret: string,
  ) {
    if (!secret) throw new Error("ADMIN_JWT_SECRET manquant : refuser de démarrer plutôt que de signer sans clé");
  }

  // Pas de clé ici, à la différence de l'OTP : 256 bits tirés au hasard ne
  // s'énumèrent pas, donc un condensé nu ne donne aucune prise.
  private hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  verifierAcces(token: string): { adminId: string } {
    try {
      const charge = jwt.verify(token, this.secret, { algorithms: [ALGORITHM] }) as {
        sub: string; typ?: string;
      };
      if (charge.typ !== TYPE) throw new Error("mauvais type de jeton");
      return { adminId: charge.sub };
    } catch {
      throw new AppError("session_expired", "admin access token invalid or expired");
    }
  }

  private async emettre(
    adminId: string,
    familyId: string,
    parentId: string | null,
    userAgent: string | undefined,
    tx: TransactionPrisma = this.prisma,
  ): Promise<PaireAdmin> {
    const refreshToken = randomBytes(32).toString("base64url");
    await tx.adminRefreshToken.create({
      data: {
        adminId,
        familyId,
        parentId,
        tokenHash: this.hash(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        userAgent: userAgent ?? null,
      },
    });
    const accessToken = jwt.sign({ sub: adminId, typ: TYPE }, this.secret, {
      expiresIn: ACCESS_TTL_S, algorithm: ALGORITHM,
    });
    return { accessToken, refreshToken, expiresIn: ACCESS_TTL_S };
  }

  async ouvrir(adminId: string, userAgent?: string): Promise<PaireAdmin> {
    return this.emettre(adminId, randomUUID(), null, userAgent);
  }

  // Échanger le jeton long contre une paire neuve. Sans cet échange, une
  // session d'exploitation meurt au bout de trente minutes et l'administrateur
  // repasse par sa boîte aux lettres deux fois par heure — le jeton de douze
  // heures qu'on lui remet ne servirait alors à rien.
  //
  // La mécanique reprend celle des utilisateurs (auth/token.service.ts, où le
  // raisonnement sur l'atomicité est écrit en entier) : consommation par un
  // UPDATE conditionnel dans une transaction, pour qu'un rejeu concurrent perde
  // la course par construction et non par une relecture devenue périmée.
  //
  // Une vérification en plus, propre à l'administration : le compte doit être
  // encore en service. Un jeton d'accès porte sa preuve en lui-même et vit
  // trente minutes ; un jeton de rafraîchissement, lui, passe par la base à
  // chaque tour. C'est donc le seul endroit où une révocation de compte peut
  // couper une session en cours plutôt que d'attendre douze heures.
  async tourner(refreshToken: string, userAgent?: string): Promise<PaireAdmin & { role: string }> {
    const tokenHash = this.hash(refreshToken);

    const issue = await this.prisma.$transaction(async (tx): Promise<Issue> => {
      const { count } = await tx.adminRefreshToken.updateMany({
        where: { tokenHash, consumedAt: null, revokedAt: null },
        data: { consumedAt: new Date() },
      });

      if (count === 0) {
        const ligne = await tx.adminRefreshToken.findUnique({ where: { tokenHash } });
        if (!ligne || ligne.revokedAt) return { ok: false, raison: "session_expired" };
        // La ligne existe, n'est pas révoquée, et l'écriture conditionnelle a
        // échoué : elle était déjà consommée. On ne peut pas distinguer le
        // voleur du légitime — la lignée tombe entière.
        await tx.adminRefreshToken.updateMany({
          where: { familyId: ligne.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return { ok: false, raison: "refresh_reused" };
      }

      const ligne = await tx.adminRefreshToken.findUniqueOrThrow({ where: { tokenHash } });
      if (ligne.expiresAt.getTime() < Date.now()) return { ok: false, raison: "session_expired" };

      const admin = await tx.admin.findUnique({ where: { id: ligne.adminId } });
      if (!admin || !admin.isActive) {
        // Le compte est écarté : on ferme la lignée plutôt que de refuser le
        // seul tour en cours, sinon le jeton parent resterait exploitable.
        await tx.adminRefreshToken.updateMany({
          where: { familyId: ligne.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return { ok: false, raison: "session_expired" };
      }

      const paire = await this.emettre(ligne.adminId, ligne.familyId, ligne.id, userAgent, tx);
      return { ok: true, paire: { ...paire, role: admin.role } };
    });

    if (!issue.ok) {
      const message = issue.raison === "refresh_reused"
        ? "admin refresh token replayed; family revoked"
        : "admin refresh token unknown, revoked, expired, or account deactivated";
      throw new AppError(issue.raison, message);
    }
    return issue.paire;
  }

  /**
   * Ferme la session portée par ce jeton — la lignée entière, pas la seule
   * ligne présentée. Depuis que les jetons tournent, une session est une suite
   * de jetons ; n'en révoquer qu'un laisserait le reste de la chaîne debout.
   */
  async fermer(refreshToken: string): Promise<void> {
    const ligne = await this.prisma.adminRefreshToken.findUnique({
      where: { tokenHash: this.hash(refreshToken) },
    });
    // Se déconnecter d'une session inconnue n'est pas une erreur.
    if (!ligne) return;
    await this.prisma.adminRefreshToken.updateMany({
      where: { familyId: ligne.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

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

  async ouvrir(adminId: string, userAgent?: string): Promise<PaireAdmin> {
    const refreshToken = randomBytes(32).toString("base64url");
    await this.prisma.adminRefreshToken.create({
      data: {
        adminId,
        familyId: randomUUID(),
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

  /** Ferme la session portée par ce jeton de rafraîchissement. */
  async fermer(refreshToken: string): Promise<void> {
    await this.prisma.adminRefreshToken.updateMany({
      where: { tokenHash: this.hash(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import jwt from "jsonwebtoken";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";

const ACCESS_TTL_S = 15 * 60;
const REFRESH_TTL_MS = 60 * 24 * 3_600_000; // soixante jours
// On ne signe qu'en HS256, avec un secret symétrique. jwt.verify accepte par
// défaut n'importe quel algorithme que le jeton déclare lui-même ; épingler
// la liste ferme par construction toute confusion d'algorithme.
const ALGORITHM = "HS256";

export type Pair = { accessToken: string; refreshToken: string; expiresIn: number };

type RotateOutcome = { ok: true; pair: Pair } | { ok: false; reason: "session_expired" | "refresh_reused" };

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject("JWT_SECRET") private readonly secret: string,
  ) {
    if (!secret) throw new Error("JWT_SECRET manquant");
  }

  // Pas de clé ici, à la différence de l'OTP : 256 bits tirés au hasard
  // ne s'énumèrent pas, donc un condensé nu ne donne aucune prise.
  private hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  verifyAccess(token: string): { userId: string } {
    try {
      const payload = jwt.verify(token, this.secret, { algorithms: [ALGORITHM] }) as { sub: string };
      return { userId: payload.sub };
    } catch {
      throw new AppError("session_expired", "access token invalid or expired");
    }
  }

  private async mint(
    userId: string,
    familyId: string,
    parentId: string | null,
    userAgent: string | undefined,
    client: Prisma.TransactionClient | PrismaService,
  ): Promise<Pair> {
    const refreshToken = randomBytes(32).toString("base64url");
    await client.refreshToken.create({
      data: {
        userId, familyId, parentId, tokenHash: this.hash(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        userAgent: userAgent ?? null,
      },
    });
    const accessToken = jwt.sign({ sub: userId }, this.secret, { expiresIn: ACCESS_TTL_S, algorithm: ALGORITHM });
    return { accessToken, refreshToken, expiresIn: ACCESS_TTL_S };
  }

  issuePair(userId: string, userAgent?: string): Promise<Pair> {
    return this.mint(userId, randomUUID(), null, userAgent, this.prisma);
  }

  async rotate(refreshToken: string, userAgent?: string): Promise<Pair> {
    const tokenHash = this.hash(refreshToken);

    // Consommer le jeton présenté, éventuellement révoquer sa lignée, et
    // émettre le suivant doivent se jouer comme un seul geste atomique.
    // Lire puis écrire (l'ancienne version) ne suffit pas : deux rotate()
    // concurrents liraient tous deux consumedAt: null avant que l'un
    // n'écrive, et les deux passeraient — refresh_reused ne serait jamais
    // levé, exactement le scénario que ce mécanisme existe pour intercepter.
    //
    // On consomme donc par un UPDATE conditionnel (WHERE ... consumedAt IS
    // NULL). Postgres verrouille la ligne candidate le temps de la mise à
    // jour ; un second appel concurrent qui la trouve verrouillée attend,
    // puis réévalue le WHERE sur l'état déjà écrit — il perd la course par
    // construction (count === 0 de l'écriture elle-même), jamais par une
    // relecture d'un état devenu périmé entre-temps.
    //
    // Ce verrou de ligne doit rester posé jusqu'à ce que le jeton suivant
    // soit inséré : sinon, un perdant qui détecte le rejeu pourrait
    // committer la révocation de la lignée AVANT que l'enfant du gagnant
    // n'existe, et cet enfant y survivrait — la lignée ne serait pas
    // entièrement tombée. On tient donc toute la séquence (consommation,
    // mint, ou révocation de lignée) dans UNE transaction : le verrou posé
    // par l'UPDATE conditionnel n'est relâché qu'au commit, donc un perdant
    // ne peut lire l'état « déjà consommé » qu'une fois le gagnant
    // entièrement committé, enfant compris.
    //
    // On ne jette aucune AppError depuis l'intérieur de la transaction : un
    // throw y déclenche un rollback, ce qui annulerait la révocation de
    // lignée qu'on veut au contraire faire persister. La transaction rend
    // donc un résultat neutre ; on ne jette qu'après coup, une fois committé.
    const outcome = await this.prisma.$transaction(async (tx): Promise<RotateOutcome> => {
      const { count } = await tx.refreshToken.updateMany({
        where: { tokenHash, consumedAt: null, revokedAt: null },
        data: { consumedAt: new Date() },
      });

      if (count === 0) {
        const row = await tx.refreshToken.findUnique({ where: { tokenHash } });
        if (!row || row.revokedAt) return { ok: false, reason: "session_expired" };
        // La ligne existe, n'est pas révoquée, et l'écriture conditionnelle
        // ci-dessus a échoué : elle était donc déjà consommée. Rejeu détecté
        // — on ne peut pas distinguer le voleur du légitime, la lignée tombe.
        await tx.refreshToken.updateMany({
          where: { familyId: row.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return { ok: false, reason: "refresh_reused" };
      }

      const row = await tx.refreshToken.findUniqueOrThrow({ where: { tokenHash } });
      if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: "session_expired" };

      const pair = await this.mint(row.userId, row.familyId, row.id, userAgent, tx);
      return { ok: true, pair };
    });

    if (!outcome.ok) {
      const message = outcome.reason === "refresh_reused"
        ? "refresh token replayed; family revoked"
        : "refresh token unknown, revoked, or expired";
      throw new AppError(outcome.reason, message);
    }
    return outcome.pair;
  }

  async revokeFamily(refreshToken: string): Promise<void> {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: this.hash(refreshToken) } });
    if (!row) return; // se déconnecter d'une session inconnue n'est pas une erreur
    await this.prisma.refreshToken.updateMany({
      where: { familyId: row.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

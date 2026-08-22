import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import jwt from "jsonwebtoken";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";

const ACCESS_TTL_S = 15 * 60;
const REFRESH_TTL_MS = 60 * 24 * 3_600_000; // soixante jours

export type Pair = { accessToken: string; refreshToken: string; expiresIn: number };

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
      const payload = jwt.verify(token, this.secret) as { sub: string };
      return { userId: payload.sub };
    } catch {
      throw new AppError("session_expired", "access token invalid or expired");
    }
  }

  private async mint(userId: string, familyId: string, parentId: string | null, userAgent?: string): Promise<Pair> {
    const refreshToken = randomBytes(32).toString("base64url");
    await this.prisma.refreshToken.create({
      data: {
        userId, familyId, parentId, tokenHash: this.hash(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        userAgent: userAgent ?? null,
      },
    });
    const accessToken = jwt.sign({ sub: userId }, this.secret, { expiresIn: ACCESS_TTL_S });
    return { accessToken, refreshToken, expiresIn: ACCESS_TTL_S };
  }

  issuePair(userId: string, userAgent?: string): Promise<Pair> {
    return this.mint(userId, randomUUID(), null, userAgent);
  }

  async rotate(refreshToken: string, userAgent?: string): Promise<Pair> {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: this.hash(refreshToken) } });
    if (!row || row.revokedAt) throw new AppError("session_expired", "refresh token unknown or revoked");

    if (row.consumedAt) {
      // Un jeton déjà consommé qui revient : quelqu'un le rejoue. On ne peut pas
      // distinguer le voleur du légitime, donc la lignée entière tombe.
      await this.prisma.refreshToken.updateMany({
        where: { familyId: row.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new AppError("refresh_reused", "refresh token replayed; family revoked");
    }
    if (row.expiresAt.getTime() < Date.now())
      throw new AppError("session_expired", "refresh token expired");

    await this.prisma.refreshToken.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
    return this.mint(row.userId, row.familyId, row.id, userAgent);
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

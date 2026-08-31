import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { OtpReason } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";

const TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const KEY_VERSION = "v1";

@Injectable()
export class OtpService {
  // @Inject(PrismaService) explicite : sous vitest/esbuild, design:paramtypes
  // n'est pas émis (pas de support d'emitDecoratorMetadata), donc un
  // paramètre typé sans jeton explicite se résout à `undefined` chez Nest.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject("OTP_PEPPER") private readonly pepper: string,
  ) {
    if (!pepper) throw new Error("OTP_PEPPER manquant : refuser de démarrer plutôt que de hacher sans clé");
  }

  hash(code: string): string {
    const digest = createHmac("sha256", Buffer.from(this.pepper, "base64")).update(code).digest("base64");
    return `${KEY_VERSION}$${digest}`;
  }

  // Public : le service d'administration compare de la même façon, sur ses
  // propres tables. Deux comparaisons en temps constant écrites deux fois
  // finiraient par diverger, et c'est le genre d'écart qu'on ne voit pas.
  matches(stored: string, candidate: string): boolean {
    const a = Buffer.from(stored);
    const b = Buffer.from(this.hash(candidate));
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async issue(email: string, reason: OtpReason): Promise<{ code: string; expiresAt: Date }> {
    // Une demande neuve annule les précédentes : sinon plusieurs codes vivent
    // en parallèle et le plafond de tentatives se contourne en en demandant un autre.
    await this.prisma.otpCode.updateMany({
      where: { targetEmail: email, reason, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAt = new Date(Date.now() + TTL_MS);
    await this.prisma.otpCode.create({
      data: { targetEmail: email, reason, codeHash: this.hash(code), expiresAt },
    });
    return { code, expiresAt };
  }

  async verify(email: string, reason: OtpReason, code: string): Promise<{ userId: string | null }> {
    const row = await this.prisma.otpCode.findFirst({
      where: { targetEmail: email, reason, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!row) throw new AppError("otp_invalid", "no pending code for this address");
    if (row.attempts >= MAX_ATTEMPTS)
      throw new AppError("otp_too_many_attempts", "code burnt after too many attempts");
    if (row.expiresAt.getTime() < Date.now())
      throw new AppError("otp_expired", "code expired");

    if (!this.matches(row.codeHash, code)) {
      // Incrément conditionnel et atomique : le plafond est revérifié au
      // moment de l'écriture (attempts < MAX_ATTEMPTS dans le WHERE), pas
      // seulement à la lecture d'avant. Sans ça, une rafale de tentatives
      // concurrentes pourrait toutes lire un compteur encore sous le
      // plafond et le dépasser de plusieurs essais avant qu'aucune d'elles
      // n'écrive. Avec la condition, Postgres sérialise les écritures sur
      // la ligne ; une fois le plafond atteint, tout appelant restant se
      // heurte à count === 0 et reçoit otp_too_many_attempts, jamais un
      // dépassement.
      const { count } = await this.prisma.otpCode.updateMany({
        where: { id: row.id, attempts: { lt: MAX_ATTEMPTS } },
        data: { attempts: { increment: 1 } },
      });
      if (count === 0) throw new AppError("otp_too_many_attempts", "code burnt after too many attempts");
      throw new AppError("otp_invalid", "code does not match");
    }

    // Consommation conditionnelle et atomique : deux verify() concurrents
    // avec le même bon code liraient tous deux consumedAt: null avant que
    // l'un n'écrive, et tous deux réussiraient. Le WHERE ... consumedAt:
    // null de cet updateMany est réévalué par Postgres sous verrou de
    // ligne ; un seul appelant peut gagner. Le perdant le sait par
    // count === 0 — pas par une relecture déjà périmée — et est traité
    // comme s'il n'avait jamais trouvé de code en attente.
    //
    // attempts: { lt: MAX_ATTEMPTS } revérifie aussi le plafond au moment
    // d'écrire, pas seulement à la lecture d'avant : sans ça, un bon code lu
    // pendant que le compteur était encore sous le plafond pourrait quand
    // même consommer la ligne si une rafale de mauvais essais concurrents a
    // fait grimper le compteur au plafond entre-temps — un code brûlé ne
    // resterait pas brûlé.
    const { count } = await this.prisma.otpCode.updateMany({
      where: { id: row.id, consumedAt: null, attempts: { lt: MAX_ATTEMPTS } },
      data: { consumedAt: new Date() },
    });
    if (count === 0) {
      // On ne sait pas, sans relire, laquelle des deux conditions a fait
      // échouer l'écriture : la ligne était déjà consommée, ou le plafond a
      // été franchi entre-temps. Cette relecture n'explique qu'un fait déjà
      // acté par l'écriture ci-dessus ; elle ne décide de rien elle-même.
      const fresh = await this.prisma.otpCode.findUnique({ where: { id: row.id } });
      if (fresh && fresh.attempts >= MAX_ATTEMPTS)
        throw new AppError("otp_too_many_attempts", "code burnt after too many attempts");
      throw new AppError("otp_invalid", "code already consumed");
    }

    return { userId: row.userId };
  }
}

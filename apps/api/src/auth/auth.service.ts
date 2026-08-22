import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { OtpService } from "./otp.service.js";
import { TokenService, type Pair } from "./token.service.js";

type VerifyInput = { email: string; code: string; deviceId?: string; userAgent?: string };

@Injectable()
export class AuthService {
  // @Inject explicite sur chaque paramètre typé par une classe : ce projet
  // exécute les tests via esbuild (vitest), qui n'émet pas
  // `design:paramtypes` (pas de support d'`emitDecoratorMetadata`). Sans ce
  // jeton explicite, Nest résout le paramètre à `undefined` au lieu du type
  // — l'injection implicite par type ne survivrait pas au câblage réel.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OtpService) private readonly otp: OtpService,
    @Inject(TokenService) private readonly tokens: TokenService,
  ) {}

  // Rend toujours la même chose : une adresse inconnue ne doit pas se distinguer
  // d'une connue, sinon le point d'entrée énumère les comptes.
  async requestOtp(input: { email: string }): Promise<{ sent: true }> {
    const { code } = await this.otp.issue(input.email, "login");
    // Béquille de développement, à SUPPRIMER par la tâche 17 quand elle branche
    // l'envoi réel. Adhésion explicite plutôt que défaut par omission : une
    // variable absente ne doit jamais faire fuiter un code à usage unique dans
    // un journal (contrainte globale sur le contenu sensible des journaux).
    if (process.env.LEHNO_LOG_OTP === "1") console.log(`[otp] ${input.email} → ${code}`);
    return { sent: true };
  }

  private async paramNumber(key: string, fallback: number): Promise<number> {
    const row = await this.prisma.systemParameter.findUnique({ where: { key } });
    return row ? Number(row.value) : fallback;
  }

  async verifyOtp(input: VerifyInput): Promise<Pair & { isNewAccount: boolean }> {
    try {
      await this.otp.verify(input.email, "login", input.code);
    } catch (e) {
      await this.prisma.loginActivity.create({
        data: { attemptedEmail: input.email, result: "failure", userAgent: input.userAgent ?? null },
      });
      throw e;
    }

    let user = await this.prisma.user.findUnique({ where: { email: input.email } });
    let isNewAccount = false;

    if (!user) {
      if (input.deviceId) {
        const seuil = await this.paramNumber("max_accounts_per_device", 3);
        const déjà = await this.prisma.deviceSignup.count({ where: { deviceId: input.deviceId } });
        // Vérifié AVANT toute création : refuser après aurait laissé un compte orphelin.
        if (déjà >= seuil)
          throw new AppError("device_limit_reached", "too many accounts from this device");
      }
      user = await this.prisma.user.create({
        data: {
          email: input.email,
          emailVerified: true,
          // Pseudo provisoire : l'écran de première connexion en fait choisir un vrai.
          username: `u${randomBytes(4).toString("hex")}`,
          referralCode: randomBytes(6).toString("base64url").slice(0, 8).toUpperCase(),
        },
      });
      isNewAccount = true;
      if (input.deviceId)
        await this.prisma.deviceSignup.create({ data: { deviceId: input.deviceId, userId: user.id } });
    } else if (!user.emailVerified) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    }

    if (user.status === "suspended") throw new AppError("account_suspended", "account suspended");
    if (user.status === "pending_deletion")
      throw new AppError("account_pending_deletion", "account is being deleted");

    await this.prisma.loginActivity.create({
      data: { userId: user.id, attemptedEmail: input.email, result: "success", userAgent: input.userAgent ?? null },
    });
    const pair = await this.tokens.issuePair(user.id, input.userAgent);
    return { ...pair, isNewAccount };
  }
}

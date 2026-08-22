import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { IdentityProvider } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { TokenService, type Pair } from "./token.service.js";
import { AppError } from "../common/errors.js";

export interface IdentityVerifier {
  verify(idToken: string): Promise<{ providerUserId: string; email: string | null; emailVerified: boolean }>;
}

@Injectable()
export class FederatedService {
  // @Inject explicite : voir TokenService/OtpService — sous vitest/esbuild,
  // design:paramtypes n'est pas émis, un paramètre typé sans jeton explicite
  // se résoudrait à `undefined` chez Nest.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject("IDENTITY_VERIFIERS") private readonly verifiers: Record<IdentityProvider, IdentityVerifier>,
  ) {}

  async signIn(input: { provider: IdentityProvider; idToken: string; deviceId?: string }): Promise<Pair & { isNewAccount: boolean }> {
    const claims = await this.verifiers[input.provider].verify(input.idToken).catch(() => {
      throw new AppError("federated_token_invalid", "provider token rejected");
    });

    // D'abord l'identifiant du fournisseur : il est stable, l'adresse ne l'est pas.
    const existing = await this.prisma.federatedIdentity.findUnique({
      where: { provider_providerUserId: { provider: input.provider, providerUserId: claims.providerUserId } },
    });
    if (existing) {
      await this.prisma.federatedIdentity.update({
        where: { id: existing.id }, data: { lastUsedAt: new Date() },
      });
      const pair = await this.tokens.issuePair(existing.userId);
      return { ...pair, isNewAccount: false };
    }

    // Ensuite l'adresse, mais seulement si le fournisseur la dit vérifiée :
    // sinon n'importe qui déclarerait l'adresse d'autrui.
    if (!claims.email || !claims.emailVerified)
      throw new AppError("federated_token_invalid", "provider did not supply a verified email");

    let user = await this.prisma.user.findUnique({ where: { email: claims.email } });
    let isNewAccount = false;
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: claims.email, emailVerified: true,
          username: `u${randomBytes(4).toString("hex")}`,
          referralCode: randomBytes(6).toString("base64url").slice(0, 8).toUpperCase(),
        },
      });
      isNewAccount = true;
      if (input.deviceId)
        await this.prisma.deviceSignup.create({ data: { deviceId: input.deviceId, userId: user.id } });
    }
    if (user.status !== "active") throw new AppError("account_suspended", "account not active");

    await this.prisma.federatedIdentity.create({
      data: {
        userId: user.id, provider: input.provider, providerUserId: claims.providerUserId,
        emailAtLink: claims.email, lastUsedAt: new Date(),
      },
    });
    const pair = await this.tokens.issuePair(user.id);
    return { ...pair, isNewAccount };
  }
}

import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { Prisma, type IdentityProvider, type User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { TokenService, type Pair } from "./token.service.js";
import { AppError } from "../common/errors.js";

export interface IdentityVerifier {
  verify(idToken: string): Promise<{ providerUserId: string; email: string | null; emailVerified: boolean }>;
}

type SignInInput = { provider: IdentityProvider; idToken: string; deviceId?: string; userAgent?: string };

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

  // Revue tour 1, point 3 : un compte suspendu ou en cours de suppression ne
  // doit jamais recevoir de jetons, sur AUCUN chemin de cette voie — la
  // reconnaissance par identité déjà liée y compris, alors même que c'est le
  // chemin le plus emprunté (celui de la reconnexion). Même distinction que
  // AuthService.verifyOtp entre les deux statuts.
  private assertActive(user: Pick<User, "status">): void {
    if (user.status === "suspended") throw new AppError("account_suspended", "account suspended");
    if (user.status === "pending_deletion") throw new AppError("account_pending_deletion", "account is being deleted");
  }

  // Revue tour 1, point 4 : la voie du code à usage unique laisse une trace
  // dans loginActivity à chaque issue ; cette voie doit en faire autant, sous
  // peine d'un angle mort dans les traces de sécurité pour la voie la plus
  // exposée (jeton d'un tiers, pas un secret qu'on émet nous-mêmes).
  private async recordAttempt(
    email: string | null, userAgent: string | undefined, userId: string | null, result: "success" | "failure",
  ): Promise<void> {
    await this.prisma.loginActivity.create({
      data: { userId, attemptedEmail: email, result, userAgent: userAgent ?? null },
    });
  }

  async signIn(input: SignInInput): Promise<Pair & { isNewAccount: boolean }> {
    let claims: { providerUserId: string; email: string | null; emailVerified: boolean };
    try {
      claims = await this.verifiers[input.provider].verify(input.idToken);
    } catch {
      // Un jeton rejeté par le fournisseur laisse une trace comme un code à
      // usage unique invalide en laisse une (voir AuthService.verifyOtp) :
      // sans elle, le tout premier échec de cette voie resterait invisible.
      await this.recordAttempt(null, input.userAgent, null, "failure");
      throw new AppError("federated_token_invalid", "provider token rejected");
    }

    // D'abord l'identifiant du fournisseur : il est stable, l'adresse ne l'est pas.
    const existing = await this.prisma.federatedIdentity.findUnique({
      where: { provider_providerUserId: { provider: input.provider, providerUserId: claims.providerUserId } },
      include: { user: true },
    });
    if (existing) {
      try {
        this.assertActive(existing.user);
      } catch (e) {
        await this.recordAttempt(claims.email, input.userAgent, existing.userId, "failure");
        throw e;
      }
      await this.prisma.federatedIdentity.update({
        where: { id: existing.id }, data: { lastUsedAt: new Date() },
      });
      const pair = await this.tokens.issuePair(existing.userId, input.userAgent);
      await this.recordAttempt(claims.email, input.userAgent, existing.userId, "success");
      return { ...pair, isNewAccount: false };
    }

    // Ensuite l'adresse, mais seulement si le fournisseur la dit vérifiée :
    // sinon n'importe qui déclarerait l'adresse d'autrui.
    if (!claims.email || !claims.emailVerified) {
      await this.recordAttempt(claims.email, input.userAgent, null, "failure");
      throw new AppError("federated_token_invalid", "provider did not supply a verified email");
    }

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
    try {
      this.assertActive(user);
    } catch (e) {
      await this.recordAttempt(claims.email, input.userAgent, user.id, "failure");
      throw e;
    }

    // Revue tour 1, point 6 : `@@unique([userId, provider])` protège le
    // même compte contre deux identités du même fournisseur, mais rien ne le
    // gardait ici — un P2002 remontait tel quel en 500. federated_already_
    // linked existe dans le contrat précisément pour ce cas.
    try {
      await this.prisma.federatedIdentity.create({
        data: {
          userId: user.id, provider: input.provider, providerUserId: claims.providerUserId,
          emailAtLink: claims.email, lastUsedAt: new Date(),
        },
      });
    } catch (e) {
      await this.recordAttempt(claims.email, input.userAgent, user.id, "failure");
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        throw new AppError("federated_already_linked", "account already linked to a provider identity");
      throw e;
    }

    const pair = await this.tokens.issuePair(user.id, input.userAgent);
    await this.recordAttempt(claims.email, input.userAgent, user.id, "success");
    return { ...pair, isNewAccount };
  }
}

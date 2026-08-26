import { Inject, Injectable } from "@nestjs/common";
import { Prisma, type IdentityProvider, type User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { SignupService } from "../onboarding/signup.service.js";
import { TrackingService } from "../tracking/tracking.service.js";
import type { VerifyOutcome } from "@lehno/contracts";
import { TokenService } from "./token.service.js";
import { AppError } from "../common/errors.js";

export interface IdentityVerifier {
  verify(idToken: string): Promise<{ providerUserId: string; email: string | null; emailVerified: boolean }>;
}

type SignInInput = {
  provider: IdentityProvider; idToken: string; deviceId?: string;
  // La §5.1 veut le parrainage sur les trois voies : il manquait ici.
  referralCode?: string;
  userAgent?: string;
  /** L'adresse au moment de la tentative, pour la trace. */
  ip?: string;
};

@Injectable()
export class FederatedService {
  // @Inject explicite : voir TokenService/OtpService — sous vitest/esbuild,
  // design:paramtypes n'est pas émis, un paramètre typé sans jeton explicite
  // se résoudrait à `undefined` chez Nest.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject("IDENTITY_VERIFIERS") private readonly verifiers: Record<IdentityProvider, IdentityVerifier>,
    @Inject(SignupService) private readonly signup: SignupService,
    @Inject(TrackingService) private readonly mesure: TrackingService,
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
    email: string | null, userAgent: string | undefined, userId: string | null,
    result: "success" | "failure", provider: "google" | "apple", ip?: string,
  ): Promise<void> {
    await this.prisma.loginActivity.create({
      data: {
        userId, attemptedEmail: email, result,
        // La voie, et non « externe » : c'est la distinction entre Google et
        // Apple qui permet de voir qu'un seul des deux est en cause.
        method: provider, ip: ip ?? null,
        userAgent: userAgent ?? null,
      },
    });
  }

  async signIn(input: SignInInput): Promise<VerifyOutcome> {
    let claims: { providerUserId: string; email: string | null; emailVerified: boolean };
    try {
      claims = await this.verifiers[input.provider].verify(input.idToken);
    } catch {
      // Un jeton rejeté par le fournisseur laisse une trace comme un code à
      // usage unique invalide en laisse une (voir AuthService.verifyOtp) :
      // sans elle, le tout premier échec de cette voie resterait invisible.
      await this.recordAttempt(null, input.userAgent, null, "failure", input.provider, input.ip);
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
        await this.recordAttempt(claims.email, input.userAgent, existing.userId, "failure", input.provider, input.ip);
        throw e;
      }
      await this.prisma.federatedIdentity.update({
        where: { id: existing.id }, data: { lastUsedAt: new Date() },
      });
      const pair = await this.tokens.issuePair(existing.userId, input.userAgent);
      await this.recordAttempt(claims.email, input.userAgent, existing.userId, "success", input.provider, input.ip);
      // Voir AuthService.verifyOtp : l'identifiant vient d'ici, il ne traverse
      // pas le contrat.
      this.mesure.emettre(existing.userId, "signin.completed", { method: input.provider });
      return { outcome: "session" as const, ...pair, isNewAccount: false };
    }

    // Ensuite l'adresse, mais seulement si le fournisseur la dit vérifiée :
    // sinon n'importe qui déclarerait l'adresse d'autrui.
    if (!claims.email || !claims.emailVerified) {
      await this.recordAttempt(claims.email, input.userAgent, null, "failure", input.provider, input.ip);
      throw new AppError("federated_token_invalid", "provider did not supply a verified email");
    }

    const user = await this.prisma.user.findUnique({ where: { email: claims.email } });
    if (!user) {
      // AUCUN COMPTE N'EST CRÉÉ ICI, comme sur la voie du courriel. La §3.1
      // veut le choix du pseudo « à la première connexion, QUELLE QUE SOIT LA
      // VOIE empruntée » : si Google créait le compte tout de suite, le
      // parcours divergerait selon la porte, et le code de parrainage — saisi
      // à l'écran du pseudo — n'aurait nulle part où aller.
      //
      // Le fournisseur a vérifié l'adresse ; on atteste cette vérification par
      // un jeton d'inscription, et /auth/register fera le reste en une
      // transaction.
      await this.recordAttempt(claims.email, input.userAgent, null, "success", input.provider, input.ip);
      const jeton = this.tokens.issueRegistration(claims.email);
      const deviceLimitReached = input.deviceId
        ? await this.signup.plafondAtteint(input.deviceId)
        : false;

      return {
        outcome: "registration" as const,
        ...jeton,
        email: claims.email,
        deviceLimitReached,
      };
    }

    try {
      this.assertActive(user);
    } catch (e) {
      await this.recordAttempt(claims.email, input.userAgent, user.id, "failure", input.provider, input.ip);
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
      await this.recordAttempt(claims.email, input.userAgent, user.id, "failure", input.provider, input.ip);
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        throw new AppError("federated_already_linked", "account already linked to a provider identity");
      throw e;
    }

    const pair = await this.tokens.issuePair(user.id, input.userAgent);
    await this.recordAttempt(claims.email, input.userAgent, user.id, "success", input.provider, input.ip);
    this.mesure.emettre(user.id, "signin.completed", { method: input.provider });
    return { outcome: "session" as const, ...pair, isNewAccount: false };
  }
}

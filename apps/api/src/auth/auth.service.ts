import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Locale } from "@lehno/i18n";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { RateLimitService } from "../common/rate-limit.service.js";
import { assertUsableEmail, canonicalEmail } from "../common/email.js";
import { OtpService } from "./otp.service.js";
import { TokenService, type Pair } from "./token.service.js";
import { SignupService } from "../onboarding/signup.service.js";
import type { MailPort } from "../mail/mail.port.js";
import { otpEmail } from "../mail/templates.js";

type VerifyInput = {
  email: string; code: string; deviceId?: string;
  // Facultatif, et jeté jusqu'ici : le contrat l'acceptait, le contrôleur ne
  // le transmettait pas, et le filleul perdait son bonus sans qu'aucune
  // erreur ne le dise.
  referralCode?: string;
  userAgent?: string; ip?: string;
};

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
    @Inject(SignupService) private readonly signup: SignupService,
    @Inject(RateLimitService) private readonly limiter: RateLimitService,
    @Inject("MAIL_PORT") private readonly mail: MailPort,
  ) {}

  // La réponse reste la même pour une adresse inconnue : on émet un code et
  // on envoie, que le compte existe ou non — sinon le point d'entrée énumère
  // les comptes.
  async requestOtp(input: { email: string; ip?: string }): Promise<{ sent: true }> {
    // Par destinataire ET par origine : l'un arrête celui qui vise une personne,
    // l'autre celui qui balaie un annuaire.
    //
    // La clé se compose sur la forme canonique de l'adresse, pas sur la
    // saisie. `rate_limit_hit.key` est un varchar ordinaire, pas citext comme
    // `user.email` : sans canonisation, « awa@x.com » et « AWA@X.COM »
    // ouvriraient deux compteurs pour une seule boîte réelle.
    //
    // La casse abaissée seule ne suffisait pas — c'était le défaut trouvé à
    // la revue des surfaces publiques. Une même boîte se laissait arroser en
    // variant l'étiquette après le « + » : cinq courriers par heure et par
    // variante, toutes livrées au même endroit. canonicalEmail ramène
    // « AWA@ », « awa+1@ » et « a.w.a@gmail.com » à un seul compteur (voir
    // common/email.ts et la spécification technique 9.9).
    //
    // Seule la clé est canonisée : la recherche du compte et l'envoi plus bas
    // gardent l'adresse telle qu'elle a été fournie.
    assertUsableEmail(input.email);
    const normalizedEmail = canonicalEmail(input.email);
    await this.limiter.hit(`otp:email:${normalizedEmail}`, 5, 3_600_000);
    if (input.ip) await this.limiter.hit(`otp:ip:${input.ip}`, 20, 3_600_000);

    const { code } = await this.otp.issue(input.email, "login");
    const user = await this.prisma.user.findUnique({
      where: { email: input.email }, select: { uiLanguage: true },
    });
    const locale = (user?.uiLanguage === "en" ? "en" : "fr") as Locale;
    const { subject, text } = otpEmail({ code, locale });
    await this.mail.send({ to: input.email, subject, text, locale });
    return { sent: true };
  }

  private async paramNumber(
    client: PrismaService | Prisma.TransactionClient,
    key: string,
    fallback: number,
  ): Promise<number> {
    const row = await client.systemParameter.findUnique({ where: { key } });
    return row ? Number(row.value) : fallback;
  }

  private randomAccountFields(email: string) {
    return {
      email,
      emailVerified: true,
      // Pseudo provisoire : l'écran de première connexion en fait choisir un vrai.
      username: `u${randomBytes(4).toString("hex")}`,
      referralCode: randomBytes(6).toString("base64url").slice(0, 8).toUpperCase(),
    };
  }

  private async recordAttempt(
    input: VerifyInput,
    userId: string | null,
    result: "success" | "failure",
  ): Promise<void> {
    await this.prisma.loginActivity.create({
      data: { userId, attemptedEmail: input.email, result, userAgent: input.userAgent ?? null },
    });
  }

  async verifyOtp(input: VerifyInput): Promise<Pair & { isNewAccount: boolean }> {
    // Revue tour 2, point 5 : par origine seulement, pas par destinataire —
    // OtpService.verify borne déjà les essais SUR UN CODE DONNÉ (cinq, puis
    // il brûle), mais rien n'empêchait jusqu'ici de balayer des milliers
    // d'adresses à cinq essais chacune depuis une seule origine. Trente par
    // heure laisse largement la place à un usage normal — même partagé
    // (plusieurs personnes derrière la même IP de bureau ou de borne Wi-Fi,
    // chacune avec une faute de frappe ou deux) — tout en rendant un
    // balayage à grande échelle bien trop lent pour valoir le coût.
    if (input.ip) await this.limiter.hit(`otp-verify:ip:${input.ip}`, 30, 3_600_000);

    try {
      await this.otp.verify(input.email, "login", input.code);
    } catch (e) {
      await this.recordAttempt(input, null, "failure");
      throw e;
    }

    // Passé ce point, le code était valide : tout refus qui suit doit laisser
    // une trace comme un succès l'aurait fait, sinon un porteur de code
    // valide peut buter sur ces murs sans qu'il en reste rien (device_limit_
    // reached, account_suspended, account_pending_deletion, et l'identifiant
    // d'appareil manquant ci-dessous).
    let user = await this.prisma.user.findUnique({ where: { email: input.email } });
    let isNewAccount = false;

    if (!user) {
      // deviceId est obligatoire pour CRÉER un compte — inutile pour se
      // connecter à un compte existant, qui n'écrit aucune ligne d'appareil.
      // Sans cette exigence, le plafond par appareil se contournerait en
      // omettant simplement ce champ, facultatif dans le contrat de transport.
      const deviceId = input.deviceId;
      if (!deviceId) {
        await this.recordAttempt(input, null, "failure");
        throw new AppError("validation_failed", "deviceId is required to create an account", {
          deviceId: "required to create an account",
        });
      }

      const creation = await this.signup.creer({
        email: input.email,
        emailVerified: true,
        deviceId,
        referralCode: input.referralCode,
      });
      if (creation.plafondAtteint) {
        await this.recordAttempt(input, null, "failure");
        throw new AppError("device_limit_reached", "too many accounts from this device");
      }
      user = await this.prisma.user.findUniqueOrThrow({ where: { id: creation.user.id } });
      isNewAccount = true;
    } else if (!user.emailVerified) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    }

    if (user.status === "suspended") {
      await this.recordAttempt(input, user.id, "failure");
      throw new AppError("account_suspended", "account suspended");
    }
    if (user.status === "pending_deletion") {
      await this.recordAttempt(input, user.id, "failure");
      throw new AppError("account_pending_deletion", "account is being deleted");
    }

    await this.recordAttempt(input, user.id, "success");
    const pair = await this.tokens.issuePair(user.id, input.userAgent);
    return { ...pair, isNewAccount };
  }
}

import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Locale } from "@lehno/i18n";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { RateLimitService } from "../common/rate-limit.service.js";
import { TrackingService } from "../tracking/tracking.service.js";
import { assertUsableEmail, canonicalEmail } from "../common/email.js";
import { OtpService } from "./otp.service.js";
import { TokenService } from "./token.service.js";
import { SignupService } from "../onboarding/signup.service.js";
import type { MailPort } from "../mail/mail.port.js";
import type { VerifyOutcome, RegisterInput, Registered } from "@lehno/contracts";
import { otpEmail } from "../mail/templates.js";

type VerifyInput = {
  email: string; code: string; deviceId?: string;
  // Facultatif, et jeté jusqu'ici : le contrat l'acceptait, le contrôleur ne
  // le transmettait pas, et le filleul perdait son bonus sans qu'aucune
  // erreur ne le dise.
  referralCode?: string;
  userAgent?: string; ip?: string;
};

/* Le refus qui correspond à un état, nommé une seule fois pour les deux voies —
 * le code à usage unique et l'identité fédérée. Deux tables des mêmes états
 * finiraient par diverger, et c'est exactement ainsi que `deleted` a été oublié
 * d'un côté.
 *
 * `deleted` rend le même code que `pending_deletion`, et ce n'est pas un
 * raccourci : entre le geste d'effacement et le passage de nuit qui vide la
 * ligne, « marqué effacé » et « en cours d'effacement » ne se distinguent pas
 * du dehors. Une fois la ligne vidée, l'adresse ne se trouve plus du tout — et
 * le chemin d'inscription reprend, comme pour une adresse inconnue. C'est ce
 * que l'effacement doit produire. */
export function refusDe(statut: string): AppError {
  if (statut === "suspended") return new AppError("account_suspended", "account suspended");
  return new AppError("account_pending_deletion", "account is being deleted");
}

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
    @Inject(TrackingService) private readonly mesure: TrackingService,
  ) {}

  // La réponse reste la même pour une adresse inconnue : on émet un code et
  // on envoie, que le compte existe ou non — sinon le point d'entrée énumère
  // les comptes.
  async requestOtp(
    input: { email: string; ip?: string },
  ): Promise<{ sent: true; retryAfterSeconds: number }> {
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

    // Trois codes par heure et par boîte, avec un délai croissant entre deux :
    // cinq secondes, puis vingt-cinq, puis cent vingt-cinq. Le plafond arrête
    // celui qui insiste ; le délai arrête le geste réflexe de celui qui ne
    // voit pas le courriel arriver et retape.
    const { retryAfterSeconds } = await this.limiter.hitWithBackoff(
      `otp:email:${normalizedEmail}`,
      { plafond: 3, fenetreMs: 3_600_000, baseSecondes: 5 },
    );

    // Par origine, en plus : le plafond par boîte arrête celui qui vise une
    // personne, celui-ci arrête celui qui balaie un annuaire. Pas de délai
    // croissant ici — plusieurs personnes légitimes partagent une IP de bureau
    // ou de borne Wi-Fi, et les faire attendre l'une pour l'autre serait une
    // panne, pas une protection.
    if (input.ip) await this.limiter.hit(`otp:ip:${input.ip}`, 20, 3_600_000);

    const { code } = await this.otp.issue(input.email, "login");
    const user = await this.prisma.user.findUnique({
      where: { email: input.email }, select: { uiLanguage: true },
    });
    const locale = (user?.uiLanguage === "en" ? "en" : "fr") as Locale;
    const { subject, text } = otpEmail({ code, locale });
    await this.mail.send({ to: input.email, subject, text, locale });

    // Le délai avant la prochaine demande voyage avec la réponse. L'écran du
    // code l'affiche en compte à rebours : sans lui, le client devrait coder
    // la formule de son côté, et deux versions du parc appliqueraient deux
    // règles différentes — celle du serveur restant la seule qui compte.
    return { sent: true, retryAfterSeconds };
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

  // La création du compte, en UN geste. Le jeton d'inscription atteste que
  // l'adresse a été vérifiée ; le pseudo et le code de parrainage arrivent
  // avec lui. Plafond, compte, crédits et parrainage se jouent dans la même
  // transaction — SignupService s'en charge.
  //
  // Pourquoi ici et pas à la vérification : le code de parrainage se saisit à
  // l'écran du pseudo, donc après. Créer d'abord et rattacher ensuite
  // laisserait un compte réclamer un parrainage des mois plus tard.
  async register(input: RegisterInput & { userAgent?: string; ip?: string }): Promise<Registered> {
    const { email } = this.tokens.verifyRegistration(input.registrationToken);

    // Le jeton dit qu'une adresse a été vérifiée, pas qu'elle est libre. Entre
    // la vérification et cet appel, la même adresse a pu s'inscrire par une
    // autre voie — Google, par exemple.
    const deja = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (deja) throw new AppError("conflict", "an account already exists for this email");

    const creation = await this.signup.creer({
      email,
      emailVerified: true,
      deviceId: input.deviceId,
      username: input.username,
      ...(input.referralCode !== undefined ? { referralCode: input.referralCode } : {}),
      ...(input.ip !== undefined ? { ip: input.ip } : {}),
    });

    if (creation.plafondAtteint) {
      await this.prisma.loginActivity.create({
        data: {
          userId: null, attemptedEmail: email, result: "failure",
          method: "otp", ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
        },
      });
      throw new AppError("device_limit_reached", "too many accounts from this device");
    }

    await this.prisma.loginActivity.create({
      data: {
        userId: creation.user.id, attemptedEmail: email, result: "success",
        method: "otp", ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
    const pair = await this.tokens.issuePair(creation.user.id, input.userAgent, input.ip);

    /* Émis ICI et non au contrôleur : `Registered` ne porte pas l'identifiant
       de compte — à dessein, il n'a rien à faire côté client. Or c'est
       l'événement d'activation du produit ; sans identifiant, il ne se recolle
       à aucun parcours ultérieur et l'entonnoir ne dit plus rien. */
    this.mesure.emettre(creation.user.id, "signup.completed", {
      referred: creation.parrainage.etat === "credite",
    });

    // Le DÉTAIL, pas un total : cadeau de bienvenue et bonus de parrainage
    // sont deux gestes distincts, et l'un des deux se mérite. Les confondre
    // dans un solde unique effacerait la raison d'inviter quelqu'un.
    const p = creation.parrainage;
    return {
      outcome: "session" as const,
      ...pair,
      isNewAccount: true as const,
      signupCredits: creation.creditsOfferts,
      // Nul quand la personne n'attendait pas, ou quand le cadeau vaut zéro :
      // dans les deux cas l'écran ne doit rien annoncer.
      waitlistBonus: creation.cadeauAttente && creation.cadeauAttente.credits > 0
        ? creation.cadeauAttente.credits
        : null,
      referral: p.etat === "aucun" ? null : {
        outcome: p.etat === "credite" ? ("credited" as const)
          : p.etat === "soi_meme" ? ("self" as const) : ("unknown" as const),
        inviterUsername: p.etat === "credite" ? p.parrain : null,
        bonusCredits: p.etat === "credite" ? p.bonusFilleul : 0,
      },
    };
  }

  private async recordAttempt(
    input: VerifyInput,
    userId: string | null,
    result: "success" | "failure",
  ): Promise<void> {
    await this.prisma.loginActivity.create({
      data: {
        userId, attemptedEmail: input.email, result,
        method: "otp", ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  }

  async verifyOtp(input: VerifyInput): Promise<VerifyOutcome> {
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
    // Une session ouverte ici est toujours un RETOUR : la première fois passe
    // par /auth/register, qui rend isNewAccount vrai.
    const isNewAccount = false;

    if (!user) {
      // AUCUN COMPTE N'EST CRÉÉ ICI, et c'est le point de tout ce chemin.
      //
      // Le code de parrainage se saisit à l'écran du pseudo, donc APRÈS cette
      // vérification. Créer le compte maintenant et rattacher le parrainage
      // ensuite ouvrirait un chemin pour le réclamer plus tard, sur un compte
      // de six mois — l'unicité sur invited_user_id empêcherait le rejeu, pas
      // l'antériorité. Les deux opérations doivent être atomiques : elles se
      // font donc ensemble, à /auth/register, ou pas du tout.
      //
      // On rend un jeton d'inscription : il atteste que cette adresse a été
      // vérifiée, et rien d'autre. Il n'ouvre aucune ressource.
      await this.recordAttempt(input, null, "success");
      const jeton = this.tokens.issueRegistration(input.email);

      // Indicatif, et volontairement non bloquant : le plafond fait foi à la
      // création, sous verrou. Le rendre dès maintenant évite de faire choisir
      // un pseudo à quelqu'un dont la création sera refusée au bout.
      const deviceLimitReached = input.deviceId
        ? await this.signup.plafondAtteint(input.deviceId)
        : false;

      return {
        outcome: "registration" as const,
        ...jeton,
        email: input.email,
        deviceLimitReached,
      };
    } else if (!user.emailVerified) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    }

    /* REFUS PAR DÉFAUT : seul `active` passe.
     *
     * L'énumération listait trois refus et en oubliait un — `deleted`, qui
     * ouvrait donc une session sur un compte marqué effacé, jusqu'au passage de
     * nuit qui le vide. Écrit ainsi, un état ajouté demain sera refusé tant que
     * personne n'aura décidé de l'admettre. C'est l'inverse de ce qui vient
     * d'arriver, et c'est le seul sens dans lequel un oubli soit sans danger. */
    if (user.status !== "active") {
      await this.recordAttempt(input, user.id, "failure");
      throw refusDe(user.status);
    }

    await this.recordAttempt(input, user.id, "success");
    const pair = await this.tokens.issuePair(user.id, input.userAgent, input.ip);

    /* Émis ICI et non au contrôleur, pour la même raison que signup.completed :
       VerifyOutcome ne porte pas l'identifiant de compte, et il n'a rien à faire
       côté client. Sans lui, une connexion ne se rattache à aucun parcours — et
       la rétention à sept, trente et quatre-vingt-dix jours (§16.1) devient
       incalculable, c'est-à-dire la moitié de ce pour quoi le plan existe. */
    this.mesure.emettre(user.id, "signin.completed", { method: "code" });

    return { outcome: "session" as const, ...pair, isNewAccount };
  }
}

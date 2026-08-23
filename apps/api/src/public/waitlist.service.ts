import { Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { RateLimitService } from "../common/rate-limit.service.js";
import type { MailPort } from "../mail/mail.port.js";
import { waitlistEmail } from "../mail/templates.js";
import type { WaitlistJoinInput } from "@lehno/contracts";

// Plafonds. Trois tentatives par heure sur une même adresse : au-delà, c'est
// un rejeu, pas une hésitation. Dix par heure et par origine : assez pour un
// foyer ou un bureau partagé, trop peu pour peupler une liste de diffusion.
const PLAFOND_ADRESSE = 3;
const PLAFOND_ORIGINE = 10;
const FENETRE_MS = 3_600_000;

@Injectable()
export class WaitlistService {
  private readonly journal = new Logger(WaitlistService.name);

  // @Inject explicites : voir ProfileService, même contrainte esbuild/vitest
  // (pas d'emitDecoratorMetadata).
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RateLimitService) private readonly limiter: RateLimitService,
    @Inject("MAIL_PORT") private readonly mail: MailPort,
  ) {}

  // Idempotent, et muet sur ce qu'il savait déjà : dire « déjà inscrit »
  // ferait de ce point d'entrée un test d'appartenance.
  //
  // `ip` ne figure pas dans le contrat, qui est en .strict() : elle vient de
  // la connexion, jamais du corps. Un client qui l'annoncerait lui-même
  // choisirait son propre plafond.
  async join(input: WaitlistJoinInput & { ip?: string }): Promise<{ joined: true }> {
    // `email` est en citext côté base (voir waitlist_signup) : deux casses
    // désignent la même ligne. La clé du limiteur, elle, est une chaîne
    // ordinaire — sans cette normalisation, « AWA@ » et « awa@ » compteraient
    // séparément et le plafond par adresse se contournerait par la touche
    // majuscule. Même défaut déjà corrigé sur le code à usage unique.
    const adresse = input.email.toLowerCase();
    await this.limiter.hit(`waitlist:email:${adresse}`, PLAFOND_ADRESSE, FENETRE_MS);
    if (input.ip) await this.limiter.hit(`waitlist:ip:${input.ip}`, PLAFOND_ORIGINE, FENETRE_MS);

    const locale = input.locale ?? "fr";

    // `create` plutôt qu'`upsert` : il faut distinguer la première inscription
    // d'un rejeu pour n'envoyer qu'une confirmation. La violation d'unicité
    // (P2002) est la réponse de la base, donc elle tranche sans course — là
    // où un findFirst suivi d'un create laisserait deux appels simultanés
    // envoyer deux courriels.
    try {
      await this.prisma.waitlistSignup.create({
        data: { email: input.email, locale: input.locale ?? null, source: input.source ?? null },
      });
    } catch (erreur) {
      if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === "P2002") {
        return { joined: true };
      }
      throw erreur;
    }

    // L'adresse capturée vaut plus que la confirmation : une panne
    // d'acheminement ne doit ni perdre l'inscription, ni faire échouer
    // l'appel. On journalise sans l'adresse — le journal n'est pas une copie
    // de la liste.
    const gabarit = waitlistEmail({ locale });
    try {
      await this.mail.send({ to: input.email, locale, ...gabarit });
    } catch (erreur) {
      this.journal.warn(
        `confirmation de liste d'attente non acheminée : ${erreur instanceof Error ? erreur.message : "cause inconnue"}`,
      );
    }

    return { joined: true };
  }
}

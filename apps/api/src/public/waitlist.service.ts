import { Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { RateLimitService } from "../common/rate-limit.service.js";
import { assertUsableEmail, canonicalEmail } from "../common/email.js";
import { AppError } from "../common/errors.js";
import type { MailPort } from "../mail/mail.port.js";
import { waitlistEmail } from "../mail/templates.js";
import type { WaitlistJoinInput } from "@lehno/contracts";

// Plafonds. Cinq tentatives par heure sur une même boîte : trois était trop
// serré pour un geste aussi anodin — quelqu'un qui hésite et clique quatre
// fois tombait sur une erreur. Cinq reste très loin de ce qu'il faut pour
// bombarder une adresse. Dix par heure et par origine : assez pour un foyer ou
// un bureau partagé, trop peu pour peupler une liste de diffusion.
const PLAFOND_ADRESSE = 5;
const PLAFOND_ORIGINE = 10;
const FENETRE_MS = 3_600_000;

// Bornes de la soumission. En deçà d'une seconde, personne n'a lu la page ni
// tapé son adresse. Au-delà d'un jour, la page traînait ouverte — ou l'instant
// a été inventé.
const DELAI_MINIMAL_MS = 1_000;
const DELAI_MAXIMAL_MS = 24 * 3_600_000;

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
    this.refuserLesRobots(input);
    assertUsableEmail(input.email);

    // La forme canonique porte à la fois la clé du limiteur et l'unicité en
    // base : « AWA@ », « awa+1@ » et « a.w.a@gmail.com » désignent une seule
    // boîte, donc un seul compteur et une seule ligne. Sans elle, le plafond
    // se contourne d'une majuscule et la liste se gonfle d'un suffixe.
    const canonique = canonicalEmail(input.email);
    await this.limiter.hit(`waitlist:email:${canonique}`, PLAFOND_ADRESSE, FENETRE_MS);
    if (input.ip) await this.limiter.hit(`waitlist:ip:${input.ip}`, PLAFOND_ORIGINE, FENETRE_MS);

    const locale = input.locale ?? "fr";

    // `create` plutôt qu'`upsert` : il faut distinguer la première inscription
    // d'un rejeu pour n'envoyer qu'une confirmation. La violation d'unicité
    // (P2002) est la réponse de la base, donc elle tranche sans course — là
    // où un findFirst suivi d'un create laisserait deux appels simultanés
    // envoyer deux courriels.
    try {
      await this.prisma.waitlistSignup.create({
        data: {
          email: input.email,
          emailCanonical: canonique,
          locale: input.locale ?? null,
          source: input.source ?? null,
        },
      });
    } catch (erreur) {
      if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === "P2002") {
        // Quelqu'un qui revient est une bonne nouvelle : on veut la voir
        // passer. Sans l'adresse — le journal n'est pas une copie de la liste,
        // et la même règle vaut ici que pour les échecs d'acheminement.
        this.journal.log("liste d'attente : seconde tentative sur une boîte déjà inscrite");
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

  // Deux filtres à robots ordinaires, l'un et l'autre franchissables par qui
  // s'en donne la peine — ce sont des économies de bruit, pas des remparts.
  // Le rempart, ce sont les plafonds ci-dessus, qui ne dépendent d'aucune
  // coopération du client.
  //
  // Le refus emprunte un seul code ET un seul message : `AppError.toEnvelope`
  // renvoie le message au client tel quel, donc deux libellés distincts
  // diraient au robot lequel des deux filtres a mordu — et il s'ajusterait.
  // La distinction n'existe que dans le journal, où elle sert au diagnostic.
  private refuserLesRobots(input: WaitlistJoinInput): void {
    const refuser = (cause: string): never => {
      this.journal.warn(`soumission écartée : ${cause}`);
      throw new AppError("waitlist_rejected", "submission rejected");
    };

    if (input.website !== undefined && input.website !== "") refuser("champ leurre rempli");
    if (input.renderedAt !== undefined) {
      const ecoule = Date.now() - input.renderedAt;
      if (ecoule < DELAI_MINIMAL_MS || ecoule > DELAI_MAXIMAL_MS) {
        refuser(`délai de soumission invraisemblable (${ecoule} ms)`);
      }
    }
  }
}

import { Inject, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { RateLimitService } from "../common/rate-limit.service.js";
import { assertUsableEmail, canonicalEmail } from "../common/email.js";
import { AppError } from "../common/errors.js";
import type { MailPort } from "../mail/mail.port.js";
import { contactConfirmationEmail, contactTeamEmail } from "../mail/templates.js";
import type { ContactSendInput } from "@lehno/contracts";

// Plafonds. Un formulaire de contact est plus rare qu'une inscription à la
// liste d'attente (WaitlistService), mais une même personne peut légitimement
// écrire deux fois — une précision oubliée, une réponse qui se perd. Trois
// par heure sur une même boîte laisse cette marge ; au-delà, c'est un rejeu.
// Cinq par heure et par origine : moins que la liste d'attente (dix), parce
// qu'écrire est un geste plus rare que s'inscrire, mais assez pour un foyer
// ou un bureau partagé qui s'y met à plusieurs.
const PLAFOND_ADRESSE = 3;
const PLAFOND_ORIGINE = 5;
const FENETRE_MS = 3_600_000;

// Bornes de la soumission — même raisonnement qu'au formulaire de liste
// d'attente (WaitlistService) : en deçà d'une seconde, personne n'a lu la
// page ni tapé son message ; au-delà d'un jour, la page traînait ouverte ou
// l'instant a été inventé.
const DELAI_MINIMAL_MS = 1_000;
const DELAI_MAXIMAL_MS = 24 * 3_600_000;

@Injectable()
export class ContactService {
  private readonly journal = new Logger(ContactService.name);

  // @Inject explicites : voir WaitlistService, même contrainte esbuild/vitest
  // (pas d'emitDecoratorMetadata). `to` est l'adresse de destination pour
  // l'équipe — posée par CONTACT_TO_EMAIL (voir app.module.ts), avec un
  // repli documenté si la variable est absente.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RateLimitService) private readonly limiter: RateLimitService,
    @Inject("MAIL_PORT") private readonly mail: MailPort,
    @Inject("CONTACT_TO_EMAIL") private readonly to: string,
  ) {}

  // `ip` ne figure pas dans le contrat, qui est en .strict() : elle vient de
  // la connexion, jamais du corps (voir ContactController).
  async send(input: ContactSendInput & { ip?: string }): Promise<{ sent: true }> {
    this.refuserLesRobots(input);
    assertUsableEmail(input.email);

    const canonique = canonicalEmail(input.email);
    await this.limiter.hit(`contact:email:${canonique}`, PLAFOND_ADRESSE, FENETRE_MS);
    if (input.ip) await this.limiter.hit(`contact:ip:${input.ip}`, PLAFOND_ORIGINE, FENETRE_MS);

    const locale = input.locale ?? "fr";

    // Contrairement à WaitlistService, rien d'autre ne porte ce message :
    // il est écrit en base AVANT toute tentative d'envoi. Si le courriel
    // vers l'équipe échoue plus bas, cette ligne est ce qui empêche sa perte
    // pure et simple — l'équipe le retrouvera dans la table le temps que
    // l'incident d'acheminement se résolve.
    await this.prisma.contactMessage.create({
      data: {
        name: input.name,
        email: input.email,
        subject: input.subject,
        message: input.message,
        locale,
      },
    });

    const gabaritEquipe = contactTeamEmail({
      name: input.name, email: input.email, subject: input.subject, message: input.message, locale,
    });
    try {
      await this.mail.send({ to: this.to, locale, ...gabaritEquipe });
    } catch (erreur) {
      // Sévérité `error`, pas `warn` : contrairement à l'accusé de réception
      // ci-dessous, cette panne retarde la lecture du message par l'équipe.
      // Le message reste néanmoins en base (voir ci-dessus) — ce n'est donc
      // qu'un retard, jamais une perte.
      this.journal.error(
        `acheminement vers l'équipe en échec, message conservé en base : ${erreur instanceof Error ? erreur.message : "cause inconnue"}`,
      );
    }

    const gabaritAccuse = contactConfirmationEmail({ locale });
    try {
      await this.mail.send({ to: input.email, locale, ...gabaritAccuse });
    } catch (erreur) {
      this.journal.warn(
        `accusé de réception non acheminé : ${erreur instanceof Error ? erreur.message : "cause inconnue"}`,
      );
    }

    return { sent: true };
  }

  // Deux filtres à robots ordinaires — même logique que WaitlistService : un
  // seul code ET un seul message, pour que le refus ne dise pas au robot
  // lequel des deux a mordu.
  private refuserLesRobots(input: ContactSendInput): void {
    const refuser = (cause: string): never => {
      this.journal.warn(`soumission écartée : ${cause}`);
      throw new AppError("contact_rejected", "submission rejected");
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

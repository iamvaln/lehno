import { Inject, Injectable } from "@nestjs/common";
import type {
  CreateEventInput, UpdateEventInput, ListEventsQuery, Event as EventContrat,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantRepository } from "../tenancy/tenant.repository.js";
import { AppError } from "../common/errors.js";
import { echeances, type Regle } from "./calendrier.js";

// Un anniversaire se répète tous les ans. C'est la règle par défaut, et la
// seule que la saisie propose aujourd'hui — les récurrences libres viendront
// avec l'écran qui les compose.
const TOUS_LES_ANS: Regle = { unite: "year", pas: 1 };

@Injectable()
export class EventService {
  // @Inject explicite : voir PersonService, même contrainte esbuild/vitest.
  constructor(
    @Inject(TenantRepository) private readonly depot: TenantRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  // « Aujourd'hui » en date civile. Le fuseau de l'utilisateur affinera ce
  // calcul quand les préférences le porteront ; en attendant, la date du
  // serveur, exprimée en chaîne pour ne jamais entrer dans un objet Date.
  private aujourdhui(): string {
    return new Date().toISOString().slice(0, 10);
  }

  async list(userId: string, query: ListEventsQuery = {}): Promise<EventContrat[]> {
    // findOrThrow d'abord quand un proche est visé : une liste vide dirait « ce
    // proche existe et n'a pas d'événement », alors qu'il peut être à un autre
    // compte. Le filtre deviendrait un oracle d'identifiants.
    if (query.personId !== undefined) {
      await this.depot.persons(userId).findOrThrow(query.personId);
    }
    const where = query.personId !== undefined ? { personId: query.personId } : {};
    return (await this.depot.events(userId).findMany(where)).map(rendre);
  }

  async get(userId: string, id: string): Promise<EventContrat> {
    return rendre(await this.depot.events(userId).findOrThrow(id));
  }

  async create(userId: string, input: CreateEventInput): Promise<EventContrat> {
    // findOrThrow d'abord : rattacher un événement au proche d'un autre doit
    // échouer AVANT toute écriture, et rendre 404 plutôt que 403.
    const proche = await this.depot.persons(userId).findOrThrow(input.personId);

    // L'ancrage : pour un anniversaire, il se CALCULE depuis la naissance du
    // proche — la prochaine échéance, jamais la naissance elle-même. Pour tout
    // autre événement, il vient de la saisie, et le contrat garantit déjà
    // qu'il est à venir.
    //
    // Un proche sans date de naissance ne peut pas avoir d'anniversaire : lui
    // en créer un donnerait une échéance qui ne tombe jamais, et une fiche qui
    // annonce une date qu'elle ne connaît pas.
    let ancrage: string;
    if (input.kind === "birthday") {
      const naissance = (proche as { birthDate: Date | null }).birthDate;
      if (!naissance) {
        throw new AppError(
          "validation_failed",
          "this person has no birth date",
          { birthDate: "required on the person to create a birthday" },
        );
      }
      ancrage = this.prochaineDepuisNaissance(iso(naissance));
    } else {
      ancrage = input.referenceDate!;
    }

    // « Proche déjà porteur d'un anniversaire : l'application le signale plutôt
    // que d'en créer un second » (§3.6). La règle se tient ICI : un client qui
    // l'oublie ne doit pas pouvoir en créer deux, sinon la fiche affiche deux
    // anniversaires et les rappels partent en double. Les événements libres,
    // eux, se cumulent — une même personne a un mariage et une crémaillère.
    //
    // Requête directe hors du dépôt : `personId` est déjà éprouvé au demandeur
    // par le `findOrThrow` ci-dessus, ce n'est donc pas une lecture hors
    // périmètre — seulement une règle métier sur une ressource déjà vérifiée.
    if (input.kind === "birthday") {
      const deja = await this.prisma.event.findFirst({
        where: { personId: input.personId, kind: "birthday" }, select: { id: true },
      });
      if (deja) throw new AppError("conflict", "this person already has a birthday");
    }

    // Un anniversaire se répète chaque année sans qu'on le demande : c'est ce
    // que le formulaire annonce. Les autres événements portent les règles
    // qu'on leur a composées, et ils peuvent en avoir plusieurs — « un mois
    // puis trois mois après une date » (§3.6).
    const regles = input.schedules ?? (
      input.kind === "birthday"
        ? [{ type: "recurrent" as const, unit: "year" as const, interval: 1 }]
        : []
    );

    const ligne = await this.prisma.event.create({
      data: {
        personId: input.personId,
        authorUserId: userId,
        kind: input.kind,
        label: input.label ?? null,
        eventNature: input.nature ?? "happy",
        referenceDate: new Date(`${ancrage}T00:00:00Z`),
        schedules: {
          create: regles.map((r) => ({
            type: r.type,
            unit: r.unit ?? null,
            interval: r.interval ?? null,
            offsetUnit: r.offsetUnit ?? null,
            offsetAmount: r.offsetAmount ?? null,
            leadTimeDays: r.leadTimeDays ?? null,
          })),
        },
      },
    });

    await this.ouvrirProchaine(userId, ligne.id, ancrage);
    return rendre(ligne);
  }

  async update(userId: string, id: string, input: UpdateEventInput): Promise<EventContrat> {
    const avant = await this.depot.events(userId).findOrThrow(id);
    const data: Record<string, unknown> = {};
    if (input.label !== undefined) data["label"] = input.label;
    if (input.kind !== undefined) data["kind"] = input.kind;
    if (input.nature !== undefined) data["eventNature"] = input.nature;
    if (input.referenceDate !== undefined)
      data["referenceDate"] = new Date(`${input.referenceDate}T00:00:00Z`);

    const apres = await this.depot.events(userId).updateOrThrow(id, data as never);

    // La date a bougé : l'échéance ouverte ne vaut plus. La laisser
    // afficherait deux anniversaires pour la même personne.
    //
    // Le même recalage vaut quand c'est la NAISSANCE du proche qui change :
    // PersonService.update appelle alors `recalerAnniversaire` ci-dessous.
    // Sans cela, la fiche annoncerait l'ancienne date jusqu'au jour dit — et
    // personne ne s'en aperçoit avant.
    if (input.referenceDate !== undefined && input.referenceDate !== iso(avant.referenceDate)) {
      await this.prisma.eventOccurrence.deleteMany({ where: { eventId: id, status: "upcoming" } });
      await this.ouvrirProchaine(userId, id, input.referenceDate);
    }
    return rendre(apres);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.depot.events(userId).deleteOrThrow(id);
  }

  // Appelé par PersonService.update quand la naissance du proche change. Un
  // proche n'a qu'un anniversaire (§3.6) : s'il en porte un, son ancrage doit
  // suivre la nouvelle naissance — sans quoi la fiche annoncerait l'ancienne
  // date jusqu'au jour dit, et personne ne s'en aperçoit avant.
  //
  // Silencieux si ce proche n'a pas d'anniversaire : rien à recaler.
  async recalerAnniversaire(userId: string, personId: string, naissance: string): Promise<void> {
    const [anniversaire] = await this.depot.events(userId).findMany({ personId, kind: "birthday" });
    if (!anniversaire) return;
    const prochaine = this.prochaineDepuisNaissance(naissance);
    // Réutilise `update`, qui porte déjà la comparaison avant/après et le
    // recalage de l'occurrence ouverte — deux chemins vers la même écriture
    // finiraient par diverger.
    await this.update(userId, anniversaire.id, { referenceDate: prochaine });
  }

  // La PROCHAINE échéance annuelle depuis une date de naissance — jamais la
  // naissance elle-même. Partagé entre `create` et `recalerAnniversaire` pour
  // qu'un seul calcul décide de ce qu'« anniversaire » signifie.
  private prochaineDepuisNaissance(naissance: string): string {
    const [prochaine] = echeances(naissance, TOUS_LES_ANS, this.aujourdhui(), 1);
    return prochaine!;
  }

  // L'occurrence naît AVEC l'événement. Sans elle, un anniversaire saisi
  // n'apparaîtrait nulle part avant qu'un traitement programmé ne passe, et
  // l'utilisateur croirait sa saisie perdue.
  private async ouvrirProchaine(userId: string, eventId: string, reference: string): Promise<void> {
    const [prochaine] = echeances(reference, TOUS_LES_ANS, this.aujourdhui(), 1);
    if (!prochaine) return;
    await this.prisma.eventOccurrence.create({
      data: {
        eventId, userId,
        occurrenceDate: new Date(`${prochaine}T00:00:00Z`),
        occurrenceYear: Number(prochaine.slice(0, 4)),
      },
    });
  }
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rendre(e: {
  id: string; personId: string; label: string | null; kind: string;
  eventNature: string; referenceDate: Date;
}): EventContrat {
  return {
    id: e.id,
    personId: e.personId,
    label: e.label,
    kind: e.kind as EventContrat["kind"],
    nature: e.eventNature as EventContrat["nature"],
    referenceDate: iso(e.referenceDate),
  };
}

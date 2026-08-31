import { Inject, Injectable } from "@nestjs/common";
import type {
  CreateEventInput, UpdateEventInput, ListEventsQuery, Event as EventContrat,
  Schedule as ScheduleContrat,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantRepository } from "../tenancy/tenant.repository.js";
import { FlagsService } from "../flags/flags.service.js";
import { AppError } from "../common/errors.js";
import { ajouterJours, ajouterMois, echeances, type Regle, type UniteRegle } from "./calendrier.js";

// Un anniversaire se répète tous les ans. C'est la règle par défaut d'un
// anniversaire créé sans qu'on la compose — voir `create`.
const TOUS_LES_ANS: Regle = { unite: "year", pas: 1 };

@Injectable()
export class EventService {
  // @Inject explicite : voir PersonService, même contrainte esbuild/vitest.
  constructor(
    @Inject(TenantRepository) private readonly depot: TenantRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FlagsService) private readonly flags: FlagsService,
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
    const lignes = await this.depot.events(userId).findMany(where);

    // Une seule requête pour toutes les règles plutôt qu'une par événement :
    // sur l'annuaire complet, N+1 requêtes coûteraient cher pour rien.
    const toutes = await this.prisma.schedule.findMany({
      where: { eventId: { in: lignes.map((l) => l.id) } },
    });
    const parEvenement = new Map<string, typeof toutes>();
    for (const r of toutes) {
      const liste = parEvenement.get(r.eventId) ?? [];
      liste.push(r);
      parEvenement.set(r.eventId, liste);
    }
    return lignes.map((l) => rendre(l, (parEvenement.get(l.id) ?? []).map(versSchedule)));
  }

  async get(userId: string, id: string): Promise<EventContrat> {
    const ligne = await this.depot.events(userId).findOrThrow(id);
    const regles = await this.prisma.schedule.findMany({ where: { eventId: id } });
    return rendre(ligne, regles.map(versSchedule));
  }

  async create(userId: string, input: CreateEventInput): Promise<EventContrat> {
    /* Le drapeau garde la CRÉATION d'un type autre qu'anniversaire.
     *
     * 422 et non 404 : les autres drapeaux ferment des CHEMINS, et un 404 y
     * cache l'existence de la surface. Ici le chemin existe — les
     * anniversaires l'empruntent —, donc rien n'est à cacher. La requête est
     * bien formée, c'est la règle qui ne l'est pas.
     *
     * Et c'est bien le SERVEUR qui refuse, pas seulement `/me/metadata` qui
     * omet le type : un client d'une version antérieure, ou qui n'a pas relu
     * ses métadonnées, ne doit pas pouvoir créer ce qu'on a fermé. */
    if (input.kind !== "birthday" && !(await this.flags.estActif("events.other"))) {
      throw new AppError(
        "resource_inactive",
        "other event kinds are closed",
        { kind: input.kind },
      );
    }

    // findOrThrow ensuite : rattacher un événement au proche d'un autre doit
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
    return rendre(ligne, regles);
  }

  async update(userId: string, id: string, input: UpdateEventInput): Promise<EventContrat> {
    const avant = await this.depot.events(userId).findOrThrow(id);
    const data: Record<string, unknown> = {};
    if (input.label !== undefined) data["label"] = input.label;
    if (input.kind !== undefined) data["kind"] = input.kind;
    if (input.nature !== undefined) data["eventNature"] = input.nature;
    if (input.referenceDate !== undefined)
      data["referenceDate"] = new Date(`${input.referenceDate}T00:00:00Z`);

    // `schedules` seul est un correctif valide (`updateEventSchema` l'accepte
    // au titre du « au moins un champ ») mais ne touche AUCUNE colonne de
    // `event` : un `updateMany` à `data` vide n'a rien à faire matcher, la
    // ligne déjà trouvée par `findOrThrow` ci-dessus fait donc l'affaire.
    const apres = Object.keys(data).length > 0
      ? await this.depot.events(userId).updateOrThrow(id, data as never)
      : avant;

    // `schedules`, fourni, REMPLACE le jeu de règles en entier — jamais un
    // patch règle par règle. Voir le commentaire d'`updateEventSchema` : c'est
    // ce qui empêche une règle retirée à l'écran de survivre en silence.
    if (input.schedules !== undefined) {
      await this.remplacerRegles(id, input.schedules);
    }

    // La date a bougé : l'échéance ouverte ne vaut plus. La laisser
    // afficherait deux anniversaires pour la même personne.
    //
    // Le même recalage vaut quand c'est la NAISSANCE du proche qui change :
    // PersonService.update appelle alors `recalerAnniversaire` ci-dessous.
    // Sans cela, la fiche annoncerait l'ancienne date jusqu'au jour dit — et
    // personne ne s'en aperçoit avant.
    //
    // Et quand ce sont les RÈGLES qui changent, l'échéance déjà ouverte peut
    // avoir été calculée d'une manière que le nouveau jeu ne produirait plus
    // — la laisser en l'état afficherait une échéance que plus aucune règle
    // n'explique.
    const dateChangee = input.referenceDate !== undefined
      && input.referenceDate !== iso(avant.referenceDate);
    if (dateChangee || input.schedules !== undefined) {
      await this.prisma.eventOccurrence.deleteMany({ where: { eventId: id, status: "upcoming" } });
      await this.ouvrirProchaine(userId, id, input.referenceDate ?? iso(apres.referenceDate));
    }

    const regles = await this.prisma.schedule.findMany({ where: { eventId: id } });
    return rendre(apres, regles.map(versSchedule));
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

  // Remplace le jeu de règles en entier — jamais un patch règle par règle.
  // Voir le commentaire d'`updateEventSchema` : composer, à l'écran, un
  // ensemble cohérent règle par règle exigerait un identifiant stable par
  // règle, et une suppression oubliée laisserait une ancienne règle vivre en
  // silence à côté des nouvelles. Supprimer-puis-recréer rend ça impossible :
  // ce qui reste après l'appel est toujours exactement ce qui a été fourni.
  private async remplacerRegles(eventId: string, regles: readonly ScheduleContrat[]): Promise<void> {
    await this.prisma.schedule.deleteMany({ where: { eventId } });
    if (regles.length === 0) return;
    await this.prisma.schedule.createMany({
      data: regles.map((r) => ({
        eventId,
        type: r.type,
        unit: r.unit ?? null,
        interval: r.interval ?? null,
        offsetUnit: r.offsetUnit ?? null,
        offsetAmount: r.offsetAmount ?? null,
        leadTimeDays: r.leadTimeDays ?? null,
      })),
    });
  }

  // L'occurrence naît AVEC l'événement. Sans elle, un anniversaire saisi
  // n'apparaîtrait nulle part avant qu'un traitement programmé ne passe, et
  // l'utilisateur croirait sa saisie perdue.
  //
  // OUVRE UNE ÉCHÉANCE PAR RÈGLE ENREGISTRÉE, jamais une seule pour
  // l'événement : une règle `offset` n'a de sens que si plusieurs coexistent
  // — « un mois puis trois mois après une date » (§3.6) sont bien DEUX
  // échéances, pas une. Sans règle du tout (un événement libre tout simple),
  // la référence elle-même tient lieu d'unique échéance : rien à composer
  // pour le cas ordinaire, comme le formulaire l'annonce.
  //
  // Ne construit qu'un jeu d'échéances upcoming, pas la suite dans le temps :
  // rouvrir la PROCHAINE quand celle-ci se ferme est le travail de
  // l'ordonnanceur, pas de celui-ci.
  private async ouvrirProchaine(userId: string, eventId: string, reference: string): Promise<void> {
    const regles = await this.prisma.schedule.findMany({ where: { eventId } });
    const depuis = this.aujourdhui();

    // Un Set : deux règles pourraient, par coïncidence, retomber sur la même
    // date — la contrainte d'unicité (eventId, occurrenceDate) refuserait la
    // seconde écriture sinon.
    const dates = new Set<string>();

    if (regles.length === 0) {
      if (reference >= depuis) dates.add(reference);
    } else {
      for (const r of regles) {
        if (r.type === "recurrent") {
          // `unit` et `interval` sont garantis par `scheduleSchema.superRefine`
          // pour une règle recurrent — non-nuls en base pour ce type-là.
          const regle: Regle = { unite: r.unit as UniteRegle, pas: r.interval! };
          const [prochaine] = echeances(reference, regle, depuis, 1);
          if (prochaine) dates.add(prochaine);
        } else {
          // offset : un POINT FIXE après la référence, pas une série — d'où
          // `ajouterJours`/`ajouterMois` directement, et non `echeances()` qui
          // ne sert qu'aux récurrences périodiques.
          const decalee = r.offsetUnit === "day"
            ? ajouterJours(reference, r.offsetAmount!)
            : ajouterMois(reference, r.offsetAmount!);
          if (decalee >= depuis) dates.add(decalee);
        }
      }
    }

    for (const date of dates) {
      await this.prisma.eventOccurrence.create({
        data: {
          eventId, userId,
          occurrenceDate: new Date(`${date}T00:00:00Z`),
          occurrenceYear: Number(date.slice(0, 4)),
        },
      });
    }
  }
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rendre(e: {
  id: string; personId: string; label: string | null; kind: string;
  eventNature: string; referenceDate: Date;
}, regles: readonly ScheduleContrat[]): EventContrat {
  return {
    id: e.id,
    personId: e.personId,
    label: e.label,
    kind: e.kind as EventContrat["kind"],
    nature: e.eventNature as EventContrat["nature"],
    referenceDate: iso(e.referenceDate),
    schedules: [...regles],
  };
}

// Une ligne `schedule` de la base porte des colonnes nulles pour l'autre
// type de règle (voir le schéma : une règle est récurrente OU décalée). Le
// contrat, lui, les veut ABSENTES et non nulles — `scheduleSchema` n'a pas de
// `.nullable()`, seulement des `.optional()`.
function versSchedule(r: {
  type: string; unit: string | null; interval: number | null;
  offsetUnit: string | null; offsetAmount: number | null; leadTimeDays: number | null;
}): ScheduleContrat {
  return {
    type: r.type as ScheduleContrat["type"],
    unit: r.unit === null ? undefined : (r.unit as ScheduleContrat["unit"]),
    interval: r.interval ?? undefined,
    offsetUnit: r.offsetUnit === null ? undefined : (r.offsetUnit as ScheduleContrat["offsetUnit"]),
    offsetAmount: r.offsetAmount ?? undefined,
    leadTimeDays: r.leadTimeDays ?? undefined,
  };
}

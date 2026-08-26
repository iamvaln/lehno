import { Inject, Injectable } from "@nestjs/common";
import type { ListOccurrencesQuery, Occurrence } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantRepository } from "../tenancy/tenant.repository.js";
import { ajouterJours } from "./calendrier.js";

// Défauts du dictionnaire, employés si system_parameter ne les porte pas.
const FENETRE_AVANT = 7;
const FENETRE_APRES = 30;
// L'écran Dates montre un mois ; sans plafond explicite, on borne large plutôt
// que de rendre l'historique entier à un client qui n'en veut pas.
const PLAFOND_DEFAUT = 50;

type LigneJointe = {
  id: string; eventId: string; occurrenceDate: Date; occurrenceYear: number | null;
  event: {
    kind: string; eventNature: string; label: string | null;
    referenceDate: Date;
    person: { id: string; displayName: string; birthDate: Date | null; birthYearKnown: boolean };
  };
};

@Injectable()
export class OccurrenceService {
  // @Inject explicite : voir EventService/PersonService, même contrainte
  // esbuild/vitest — design:paramtypes n'est pas émis, un paramètre typé sans
  // jeton explicite se résoudrait à `undefined` chez Nest.
  constructor(
    @Inject(TenantRepository) private readonly depot: TenantRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  private aujourdhui(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private async fenetre(): Promise<[number, number]> {
    const lignes = await this.prisma.systemParameter.findMany({
      where: { key: { in: ["wish_window_lead_days", "wish_window_trail_days"] } },
    });
    const lire = (cle: string, defaut: number): number => {
      const l = lignes.find((x) => x.key === cle);
      return l ? Number(l.value) : defaut;
    };
    return [lire("wish_window_lead_days", FENETRE_AVANT), lire("wish_window_trail_days", FENETRE_APRES)];
  }

  async list(userId: string, query: ListOccurrencesQuery): Promise<Occurrence[]> {
    const depuis = query.from ?? this.aujourdhui();
    // findOrThrow d'abord quand un proche est visé : sans cette garde, une
    // liste vide dirait « ce proche existe et n'a rien à venir », d'un proche
    // qui appartient à un autre compte — le filtre deviendrait un oracle.
    if (query.personId !== undefined) {
      await this.depot.persons(userId).findOrThrow(query.personId);
    }
    // La portée cloisonnée choisit QUOI est visible ; elle ne porte pas de
    // relation, donc les lignes qu'elle rend n'incluent ni l'événement ni le
    // proche. On la consulte d'abord — c'est elle qui garantit le
    // cloisonnement — puis on recharge les mêmes identifiants avec leurs
    // relations pour que le nom du proche voyage avec l'échéance.
    const lignes = await this.depot.occurrences(userId).findMany({
      occurrenceDate: {
        gte: new Date(`${depuis}T00:00:00Z`),
        ...(query.to ? { lte: new Date(`${query.to}T00:00:00Z`) } : {}),
      },
      // L'échéance ne porte pas le proche : elle passe par son événement.
      ...(query.personId !== undefined ? { event: { personId: query.personId } } : {}),
    });

    const jointes = await this.prisma.eventOccurrence.findMany({
      where: { id: { in: lignes.map((l) => l.id) } },
      orderBy: { occurrenceDate: "asc" },
      take: query.limit ?? PLAFOND_DEFAUT,
      include: { event: { include: { person: true } } },
    });

    const [avant, apres] = await this.fenetre();
    return jointes.map((l) => this.rendre(l as LigneJointe, avant, apres));
  }

  async get(userId: string, id: string): Promise<Occurrence> {
    // findOrThrow d'abord : 404 sur ce qui n'est pas au demandeur, avant
    // toute lecture jointe — la ligne ne devrait même pas laisser deviner
    // qu'une échéance existe à cet identifiant.
    await this.depot.occurrences(userId).findOrThrow(id);
    const l = await this.prisma.eventOccurrence.findUniqueOrThrow({
      where: { id }, include: { event: { include: { person: true } } },
    });
    const [avant, apres] = await this.fenetre();
    return this.rendre(l as LigneJointe, avant, apres);
  }

  private rendre(l: LigneJointe, avant: number, apres: number): Occurrence {
    const date = l.occurrenceDate.toISOString().slice(0, 10);
    const jour = this.aujourdhui();

    // Le statut se DÉRIVE : la colonne en base est une matérialisation pour
    // requêter, pas la vérité. Une occurrence dont la fenêtre s'est ouverte
    // pendant la nuit doit se lire « collecting » sans qu'aucun traitement
    // programmé ne soit passé.
    const ouverture = ajouterJours(date, -avant);
    const fermeture = ajouterJours(date, apres);
    const status = jour < ouverture ? "upcoming" : jour > fermeture ? "closed" : "collecting";

    return {
      id: l.id,
      eventId: l.eventId,
      personId: l.event.person.id,
      personDisplayName: l.event.person.displayName,
      kind: l.event.kind as Occurrence["kind"],
      nature: l.event.eventNature as Occurrence["nature"],
      label: l.event.label,
      occurrenceDate: date,
      occurrenceYear: l.occurrenceYear,
      status,
      daysUntil: joursEntre(jour, date),
      // L'âge vient de la NAISSANCE DU PROCHE, jamais de la date d'ancrage de
      // l'événement — celle-ci est désormais toujours à venir, et en tirer un
      // âge donnerait zéro sur toutes les fiches, sans casser un seul test. Nul
      // quand l'année de naissance n'est pas connue : l'écran est obligé de
      // traiter le cas au lieu de l'oublier et d'afficher « NaN ans ».
      age: l.event.person.birthDate && l.event.person.birthYearKnown
        ? Number(date.slice(0, 4)) - l.event.person.birthDate.getUTCFullYear()
        : null,
    };
  }
}

// Le décompte est SIGNÉ : négatif pour une échéance passée. Ce n'est pas pour
// la vue Dates, qui se concentre sur ce qui vient : c'est pour le détail
// d'une occasion passée, qui affiche « passée ». Un décompte non signé y
// rendrait « J−3 » trois jours après la date.
function joursEntre(de: string, a: string): number {
  const ms = Date.parse(`${a}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

import { Inject, Injectable } from "@nestjs/common";
import type {
  CreatePersonInput, Person, PersonList, UpdatePersonInput, ListPersonsQuery,
} from "@lehno/contracts";
import { PAGE_PROCHES } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantRepository } from "../tenancy/tenant.repository.js";
import { EventService } from "./event.service.js";

// Le tri alphabétique se fait ici et non en base : `ORDER BY` de PostgreSQL
// suit la collation du serveur, que rien ne garantit être celle d'un lecteur
// francophone — « Émile » se rangerait après « Zoé ». `sensitivity: "base"`
// range les accentuées avec leur lettre, ce que le carnet attend. Le français
// et l'anglais collationnent identiquement sur ce jeu, un seul collateur suffit.
const COLLATEUR = new Intl.Collator("fr", { sensitivity: "base" });

/* Abaisse la casse ET retire les accents : chercher « emile » doit trouver
   « Émile », et « celarine » doit trouver « Célarine ». Sur un marché où les
   claviers ne portent pas toujours les accents, l'inverse rendrait la
   recherche inutilisable pour la moitié des noms du carnet.
   
   NFD sépare la lettre de son signe diacritique, la plage \u0300-\u036f les
   retire. C'est la forme la plus courte qui traite aussi bien « ç » que « ï ». */
function sansAccents(valeur: string): string {
  return valeur.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// L'annuaire et la fiche. Toutes les lectures passent par la portée cloisonnée
// du dépôt : une requête Prisma directe sur `person` ici serait un défaut, le
// cloisonnement cesserait d'être garanti par construction.
@Injectable()
export class PersonService {
  // @Inject explicite : voir ProfileService, même contrainte esbuild/vitest.
  constructor(
    @Inject(TenantRepository) private readonly depot: TenantRepository,
    // La naissance d'un proche recale son anniversaire — voir `update`
    // ci-dessous. Sans cette dépendance, la correction resterait invisible
    // jusqu'au jour dit, personne ne la remarquant avant.
    @Inject(EventService) private readonly events: EventService,
    // Le décompte des notes et la prochaine échéance ne s'obtiennent pas par la
    // portée des proches : ils vivent sur d'autres tables. On les lit
    // directement, mais TOUJOURS restreints à des identifiants déjà rendus par
    // la portée cloisonnée — le cloisonnement s'hérite alors de la première
    // requête, comme dans NoteService.
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  private aujourdhui(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /* Le décompte des notes et la prochaine échéance, pour un lot de proches.
   *
   * DEUX requêtes quel que soit le nombre de fiches, jamais une par proche :
   * la ligne du carnet affiche « 3 notes · 22 août », et l'obtenir fiche par
   * fiche ferait quarante-trois appels sur le carnet d'essai du handoff. */
  private async enrichir(
    ids: string[],
  ): Promise<Map<string, { notesCount: number; nextOccurrence: Person["nextOccurrence"] }>> {
    const vide = new Map<string, { notesCount: number; nextOccurrence: Person["nextOccurrence"] }>();
    for (const id of ids) vide.set(id, { notesCount: 0, nextOccurrence: null });
    if (ids.length === 0) return vide;

    const depuis = this.aujourdhui();
    const [comptes, echeances] = await Promise.all([
      this.prisma.note.groupBy({
        by: ["personId"],
        // eventOccurrenceId: null — les notes DURABLES seules, celles que rend
        // /me/persons/{id}/notes. Compter aussi celles de circonstance ferait
        // dire « 7 notes » à une fiche qui n'en montre que trois.
        where: { personId: { in: ids }, eventOccurrenceId: null },
        _count: { _all: true },
      }),
      this.prisma.eventOccurrence.findMany({
        where: {
          event: { personId: { in: ids } },
          occurrenceDate: { gte: new Date(`${depuis}T00:00:00Z`) },
        },
        orderBy: { occurrenceDate: "asc" },
        select: {
          id: true, occurrenceDate: true,
          event: { select: { personId: true, kind: true, label: true } },
        },
      }),
    ]);

    for (const c of comptes) {
      const e = vide.get(c.personId);
      if (e) e.notesCount = c._count._all;
    }
    // Rangées par date croissante : la PREMIÈRE rencontrée pour un proche est
    // la sienne. Les suivantes se laissent tomber.
    for (const o of echeances) {
      const e = vide.get(o.event.personId);
      if (!e || e.nextOccurrence) continue;
      const date = o.occurrenceDate.toISOString().slice(0, 10);
      e.nextOccurrence = {
        id: o.id,
        occurrenceDate: date,
        daysUntil: joursEntre(depuis, date),
        kind: o.event.kind as "birthday" | "other",
        label: o.event.label,
      };
    }
    return vide;
  }

  /* Le carnet : trié, puis paginé — dans cet ordre, et pas l'inverse.
   *
   * On charge TOUTES les fiches du demandeur avant de trancher la page. Ça
   * paraît prodigue et c'est ce qu'il faut : le tri « par date » porte sur la
   * prochaine échéance, qui ne vit pas sur la table des proches. Paginer en
   * base d'abord, puis trier les vingt obtenues, rendrait une liste fausse —
   * la vingt-et-unième fiche pourrait être celle dont la date est la plus
   * proche, et elle ne paraîtrait jamais en tête.
   *
   * Le coût est borné par la taille d'un carnet personnel : quelques centaines
   * de fiches au plus. Si le produit devait un jour en tenir des milliers, ce
   * n'est plus ici qu'il faudrait paginer mais dans une requête qui joint
   * l'échéance — pas en découpant celle-ci en morceaux. */
  async list(userId: string, query: ListPersonsQuery = {}): Promise<PersonList> {
    const lignes = await this.depot.persons(userId).findMany({});
    const details = await this.enrichir(lignes.map((l) => l.id));
    const bruts = lignes.map((l) => rendre(l, details.get(l.id)));

    /* Le filtre AVANT le tri et la découpe, jamais après : filtrer une page
       déjà coupée laisserait un proche de la troisième page introuvable, ce
       qui est exactement le défaut qu'on corrige.
       
       La comparaison se fait ici et non en base : `contains` de PostgreSQL
       suit la collation du serveur, que rien ne garantit être celle d'un
       lecteur francophone — chercher « emile » ne trouverait pas « Émile ».
       On normalise donc explicitement, comme le tri alphabétique le fait déjà
       avec son collateur.

       La recherche porte sur les DEUX noms : quelqu'un cherche « maman » sans
       savoir si sa fiche dit « Maman » ou « Maman Chantal », et le nom d'usage
       est justement celui par lequel on l'appelle. */
    const tous = query.q === undefined ? bruts : bruts.filter((p) => {
      const aiguille = sansAccents(query.q!);
      return sansAccents(p.displayName).includes(aiguille)
        || (p.callingName !== null && sansAccents(p.callingName).includes(aiguille));
    });

    const sens = query.direction === "desc" ? -1 : 1;
    if (query.sort === "alpha") {
      tous.sort((a, b) => sens * COLLATEUR.compare(a.displayName, b.displayName));
    } else {
      // Par défaut, et c'est le tri d'ouverture de l'écran.
      //
      // Une fiche SANS date passe en fin de liste dans les DEUX sens, jamais en
      // tête : le carnet sert à voir qui a une date qui approche, et une fiche
      // à compléter occuperait la place de ce qui presse. D'où le test avant la
      // multiplication par le sens — sans quoi l'inversion les remonterait.
      tous.sort((a, b) => {
        const da = a.nextOccurrence?.daysUntil;
        const db = b.nextOccurrence?.daysUntil;
        if (da === undefined && db === undefined) return 0;
        if (da === undefined) return 1;
        if (db === undefined) return -1;
        return sens * (da - db);
      });
    }

    const offset = query.offset ?? 0;
    const limit = query.limit ?? PAGE_PROCHES;
    return { persons: tous.slice(offset, offset + limit), total: tous.length };
  }

  async create(userId: string, input: CreatePersonInput): Promise<Person> {
    // Les champs s'ÉNUMÈRENT au lieu de s'étaler : une clé inattendue — un
    // userId glissé par un appelant qui contourne le typage — n'atteint jamais
    // le dépôt. C'est la première des deux gardes du cloisonnement à
    // l'écriture, la seconde étant l'ordre d'écriture de Scope.create.
    //
    // Le prix de cette énumération : un champ ajouté au contrat et oublié ici
    // ne serait jamais écrit, en silence. C'est ce que garde le test
    // « écrit tous les champs du contrat » de person.test.ts.
    const ligne = await this.depot.persons(userId).create({
      displayName: input.displayName,
      callingName: input.callingName ?? null,
      avatarUrl: input.avatarUrl ?? null,
      relation: input.relation ?? null,
      register: input.register ?? null,
      /* S'écrit, ne se lit pas. `personSchema` ne le rend pas — c'est la garde
         qui empêche un écran d'afficher le genre d'un tiers, ou de trier
         dessus. Il ne sert que l'accord grammatical, et ne ressort que vers le
         modèle. */
      gender: input.gender ?? "unspecified",
      language: input.language ?? null,
      relationHint: input.relationHint ?? null,
      birthDate: input.birthDate ? new Date(`${input.birthDate}T00:00:00Z`) : null,
      birthYearKnown: input.birthYearKnown ?? true,
      city: input.city ?? null,
      country: input.country ?? null,
      preferredChannel: input.preferredChannel ?? null,
    });
    return rendre(ligne);
  }

  async get(userId: string, id: string): Promise<Person> {
    return rendre(await this.depot.persons(userId).findOrThrow(id));
  }

  async update(userId: string, id: string, input: UpdatePersonInput): Promise<Person> {
    // La naissance est une chaîne civile dans le contrat, une colonne `@db.Date`
    // en base : elle se convertit ici, comme à la création — sans quoi Prisma
    // refuse la valeur (« premature end of input, expected ISO-8601 DateTime »).
    const data: Record<string, unknown> = { ...input };
    if (input.birthDate !== undefined) data["birthDate"] = new Date(`${input.birthDate}T00:00:00Z`);

    // updateOrThrow refuse les colonnes d'appartenance dans les données et rend
    // un not_found si la ressource n'est pas au demandeur — les deux
    // protections viennent du dépôt, pas d'un contrôle ici.
    const ligne = await this.depot.persons(userId).updateOrThrow(id, data as never);

    // La naissance vient de changer : l'anniversaire de ce proche, s'il en a
    // un, doit suivre. C'est ÉCRIT au cahier — le cas qui se remarque le plus
    // tard et coûte le plus cher, puisque personne ne relit la fiche avant le
    // jour dit.
    if (input.birthDate !== undefined) {
      await this.events.recalerAnniversaire(userId, id, input.birthDate);
    }

    return rendre(ligne);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.depot.persons(userId).deleteOrThrow(id);
  }
}

// La date se rend en chaîne ISO : le contrat est du JSON, pas un objet Date.
function rendre(p: {
  id: string; displayName: string; callingName: string | null; avatarUrl: string | null;
  isSelf: boolean; relation: string | null; register: string | null; language: string | null;
  relationHint: string | null; birthDate: Date | null; birthYearKnown: boolean;
  city: string | null;
  country: string | null; preferredChannel: string | null; createdAt: Date;
}, details?: { notesCount: number; nextOccurrence: Person["nextOccurrence"] }): Person {
  return {
    id: p.id,
    displayName: p.displayName,
    callingName: p.callingName,
    avatarUrl: p.avatarUrl,
    isSelf: p.isSelf,
    relation: p.relation as Person["relation"],
    relationHint: p.relationHint,
    // La date de naissance se rend en chaîne civile, comme toutes les dates
    // du contrat : du JSON, pas un objet Date.
    birthDate: p.birthDate ? p.birthDate.toISOString().slice(0, 10) : null,
    birthYearKnown: p.birthYearKnown,
    city: p.city,
    country: p.country,
    register: p.register as Person["register"],
    language: p.language,
    preferredChannel: p.preferredChannel as Person["preferredChannel"],
    createdAt: p.createdAt.toISOString(),
    // Absents quand l'appelant ne les a pas chargés — une fiche qui vient
    // d'être créée n'a ni note ni échéance, et le dire coûterait deux requêtes
    // pour deux valeurs connues d'avance.
    notesCount: details?.notesCount ?? 0,
    nextOccurrence: details?.nextOccurrence ?? null,
  };
}

/* L'écart en jours entre deux dates civiles, sans passer par un objet Date
   local : `new Date("2026-02-29")` s'interprète en UTC puis se décale du
   fuseau, ce qui fait basculer un décompte d'un jour selon l'heure qu'il est.
   Voir me/calendrier.ts, qui tient le même raisonnement. */
function joursEntre(depuis: string, jusqu: string): number {
  const jour = (d: string): number => {
    const [a, m, j] = d.split("-").map(Number) as [number, number, number];
    return Math.floor(Date.UTC(a, m - 1, j) / 86_400_000);
  };
  return jour(jusqu) - jour(depuis);
}

import { Inject, Injectable } from "@nestjs/common";
import type { CreateNoteInput, CreateNotesInput, Note, UpdateNoteInput } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantRepository } from "../tenancy/tenant.repository.js";
import { classer } from "./note-classifier.js";
import { AppError } from "../common/errors.js";

@Injectable()
export class NoteService {
  // @Inject explicite : voir ProfileService, même contrainte esbuild/vitest.
  constructor(
    @Inject(TenantRepository) private readonly depot: TenantRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async listForPerson(userId: string, personId: string): Promise<Note[]> {
    // findOrThrow d'abord : si le proche n'est pas au demandeur, on rend 404
    // avant même de lire des notes. Sans cela, une liste vide laisserait croire
    // que le proche existe et n'a rien — l'identifiant deviendrait un oracle.
    await this.depot.persons(userId).findOrThrow(personId);

    const lignes = await this.prisma.note.findMany({
      // eventOccurrenceId: null — seules les notes DURABLES. Une note de
      // circonstance appartient à une occasion, et remonter ici la ferait
      // ressurgir des années plus tard, hors de son contexte : « lui offrir un
      // moulin » réapparaîtrait trois anniversaires après celui qu'elle visait.
      where: { personId, eventOccurrenceId: null },
      // Les plus récentes d'abord : la fiche se lit du haut, et une note
      // fraîche vaut mieux qu'une note d'il y a deux ans.
      orderBy: { createdAt: "desc" },
      // « include », jamais une jointure interne : une note SANS catégorie
      // doit figurer dans la liste. Zéro ligne dans note_category est un état
      // valide, et une note non rangée reste telle qu'elle a été saisie.
      include: { categories: { include: { category: true } } },
    });
    return lignes.map(rendre);
  }

  // Les notes d'une occasion. Le proche s'en déduit : une occurrence appartient
  // à un événement, qui appartient à un proche — le client n'a pas à le dire,
  // et le lui faire dire ouvrirait la porte à une incohérence.
  async listForOccurrence(userId: string, occurrenceId: string): Promise<Note[]> {
    await this.depot.occurrences(userId).findOrThrow(occurrenceId);
    const lignes = await this.prisma.note.findMany({
      where: { eventOccurrenceId: occurrenceId },
      orderBy: { createdAt: "desc" },
      include: { categories: { include: { category: true } } },
    });
    return lignes.map(rendre);
  }

  async createForOccurrence(
    userId: string, occurrenceId: string, input: CreateNoteInput,
  ): Promise<Note> {
    await this.depot.occurrences(userId).findOrThrow(occurrenceId);
    const occurrence = await this.prisma.eventOccurrence.findUniqueOrThrow({
      where: { id: occurrenceId }, include: { event: true },
    });

    const codes = classer(input.content);
    const categories = codes.length
      ? await this.prisma.category.findMany({ where: { code: { in: codes } } })
      : [];

    const ligne = await this.prisma.note.create({
      data: {
        personId: occurrence.event.personId,
        authorUserId: userId,
        content: input.content,
        eventOccurrenceId: occurrenceId,
        categories: { create: categories.map((c) => ({ categoryId: c.id })) },
      },
      include: { categories: { include: { category: true } } },
    });
    return rendre(ligne);
  }

  async createForPerson(userId: string, personId: string, input: CreateNoteInput): Promise<Note> {
    await this.depot.persons(userId).findOrThrow(personId);

    // Le classement est heuristique et local : aucun appel de modèle, donc
    // aucune attente ni dépendance sur le chemin d'écriture. Il peut ne rien
    // trouver, et c'est prévu — la note existe et sert quand même.
    const codes = classer(input.content);
    const categories = codes.length
      ? await this.prisma.category.findMany({ where: { code: { in: codes } } })
      : [];

    await this.verifierLOccurrence(userId, personId, input.eventOccurrenceId);

    const ligne = await this.prisma.note.create({
      data: {
        personId,
        authorUserId: userId,
        content: input.content,
        eventOccurrenceId: input.eventOccurrenceId ?? null,
        categories: { create: categories.map((c) => ({ categoryId: c.id })) },
      },
      include: { categories: { include: { category: true } } },
    });
    return rendre(ligne);
  }

  /* CORRIGER LE TEXTE, ET RECLASSER AVEC LUI.
   *
   * Le classement est DÉRIVÉ du contenu. Corriger le texte sans rejouer
   * `classer()` laisserait les catégories décrire la phrase d'avant — une note
   * qui parle désormais de santé rangée dans « goûts », sans que rien ne le
   * signale. On remplace donc l'ensemble des rattachements, on n'y ajoute pas :
   * une catégorie que le texte corrigé ne justifie plus doit partir.
   *
   * LES TRAITS, EUX, NE SE REJOUENT PAS, et ce n'est pas un oubli. Un trait
   * n'est pas « un par note » : `attributs.service` tient une valeur COURANTE
   * par nature, avec un pointeur vers la note qui l'a posée en dernier — « le
   * plus récent l'emporte », comme la spec le dit. Les re-dériver ici
   * demanderait de rejouer toutes les notes restantes du proche pour savoir ce
   * qui redevient vrai. Ce qui vaut pour la correction vaut pour la saisie : on
   * corrige un trait en écrivant une note neuve. */
  async updateForPerson(
    userId: string, personId: string, noteId: string, input: UpdateNoteInput,
  ): Promise<Note> {
    await this.depot.persons(userId).findOrThrow(personId);
    await this.trouver(personId, noteId);

    const codes = classer(input.content);
    const categories = codes.length
      ? await this.prisma.category.findMany({ where: { code: { in: codes } } })
      : [];

    const ligne = await this.prisma.note.update({
      where: { id: noteId },
      data: {
        content: input.content,
        categories: {
          deleteMany: {},
          create: categories.map((c) => ({ categoryId: c.id })),
        },
      },
      include: { categories: { include: { category: true } } },
    });
    return rendre(ligne);
  }

  /* EFFACER POUR DE BON, et pas marquer comme effacée.
   *
   * Quelqu'un qui retire ce qu'il a écrit sur un proche veut que ce soit parti,
   * pas caché : une note conservée en douce continuerait de pouvoir être lue,
   * exportée, et surtout de nourrir les invites — ce qui est exactement la
   * raison de l'effacer.
   *
   * Ce que la base fait autour, et qui est déjà juste : les rattachements de
   * catégorie tombent avec elle (`Cascade`), et les TRAITS survivent en perdant
   * leur provenance (`SetNull`). Le second surprend et c'est le bon choix — un
   * trait est une valeur courante que la note a posée en dernier, pas une
   * possession ; l'emporter reviendrait à annuler une déduction sans savoir ce
   * qui la remplace. Le texte, lui, ne nourrit plus rien. */
  async deleteForPerson(userId: string, personId: string, noteId: string): Promise<void> {
    await this.depot.persons(userId).findOrThrow(personId);
    await this.trouver(personId, noteId);
    await this.prisma.note.delete({ where: { id: noteId } });
  }

  /* 404 SUR LA NOTE D'UN AUTRE PROCHE, même si elle appartient au demandeur.
   *
   * Le proche est déjà vérifié au-dessus ; ce qui reste à refuser est une note
   * qui n'est pas SOUS CE PROCHE-LÀ. Sans ce contrôle, corriger une note en se
   * trompant de chemin toucherait la fiche d'un autre, et le rendu dirait que
   * tout s'est bien passé. */
  private async trouver(personId: string, noteId: string): Promise<void> {
    const ligne = await this.prisma.note.findFirst({
      where: { id: noteId, personId }, select: { id: true },
    });
    if (ligne === null) throw new AppError("not_found", "note not found");
  }

  // Une même note pour plusieurs proches. Elle se DUPLIQUE : chacun reçoit la
  // sienne, indépendante ensuite — corriger le classement de l'une ne touche
  // pas les autres, et supprimer un proche n'emporte pas les notes des autres.
  //
  // TOUT OU RIEN. La liste est vérifiée AVANT la moindre écriture. Sans cette
  // vérification préalable, la première note partirait puis on découvrirait
  // que la seconde n'est pas permise : l'appelant recevrait une erreur en
  // croyant que rien n'a été écrit, alors qu'une note serait déjà posée sur

  /* L'occurrence citée doit être CELLE DE CE PROCHE.
   *
   * `depot.occurrences(userId)` garantit qu'elle appartient au compte, pas
   * qu'elle appartient à cette personne-là. Sans ce contrôle, une note se
   * rattachait à la date de quelqu'un d'autre du même carnet — et ressortait en
   * ouvrant cette occasion, mêlée à celles qui la concernent vraiment.
   *
   * Le commentaire de `listForOccurrence` promet précisément cette
   * cohérence — « une note de circonstance appartient à un événement, qui
   * appartient à un proche » — et rien ne la tenait.
   */
  private async verifierLOccurrence(
    userId: string, personId: string, occurrenceId: string | undefined,
  ): Promise<void> {
    if (occurrenceId === undefined) return;
    const occurrence = await this.depot.occurrences(userId).findOrThrow(occurrenceId);
    const evenement = await this.prisma.event.findUnique({
      where: { id: occurrence.eventId }, select: { personId: true },
    });
    /* 404 et non 403 : l'occasion d'un autre proche du même carnet existe bel
       et bien, et le dire distinguerait « pas la vôtre » de « n'existe pas ».
       C'est la règle du dépôt pour tout ce qui se désigne par identifiant. */
    if (evenement?.personId !== personId)
      throw new AppError("not_found", "resource not found");
  }

  // la fiche de quelqu'un d'autre.
  async createForMany(userId: string, input: CreateNotesInput): Promise<Note[]> {
    // Dédoublonnés : le même proche cité deux fois ne mérite pas deux notes
    // identiques, et le décompte de vérification ci-dessous serait faussé.
    const ids = [...new Set(input.personIds)];

    // Une seule requête, dans la portée cloisonnée : ce qui n'appartient pas
    // au demandeur n'en revient tout simplement pas.
    const permis = await this.depot.persons(userId).findMany({ id: { in: ids } });
    if (permis.length !== ids.length) {
      // 404 et non 403 : révéler qu'un identifiant existe mais appartient à
      // quelqu'un d'autre en ferait un oracle. Un identifiant inconnu et un
      // identifiant d'autrui rendent donc la même chose.
      throw new AppError("not_found", "resource not found");
    }

    /* Le contrat refuse déjà une occurrence avec plus d'un proche : il ne
       reste donc ici qu'un seul destinataire possible quand elle est citée. */
    if (input.eventOccurrenceId !== undefined && ids[0] !== undefined)
      await this.verifierLOccurrence(userId, ids[0], input.eventOccurrenceId);

    const codes = classer(input.content);
    const categories = codes.length
      ? await this.prisma.category.findMany({ where: { code: { in: codes } } })
      : [];

    // En transaction : si l'une des écritures échoue, aucune ne demeure.
    const lignes = await this.prisma.$transaction(
      ids.map((personId) =>
        this.prisma.note.create({
          data: {
            personId,
            authorUserId: userId,
            content: input.content,
            eventOccurrenceId: input.eventOccurrenceId ?? null,
            categories: { create: categories.map((c) => ({ categoryId: c.id })) },
          },
          include: { categories: { include: { category: true } } },
        }),
      ),
    );
    return lignes.map(rendre);
  }
}

function rendre(n: {
  id: string; personId: string; content: string;
  eventOccurrenceId: string | null; createdAt: Date;
  categories: { category: { code: string } }[];
}): Note {
  return {
    id: n.id,
    personId: n.personId,
    content: n.content,
    eventOccurrenceId: n.eventOccurrenceId,
    categories: n.categories.map((c) => c.category.code) as Note["categories"],
    createdAt: n.createdAt.toISOString(),
  };
}

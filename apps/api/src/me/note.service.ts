import { Inject, Injectable } from "@nestjs/common";
import type { CreateNoteInput, CreateNotesInput, Note } from "@lehno/contracts";
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

  // Une même note pour plusieurs proches. Elle se DUPLIQUE : chacun reçoit la
  // sienne, indépendante ensuite — corriger le classement de l'une ne touche
  // pas les autres, et supprimer un proche n'emporte pas les notes des autres.
  //
  // TOUT OU RIEN. La liste est vérifiée AVANT la moindre écriture. Sans cette
  // vérification préalable, la première note partirait puis on découvrirait
  // que la seconde n'est pas permise : l'appelant recevrait une erreur en
  // croyant que rien n'a été écrit, alors qu'une note serait déjà posée sur
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

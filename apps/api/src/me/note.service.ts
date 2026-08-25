import { Inject, Injectable } from "@nestjs/common";
import type { CreateNoteInput, Note } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantRepository } from "../tenancy/tenant.repository.js";
import { classer } from "./note-classifier.js";

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
      where: { personId },
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

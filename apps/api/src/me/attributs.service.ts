import { Inject, Injectable } from "@nestjs/common";
import type { AttributeKind, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantRepository } from "../tenancy/tenant.repository.js";

/* Le topo d'un proche : ce que les notes ont appris de lui.
 *
 * EXTRAIT, jamais saisi. Aucun formulaire ne le demande — corriger, c'est
 * écrire une note nouvelle, et le plus récent l'emporte. */

export type AttributExtrait = {
  readonly kind: AttributeKind;
  readonly value: string;
  readonly noteId: string | null;
  /** La date de la NOTE, pas celle du traitement. Voir `poser`. */
  readonly observedAt: Date;
};

@Injectable()
export class AttributsService {
  // @Inject explicite : esbuild/vitest n'émet pas design:paramtypes.
  constructor(
    @Inject(TenantRepository) private readonly depot: TenantRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /* Ce que la fiche affiche, dans un ordre stable.
   *
   * L'ordre vient de l'énumération, pas de la date : un topo dont les lignes
   * changent de place à chaque note nouvelle se relit mal, et on cherche
   * l'information au lieu de la voir. */
  async lister(userId: string, personId: string): Promise<AttributExtrait[]> {
    await this.depot.persons(userId).findOrThrow(personId);
    return this.prisma.personAttribute.findMany({
      where: { personId },
      orderBy: { kind: "asc" },
      select: { kind: true, value: true, noteId: true, observedAt: true },
    });
  }

  /* Poser un attribut extrait d'une note.
   *
   * LA GARDE : on n'écrase que si la note est PLUS RÉCENTE que celle déjà en
   * place. Comparer sur l'ordre d'écriture suffirait tant que les notes se
   * traitent une par une, dans l'ordre — ce qui est vrai aujourd'hui et cessera
   * de l'être au premier rattrapage d'arriéré, où tout un historique se traite
   * d'un coup et dans le désordre. Une valeur de mars écraserait alors celle de
   * septembre, sans que rien ne le signale.
   *
   * Le `updateMany` conditionné fait la comparaison EN BASE, dans la même
   * instruction que l'écriture : deux passes concurrentes sur la même personne
   * ne peuvent pas se croiser entre la lecture et l'écriture. */
  async poser(
    personId: string, attribut: AttributExtrait,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    const { kind, value, noteId, observedAt } = attribut;

    const misAJour = await client.personAttribute.updateMany({
      where: { personId, kind, observedAt: { lte: observedAt } },
      data: { value, noteId, observedAt },
    });
    if (misAJour.count > 0) return;

    /* Aucune ligne mise à jour veut dire deux choses très différentes : soit il
       n'y en avait pas, soit celle qui existe est plus récente. On tente donc
       la création, et une violation d'unicité tranche — c'est le second cas, et
       il n'y a rien à faire. Interroger d'abord laisserait une fenêtre entre la
       lecture et l'écriture. */
    try {
      await client.personAttribute.create({
        data: { personId, kind, value, noteId, observedAt },
      });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code !== "P2002") throw err;
    }
  }
}

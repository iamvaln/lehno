import { Controller, Get, Inject, Injectable, Query, UseGuards } from "@nestjs/common";
import { motifsDuGesteSchema, type MotifsDuGeste } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AdminGuard } from "./admin.guard.js";

/**
 * Les motifs proposés pour un geste.
 *
 * Ils vivaient dans le dictionnaire du back-office, donc en double — une liste
 * française et une anglaise. C'est le LIBELLÉ qui partait au journal, et le même
 * geste s'y inscrivait « Fraude suspectée » ou « Suspected fraud » selon la
 * langue au moment du clic. Deux textes pour un motif : « combien de
 * suspensions pour fraude » n'avait pas de réponse.
 *
 * Le service rend le code et les deux libellés ; l'écran affiche celui de sa
 * langue et renvoie le code.
 */
@Injectable()
export class ReasonsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async pourLeGeste(geste: string): Promise<MotifsDuGeste> {
    const portees = await this.prisma.auditReasonScope.findMany({
      where: { geste, reason: { isActive: true } },
      // `position` d'abord, le code ensuite : deux motifs sans position
      // s'ordonneraient sinon au gré du plan d'exécution, et la liste changerait
      // d'ordre d'un chargement à l'autre sans que rien n'ait bougé.
      orderBy: [{ position: "asc" }, { reason: { code: "asc" } }],
      select: { reason: { select: { code: true, labelFr: true, labelEn: true } } },
    });

    return {
      geste,
      motifs: portees.map((p) => ({ code: p.reason.code, fr: p.reason.labelFr, en: p.reason.labelEn })),
    };
  }
}

@Controller("admin/reasons")
@UseGuards(AdminGuard)
export class ReasonsController {
  constructor(@Inject(ReasonsService) private readonly service: ReasonsService) {}

  /* Aucune garde de rôle : `support` pose des motifs comme `admin`, sur les
     gestes qui lui sont ouverts. Restreindre la LECTURE de la liste ne
     protégerait rien — ce sont les gestes eux-mêmes qui sont gardés. */
  @Get()
  async lister(@Query("geste") geste?: string): Promise<MotifsDuGeste> {
    return motifsDuGesteSchema.parse(await this.service.pourLeGeste(geste ?? ""));
  }
}

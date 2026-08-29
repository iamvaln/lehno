import { Body, Controller, Get, HttpCode, Inject, Injectable, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import {
  motifsDuGesteSchema, motifsAdminSchema, creationMotifSchema, modificationMotifSchema,
  type MotifsDuGeste, type MotifsAdmin,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AdminGuard } from "./admin.guard.js";
import { Role, RoleGuard } from "./role.guard.js";
import { AuditService } from "./audit.service.js";
import { poserLAuteurEtLeMotif } from "./historisation.js";

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
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly journal: AuditService,
  ) {}

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

  /** Tous les motifs, retirés compris : l'administration les gère, elle ne les
   *  consomme pas. Un motif retiré doit rester visible pour être remis. */
  async tous(): Promise<MotifsAdmin> {
    const motifs = await this.prisma.auditReason.findMany({
      orderBy: { code: "asc" },
      select: {
        id: true, code: true, labelFr: true, labelEn: true, isActive: true,
        scopes: { select: { geste: true }, orderBy: { geste: "asc" } },
      },
    });
    return {
      motifs: motifs.map((m) => ({
        id: m.id, code: m.code, fr: m.labelFr, en: m.labelEn,
        actif: m.isActive, gestes: m.scopes.map((p) => p.geste),
      })),
    };
  }

  async creer(auteurId: string, entree: z.infer<typeof creationMotifSchema>): Promise<{ id: string }> {
    const existant = await this.prisma.auditReason.findUnique({ where: { code: entree.code } });
    if (existant) throw new AppError("conflict", "a reason already exists with this code");

    return this.prisma.$transaction(async (tx) => {
      await poserLAuteurEtLeMotif(tx, auteurId, entree.reason);
      const cree = await tx.auditReason.create({
        data: {
          code: entree.code, labelFr: entree.fr, labelEn: entree.en,
          scopes: { create: entree.gestes.map((geste, i) => ({ geste, position: i })) },
        },
        select: { id: true },
      });
      await this.journal.consigner({
        auteurId, action: "audit_reason_create", motif: entree.reason,
        cibleType: "audit_reason", cibleId: cree.id,
        details: { code: entree.code, gestes: entree.gestes },
      }, tx);
      return cree;
    });
  }

  async modifier(
    auteurId: string, id: string, entree: z.infer<typeof modificationMotifSchema>,
  ): Promise<{ id: string }> {
    const avant = await this.prisma.auditReason.findUnique({
      where: { id }, select: { code: true, labelFr: true, isActive: true },
    });
    if (!avant) throw new AppError("not_found", "unknown reason");

    return this.prisma.$transaction(async (tx) => {
      await poserLAuteurEtLeMotif(tx, auteurId, entree.reason);
      await this.journal.consigner({
        auteurId, action: "audit_reason_update", motif: entree.reason,
        cibleType: "audit_reason", cibleId: id,
        details: { code: avant.code, from: { fr: avant.labelFr, actif: avant.isActive }, to: entree },
      }, tx);

      await tx.auditReason.update({
        where: { id },
        data: {
          ...(entree.fr !== undefined ? { labelFr: entree.fr } : {}),
          ...(entree.en !== undefined ? { labelEn: entree.en } : {}),
          ...(entree.actif !== undefined ? { isActive: entree.actif } : {}),
        },
      });

      /* Les portées se remplacent en bloc, jamais par différence : calculer
         l'écart côté service perdrait la course à deux administrateurs
         simultanés, et laisserait un geste rattaché deux fois ou pas du tout.
         Effacer puis recréer dans la même transaction est atomique, et
         l'historique garde chaque portée fermée à sa date. */
      if (entree.gestes !== undefined) {
        await tx.auditReasonScope.deleteMany({ where: { reasonId: id } });
        for (const [i, geste] of entree.gestes.entries()) {
          await tx.auditReasonScope.create({ data: { reasonId: id, geste, position: i } });
        }
      }
      return { id };
    });
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

  /* Gérer les motifs, c'est décider de ce qui se compte. Réservé à `admin` :
     le support les emploie, il ne les fabrique pas. */
  @Get("all")
  @Role("admin")
  @UseGuards(RoleGuard)
  async tous(): Promise<MotifsAdmin> {
    return motifsAdminSchema.parse(await this.service.tous());
  }

  @Post()
  @Role("admin")
  @UseGuards(RoleGuard)
  @HttpCode(201)
  async creer(
    @Req() req: { admin: { id: string } },
    @Body(new ZodValidationPipe(creationMotifSchema)) corps: z.infer<typeof creationMotifSchema>,
  ): Promise<{ id: string }> {
    return this.service.creer(req.admin.id, corps);
  }

  /* Aucun DELETE, et ce n'est pas un oubli. Un code n'a pas de clé étrangère
     depuis le journal — l'effacer ne casserait rien, il rendrait simplement
     illisibles tous les gestes qu'il a justifiés. On le RETIRE : il cesse
     d'être proposé, et ce qu'il explique reste explicable. */
  @Patch(":id")
  @Role("admin")
  @UseGuards(RoleGuard)
  async modifier(
    @Req() req: { admin: { id: string } },
    @Param("id") id: string,
    @Body(new ZodValidationPipe(modificationMotifSchema)) corps: z.infer<typeof modificationMotifSchema>,
  ): Promise<{ id: string }> {
    return this.service.modifier(req.admin.id, id, corps);
  }
}

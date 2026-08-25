import { Body, Controller, Get, HttpCode, Inject, Injectable, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AdminGuard } from "./admin.guard.js";
import { Role, RoleGuard } from "./role.guard.js";
import { AuditService } from "./audit.service.js";

const KINDS = ["message", "illustration", "photo_style", "note_classification", "sensitive_detection"] as const;

const listeSchema = z.object({
  kind: z.enum(KINDS).optional(),
  key: z.string().max(60).optional(),
}).strict();

const creationSchema = z.object({
  kind: z.enum(KINDS),
  key: z.string().min(1).max(60),
  body: z.string().min(1).max(20_000),
  guardrails: z.record(z.unknown()).optional(),
  aiModelId: z.string().uuid().optional(),
  reason: z.string().max(500),
}).strict();

const activationSchema = z.object({
  isActive: z.literal(true),
  reason: z.string().max(500),
}).strict();

@Injectable()
export class StudioService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly journal: AuditService,
  ) {}

  async lister(requete: z.infer<typeof listeSchema>) {
    const lignes = await this.prisma.promptTemplate.findMany({
      where: {
        ...(requete.kind ? { kind: requete.kind } : {}),
        ...(requete.key ? { key: requete.key } : {}),
      },
      // Le plus récent en tête : on ouvre l'historique pour voir ce qui tourne
      // aujourd'hui, et remonter ensuite.
      orderBy: [{ kind: "asc" }, { key: "asc" }, { version: "desc" }],
    });
    return { items: lignes.map((g) => this.rendre(g)) };
  }

  private rendre(g: {
    id: string; kind: string; key: string; version: number; body: string;
    guardrails: unknown; aiModelId: string | null; isActive: boolean;
    createdByAdminId: string | null; createdAt: Date;
  }) {
    return {
      id: g.id, kind: g.kind, key: g.key, version: g.version, body: g.body,
      guardrails: g.guardrails, aiModelId: g.aiModelId, isActive: g.isActive,
      createdByAdminId: g.createdByAdminId, createdAt: g.createdAt.toISOString(),
    };
  }

  // Ajuster un gabarit **crée une version** : l'ancienne demeure. Sans cela,
  // comprendre pourquoi les productions d'une semaine valaient mieux que celles
  // de la suivante devient impossible — et c'est tout l'objet du versionnage.
  async creer(auteurId: string, entree: z.infer<typeof creationSchema>) {
    const derniere = await this.prisma.promptTemplate.findFirst({
      where: { kind: entree.kind, key: entree.key },
      orderBy: { version: "desc" },
      select: { id: true, version: true },
    });
    const version = (derniere?.version ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      await this.journal.consigner({
        auteurId, action: "prompt_template_create", motif: entree.reason,
        cibleType: "prompt_template",
        details: { kind: entree.kind, key: entree.key, version },
      }, tx);

      // La version précédente se range avant que la nouvelle prenne la main :
      // l'index unique partiel n'admet qu'une seule active par (kind, key), et
      // il refuserait l'insertion dans l'ordre inverse.
      await tx.promptTemplate.updateMany({
        where: { kind: entree.kind, key: entree.key, isActive: true },
        data: { isActive: false },
      });

      const cree = await tx.promptTemplate.create({
        data: {
          kind: entree.kind, key: entree.key, version, body: entree.body,
          ...(entree.guardrails === undefined ? {} : { guardrails: entree.guardrails as object }),
          ...(entree.aiModelId === undefined ? {} : { aiModelId: entree.aiModelId }),
          isActive: true,
          createdByAdminId: auteurId,
        },
      });
      return this.rendre(cree);
    });
  }

  /** Revenir à une version antérieure : elle reprend la main, sans être copiée. */
  async activer(auteurId: string, id: string, entree: z.infer<typeof activationSchema>) {
    const cible = await this.prisma.promptTemplate.findUnique({ where: { id } });
    if (!cible) throw new AppError("not_found", "unknown template");

    return this.prisma.$transaction(async (tx) => {
      await this.journal.consigner({
        auteurId, action: "prompt_template_activate", motif: entree.reason,
        cibleType: "prompt_template", cibleId: id,
        details: { kind: cible.kind, key: cible.key, version: cible.version },
      }, tx);

      await tx.promptTemplate.updateMany({
        where: { kind: cible.kind, key: cible.key, isActive: true },
        data: { isActive: false },
      });

      const apres = await tx.promptTemplate.update({ where: { id }, data: { isActive: true } });
      return this.rendre(apres);
    });
  }
}

@Controller("admin/portrait-studio/templates")
@UseGuards(AdminGuard, RoleGuard)
export class StudioController {
  constructor(@Inject(StudioService) private readonly service: StudioService) {}

  // Le support consulte : comprendre ce qui a produit un contenu raté fait
  // partie de l'assistance. Il ne règle rien.
  @Get()
  lister(@Query(new ZodValidationPipe(listeSchema)) requete: z.infer<typeof listeSchema>) {
    return this.service.lister(requete);
  }

  @Post()
  @HttpCode(201)
  @Role("admin")
  creer(
    @Body(new ZodValidationPipe(creationSchema)) corps: z.infer<typeof creationSchema>,
    @Req() req: { admin: { id: string } },
  ) {
    return this.service.creer(req.admin.id, corps);
  }

  // Une version ne se modifie pas — le seul geste possible sur elle est de la
  // remettre en service.
  @Patch(":id")
  @Role("admin")
  activer(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(activationSchema)) corps: z.infer<typeof activationSchema>,
    @Req() req: { admin: { id: string } },
  ) {
    return this.service.activer(req.admin.id, id, corps);
  }
}

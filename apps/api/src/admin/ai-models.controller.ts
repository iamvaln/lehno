import { Body, Controller, Get, Inject, Injectable, Patch, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AdminGuard } from "./admin.guard.js";
import { Role, RoleGuard } from "./role.guard.js";
import { AuditService } from "./audit.service.js";

const ecritureSchema = z.object({
  id: z.string().uuid(),
  priority: z.number().int().min(0).max(1000).optional(),
  enabled: z.boolean().optional(),
  reason: z.string().max(500),
}).strict();

@Injectable()
export class AIModelsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly journal: AuditService,
  ) {}

  // L'ordre rendu est celui du routage : le plus bas passe en premier. Rendre
  // les modèles en désordre obligerait l'écran à les retrier, et deux tris
  // valent moins qu'un seul dès qu'ils divergent.
  async lister() {
    const lignes = await this.prisma.aIModel.findMany({ orderBy: [{ priority: "asc" }, { provider: "asc" }] });
    return {
      items: lignes.map((m) => ({
        id: m.id,
        fournisseur: m.provider,
        modele: m.modelKey,
        rang: m.priority,
        actif: m.enabled,
        // Nuls quand le modèle n'a pas encore été tarifé — ce n'est pas
        // « gratuit », c'est « on ne sait pas ce qu'il coûte ».
        coutEntree: m.costInput === null ? null : Number(m.costInput),
        coutSortie: m.costOutput === null ? null : Number(m.costOutput),
        misAJourLe: m.updatedAt.toISOString(),
      })),
    };
  }

  async ecrire(auteurId: string, entree: z.infer<typeof ecritureSchema>) {
    const avant = await this.prisma.aIModel.findUnique({ where: { id: entree.id } });
    if (!avant) throw new AppError("not_found", "unknown model");

    // Désactiver le dernier modèle actif couperait toute génération, sans que
    // rien ne le dise avant la première panne. Le refus est ici, pas dans une
    // consigne d'usage : c'est exactement le geste qu'on pose à trois heures du
    // matin en éteignant un modèle qui échoue.
    if (entree.enabled === false && avant.enabled) {
      const actifs = await this.prisma.aIModel.count({ where: { enabled: true } });
      if (actifs <= 1)
        throw new AppError("validation_failed", "the last enabled model cannot be disabled");
    }

    const details: Record<string, { from: unknown; to: unknown }> = {};
    if (entree.priority !== undefined && entree.priority !== avant.priority)
      details["priority"] = { from: avant.priority, to: entree.priority };
    if (entree.enabled !== undefined && entree.enabled !== avant.enabled)
      details["enabled"] = { from: avant.enabled, to: entree.enabled };

    return this.prisma.$transaction(async (tx) => {
      await this.journal.consigner({
        auteurId, action: "ai_model_update", motif: entree.reason,
        cibleType: "ai_model", cibleId: avant.id,
        details: { provider: avant.provider, modelKey: avant.modelKey, ...details },
      }, tx);

      const apres = await tx.aIModel.update({
        where: { id: entree.id },
        data: {
          ...(entree.priority === undefined ? {} : { priority: entree.priority }),
          ...(entree.enabled === undefined ? {} : { enabled: entree.enabled }),
        },
      });
      return {
        id: apres.id, provider: apres.provider, modelKey: apres.modelKey,
        priority: apres.priority, enabled: apres.enabled,
      };
    });
  }
}

@Controller("admin/ai-models")
@UseGuards(AdminGuard, RoleGuard)
export class AIModelsController {
  constructor(@Inject(AIModelsService) private readonly service: AIModelsService) {}

  // Le support consulte : comprendre quel modèle a produit un contenu raté fait
  // partie de l'assistance quotidienne.
  @Get()
  lister() {
    return this.service.lister();
  }

  // « Piloter les modèles d'IA » appartient à l'admin (ux-admin §6).
  @Patch()
  @Role("admin")
  ecrire(
    @Body(new ZodValidationPipe(ecritureSchema)) corps: z.infer<typeof ecritureSchema>,
    @Req() req: { admin: { id: string } },
  ) {
    return this.service.ecrire(req.admin.id, corps);
  }
}

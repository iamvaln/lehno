import { Body, Controller, Get, Inject, Injectable, Patch, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { motifSchema } from "@lehno/contracts";
import {
  CAPACITE_REQUISE, RANGS_RECOMMANDES, TACHES_IA, type TacheIA,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AdminGuard } from "./admin.guard.js";
import { Role, RoleGuard } from "./role.guard.js";
import { AuditService } from "./audit.service.js";

const modeleSchema = z.object({
  id: z.string().uuid(),
  enabled: z.boolean().optional(),
  costInput: z.number().nonnegative().optional(),
  costOutput: z.number().nonnegative().optional(),
  /* Lever une panne à la main, quand on sait que le fournisseur est revenu et
     qu'on ne veut pas attendre l'expiration. C'est le SEUL geste humain sur
     l'état de panne, et il ne fait que l'effacer : il ne le pose jamais. Poser
     une panne à la main reviendrait à couper un modèle, et couper un modèle a
     déjà son interrupteur — celui qui, lui, résiste à la reprise automatique. */
  clearOutage: z.boolean().optional(),
  reason: motifSchema,
  reasonCode: z.string().max(48).optional(),
}).strict();

// Une chaîne se règle ENTIÈRE : le tableau EST l'ordre. Promouvoir et déclasser
// se font en déplaçant une entrée, ce qui évite d'avoir à exprimer « échange les
// rangs 1 et 2 » — une opération qui, faite en deux écritures, viole l'unicité
// (tâche, rang) au milieu du chemin.
const chaineSchema = z.object({
  task: z.enum(TACHES_IA),
  modelIds: z.array(z.string().uuid()).min(1).max(10),
  reason: motifSchema,
  reasonCode: z.string().max(48).optional(),
}).strict();

type ModeleLu = {
  id: string; provider: string; modelKey: string; capability: string;
  enabled: boolean; outageUntil: Date | null;
};

@Injectable()
export class AIModelsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly journal: AuditService,
  ) {}

  async listerModeles() {
    const lignes = await this.prisma.aIModel.findMany({
      orderBy: [{ capability: "asc" }, { provider: "asc" }, { modelKey: "asc" }],
      include: { routes: { select: { task: true, rank: true } } },
    });
    const maintenant = Date.now();
    return {
      items: lignes.map((m) => ({
        id: m.id,
        fournisseur: m.provider,
        modele: m.modelKey,
        capacite: m.capability,
        actif: m.enabled,
        // Les deux états sont rendus SÉPARÉMENT, jamais fondus en un seul
        // « disponible ». Un modèle coupé à la main et un modèle en panne se
        // réparent par des gestes opposés ; les confondre à l'écran ferait
        // attendre une reprise qui ne viendra pas.
        enPanneJusquA: m.outageUntil !== null && m.outageUntil.getTime() > maintenant
          ? m.outageUntil.toISOString() : null,
        motifDePanne: m.outageUntil !== null && m.outageUntil.getTime() > maintenant
          ? m.outageReason : null,
        echecsConsecutifs: m.consecutiveFailures,
        // Nuls quand le modèle n'a pas encore été tarifé — ce n'est pas
        // « gratuit », c'est « on ne sait pas ce qu'il coûte ».
        coutEntree: m.costInput === null ? null : Number(m.costInput),
        coutSortie: m.costOutput === null ? null : Number(m.costOutput),
        // Où ce modèle sert, pour qu'on voie ce qu'on casse en le coupant.
        emplois: m.routes.map((r) => ({ tache: r.task, rang: r.rank }))
          .sort((a, b) => a.tache.localeCompare(b.tache)),
        misAJourLe: m.updatedAt.toISOString(),
      })),
    };
  }

  async listerChaines() {
    const routes = await this.prisma.aITaskRoute.findMany({
      orderBy: [{ task: "asc" }, { rank: "asc" }],
      include: { model: true },
    });
    const maintenant = Date.now();
    return {
      items: TACHES_IA.map((tache) => {
        const rangs = routes.filter((r) => r.task === tache);
        const fournisseurs = rangs.map((r) => r.model.provider);
        return {
          tache,
          capaciteRequise: CAPACITE_REQUISE[tache],
          rangs: rangs.map((r) => ({
            rang: r.rank,
            modeleId: r.modelId,
            // Le fournisseur est rendu À CHAQUE RANG, et pas seulement dans le
            // catalogue : c'est ce qui rend visible d'un coup d'œil qu'on vient
            // d'aligner trois modèles du même hébergeur — une chaîne qu'une
            // seule panne emporte en entier.
            fournisseur: r.model.provider,
            modele: r.model.modelKey,
            actif: r.model.enabled,
            enPanne: r.model.outageUntil !== null && r.model.outageUntil.getTime() > maintenant,
          })),
          /* Des avertissements, pas des refus. Refuser une chaîne courte
             rendrait les tâches d'image inconfigurables — deux fournisseurs
             seulement en produisent — et transformerait un jugement
             d'exploitation en interdit. */
          avertissements: [
            ...(rangs.length < RANGS_RECOMMANDES
              ? [{ code: "chaine_courte", rangs: rangs.length, recommande: RANGS_RECOMMANDES }]
              : []),
            ...(new Set(fournisseurs).size < fournisseurs.length
              ? [{ code: "fournisseur_repete" }]
              : []),
          ],
        };
      }),
    };
  }

  async ecrireModele(auteurId: string, entree: z.infer<typeof modeleSchema>) {
    const avant = await this.prisma.aIModel.findUnique({ where: { id: entree.id } });
    if (!avant) throw new AppError("not_found", "unknown model");

    if (entree.enabled === false && avant.enabled) await this.refuserSiCaVideUneChaine(avant.id);

    const details: Record<string, { from: unknown; to: unknown }> = {};
    if (entree.enabled !== undefined && entree.enabled !== avant.enabled)
      details["enabled"] = { from: avant.enabled, to: entree.enabled };
    if (entree.costInput !== undefined) details["costInput"] = { from: avant.costInput, to: entree.costInput };
    if (entree.costOutput !== undefined) details["costOutput"] = { from: avant.costOutput, to: entree.costOutput };
    if (entree.clearOutage === true) details["outageUntil"] = { from: avant.outageUntil, to: null };

    return this.prisma.$transaction(async (tx) => {
      await this.journal.consigner({
        auteurId, action: "ai_model_update",
        /* Allumer et éteindre sont deux gestes sous une même action : « taux
           d'échec trop haut » n'explique pas une remise en service, et « retour
           à la normale » n'explique pas une coupure. Lever une panne à la main
           se range avec l'allumage — c'est le même « il est revenu ». */
        geste: entree.enabled === false ? "ai_model_disable" : "ai_model_enable",
        motif: entree.reason,
        ...(entree.reasonCode !== undefined ? { codeMotif: entree.reasonCode } : {}),
        cibleType: "ai_model", cibleId: avant.id,
        details: { provider: avant.provider, modelKey: avant.modelKey, ...details },
      }, tx);

      const apres = await tx.aIModel.update({
        where: { id: entree.id },
        data: {
          ...(entree.enabled === undefined ? {} : { enabled: entree.enabled }),
          ...(entree.costInput === undefined ? {} : { costInput: entree.costInput }),
          ...(entree.costOutput === undefined ? {} : { costOutput: entree.costOutput }),
          // Le compteur repart de zéro avec la panne : le laisser à trois
          // ferait rebasculer en panne au premier échec suivant, et la levée
          // manuelle n'aurait servi qu'une requête.
          ...(entree.clearOutage === true
            ? { outageUntil: null, outageReason: null, consecutiveFailures: 0 }
            : {}),
        },
      });
      return {
        id: apres.id, provider: apres.provider, modelKey: apres.modelKey,
        enabled: apres.enabled, outageUntil: apres.outageUntil?.toISOString() ?? null,
      };
    });
  }

  /* Couper un modèle ne doit laisser aucune tâche sans rien à appeler.
   *
   * Le refus est ici, pas dans une consigne d'usage : c'est exactement le geste
   * qu'on pose à trois heures du matin en éteignant ce qui échoue, et il
   * couperait toute génération sans que rien ne le dise avant le premier appel.
   * On regarde tâche par tâche, pas globalement : un catalogue riche en modèles
   * de texte ne sauve pas la tâche d'image dont on vient de couper le dernier. */
  private async refuserSiCaVideUneChaine(modelId: string): Promise<void> {
    const emplois = await this.prisma.aITaskRoute.findMany({
      where: { modelId }, select: { task: true },
    });
    for (const { task } of emplois) {
      const restants = await this.prisma.aITaskRoute.count({
        where: { task, modelId: { not: modelId }, model: { enabled: true } },
      });
      if (restants === 0)
        throw new AppError(
          "validation_failed",
          `disabling this model would leave task "${task}" with no usable model`,
        );
    }
  }

  async ecrireChaine(auteurId: string, entree: z.infer<typeof chaineSchema>) {
    const tache = entree.task as TacheIA;

    // Le même modèle deux fois dans une chaîne ferait « réessayer » sur celui
    // qui vient d'échouer. Ce n'est pas un repli.
    if (new Set(entree.modelIds).size !== entree.modelIds.length)
      throw new AppError("validation_failed", "a model cannot appear twice in a chain");

    const modeles = await this.prisma.aIModel.findMany({
      where: { id: { in: entree.modelIds } },
      select: { id: true, provider: true, modelKey: true, capability: true, enabled: true, outageUntil: true },
    });
    const parId = new Map<string, ModeleLu>(modeles.map((m) => [m.id, m as ModeleLu]));

    const requise = CAPACITE_REQUISE[tache];
    for (const id of entree.modelIds) {
      const m = parId.get(id);
      if (!m) throw new AppError("not_found", "unknown model");
      /* Le refus est au serveur, pas à l'écran. Un modèle de texte rangé sur
         une tâche d'image n'échouerait pas ici mais à la première génération,
         en production, sur un contenu déjà facturé au demandeur. */
      if (m.capability !== requise)
        throw new AppError(
          "validation_failed",
          `model ${m.provider}:${m.modelKey} is "${m.capability}" but task "${tache}" needs "${requise}"`,
        );
    }

    if (!entree.modelIds.some((id) => parId.get(id)!.enabled))
      throw new AppError("validation_failed", "a chain needs at least one enabled model");

    const avant = await this.prisma.aITaskRoute.findMany({
      where: { task: tache }, orderBy: { rank: "asc" },
      include: { model: { select: { provider: true, modelKey: true } } },
    });

    return this.prisma.$transaction(async (tx) => {
      await this.journal.consigner({
        auteurId, action: "ai_route_update", motif: entree.reason,
        /* Pas de `cibleId` : la cible est une TÂCHE, pas une ligne. `targetId`
           est un UUID en base, et y glisser un nom de tâche fait tomber
           l'écriture — donc l'écriture entière, transaction oblige. La tâche
           voyage dans les détails, où elle est lisible sans jointure. */
        cibleType: "ai_task_route",
        details: {
          task: tache,
          from: avant.map((r) => `${r.model.provider}:${r.model.modelKey}`),
          to: entree.modelIds.map((id) => {
            const m = parId.get(id)!;
            return `${m.provider}:${m.modelKey}`;
          }),
        },
      }, tx);

      /* On efface puis on réécrit, dans la MÊME transaction. Réordonner par
         mises à jour successives est impossible : l'unicité (tâche, rang) est
         violée dès le premier échange, avant même que le second ne rétablisse
         l'ordre. La table est petite et la tâche est verrouillée le temps de
         l'écriture — le coût est nul, la garantie est totale. */
      await tx.aITaskRoute.deleteMany({ where: { task: tache } });
      await tx.aITaskRoute.createMany({
        data: entree.modelIds.map((modelId, i) => ({ task: tache, modelId, rank: i + 1 })),
      });

      return {
        task: tache,
        ranks: entree.modelIds.map((id, i) => {
          const m = parId.get(id)!;
          return { rank: i + 1, provider: m.provider, modelKey: m.modelKey };
        }),
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
    return this.service.listerModeles();
  }

  // « Piloter les modèles d'IA » appartient à l'admin (ux-admin §6).
  @Patch()
  @Role("admin")
  ecrire(
    @Body(new ZodValidationPipe(modeleSchema)) corps: z.infer<typeof modeleSchema>,
    @Req() req: { admin: { id: string } },
  ) {
    return this.service.ecrireModele(req.admin.id, corps);
  }
}

@Controller("admin/ai-routes")
@UseGuards(AdminGuard, RoleGuard)
export class AIRoutesController {
  constructor(@Inject(AIModelsService) private readonly service: AIModelsService) {}

  @Get()
  lister() {
    return this.service.listerChaines();
  }

  @Patch()
  @Role("admin")
  ecrire(
    @Body(new ZodValidationPipe(chaineSchema)) corps: z.infer<typeof chaineSchema>,
    @Req() req: { admin: { id: string } },
  ) {
    return this.service.ecrireChaine(req.admin.id, corps);
  }
}

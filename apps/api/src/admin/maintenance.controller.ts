import { Body, Controller, Delete, Get, HttpCode, Inject, Injectable, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import {
  arretSchema, leverSchema,
  PARAM_MAINTENANCE, PARAM_MAINTENANCE_UNTIL,
  type MaintenanceStatus,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { MaintenanceService } from "../maintenance/maintenance.service.js";
import { AdminGuard } from "./admin.guard.js";
import { Role, RoleGuard } from "./role.guard.js";
import { AuditService } from "./audit.service.js";

const MINUTE_MS = 60_000;

/**
 * Déclencher, prolonger et lever un arrêt pour intervention.
 *
 * Le mécanisme existait déjà — le garde, l'état public, les trois paramètres
 * semés en migration — mais rien ne permettait de l'actionner : il fallait
 * écrire `true` et une date ISO à la main dans l'écran générique des
 * paramètres. Un interrupteur d'urgence qui demande de composer une date au
 * format ISO n'est pas un interrupteur.
 */
@Injectable()
export class AdminMaintenanceService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly journal: AuditService,
    // L'état se relit par le service qui le sert au public : deux lectures de
    // la même chose finiraient par ne plus dire pareil, et l'administrateur
    // verrait un état que les clients ne voient pas.
    @Inject(MaintenanceService) private readonly maintenance: MaintenanceService,
  ) {}

  etat(): Promise<MaintenanceStatus> {
    return this.maintenance.etat();
  }

  /**
   * L'administrateur annonce une **durée** ; le serveur en déduit l'heure.
   *
   * Et il repart de MAINTENANT, jamais de l'heure déjà annoncée. Prolonger de
   * trente minutes alors que l'échéance est dépassée doit donner trente
   * minutes — additionner à une heure passée annoncerait un retour d'hier.
   */
  declencher(auteurId: string, entree: z.infer<typeof arretSchema>): Promise<MaintenanceStatus> {
    const heure = entree.dureeMinutes === null
      ? ""
      : new Date(Date.now() + entree.dureeMinutes * MINUTE_MS).toISOString();
    return this.ecrire(auteurId, "maintenance_start", entree.reason, "true", heure, {
      dureeMinutes: entree.dureeMinutes,
    });
  }

  /** Rouvrir efface l'heure annoncée. Laissée derrière elle, elle ressortirait
   *  au prochain arrêt : le service annoncerait un retour pour avant-hier. */
  lever(auteurId: string, entree: z.infer<typeof leverSchema>): Promise<MaintenanceStatus> {
    return this.ecrire(auteurId, "maintenance_end", entree.reason, "false", "", {});
  }

  private async ecrire(
    auteurId: string, action: string, motif: string,
    arret: string, heure: string, details: Record<string, unknown>,
  ): Promise<MaintenanceStatus> {
    // La transaction tient les trois ensemble : un service arrêté sans trace,
    // ou un interrupteur posé sans son heure, valent moins que rien. Le journal
    // écrit en premier — s'il refuse le motif, rien n'a bougé.
    await this.prisma.$transaction(async (tx) => {
      await this.journal.consigner({
        auteurId, action, motif,
        cibleType: "system_parameter",
        details: { ...details, until: heure },
      }, tx);

      // `upsert` et non `update` : les trois lignes viennent d'une migration,
      // mais la capacité d'ARRÊTER ne doit pas dépendre d'une ligne présente.
      // Le défaut d'un interrupteur d'arrêt est « ça marche » ; celui du geste
      // qui l'actionne doit être « ça marche aussi ».
      for (const [key, value, valueType] of [
        [PARAM_MAINTENANCE, arret, "boolean"],
        [PARAM_MAINTENANCE_UNTIL, heure, "string"],
      ] as const) {
        await tx.systemParameter.upsert({
          where: { key }, update: { value }, create: { key, value, valueType },
        });
      }
    });

    return this.maintenance.etat();
  }
}

/**
 * Le chemin vit sous `/admin`, que le garde d'arrêt laisse **toujours** passer.
 * C'est délibéré et c'est vital : c'est par là qu'on rouvre. Une route de
 * levée fermée par l'arrêt qu'elle doit lever enfermerait l'équipe dehors.
 */
@Controller("admin/maintenance")
@UseGuards(AdminGuard, RoleGuard)
export class AdminMaintenanceController {
  constructor(@Inject(AdminMaintenanceService) private readonly service: AdminMaintenanceService) {}

  // Fermé au support, comme les paramètres dont l'arrêt fait partie (§5.6,
  // famille Économie) : suspendre le service entier n'est pas un geste
  // d'assistance quotidienne.
  @Get()
  @Role("admin")
  etat(): Promise<MaintenanceStatus> {
    return this.service.etat();
  }

  // Le même appel déclenche et prolonge : ce sont le même geste vu à deux
  // moments — « le service est fermé jusqu'à telle heure ». Deux routes
  // auraient demandé de savoir laquelle employer, pour le même résultat.
  // 200 et non le 201 par défaut de Nest : rien n'est créé à une nouvelle
  // adresse, on pose un état sur une ressource qui existait déjà.
  @Post()
  @Role("admin")
  @HttpCode(200)
  declencher(
    @Body(new ZodValidationPipe(arretSchema)) entree: z.infer<typeof arretSchema>,
    @Req() req: { admin?: { id: string } },
  ): Promise<MaintenanceStatus> {
    return this.service.declencher(req.admin?.id ?? "", entree);
  }

  @Delete()
  @Role("admin")
  lever(
    @Body(new ZodValidationPipe(leverSchema)) entree: z.infer<typeof leverSchema>,
    @Req() req: { admin?: { id: string } },
  ): Promise<MaintenanceStatus> {
    return this.service.lever(req.admin?.id ?? "", entree);
  }
}

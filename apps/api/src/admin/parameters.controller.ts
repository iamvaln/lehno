import { Body, Controller, Get, Inject, Injectable, Patch, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AdminGuard } from "./admin.guard.js";
import { Role, RoleGuard } from "./role.guard.js";
import { AuditService } from "./audit.service.js";

const ecritureSchema = z.object({
  key: z.string().max(64),
  value: z.string().max(500),
  reason: z.string().max(500),
}).strict();

// Ce que la base sait d'un paramètre. Le libellé et l'unité n'y sont pas, et
// n'ont rien à y faire : ce sont des mots d'interface, qui vivent dans le
// dictionnaire du back-office. Le serveur rend la clé, la valeur et son type ;
// l'écran décide comment les nommer.
export type ParametreServeur = {
  key: string;
  value: string;
  valueType: string;
  description: string | null;
  updatedAt: string;
};

@Injectable()
export class ParametersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly journal: AuditService,
  ) {}

  async lister(): Promise<{ items: ParametreServeur[] }> {
    const lignes = await this.prisma.systemParameter.findMany({ orderBy: { key: "asc" } });
    return {
      items: lignes.map((l) => ({
        key: l.key, value: l.value, valueType: l.valueType,
        description: l.description, updatedAt: l.updatedAt.toISOString(),
      })),
    };
  }

  // La valeur est typée en base. Accepter « beaucoup » pour un prix rendrait
  // /v1/public/config incapable de servir un nombre — la landing afficherait
  // NaN, et personne ne saurait d'où ça vient.
  private verifierType(valeur: string, type: string): void {
    const numerique = type === "number" || type === "money" || type === "duration";
    if (numerique && !Number.isFinite(Number(valeur)))
      throw new AppError("validation_failed", `value is not a ${type}`);
    if (type === "boolean" && valeur !== "true" && valeur !== "false")
      throw new AppError("validation_failed", "value is not a boolean");
  }

  async ecrire(auteurId: string, entree: z.infer<typeof ecritureSchema>): Promise<ParametreServeur> {
    // Un paramètre se modifie, il ne se crée pas depuis ici : la liste des clés
    // est une décision de conception, pas une donnée d'exploitation.
    const avant = await this.prisma.systemParameter.findUnique({ where: { key: entree.key } });
    if (!avant) throw new AppError("not_found", "unknown parameter key");

    this.verifierType(entree.value, avant.valueType);

    // La transaction tient les deux ensemble : un paramètre changé sans trace,
    // ou une trace sans changement, valent tous deux moins que rien. Le journal
    // écrit en premier — s'il refuse le motif, la valeur n'a pas bougé.
    return this.prisma.$transaction(async (tx) => {
      await this.journal.consigner({
        auteurId,
        action: "parameter_update",
        motif: entree.reason,
        cibleType: "system_parameter",
        cibleId: avant.id,
        details: { key: avant.key, from: avant.value, to: entree.value },
      }, tx);

      const apres = await tx.systemParameter.update({
        where: { key: entree.key },
        data: { value: entree.value },
      });
      return {
        key: apres.key, value: apres.value, valueType: apres.valueType,
        description: apres.description, updatedAt: apres.updatedAt.toISOString(),
      };
    });
  }
}

@Controller("admin/parameters")
@UseGuards(AdminGuard, RoleGuard)
export class ParametersController {
  constructor(@Inject(ParametersService) private readonly service: ParametersService) {}

  // La lecture reste ouverte au support : consulter la configuration aide à
  // répondre à un utilisateur qui demande pourquoi son crédit coûte ce prix.
  @Get()
  lister(): Promise<{ items: ParametreServeur[] }> {
    return this.service.lister();
  }

  // « Modifier les paramètres globaux » appartient au rôle admin (ux-admin §6).
  @Patch()
  @Role("admin")
  ecrire(
    @Body(new ZodValidationPipe(ecritureSchema)) corps: z.infer<typeof ecritureSchema>,
    @Req() req: { admin: { id: string } },
  ): Promise<ParametreServeur> {
    return this.service.ecrire(req.admin.id, corps);
  }
}

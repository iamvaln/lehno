import { Body, Controller, Get, Inject, Injectable, Patch, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { EventKind } from "@prisma/client";
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

// Les types d'occasion sont un enum du schéma, pas une table. On les rend pour
// qu'un administrateur voie lesquels existent, en disant qu'ils ne se règlent
// pas d'ici : offrir un interrupteur qui n'enregistre rien est pire que ne rien
// offrir. Les valeurs viennent de l'enum lui-même — elles ne peuvent pas
// dériver de ce que la base connaît.
const TYPES_OCCASION = Object.values(EventKind).map((id) => ({
  id,
  actif: true,
  // « sensitive » est une nature d'événement, portée par chaque occasion et non
  // par son type : aucun type n'est sensible en soi.
  sensible: false,
  reglable: false,
}));

const TYPE_VALEUR = new Set(["number", "money", "duration", "boolean", "string"]);
const typeContrat = (brut: string): "number" | "money" | "duration" | "boolean" | "string" =>
  (TYPE_VALEUR.has(brut) ? brut : "string") as "number" | "money" | "duration" | "boolean" | "string";

@Injectable()
export class ParametersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly journal: AuditService,
  ) {}

  // La forme est celle du contrat publié : deux groupes, pas une liste plate.
  // Libellé, aide et unité n'y figurent pas — le serveur transporte des clés,
  // jamais des phrases composées, et c'est ce qui rend l'outil bilingue sans
  // qu'il ait à connaître la langue de qui l'appelle.
  async lister() {
    const lignes = await this.prisma.systemParameter.findMany({ orderBy: { key: "asc" } });

    // « Modifier une valeur, avec rappel de la précédente » (ux-admin §5.6). La
    // précédente ne vit nulle part dans system_parameter — la colonne porte
    // l'état, pas l'histoire. C'est le journal d'audit qui la garde, dans le
    // « from » de la dernière écriture.
    const traces = await this.prisma.auditLog.findMany({
      where: { action: "parameter_update" },
      orderBy: { createdAt: "desc" },
      select: { metadata: true },
    });
    const precedente = new Map<string, string>();
    for (const trace of traces) {
      const details = trace.metadata as { key?: string; from?: string } | null;
      // La plus récente gagne, et les plus anciennes ne l'écrasent pas : la
      // liste est déjà triée du plus récent au plus ancien.
      if (details?.key && details.from !== undefined && !precedente.has(details.key)) {
        precedente.set(details.key, details.from);
      }
    }

    return {
      economie: lignes.map((l) => ({
        cle: l.key,
        valeur: l.value,
        type: typeContrat(l.valueType),
        valeurPrecedente: precedente.get(l.key) ?? null,
        misAJourLe: l.updatedAt.toISOString(),
      })),
      typesEvenement: TYPES_OCCASION,
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
  lister() {
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

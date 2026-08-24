import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";

// Le plancher est celui de la contrainte posée en base (voir la migration
// d'administration) et celui du contrat partagé avec le back-office. Les trois
// disent six, et c'est le même six : un motif de deux caractères satisferait la
// lettre de la règle et la viderait.
const MOTIF_MINIMUM = 6;

export type Intervention = {
  auteurId: string;
  action: string;
  motif: string;
  cibleType?: string;
  cibleId?: string;
  /** Ce que le geste a changé. « il valait 100 » se relit ; « il a changé » ne dit rien. */
  details?: Prisma.InputJsonValue;
};

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Consigne un geste d'administration. La base refuse déjà un motif absent ou
   * trop court ; ce contrôle-ci existe pour rendre une erreur lisible plutôt
   * qu'une violation de contrainte, et pour refuser **avant** que l'écriture
   * métier n'ait eu lieu.
   */
  async consigner(geste: Intervention, client: Prisma.TransactionClient | PrismaService = this.prisma): Promise<void> {
    const motif = geste.motif?.trim() ?? "";
    if (motif.length < MOTIF_MINIMUM)
      throw new AppError("reason_required", "an admin action requires a reason");

    // exactOptionalPropertyTypes : une propriété absente et une propriété à
    // `undefined` ne sont pas la même chose pour Prisma. On ne pose `metadata`
    // que lorsqu'il y a quelque chose à poser.
    await client.auditLog.create({
      data: {
        actorType: "admin",
        actorId: geste.auteurId,
        action: geste.action,
        reason: motif,
        targetType: geste.cibleType ?? null,
        targetId: geste.cibleId ?? null,
        ...(geste.details === undefined ? {} : { metadata: geste.details }),
      },
    });
  }
}

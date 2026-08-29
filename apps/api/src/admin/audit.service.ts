import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";

// Le plancher est celui de la contrainte posée en base (voir la migration
// d'administration) et celui du contrat partagé avec le back-office. Les trois
// disent six, et c'est le même six : un motif de deux caractères satisferait la
// lettre de la règle et la viderait.
const MOTIF_MINIMUM = 6;

/** Le motif libre réservé quand aucun préréglage ne convient. */
export const CODE_AUTRE = "other";

export type Intervention = {
  auteurId: string;
  action: string;
  motif: string;
  /**
   * Le geste, tel que l'écran le nomme — et non l'`action` journalisée.
   *
   * Le vocabulaire du journal est plus GROSSIER que celui des écrans :
   * `user_status_update` couvre la suspension et le rétablissement. C'est le
   * geste qui décide des motifs proposés, sans quoi on offrirait « Compte de
   * test » au moment de suspendre quelqu'un.
   */
  geste?: string;
  /**
   * Le code du motif retenu. Facultatif — huit gestes n'ont aucun préréglage et
   * n'attendent qu'une phrase. Mais s'il est là, il est VÉRIFIÉ : un code
   * accepté sans contrôle ne serait qu'une chaîne libre de plus, et les
   * comptages qu'il doit permettre mentiraient d'autant plus qu'on y croirait.
   */
  codeMotif?: string;
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

    await this.verifierLeCode(geste, client);

    // exactOptionalPropertyTypes : une propriété absente et une propriété à
    // `undefined` ne sont pas la même chose pour Prisma. On ne pose `metadata`
    // que lorsqu'il y a quelque chose à poser.
    await client.auditLog.create({
      data: {
        actorType: "admin",
        actorId: geste.auteurId,
        action: geste.action,
        reason: motif,
        // `exactOptionalPropertyTypes` : une propriété absente et une propriété
        // à `undefined` ne sont pas la même chose pour Prisma.
        reasonCode: geste.codeMotif?.trim() || null,
        targetType: geste.cibleType ?? null,
        targetId: geste.cibleId ?? null,
        ...(geste.details === undefined ? {} : { metadata: geste.details }),
      },
    });
  }

  /**
   * Un code retenu doit vouloir dire quelque chose POUR CE GESTE-LÀ.
   *
   * Trois refus distincts, et ils ne disent pas la même chose : un code inconnu
   * est une faute d'appel ; un code retiré est un motif qu'on ne propose plus
   * mais qui a servi hier ; un code d'un autre geste est le cas qui rendrait
   * les comptages faux sans que rien ne se voie — « Compte de test » enregistré
   * sur une suspension.
   *
   * `other` échappe au contrôle : c'est le motif libre, il n'a pas de portée et
   * n'en aura jamais. Sa phrase, elle, reste obligatoire comme les autres.
   */
  private async verifierLeCode(
    geste: Intervention,
    client: Prisma.TransactionClient | PrismaService,
  ): Promise<void> {
    const code = geste.codeMotif?.trim();
    if (!code || code === CODE_AUTRE) return;

    const motif = await client.auditReason.findUnique({
      where: { code },
      select: { isActive: true, scopes: { select: { geste: true } } },
    });
    if (!motif)
      throw new AppError("reason_code_unknown", `unknown reason code: ${code}`);
    if (!motif.isActive)
      throw new AppError("reason_code_unknown", `reason code is retired: ${code}`);

    // Sans geste déclaré, on ne peut RIEN vérifier. On refuse plutôt que de
    // laisser passer : un contrôle qui s'abstient quand l'appelant est
    // incomplet ne protège que les appels déjà corrects.
    if (!geste.geste)
      throw new AppError("reason_code_unknown", "a reason code requires a gesture");
    if (!motif.scopes.some((p) => p.geste === geste.geste))
      throw new AppError("reason_code_unknown", `reason code ${code} does not apply to ${geste.geste}`);
  }
}

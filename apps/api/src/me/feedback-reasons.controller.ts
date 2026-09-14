import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import { NATURES_AVIS, type FeedbackReasons } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { AuthGuard } from "../auth/auth.guard.js";
import type { FeedbackNature } from "./feedback.js";

type AuthedRequest = { userId: string };

/**
 * WHY A PRODUCTION DISPLEASED — the list the app offers.
 *
 * **SERVED, NEVER WRITTEN INTO THE APP.** The first months are exactly the ones
 * where nobody knows what to list: a reason has to be addable without shipping a
 * release. And since the version registry exists, shipping is not cheap — one
 * more reason is not worth asking everyone to update.
 *
 * **THE LIST IS PER NATURE, and it is not filtered client-side.** "Poor
 * likeness" means nothing under a message, "out of budget" nothing under a
 * portrait. Offering a reason the server will refuse would fail the verdict
 * after the person has already answered the question.
 *
 * **THE LABEL ARRIVES IN THE INTERFACE LANGUAGE**, like the studio catalogue:
 * the server knows which one, and returning both would make the client decide
 * something it has no business deciding.
 */
@Controller("me/feedback-reasons")
@UseGuards(AuthGuard)
export class FeedbackReasonsController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @Req() req: AuthedRequest,
    @Query("nature") nature?: string,
  ): Promise<FeedbackReasons> {
    /* THE NATURE IS REQUIRED, and an unknown one is refused rather than served
       empty. An empty list would read as "this production takes no reason", and
       the screen would let a thumb down through without one — which the server
       then refuses, after the question was asked. */
    if (nature === undefined || !(NATURES_AVIS as readonly string[]).includes(nature))
      throw new AppError("validation_failed", `unknown nature "${nature ?? ""}"`);

    const [account, rows] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: req.userId }, select: { uiLanguage: true } }),
      this.prisma.feedbackReason.findMany({
        where: { isActive: true, natures: { has: nature as FeedbackNature } },
        orderBy: [{ position: "asc" }, { code: "asc" }],
        select: { code: true, labelFr: true, labelEn: true },
      }),
    ]);

    /* RETIRED ONES EXCLUDED — the registry keeps them so that what they already
       justified stays readable, but the service refuses a retired code. Offering
       them would fail the verdict after the fact, on a reason we had just
       offered. Same rule as the admin reason registry, for the same reason. */
    const english = account?.uiLanguage === "en";
    return { items: rows.map((r) => ({ code: r.code, label: english ? r.labelEn : r.labelFr })) };
  }
}

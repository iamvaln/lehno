import type { AvisInput, NatureAvis } from "@lehno/contracts";
import { AppError } from "../common/errors.js";
import type { PrismaService } from "../prisma/prisma.service.js";

/** From the contract, never redeclared here: two lists would drift, and the one
 *  that drifted would only show up as a count nobody can explain. */
export type FeedbackNature = NatureAvis;

/** What every production writes when someone judges it. */
export interface FeedbackWrite {
  feedback: "up" | "down" | null;
  feedbackAt: Date | null;
  feedbackReasonCode: string | null;
  feedbackNote: string | null;
}

/**
 * ONE PLACE WHERE THE THREE NATURES WRITE THEIR VERDICT.
 *
 * Portrait, message and idea carry the same four columns and the same two
 * constraints. Writing the update three times would let them drift — and they
 * would drift silently, because each has its own tests and each would stay
 * green while saying something slightly different from the other two.
 *
 * **CLEARING IS AS IMPORTANT AS SETTING.** Taking a thumb back has to take the
 * reason and the note with it: a note outliving its verdict is a comment on
 * nothing, and it would still be read in the panel, attributed to a production
 * nobody judges any more. The database holds that line too — this function is
 * what keeps the API from ever hitting it.
 */
export async function feedbackWrite(
  prisma: PrismaService, nature: FeedbackNature, entry: AvisInput,
): Promise<FeedbackWrite> {
  if (entry.feedback === null)
    return { feedback: null, feedbackAt: null, feedbackReasonCode: null, feedbackNote: null };

  /* THE CODE IS CHECKED AGAINST THE ACTIVE LIST, FOR THIS NATURE.
   *
   * There is no foreign key on purpose — a retired reason has to stop being
   * offered without breaking what it already justified. So the check lives
   * here, and it checks the two things a foreign key would not: that the reason
   * is still offered, and that it is offered for THIS nature. "Poor likeness"
   * under a message would be counted forever, in a column nobody can read. */
  if (entry.reasonCode !== undefined) {
    const known = await prisma.feedbackReason.findFirst({
      where: { code: entry.reasonCode, isActive: true, natures: { has: nature } },
      select: { id: true },
    });
    if (!known) throw new AppError("validation_failed", `unknown feedback reason: ${entry.reasonCode}`);
  }

  return {
    feedback: entry.feedback,
    feedbackAt: new Date(),
    feedbackReasonCode: entry.reasonCode ?? null,
    feedbackNote: entry.note ?? null,
  };
}

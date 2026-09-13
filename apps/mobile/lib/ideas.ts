import type { GeneratedIdea, GenerationResult } from "@lehno/contracts";

/* What a produced set of ideas lets you do, decided away from React.
 *
 * TWO GESTURES, NEVER ONE. Keeping an idea and liking it are different things,
 * and merging them would destroy the signal we came for: someone can find an
 * idea excellent and not keep it — too expensive, already given last year, not
 * for that person. A single "like" button that also kept the idea would make
 * those two answers indistinguishable.
 *
 * This file is in English: `CLAUDE.md` asks that every new file be, until the
 * normalisation pass reaches the older ones.
 */

const ROOT = "/me/ideas";

/** A call to make, or nothing when the gesture would be a no-op. */
export interface Call {
  path: string;
  method: "POST" | "PATCH";
  body: unknown;
}

/* KEEPING IS ONE-WAY, and that is why the button disappears instead of turning
 * into "un-keep". `wishlistItemId` is the wish born from the idea: once it
 * exists, the wish is an object of its own, editable and deletable from the
 * list where it now lives. Offering to undo from here would suggest the two
 * stay tied, and deleting a wish someone has since renamed would be a surprise. */
export function keeping(idea: GeneratedIdea): Call | null {
  if (idea.wishlistItemId !== null) return null;
  return { path: `${ROOT}/${idea.id}/accept`, method: "POST", body: {} };
}

/* THE SAME PRESS TWICE REMOVES THE OPINION, and that is the whole point of
 * `null` in the contract: "a slip of the finger would otherwise be final, and
 * a note you cannot correct is a note people stop giving".
 *
 * Pressing the opposite thumb replaces it — no need to clear first. */
export function rating(idea: GeneratedIdea, pressed: "up" | "down"): Call {
  const wanted = idea.feedback === pressed ? null : pressed;
  return { path: `${ROOT}/${idea.id}/feedback`, method: "PATCH", body: { feedback: wanted } };
}

/* WHAT THE RESULT SCREEN SHOWS, and it is not "a message or nothing".
 *
 * `phaseDuResultat` used to fall through to "failed" whenever a message was
 * missing — so a successful set of ideas, paid for and produced, announced that
 * it had not worked. The contract has carried `ideas` for a while; the screen
 * had not caught up.
 *
 * An empty array is NOT a failure either: the generation ran, the credit is
 * spent, and there is simply nothing to show. Saying "it failed" would promise
 * a refund that will not come. */
export function producedIdeas(result: GenerationResult | null): readonly GeneratedIdea[] | null {
  if (!result || result.generation.status !== "succeeded") return null;
  return result.ideas?.ideas ?? null;
}

/* A PRICE NOBODY CAN READ IS WORTH LESS THAN NO PRICE AT ALL — the contract
 * says so about the range itself, and the same holds for how we show it.
 *
 * NEVER A LONE LOWER BOUND. "From 20" tells you nothing about what to expect;
 * "up to 50" does, because it bounds the effort. So an upper bound alone is
 * shown, a lower one alone is not.
 *
 * The currency comes from the server, never from a constant here: it belongs to
 * the configuration, and a copy would drift the day it changes. Absent, we show
 * nothing rather than a bare number someone would read in their own currency. */
export function priceLabel(
  idea: GeneratedIdea,
  t: {
    ideesPrix: (min: string, max: string) => string;
    ideesPrixMax: (max: string) => string;
  },
): string | null {
  if (idea.currency === null || idea.priceMax === null) return null;
  const max = `${idea.priceMax} ${idea.currency}`;
  if (idea.priceMin === null) return t.ideesPrixMax(max);
  return t.ideesPrix(`${idea.priceMin}`, max);
}

import type { NatureAvis } from "@lehno/contracts";

/* Liking and disliking a production, shared by the three surfaces that have one.
 *
 * WHY ONE MODULE FOR THREE SCREENS: the rules are the server's, not each
 * screen's — a dislike carries a reason, a like carries none, and clearing an
 * opinion takes everything with it. Written three times they would drift, and
 * the drift would only show in production, on a count that came out wrong.
 *
 * THIS IS NOT THE VERDICT. Keeping a portrait and liking it are different
 * questions: one engages the object, the other says what you think of it. You
 * can keep something you don't admire, and that answer says something precise
 * neither would say alone.
 */

/** Where each nature's opinion is posted. The server owns the shape; we own the path. */
const PATHS: Readonly<Record<NatureAvis, string>> = {
  portrait: "/me/portraits",
  message: "/me/messages",
  idees: "/me/ideas",
};

export interface RatingCall {
  path: string;
  body: { feedback: "up" | "down" | null; reasonCode?: string; note?: string };
}

/** What the thumb currently says, as the screens read it back. */
export interface Rated {
  feedback: "up" | "down" | null;
}

/* PRESSING THE SAME THUMB AGAIN REMOVES THE OPINION.
 *
 * The contract puts it plainly: "a slip of the finger would otherwise be final,
 * and a note you cannot correct is a note people stop giving". Pressing the
 * opposite one replaces it — there is nothing to clear first. */
export function wanted(current: Rated, pressed: "up" | "down"): "up" | "down" | null {
  return current.feedback === pressed ? null : pressed;
}

/* A DISLIKE NEEDS ITS REASON BEFORE IT CAN BE SENT, and that is why this returns
 * null rather than a call: the screen must ASK first. Sending the dislike and
 * asking afterwards would leave an opinion recorded without the one thing we
 * came for — and someone who closed the question would never be asked again. */
export function needsReason(next: "up" | "down" | null): boolean {
  return next === "down";
}

/* THE THREE RULES OF THE BODY, and they are the server's, restated here so that
 * a screen cannot break them by accident:
 *
 * — a dislike CARRIES a reason;
 * — a like carries none — sending one would be refused;
 * — clearing takes everything, reason and note with it.
 *
 * `exactOptionalPropertyTypes` is on, so the optional fields are spread
 * conditionally: an explicit `undefined` would travel as a present key. */
export function ratingCall(
  nature: NatureAvis,
  id: string,
  next: "up" | "down" | null,
  reason?: { code: string; note?: string },
): RatingCall {
  const path = `${PATHS[nature]}/${id}/feedback`;
  if (next !== "down") return { path, body: { feedback: next } };
  return {
    path,
    body: {
      feedback: "down",
      ...(reason === undefined ? {} : { reasonCode: reason.code }),
      ...(reason?.note === undefined || reason.note.trim() === ""
        ? {}
        : { note: reason.note.trim() }),
    },
  };
}

/** Where the reasons for one nature are listed. They are never filtered here. */
export function reasonsPath(nature: NatureAvis): string {
  return `/me/feedback-reasons?nature=${nature}`;
}

/**
 * Which of the three shapes a countdown takes.
 *
 * `daysUntil` IS SIGNED — negative once the date has gone by — and the list of
 * dates asks the server for a month back on purpose: one comes back to see what
 * one has missed. The label, though, had no form for that. « J− » plus « −4 »
 * produced « J−−4 » on screen, which says nothing at all.
 *
 * WHY A SHAPE AND NOT A LABEL. Two screens already handle a past date, and
 * neither counts: the occasion shows a « Passée » tag, the reminder a sentence.
 * Counting the days since would need a notation, and the integration brief is
 * explicit that the countdown's notation — « J−3 » against « 3 days » — is not
 * settled and must not be frozen in a component. So this function says WHICH
 * form applies and leaves the words where the words live.
 */
export type CountdownShape = "past" | "today" | "ahead";

export function countdownShape(daysUntil: number): CountdownShape {
  if (daysUntil < 0) return "past";
  return daysUntil === 0 ? "today" : "ahead";
}

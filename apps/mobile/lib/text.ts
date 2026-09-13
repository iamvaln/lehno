/**
 * Ending a sentence that may already end itself.
 *
 * `Intl.DateTimeFormat` with `month: "short"` abbreviates, and an abbreviation
 * in French carries its own full stop: « nov. », « déc. », « janv. ». A label
 * that appends one produces « Rien avant le 7 nov.. » — while the same label
 * reads fine on « 4 mars », which is not abbreviated, and fine in English,
 * where the short month is "Nov" with nothing after it.
 *
 * So the defect appears for some months, in one language, and hides in the
 * other eleven cases. That is why this is a function and not a fix at one call
 * site: whoever writes the next label interpolating a date will not know.
 */
export function endSentence(text: string): string {
  return text.endsWith(".") ? text : `${text}.`;
}

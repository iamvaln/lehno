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

/**
 * French elision before a name: « de Awa » → « d'Awa ».
 *
 * Nothing in the dictionary did this, and the product is about writing to people
 * BY NAME. « La wishlist de Awa » and « Le Mur de Awa » are the titles of the
 * pages one sends to one's friends — the two most public strings in the app —
 * and every vowel-initial name got them wrong: Awa, Élise, Ines, Omar, Ada.
 *
 * FRENCH ONLY, and deliberately so: English says "Awa's wishlist" and has no
 * such rule. The function lives here rather than in `fr.ts` because the
 * dictionary holds words, not rules — and because the next label that
 * interpolates a name will need it too.
 *
 * H IS LEFT ALONE, and that is a decision rather than an omission. French
 * elides before a mute h (« d'Henri ») but not before an aspirate one
 * (« de Hugo »), and NOTHING IN THE SPELLING TELLS THEM APART — it is a fact
 * about each word, learnt one by one. On a proper noun there is no list to
 * consult. « de Hugo » reads as slightly formal; « d'Hugo » reads as a mistake
 * on someone's name, which is worse in a product whose whole promise is getting
 * the name right.
 */
const VOYELLES = /^[aeiouyàâäéèêëîïôöùûüÿ]/i;

export function elideBefore(word: string, name: string): string {
  const trimmed = name.trim();
  if (trimmed === "" || !VOYELLES.test(trimmed)) return `${word} ${trimmed}`;
  /* On retire la dernière lettre du mot, pas un « e » en dur : la règle vaut
     pour « de », « que », « le », « la », « ce » — et « la » n'est pas en « e ». */
  return `${word.slice(0, -1)}'${trimmed}`;
}

import { fr } from "./fr.js";
import { en } from "./en.js";

// Le back-office se lit dans les deux langues du produit. La forme reprend
// apps/web/messages : `en` est typé `typeof fr`, ce qui interdit à la
// compilation une clé oubliée ou une clé en trop.
export const LANGUES = ["fr", "en"] as const;
export type Langue = (typeof LANGUES)[number];

export type Messages = typeof fr;

const TABLES: Record<Langue, Messages> = { fr, en };

export function estLangue(valeur: string): valeur is Langue {
  return (LANGUES as readonly string[]).includes(valeur);
}

export function messages(langue: Langue): Messages {
  return TABLES[langue];
}

export { fr, en };

/** Les codes d'erreur que l'outil sait dire. */
export type CleCode = keyof Messages["codes"];

/**
 * Ramène un code venu du client à un code que le dictionnaire sait dire.
 *
 * Le serveur en émet une trentaine, dont la plupart appartiennent aux surfaces
 * publiques ou à l'espace privé — l'administration n'en rencontrera jamais.
 * Les traduire tous encombrerait le dictionnaire de phrases mortes ; en laisser
 * passer un afficherait une case vide. On retombe donc sur l'erreur générique,
 * qui dit au moins quoi faire : réessayer.
 */
export function codeConnu(code: string): CleCode {
  return code in fr.codes ? (code as CleCode) : "internal_error";
}

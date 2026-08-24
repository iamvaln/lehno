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

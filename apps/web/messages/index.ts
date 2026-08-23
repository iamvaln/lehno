import { fr } from "./fr";
import { en } from "./en";
import type { Langue } from "../lib/langues";

export type Messages = typeof fr;

const TABLES: Record<Langue, Messages> = { fr, en };

export function messages(langue: Langue): Messages {
  return TABLES[langue];
}

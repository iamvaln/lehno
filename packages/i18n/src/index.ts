import type { ErrorCode } from "@lehno/contracts";
import { fr } from "./fr.js";
import { en } from "./en.js";

export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const catalogues = { fr, en } as const;

export function translateError(code: ErrorCode, locale: Locale): string {
  return catalogues[locale].errors[code];
}

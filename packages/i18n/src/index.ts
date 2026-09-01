import type { ErrorCode } from "@lehno/contracts";
import { fr } from "./fr.js";
import { en } from "./en.js";
import type { Locale } from "./locale.js";

export { LOCALES } from "./locale.js";
export type { Locale } from "./locale.js";
export { phraseDeNotification, CLES_COMPOSEES } from "./notifications.js";
export type { Phrase } from "./notifications.js";

export const catalogues = { fr, en } as const;

export function translateError(code: ErrorCode, locale: Locale): string {
  return catalogues[locale].errors[code];
}

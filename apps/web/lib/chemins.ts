import type { Langue } from "./langues.js";
import type { Document } from "./legal.js";

// Les pages légales portent un chemin dans la langue de la page. Rien
// n'obligeait à cela au départ, et le site a d'abord servi « /en/confidentialite » :
// un mot français dans la barre d'adresse d'un lecteur anglophone, et une page
// anglaise indexée sous une URL française.
//
// Contact et FAQ s'écrivent pareil dans les deux langues : ils n'ont pas
// d'entrée ici, leur dossier de route suffit.
export const CHEMINS_LEGAUX: Record<Document, Record<Langue, string>> = {
  cgu: { fr: "conditions", en: "terms" },
  confidentialite: { fr: "confidentialite", en: "privacy" },
  mentions: { fr: "mentions-legales", en: "legal-notice" },
};

/** Le chemin complet d'un document légal, dans la langue demandée. */
export function cheminLegal(document: Document, langue: Langue): string {
  return `/${langue}/${CHEMINS_LEGAUX[document][langue]}`;
}

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

/* LE MÊME ÉCRAN, DANS L'AUTRE LANGUE.
 *
 * La bascule renvoyait à `/en` quelle que soit la page : depuis la FAQ on
 * repartait à l'accueil, et il fallait retrouver son chemin. Un lecteur qui
 * change de langue veut lire CE QU'IL LISAIT, pas revenir au début.
 *
 * L'échange naïf du préfixe ne suffit pas : les pages légales portent un
 * chemin traduit, donc « /fr/confidentialite » donnerait
 * « /en/confidentialite », qui n'existe pas. C'est la raison d'être de
 * CHEMINS_LEGAUX juste au-dessus, et il fallait s'en servir ici.
 *
 * Un chemin inconnu passe tel quel plutôt que d'être ramené à l'accueil : les
 * surfaces à jeton (`/c/`, `/m/`, `/v/`, `/i/`, `/l/`) s'écrivent pareil dans
 * les deux langues, et rien n'oblige à les énumérer pour qu'elles marchent.
 */
export function cheminDansLautreLangue(chemin: string, depuis: Langue): string {
  const vers: Langue = depuis === "fr" ? "en" : "fr";
  const segments = chemin.split("/").filter((s) => s !== "");

  // Hors d'une page localisée — rien à traduire, on rejoint la racine.
  if (segments[0] !== depuis) return `/${vers}`;

  const reste = segments.slice(1);
  if (reste.length === 0) return `/${vers}`;

  const traduit = Object.values(CHEMINS_LEGAUX).find((m) => m[depuis] === reste[0]);
  if (traduit) return `/${vers}/${[traduit[vers], ...reste.slice(1)].join("/")}`;

  return `/${vers}/${reste.join("/")}`;
}

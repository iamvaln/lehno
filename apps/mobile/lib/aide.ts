import { LEGAL_DOCUMENTS, type LegalDocument } from "@lehno/contracts";

/* Aide et documents — §3.26.
 *
 * Trois rangs à la maquette : questions fréquentes, nous écrire, noter
 * l'application. Deux d'entre eux ont une destination servie ; le troisième
 * dépend d'une fiche de magasin qui n'existe pas encore.
 */

/* LE DOCUMENT DEMANDÉ AU SERVEUR.
 *
 * Trois seulement — le contrat les énumère, et une valeur hors liste rend 404.
 * On ne compose donc pas le chemin depuis une chaîne libre : le typage refuse
 * ce que le serveur refuserait.
 *
 * La LANGUE accompagne la demande. Le français est la langue de référence et
 * le défaut du serveur ; l'omettre servirait du français à quelqu'un qui lit
 * l'anglais, sur le document le plus important à comprendre exactement. */
export function cheminDuDocument(document: LegalDocument, langue: string): string {
  const lang = langue === "en" ? "en" : "fr";
  return `/public/legal/${document}?lang=${lang}`;
}

/* LES DOCUMENTS QU'ON LIT DANS L'APPLICATION.
 *
 * Ceux qu'on a acceptés en entrant : on les cherche justement APRÈS, quand une
 * question se pose, et les rouvrir ne doit demander ni réseau ni navigateur de
 * plus que le reste.
 *
 * `mentions` n'en est pas, et ce n'est plus faute de libellé : les mentions
 * légales vivent sur la page d'accueil du site, et c'est ce lien-là qu'on
 * pose. Les dupliquer dans l'application créerait un second endroit où
 * l'éditeur se décrit, et l'un des deux finirait périmé.
 */
export const DOCUMENTS_INTERNES: readonly LegalDocument[] = ["cgu", "confidentialite"];

/* Ce qui se lit ailleurs qu'ici. Existe pour qu'un test dise POURQUOI un
   document servi n'est pas dans la liste — sans quoi la prochaine personne le
   prendrait pour un oubli et l'ajouterait. */
export function documentsHorsApplication(): LegalDocument[] {
  return LEGAL_DOCUMENTS.filter((d) => !DOCUMENTS_INTERNES.includes(d));
}

/* NOTER L'APPLICATION MÈNE AU MAGASIN, et l'URL se DÉCLARE — elle ne se déduit
 * pas de l'identifiant du paquet.
 *
 * `com.lehno.app` existe déjà dans la configuration, et il serait tentant d'en
 * composer `play.google.com/store/apps/details?id=…`. Mais un paquet déclaré
 * n'est pas une fiche publiée : le lien mènerait à une page absente jusqu'au
 * jour de la mise en ligne, et personne ne s'en apercevrait avant qu'un
 * utilisateur ne tombe dessus.
 *
 * Tant que l'URL n'est pas renseignée, le rang ne paraît pas. Le jour où elle
 * l'est, il paraît de lui-même — comme les rangs des réglages, on remplit la
 * valeur et le chemin s'ouvre, sans retoucher le code.
 */
export function lienDuMagasin(
  extra: { appStoreUrl?: unknown; playStoreUrl?: unknown } | null | undefined,
  plateforme: "ios" | "android" | string,
): string | null {
  return lienDeclare(plateforme === "ios" ? extra?.appStoreUrl : extra?.playStoreUrl);
}

/* LES MENTIONS LÉGALES SONT SUR LE SITE, et c'est ce lien qu'on pose.
 *
 * Déclarée entière, jamais composée : le chemin de cette page est DANS SA
 * LANGUE — `/fr/mentions-legales` — et n'existe qu'en français ; « /en/… »
 * répond 404. Fabriquer l'adresse depuis la langue de l'interface enverrait
 * donc la moitié des gens sur une page absente.
 */
export function lienDesMentions(
  extra: { mentionsUrl?: unknown } | null | undefined,
): string | null {
  return lienDeclare(extra?.mentionsUrl);
}

/* Une valeur vide, mal recopiée, ou qui ne sort pas en `https` ne s'ouvre pas :
   la configuration est éditée à la main, et une valeur laissée à moitié
   remplie ne doit pas ouvrir n'importe quoi. */
function lienDeclare(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const url = brut.trim();
  return url.startsWith("https://") ? url : null;
}

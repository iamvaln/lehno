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

/* LES DOCUMENTS QU'ON SAIT NOMMER, dans l'ordre où on les cherche : ce qu'on a
 * accepté d'abord, ce qui touche aux données ensuite.
 *
 * `mentions` n'y est pas, et ce n'est pas un oubli : la copie ne porte aucun
 * libellé pour lui — seuls `connexionPiedCgu` et `connexionPiedConf` existent,
 * écrits pour le pied de l'écran de connexion. Écrire « Mentions légales »
 * moi-même serait rédiger à la place de qui rédige.
 *
 * Le LECTEUR, lui, sait afficher les trois : le jour où le libellé arrive, il
 * suffit d'ajouter la ligne ici.
 */
export const DOCUMENTS_ETIQUETES: readonly LegalDocument[] = ["cgu", "confidentialite"];

/* Ce que le contrat sert et que l'écran ne propose pas encore. Rendu visible
   par un test plutôt que perdu dans un commentaire — un document légal qu'on
   ne montre pas ne protège personne. */
export function documentsSansLibelle(): LegalDocument[] {
  return LEGAL_DOCUMENTS.filter((d) => !DOCUMENTS_ETIQUETES.includes(d));
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
  const brut = plateforme === "ios" ? extra?.appStoreUrl : extra?.playStoreUrl;
  if (typeof brut !== "string") return null;
  const url = brut.trim();
  /* Une URL vide ou qui ne sort pas en `https` ne s'ouvre pas : la
     configuration est éditée à la main, et une valeur laissée à moitié
     remplie ne doit pas ouvrir n'importe quoi. */
  return url.startsWith("https://") ? url : null;
}

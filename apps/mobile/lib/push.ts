import { registerDeviceSchema, type RegisterDeviceInput } from "@lehno/contracts";

/* LES NOTIFICATIONS POUSSÉES — spec technique §5.7 et §16.
 *
 * Ce module ne parle NI à OneSignal NI au réseau : il décide seulement quoi
 * envoyer et quand. Le SDK est un module natif, donc intestable ici — le
 * séparer permet d'éprouver les règles sans lui, et c'est là que sont les
 * pièges.
 */

/* LA PLATEFORME SE RECONNAÎT, ELLE NE SE DEVINE PAS.
 *
 * Le contrat n'accepte que `ios` et `android`. `Platform.OS` peut rendre
 * « web », « windows » ou « macos » : envoyer l'un des trois ferait échouer la
 * validation côté serveur avec une erreur qui ne dirait pas pourquoi. On rend
 * `null`, et l'appelant n'enregistre rien — un appareil qui ne peut pas
 * recevoir de notification n'a pas à figurer dans la liste de ceux qui le
 * peuvent.
 */
export function plateformeDeLAppareil(os: string): "ios" | "android" | null {
  return os === "ios" || os === "android" ? os : null;
}

/* LA VERSION EST FACULTATIVE, ET BORNÉE À VINGT CARACTÈRES au contrat.
 *
 * Une version absente vaut mieux qu'une version tronquée : « 1.2.3-rc.4+build »
 * coupé à vingt donnerait un numéro qui n'existe pas, et c'est sur ce numéro
 * qu'on cherchera d'où vient un défaut. On omet plutôt que de mentir.
 */
export const LONGUEUR_MAX_VERSION = 20;

export function versionEnvoyable(version: string | null | undefined): string | undefined {
  const v = version?.trim() ?? "";
  if (v === "" || v.length > LONGUEUR_MAX_VERSION) return undefined;
  return v;
}

export function corpsDEnregistrement(
  jeton: string,
  plateforme: "ios" | "android",
  version: string | null | undefined,
): RegisterDeviceInput {
  const v = versionEnvoyable(version);
  return registerDeviceSchema.parse({
    pushToken: jeton.trim(),
    platform: plateforme,
    ...(v === undefined ? {} : { appVersion: v }),
  });
}

/* QUAND ENREGISTRER, et c'est la décision qui porte tout le reste.
 *
 * PAS AVANT LA SESSION. Un jeton enregistré sans compte n'a personne à qui se
 * rattacher : la route est authentifiée, l'appel rendrait 401, et le jeton
 * serait perdu jusqu'au prochain démarrage.
 *
 * À CHAQUE OUVERTURE DE SESSION, pas une seule fois. Le jeton est un jeton
 * D'INSTALLATION — « réinstaller l'application sur le même téléphone en produit
 * un nouveau » — et le serveur traite chaque jeton comme un appareil distinct.
 * Ne l'envoyer qu'à la première connexion laisserait quelqu'un sans
 * notifications après une réinstallation, sans qu'aucun écran ne le montre.
 *
 * ET C'EST SANS DANGER : le serveur fait un `upsert` sur (compte, jeton), et
 * « réenregistrer un jeton déjà connu ne compte pas contre le plafond ». Le
 * coût d'un envoi de trop est nul ; celui d'un envoi manquant est un téléphone
 * silencieux.
 *
 * MAIS PAS DEUX FOIS POUR RIEN dans la même vie de l'application : sans ce
 * garde-fou, chaque retour au premier plan referait l'appel, ce qui ne casse
 * rien mais consomme du réseau à chaque déverrouillage.
 */
export interface EtatDePoussee {
  /* Le dernier jeton effectivement enregistré, ou `null` si aucun ne l'a été.
     On garde le JETON et non un booléen : c'est le changement de jeton qui
     doit déclencher un nouvel envoi, et un booléen ne le verrait pas. */
  jetonEnregistre: string | null;
}

export function doitEnregistrer(
  etat: EtatDePoussee,
  jeton: string | null,
  connecte: boolean,
): boolean {
  if (!connecte) return false;
  if (jeton === null || jeton.trim() === "") return false;
  return jeton !== etat.jetonEnregistre;
}

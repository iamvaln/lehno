import type { DataExportRequest } from "@lehno/contracts";

/* Mes données — §3.30.
 *
 * Deux choses, et elles ne se ressemblent pas : demander une copie de ce qu'on
 * a écrit, et lire ce que le service garde. La première est un geste, la
 * seconde une phrase.
 */

export type EtatDeLExport =
  | "aucune"      // jamais demandé
  | "en_cours"    // le serveur prépare le fichier
  | "prete"       // parti par e-mail
  | "echouee"
  | "expiree";

/* L'ÉTAT DE LA DERNIÈRE DEMANDE, et `null` en est un.
 *
 * « Vous n'avez jamais demandé d'export » est une réponse, pas une absence :
 * le serveur rend d'ailleurs 200 avec un corps nul plutôt qu'un 404, pour
 * cette raison exacte. L'écran affiche un bouton dans les deux cas.
 */
export function etatDeLExport(derniere: DataExportRequest | null): EtatDeLExport {
  if (!derniere) return "aucune";
  switch (derniere.status) {
    case "pending": return "en_cours";
    case "ready": return "prete";
    case "failed": return "echouee";
    case "expired": return "expiree";
  }
}

/* QUAND LE BOUTON S'ALLUME.
 *
 * Éteint tant qu'une préparation est en cours : le serveur refuse la seconde
 * demande par un `conflict` — « l'écran doit pouvoir dire *votre export est
 * déjà en préparation* au lieu de laisser croire qu'il vient d'en relancer
 * un ». Un bouton qui part pour revenir en erreur dit le contraire du refus
 * qu'il reçoit.
 *
 * Allumé dans TOUS les autres cas, y compris après un échec ou une expiration :
 * c'est précisément là qu'on veut redemander. Un export prêt se redemande
 * aussi — le lien du courrier expire, et rien ne dit qu'on l'a encore.
 */
export function peutDemander(derniere: DataExportRequest | null): boolean {
  return etatDeLExport(derniere) !== "en_cours";
}

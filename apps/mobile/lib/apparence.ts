import Stockage from "expo-sqlite/kv-store";
import type { PreferenceDeTheme } from "@lehno/ui-native";

/* L'APPARENCE SE GARDE SUR LE TÉLÉPHONE, et pas seulement au serveur.
 *
 * Le compte porte le réglage — c'est lui qui fait foi, et il suit d'un appareil
 * à l'autre. Mais il ne s'obtient qu'après un appel authentifié, alors que le
 * thème s'applique au tout premier pixel. Ne compter que sur le serveur ferait
 * démarrer chaque lancement sur la préférence de l'appareil, puis basculer une
 * fois le profil lu : un clignotement blanc sur un compte réglé en sombre, à
 * chaque ouverture. Et hors connexion, la bascule n'arriverait jamais.
 *
 * CE N'EST PAS DANS LE COFFRE, et c'est délibéré : les entrées du coffre
 * PÉRIMENT. Un cache périmé se rappelle au serveur ; un réglage périmé se
 * perd. Ce sont deux natures différentes, elles ne partagent pas le même
 * magasin.
 *
 * Elle s'efface au départ comme le reste — voir `videLApparence`. Le thème
 * qu'on a choisi dit quelque chose de soi, et le compte suivant ouvert sur le
 * même téléphone n'a pas à en hériter.
 */
const CLE = "apparence:theme";

const CONNUES: readonly PreferenceDeTheme[] = ["system", "light", "dark"];

export async function litLApparence(): Promise<PreferenceDeTheme | null> {
  try {
    const brut = await Stockage.getItem(CLE);
    /* On VALIDE au lieu de faire confiance. Une valeur d'une version
       précédente, ou tronquée par un arrêt brutal, traverserait jusqu'à
       `nativeColors` qui rendrait des couleurs indéfinies — donc un écran sans
       texte visible, sur toute l'application, sans erreur. */
    return CONNUES.find((c) => c === brut) ?? null;
  } catch {
    // Un magasin illisible n'empêche pas de démarrer : on suit l'appareil.
    return null;
  }
}

export async function poseLApparence(preference: PreferenceDeTheme): Promise<void> {
  try {
    await Stockage.setItem(CLE, preference);
  } catch {
    /* Silencieux à dessein : un réglage qui ne se garde pas ne vaut pas
       d'interrompre l'enregistrement du profil, qui, lui, a réussi. Le serveur
       l'a retenu — le prochain passage par les réglages le remettra ici. */
  }
}

export async function videLApparence(): Promise<void> {
  try {
    await Stockage.removeItem(CLE);
  } catch {
    // Comme le coffre : un vidage qui échoue ne retient personne sur un compte.
  }
}

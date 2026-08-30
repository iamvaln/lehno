import * as SecureStore from "expo-secure-store";
import { videLeCoffre } from "./coffre.js";
import { videLaFile } from "./fileStockee.js";
import type { Session } from "@lehno/contracts";

/* Les deux jetons de la session, au trousseau de l'appareil.
 *
 * Pas dans AsyncStorage : il écrit en clair dans le bac à sable de
 * l'application, et un jeton de rafraîchissement lisible est un compte pris.
 * SecureStore passe par le trousseau iOS et le keystore Android, où la clé ne
 * sort pas du matériel.
 *
 * Le jeton d'accès y va aussi, bien qu'il expire vite : le garder en mémoire
 * seule obligerait à redemander un code après chaque fermeture de
 * l'application, ce qui n'est pas ce qu'on promet.
 */

const ACCES = "lehno.acces";
const RAFRAICHISSEMENT = "lehno.rafraichissement";

export interface Jetons {
  acces: string;
  rafraichissement: string;
}

/* Qui change de session le dit ici. Les drapeaux en dépendent : la liste
   résolue est celle DU COMPTE, et rester sur la liste publique après une
   connexion masquerait des écrans auxquels la personne a droit.

   L'annonce vit avec la pose, pas dans les écrans. Il y a deux entrées
   aujourd'hui — la connexion et l'inscription — et il y en aura d'autres ;
   celle qu'on ajouterait sans y penser serait précisément celle qui casse. */
type Temoin = () => void;
const temoins = new Set<Temoin>();

export function surChangementDeSession(observateur: Temoin): () => void {
  temoins.add(observateur);
  return () => { temoins.delete(observateur); };
}

function annonce(): void {
  for (const temoin of temoins) temoin();
}

export async function poseLesJetons(session: Session): Promise<void> {
  await SecureStore.setItemAsync(ACCES, session.accessToken);
  await SecureStore.setItemAsync(RAFRAICHISSEMENT, session.refreshToken);
  annonce();
}

export async function litLesJetons(): Promise<Jetons | null> {
  const [acces, rafraichissement] = await Promise.all([
    SecureStore.getItemAsync(ACCES),
    SecureStore.getItemAsync(RAFRAICHISSEMENT),
  ]);
  // Un seul des deux ne sert à rien : sans rafraîchissement on ne peut pas
  // renouveler, sans accès on ne peut rien demander. La paire ou rien.
  if (!acces || !rafraichissement) return null;
  return { acces, rafraichissement };
}

export async function effaceLesJetons(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCES),
    SecureStore.deleteItemAsync(RAFRAICHISSEMENT),
    /* LE CACHE PART AVEC LA SESSION, et c'est ici qu'il faut le faire — pas
       dans l'écran des réglages. Ce chemin couvre les QUATRE sorties : la
       déconnexion volontaire, la fermeture du compte, la session invalidée par
       le serveur, et le renouvellement qui échoue. Posé dans un écran, il
       manquerait les deux dernières — celles qu'on ne choisit pas.

       Le cache garde des noms, des dates de naissance et des notes intimes :
       un compte quitté sur un téléphone prêté ne laisse rien derrière lui, et
       un second compte ouvert sur le même appareil ne voit pas le carnet du
       premier. */
    videLeCoffre(),
    /* LA FILE AUSSI. Elle porte les corps des requêtes — le texte d'une note,
       le nom d'un proche — et ses actions ne se rejoueraient de toute façon
       pas : le jeton qui les autorisait vient de disparaître, et les rejouer
       sous le compte SUIVANT écrirait les notes de quelqu'un dans le carnet
       d'un autre. */
    videLaFile(),
  ]);
  annonce();
}

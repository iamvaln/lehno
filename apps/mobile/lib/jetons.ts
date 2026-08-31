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
/* LA LIGNÉE, gardée à côté des jetons.
 *
 * Elle ne sert pas à s'authentifier — le jeton d'accès la porte déjà dans
 * `sid`, et le serveur la lit de là. Elle sert à SE RECONNAÎTRE dans la liste
 * de `/me/sessions`, ce que le client ne pouvait pas faire : une installation
 * fraîche n'a rien à comparer, et deviner par le `User-Agent` désigne la
 * mauvaise dès qu'un téléphone a deux sessions ouvertes.
 *
 * Elle vit avec les jetons parce qu'elle a exactement leur durée de vie : elle
 * naît à la connexion, elle part à la déconnexion. La ranger ailleurs ferait
 * survivre l'identifiant d'une session révoquée, et l'écran cocherait « cet
 * appareil » sur la ligne de quelqu'un d'autre. */
const LIGNEE = "lehno.lignee";

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
  await SecureStore.setItemAsync(LIGNEE, session.sessionId);
  annonce();
}

/* La lignée de CETTE application, ou rien.
 *
 * `null` n'est pas une anomalie : une session ouverte par une version qui ne
 * la gardait pas encore n'en a pas, et elle reste parfaitement valide. L'écran
 * ne coche alors aucune ligne — il ne devine pas. Cocher au hasard serait pire
 * que ne rien cocher : on révoquerait la mauvaise en croyant garder la sienne. */
export async function litLaLignee(): Promise<string | null> {
  return SecureStore.getItemAsync(LIGNEE);
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
    // La lignée part avec eux : gardée seule, elle ferait cocher « cet
    // appareil » sur une session révoquée que quelqu'un d'autre a rouverte.
    SecureStore.deleteItemAsync(LIGNEE),
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

import Stockage from "expo-sqlite/kv-store";
import { cleDuCache, estPerimee, type Entree } from "./cache.js";

/* OÙ LE CACHE VIT.
 *
 * `expo-sqlite/kv-store` plutôt qu'`AsyncStorage`, pour deux raisons et non
 * une préférence :
 *
 * 1. ANDROID PLAFONNE `AsyncStorage` À 6 Mo POUR TOUTE L'APPLICATION. Un carnet
 *    de deux cents fiches avec ses notes en approche, et le dépassement ne se
 *    voit pas — l'écriture échoue, le cache cesse silencieusement de se
 *    remplir, et personne ne s'en aperçoit avant d'être hors connexion. SQLite
 *    n'a pas ce plafond.
 * 2. Même famille que le reste de la pile, comme `expo-network` : un module
 *    natif de moins à suivre à chaque montée de SDK.
 *
 * CE N'EST PAS `SecureStore` — plafonné à 2 Ko par entrée sur Android, donc
 * hors de question pour un cache. Le chiffrement au repos n'est pas là ; ce
 * qui protège ces données est le bac à sable du système, et le fait qu'on les
 * efface au départ. C'est écrit pour qu'on le sache, pas pour l'excuser.
 */

/* CE QUI EST GARDÉ EST PERSONNEL : des noms, des dates de naissance, des notes
   intimes. Le préfixe existe pour qu'on puisse tout retirer d'un geste au
   départ — voir `videLeCoffre`. Sans lui, il faudrait connaître chaque clé
   posée, et celle qu'on oublierait resterait sur le téléphone. */
const PREFIXE = "cache:";

export async function litLeCache(chemin: string): Promise<string | null> {
  try {
    const brut = await Stockage.getItem(cleDuCache(chemin));
    if (brut === null) return null;
    const entree = JSON.parse(brut) as Entree;
    /* Périmée : on la jette EN PASSANT plutôt que d'attendre un ménage. Une
       entrée périmée qu'on laisse occupe la place et sera relue à chaque
       tentative — autant la retirer au moment où l'on constate. */
    if (estPerimee(entree, Date.now())) {
      await Stockage.removeItem(cleDuCache(chemin));
      return null;
    }
    return entree.corps;
  } catch {
    /* Un cache illisible n'est pas une panne de l'application : c'est un cache
       qu'on n'a pas. Lever ici ferait échouer un écran pour une raison qui ne
       le concerne pas — et précisément quand il n'a déjà plus de réseau. */
    return null;
  }
}

export async function poseAuCache(chemin: string, corps: string): Promise<void> {
  const entree: Entree = { corps, enregistreLe: new Date().toISOString() };
  try {
    await Stockage.setItem(cleDuCache(chemin), JSON.stringify(entree));
  } catch {
    /* Écrire au cache ne doit JAMAIS faire échouer la lecture qui vient de
       réussir. Le disque plein, la base verrouillée : on a la réponse du
       serveur, l'écran l'affiche, et le repli sera simplement absent. */
  }
}

/* TOUT PART AU DÉPART, et c'est la règle qui ne souffre aucune exception.
 *
 * Le cache contient des noms, des dates de naissance et des notes intimes. Un
 * compte quitté sur un téléphone prêté ne doit rien laisser derrière lui —
 * ni pour le suivant, ni pour un second compte ouvert sur le même appareil,
 * qui verrait le carnet du premier.
 *
 * On efface par PRÉFIXE, pas par liste de clés : une clé oubliée dans la liste
 * resterait sur le téléphone, et l'oubli ne se verrait jamais. */
export async function videLeCoffre(): Promise<void> {
  try {
    const cles = await Stockage.getAllKeys();
    const notres = cles.filter((c) => c.startsWith(PREFIXE));
    if (notres.length > 0) await Stockage.multiRemove(notres);
  } catch {
    /* Un vidage qui échoue ne doit pas empêcher de se déconnecter : retenir
       quelqu'un sur un compte qu'il veut quitter est pire que le cache qui
       reste. Il repartira au prochain départ réussi, et la péremption finira
       par l'emporter. */
  }
}

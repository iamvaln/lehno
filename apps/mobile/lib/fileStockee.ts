import Stockage from "expo-sqlite/kv-store";
import type { Action } from "./file.js";

/* LA FILE SURVIT À LA FERMETURE DE L'APPLICATION, et c'est le point.
 *
 * On écrit une note dans le métro, on range son téléphone, l'application est
 * tuée par le système. Une file en mémoire aurait perdu la note sans rien dire
 * — et la personne croirait l'avoir écrite. C'est précisément le cas que la
 * promesse « ça repartira au retour du réseau » couvre.
 */
const CLE = "file:ecritures";

export async function litLaFile(): Promise<Action[]> {
  try {
    const brut = await Stockage.getItem(CLE);
    if (brut === null) return [];
    const lu = JSON.parse(brut) as unknown;
    /* Une file illisible se jette plutôt que de faire échouer l'application au
       démarrage. On perd des actions — mais une file corrompue qu'on tente de
       rejouer enverrait n'importe quoi au serveur, ce qui est pire. */
    return Array.isArray(lu) ? (lu as Action[]) : [];
  } catch {
    return [];
  }
}

export async function poseLaFile(file: readonly Action[]): Promise<void> {
  try {
    if (file.length === 0) await Stockage.removeItem(CLE);
    else await Stockage.setItem(CLE, JSON.stringify(file));
  } catch {
    /* Le disque plein : l'action est perdue. On ne peut pas mieux faire ici, et
       lever ferait échouer un geste dont l'échec ne dirait rien d'utile. */
  }
}

/* ELLE PART AVEC LA SESSION, comme le cache.
 *
 * Elle porte les corps des requêtes : le texte d'une note, le nom d'un proche.
 * Et de toute façon, ses actions ne se rejoueraient pas — le jeton qui les
 * autorisait vient de disparaître, et les rejouer sous le compte SUIVANT
 * écrirait les notes de quelqu'un dans le carnet d'un autre. */
export async function videLaFile(): Promise<void> {
  try {
    await Stockage.removeItem(CLE);
  } catch {
    // Voir `videLeCoffre` : un vidage qui échoue ne retient personne.
  }
}

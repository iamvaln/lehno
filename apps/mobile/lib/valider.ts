import type { ReceivedWish } from "@lehno/contracts";

/* À valider — §3.8, le sas.
 *
 * « Rien de ce qui vient de l'extérieur n'entre dans vos fiches sans votre
 * accord. » Trois natures y passent : un souhait, un goût, un mot reçu.
 *
 * RETENIR N'EST PAS AFFICHER, et c'est la distinction que j'avais manquée.
 * Épingler garderait un mot VISIBLE sur le Mur — ce qui n'existe pas, « le Mur
 * n'a pas de livre d'or », et le contrat garde `is_public` dehors pour qu'on ne
 * le rende pas vivant. Retenir veut dire qu'on CONSIDÈRE ce qui est arrivé :
 * un cadeau qu'on gardera en vue pour l'achat, un goût qui entrera dans la
 * fiche. Écarter, c'est ne pas le considérer — pas le cacher.
 */

export type SortDuMot = "attend" | "retenu" | "ecarte";

/* `pending` N'EST PAS UN REFUS : c'est ce qui n'a pas encore été tranché. Le
   confondre avec « écarté » ferait disparaître du sas ce qui l'attend — et le
   sas ne servirait plus à rien. */
export function sortDuMot(mot: ReceivedWish): SortDuMot {
  if (mot.status === "approved") return "retenu";
  if (mot.status === "rejected") return "ecarte";
  return "attend";
}

/* CE QUI ATTEND UNE DÉCISION D'ABORD. On ouvre le sas pour trancher ce qui est
   arrivé, pas pour relire ce qu'on a déjà rangé. Le reste suit du plus récent
   au plus ancien. */
export function motsATrancher(mots: readonly ReceivedWish[]): ReceivedWish[] {
  const rang = (m: ReceivedWish): number => (sortDuMot(m) === "attend" ? 0 : 1);
  return [...mots].sort(
    (a, b) => rang(a) - rang(b) || b.createdAt.localeCompare(a.createdAt),
  );
}

/* Ce qui reste à trancher — le décompte que « Moi » annonce. Compter tout
   donnerait un nombre qui ne baisse jamais, et une file qu'on cesse d'ouvrir. */
export function resteATrancher(mots: readonly ReceivedWish[]): number {
  return mots.filter((m) => sortDuMot(m) === "attend").length;
}

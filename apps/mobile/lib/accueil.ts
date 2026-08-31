import type { Home, Occurrence } from "@lehno/contracts";

/* L'accueil NE DÉFILE PAS.
 *
 * C'est un écran qu'on regarde, pas qu'on parcourt. Il se remplit donc à la
 * hauteur disponible, et ce qui n'y tient pas s'en va — pas en silence : le
 * lien vers Dates porte le compte de ce qui sort.
 *
 * Les DONNÉES viennent de `/me/home`, en un appel : les échéances, les
 * décomptes que la liste plafonnée ne donne pas, et de quoi choisir entre les
 * deux états vides. Ce qui se décide ici n'est donc pas quoi montrer, mais
 * combien en tient — et ça, seule la hauteur mesurée le dit.
 */

/* LES DEUX ÉTATS VIDES NE SE RESSEMBLENT PAS, et une liste vide ne dit pas
 * lequel c'est.
 *
 * Carnet neuf : l'écran ne poursuit qu'un but, conduire au premier ajout.
 * « Laisser une note » céderait la place — il n'y a personne à propos de qui
 * écrire.
 *
 * Carnet rempli mais rien qui approche : « Laisser une note » demeure, et c'est
 * même tout ce que l'écran a à proposer.
 *
 * `hasPersons` tranche, et c'est le serveur qui le porte : sans lui, le client
 * appellerait `/me/persons` rien que pour choisir un libellé de bouton. */
export type EtatDeLAccueil = "premier" | "vide" | "nominal";

export function etatDeLAccueil(home: Home): EtatDeLAccueil {
  if (home.occurrences.length > 0) return "nominal";
  return home.hasPersons ? "vide" : "premier";
}

// Quatre rangs, trois cartes, deux au moins. Sur un petit modèle, trois cartes
// seules dépassent déjà la hauteur, et retirer des rangs n'y change rien.
export const MAX_RANGS = 4;
export const MAX_CARTES = 3;
export const MIN_CARTES = 2;

// Sept jours : la semaine. C'est ce que l'accueil montre en cartes.
const SEMAINE = 7;

export interface Remplissage {
  cartes: number;
  rangs: number;
}

export const REMPLISSAGE_PLEIN: Remplissage = { cartes: MAX_CARTES, rangs: MAX_RANGS };

export interface Accueil {
  cartes: Occurrence[];
  rangs: Occurrence[];
  /* Ce qui n'entre nulle part. Jamais escamoté : le lien vers Dates le porte,
     et c'est ce qui distingue « il n'y a que ça » de « le reste est ailleurs ».
     Il compte ce que la page laisse dehors ET ce que le serveur n'a pas
     envoyé — `/me/home` rend les plus proches, pas tout le calendrier. */
  reste: number;
}

/* La semaine en CARTES, la suite en RANGS.
 *
 * Trois cartes au plus laissaient un tiers d'écran vide sur les grands modèles
 * alors que d'autres dates existaient : elles se lisent juste plus vite, en
 * rangs.
 *
 * Rien cette semaine, mais des dates plus loin : on montre les deux prochaines
 * en cartes quand même. Un écran d'accueil qui ne montrerait que des rangs
 * n'aurait plus de point d'entrée.
 */
export function composeLAccueil(
  echeances: readonly Occurrence[],
  { cartes: nbCartes, rangs: nbRangs }: Remplissage,
  /* Ce que le serveur garde par-devers lui. `/me/home` ne rend que les plus
     proches ; sans ce nombre, « Voir plus » serait inatteignable et l'écran
     dirait « Voir tout » alors qu'il en manque vingt. */
  auDela = 0,
): Accueil {
  const semaine = echeances.filter((e) => e.daysUntil >= 0 && e.daysUntil <= SEMAINE);
  const source = semaine.length ? semaine : echeances.slice(0, MIN_CARTES);
  const cartes = source.slice(0, nbCartes);
  const apres = echeances.filter((e) => !cartes.includes(e));
  const rangs = apres.slice(0, nbRangs);
  return {
    cartes: [...cartes],
    rangs: [...rangs],
    reste: Math.max(0, echeances.length - cartes.length - rangs.length) + auDela,
  };
}

/* LA MESURE NE FAIT QUE RÉTRÉCIR.
 *
 * Comparer la hauteur à chaque rendu pour repartir du maximum faisait osciller
 * les deux gestes l'un contre l'autre : on retirait, la hauteur changeait, on
 * remettait tout, on retirait à nouveau, sans fin. Le kit le dit, et la
 * transposition native ne change rien à l'affaire.
 *
 * Les rangs partent d'abord — ils portent moins —, puis une carte, et jamais
 * en dessous de deux. Rien à retirer : on rend `null`, et l'écran déborde de
 * ce qu'il ne peut plus réduire plutôt que de tourner en rond.
 */
export function retrecit({ cartes, rangs }: Remplissage): Remplissage | null {
  if (rangs > 0) return { cartes, rangs: rangs - 1 };
  if (cartes > MIN_CARTES) return { cartes: cartes - 1, rangs };
  return null;
}

/* Le retour au maximum n'appartient QU'AU REDIMENSIONNEMENT OBSERVÉ — une
   rotation, un clavier qui se referme — et pas aux quelques pixels que notre
   propre retrait déplace. Sans ce seuil, retirer un rang changeait la hauteur,
   ce qui redemandait le maximum, qui débordait, qui retirait un rang. */
export const SEUIL_DE_REDIMENSIONNEMENT = 24;

export function doitRepartirDuMaximum(
  hauteur: number,
  derniere: number | null,
): boolean {
  if (derniere === null) return false;
  return Math.abs(hauteur - derniere) >= SEUIL_DE_REDIMENSIONNEMENT;
}

/* LE RÉSUMÉ DE CE QUI VIENT — §3.2, les sept phrases du dictionnaire.
 *
 * L'accueil montrait la LISTE sans jamais la RÉSUMER. Le designer a écrit sept
 * phrases pour dire d'un coup d'œil comment les semaines qui viennent se
 * présentent — « Une date aujourd'hui. », « Rien avant le 12 octobre. » — et
 * aucune ne paraissait : `etatDeLAccueil` ne distinguait que trois états, et
 * ceux-là servent à choisir une MISE EN PAGE, pas une phrase.
 *
 * `thisWeek` INCLUT AUJOURD'HUI, et c'est le fait qui gouverne toute la table :
 * les deux décomptes partent du même jour au serveur — « Semaine = les 7
 * prochains jours, aujourd'hui compris ». Les additionner compterait donc deux
 * fois les dates du jour, et « une date aujourd'hui, une autre cette semaine »
 * annoncerait deux dates là où il n'y en a qu'une.
 *
 * D'où la soustraction : ce qui vient « en plus » cette semaine est
 * `thisWeek - today`.
 */
export type Resume =
  | { sorte: "rien" }
  | { sorte: "lointain"; date: string }
  | { sorte: "aujourdhui" }
  | { sorte: "aujourdhuiEtSemaine"; autres: number }
  | { sorte: "semaine"; combien: number };

export function resumeDeLAccueil(home: Home): Resume {
  const { today, thisWeek } = home.counts;

  /* RIEN CETTE SEMAINE : on nomme la prochaine date si on la connaît. « Rien
     avant le 12 octobre » vaut mieux que « rien » — l'un rassure en situant,
     l'autre laisse croire que le carnet est vide. La liste n'est pas triée ici :
     le serveur la rend par date croissante, et la retrier donnerait deux
     vérités sur ce qu'est « la prochaine ». */
  if (thisWeek === 0) {
    const prochaine = home.occurrences[0];
    return prochaine === undefined
      ? { sorte: "rien" }
      : { sorte: "lointain", date: prochaine.occurrenceDate };
  }

  const autres = thisWeek - today;

  /* LES PHRASES « AUJOURD'HUI » NE VALENT QUE POUR UNE SEULE DATE DU JOUR.
   *
   * Le designer n'a pas écrit de phrase pour « deux dates aujourd'hui » : les
   * siennes disent toutes « UNE date aujourd'hui ». Plutôt que d'en inventer
   * une — ce que la maquette tranche, et elle a raison contre moi — on retombe
   * sur les phrases de la semaine, qui restent VRAIES puisque la semaine
   * comprend aujourd'hui. « Deux dates cette semaine » ne ment pas quand les
   * deux sont aujourd'hui ; elle dit seulement moins. */
  if (today === 1) {
    return autres === 0
      ? { sorte: "aujourdhui" }
      : { sorte: "aujourdhuiEtSemaine", autres };
  }

  return { sorte: "semaine", combien: thisWeek };
}

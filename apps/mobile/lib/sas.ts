import {
  submissionDecisionSchema,
  type Submission, type SubmissionDecisionInput, type SubmittedWish,
} from "@lehno/contracts";

/* À valider — §3.8, le sas.
 *
 * « Rien de ce qui vient de l'extérieur n'entre dans vos fiches sans votre
 * accord. » Une contribution porte une date de naissance, un mot, et des
 * souhaits — chacun tranché SÉPARÉMENT.
 *
 * RETENIR N'EST PAS AFFICHER : retenir veut dire qu'on CONSIDÈRE ce qui est
 * arrivé — un souhait qu'on gardera en vue, une date qui entrera dans la fiche.
 * Écarter, c'est ne pas le considérer. Rien ici ne règle une visibilité.
 */

export type Sort = "retained" | "discarded";

/* CE QUI ATTEND UNE DÉCISION, et cela seul. Une contribution déjà tranchée n'a
   plus rien à faire dans le sas : l'y laisser ferait une file qui ne se vide
   jamais, et qu'on cesse d'ouvrir. */
export function aTrancher(contributions: readonly Submission[]): Submission[] {
  return contributions.filter((c) => c.status === "pending");
}

/* UN LIEN PUBLIC NE VISE PERSONNE. À la validation, le propriétaire dit où la
   contribution atterrit — sur une fiche existante, ou sur une fiche neuve
   composée depuis le nom du répondant, ce qui est le cas courant.
   
   Sur un lien NOMINATIF la question ne se pose pas : il porte déjà sa fiche, et
   « l'accepter là laisserait détourner une contribution vers la fiche d'un
   autre ». */
export function demandeOuRanger(contribution: Submission): boolean {
  return contribution.linkType === "public";
}

/* TOUT SOUHAIT DOIT ÊTRE TRANCHÉ. « `pending` est l'état d'arrivée, pas une
   décision : le laisser passer permettrait de clore une contribution en
   laissant un souhait non tranché » — il resterait alors en suspens sans que
   rien ne le rappelle. */
export function toutEstTranche(
  souhaits: readonly SubmittedWish[],
  sorts: Readonly<Record<string, Sort>>,
): boolean {
  return souhaits.every((s) => sorts[s.id] !== undefined);
}

export interface SaisieDuSas {
  garderLaDate: boolean;
  garderLeMot: boolean;
  sorts: Readonly<Record<string, Sort>>;
  /* La fiche où ranger, sur un lien public. Nulle veut dire « une fiche
     neuve », ce qui est un choix et non une absence de choix. */
  fiche: string | null;
}

/* LE REJET GLOBAL NE RÉPARTIT RIEN.
 *
 * Le contrat l'isole : « il n'y a alors rien à répartir, et demander le sort de
 * chaque souhait reviendrait à faire trancher ce qu'on vient d'écarter ».
 * Envoyer une répartition avec un rejet est refusé — à raison.
 */
export function corpsDeRejet(): SubmissionDecisionInput {
  return submissionDecisionSchema.parse({ reject: true });
}

/* LA DÉCISION PORTE SUR L'ENSEMBLE, appliquée « en une seule transaction ».
 * Une décision partielle « laisserait la fiche à moitié remplie sans que rien
 * ne le signale ».
 *
 * Les champs sans objet sont OMIS : `personId` n'a de sens que sur un lien
 * public, et le poser sur un nominatif détournerait la contribution.
 */
export function corpsDeDecision(
  contribution: Submission,
  saisie: SaisieDuSas,
): SubmissionDecisionInput {
  return submissionDecisionSchema.parse({
    keepBirthDate: saisie.garderLaDate,
    keepPersonalNote: saisie.garderLeMot,
    wishes: contribution.wishes.map((s) => ({
      id: s.id,
      reviewStatus: saisie.sorts[s.id] ?? "discarded",
    })),
    ...(demandeOuRanger(contribution) && saisie.fiche
      ? { personId: saisie.fiche }
      : {}),
  });
}

/* CE QUI AUTORISE L'ENVOI. Tout souhait tranché, et rien de plus : ni la date
   ni le mot ne sont obligatoires — les refuser tous les deux est un geste
   légitime, et le contrat l'accepte tant qu'un élément au moins est porté. */
export function pretAEnvoyer(contribution: Submission, saisie: SaisieDuSas): boolean {
  return toutEstTranche(contribution.wishes, saisie.sorts);
}

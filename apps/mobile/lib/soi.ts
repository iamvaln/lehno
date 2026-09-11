import type { Person, Profile, SelfPersonInput } from "@lehno/contracts";
import { naissanceAEnvoyer, type SaisieDeNaissance } from "./carnet.js";

/* La fiche de soi — §10 du brief backend, conception du 11 septembre.
 *
 * ELLE NE DEMANDE RIEN DE NEUF. Le nom, le genre et la langue sont déjà saisis
 * dans Mon profil ; la fiche les recopie. Le seul champ vraiment nouveau est la
 * naissance. C'est ce qui permet de la poser au premier enregistrement du
 * profil, sans que personne ait eu à comprendre qu'il en existait une.
 */

export interface SaisieDeSoi {
  nom: string;
  nomDUsage: string;
  genre: Profile["gender"];
  langue: Profile["uiLanguage"];
  naissance: SaisieDeNaissance;
}

/* CE QU'ON ENVOIE, ou rien.
 *
 * `selfPersonSchema` EXIGE le genre, et l'énumération ne vaut que
 * `female | male` : sans lui on ne poste pas. Ce n'est pas de la défiance —
 * c'est ce qui permet d'enregistrer le profil quand même, et de laisser la
 * fiche attendre le prochain passage, plutôt que de faire découvrir la règle
 * par un refus sur un écran qui n'a rien demandé de neuf.
 *
 * Le schéma est `.strict()` : une clé vide serait refusée là où l'absence
 * passe. Tout ce qui est facultatif se répand donc conditionnellement.
 */
export function ficheAEnvoyer(saisie: SaisieDeSoi): SelfPersonInput | null {
  const nom = saisie.nom.trim();
  if (nom === "" || saisie.genre === null) return null;

  const usage = saisie.nomDUsage.trim();
  const nee = naissanceAEnvoyer(saisie.naissance);

  return {
    displayName: nom,
    gender: saisie.genre,
    language: saisie.langue,
    ...(usage === "" ? {} : { callingName: usage }),
    ...(nee === null ? {} : nee),
  };
}

/* `/me/persons` REND LA FICHE DE SOI PARMI LES AUTRES.
 *
 * Vérifié au serveur le 11 septembre : la liste ne filtre pas. Les écrans qui
 * disent « mes proches » doivent donc l'écarter — sans quoi on se retrouve dans
 * son propre carnet, et on n'est pas un proche de soi-même.
 */
export function sansSoi(personnes: readonly Person[]): Person[] {
  return personnes.filter((p) => !p.isSelf);
}

/* LÀ OÙ L'ON CHOISIT UNE PERSONNE, soi reste offert et passe en tête.
 *
 * Poser une date, écrire une note : ce sont des gestes qui visent quelqu'un, et
 * ce quelqu'un peut être soi. En tête parce que c'est la fiche qu'on cherche le
 * plus souvent le jour où elle vient d'exister.
 *
 * Le tri est STABLE : l'ordre reçu du serveur — alphabétique — est conservé
 * pour tout le reste.
 */
export function soiDabord(personnes: readonly Person[]): Person[] {
  return [...personnes].sort((a, b) => Number(b.isSelf) - Number(a.isSelf));
}

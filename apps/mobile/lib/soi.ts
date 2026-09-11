import type { Person, Profile, SelfPersonInput } from "@lehno/contracts";
import { naissanceAEnvoyer, type SaisieDeNaissance } from "./carnet.js";

/* La fiche de soi — §10 du brief backend, conception du 11 septembre.
 *
 * ELLE NE DEMANDE RIEN DE NEUF. Le nom et le genre sont déjà saisis dans Mon
 * profil ; la fiche les recopie. Le seul champ vraiment nouveau est la
 * naissance. C'est ce qui permet de la poser au premier enregistrement du
 * profil, sans que personne ait eu à comprendre qu'il en existait une.
 */

export interface SaisieDeSoi {
  nom: string;
  nomDUsage: string;
  genre: Profile["gender"];
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
 * Tout ce qui est facultatif se répand CONDITIONNELLEMENT : `undefined` sur une
 * clé facultative n'est pas la même chose que l'absence de la clé, et
 * `exactOptionalPropertyTypes` refuse le premier.
 *
 * CE QU'ON OMET, LE SERVEUR LE GARDE. `ecrireSoi` ne pose que les clés reçues :
 * un nom d'usage effacé à l'écran ne s'efface donc pas au serveur, qui rend
 * l'ancien au prochain chargement. C'est assumé, et ce n'est pas propre à la
 * fiche de soi — la fiche d'un proche fait pareil (`proches/identite.tsx`, le
 * corps qui n'étale que ce qui est renseigné). Le corriger ici seulement ferait
 * diverger deux écrans qui posent la même chose, sans qu'aucun texte ne dise
 * pourquoi. Effacer un champ demandera une forme qui distingue « vide » de
 * « pas touché », des deux côtés à la fois.
 *
 * LA LANGUE DE LA FICHE N'EST PAS ENVOYÉE, et c'est délibéré. `language` dit
 * dans quelle langue on écrit À VOTRE SUJET ; `uiLanguage` dit dans quelle
 * langue l'application et les courriels vous parlent. Aucun écran ne règle le
 * premier — Mon profil ne porte que le second. L'envoyer reviendrait donc à
 * recopier `uiLanguage` par-dessus la fiche à chaque enregistrement : basculer
 * l'application en anglais un jour ferait basculer la fiche des semaines plus
 * tard, au premier geste qui ne la concerne pas, sans que rien ne le dise.
 * Tant qu'on ne possède pas ce champ, ne pas l'écrire vaut mieux que l'écrire
 * au hasard d'un autre geste — le contrat le rend facultatif, et le serveur
 * garde alors ce qu'il avait. Le régler pour de bon demanderait un
 * `PATCH /me/self` que le serveur n'a pas (brief backend, §10).
 */
export function ficheAEnvoyer(saisie: SaisieDeSoi): SelfPersonInput | null {
  const nom = saisie.nom.trim();
  if (nom === "" || saisie.genre === null) return null;

  const usage = saisie.nomDUsage.trim();
  const nee = naissanceAEnvoyer(saisie.naissance);

  return {
    displayName: nom,
    gender: saisie.genre,
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

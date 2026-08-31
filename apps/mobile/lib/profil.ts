import { usernameSchema, type Profile, type UpdateProfileInput } from "@lehno/contracts";

/* Mon profil — §3.23.
 *
 * CE QUI SE CHANGE ICI, et rien d'autre. Le contrat le dit par ce qu'il
 * accepte : `updateProfileSchema` prend le pseudo, le nom affiché, la langue,
 * le thème, le fuseau, l'heure d'envoi et le genre. Pas l'adresse électronique,
 * pas la photo.
 *
 * L'ADRESSE N'EST PAS UN CHAMP DE PROFIL. C'est le moyen de connexion : la
 * changer ferait basculer l'identité du compte, et demande une vérification du
 * nouvel adressage avant que l'ancien ne cesse de valoir. Un champ modifiable
 * qui ne serait pas envoyé — ou pire, envoyé et refusé — ferait croire à une
 * modification qui n'a pas eu lieu. Elle se montre, elle ne s'édite pas.
 */

export interface SaisieDeProfil {
  pseudo: string;
  nom: string;
  genre: Profile["gender"];
  langue: Profile["uiLanguage"];
}

/* CE QUI A CHANGÉ, et cela seul. Le schéma est partiel — c'est une invitation à
   n'envoyer que le modifié, pas une tolérance. Renvoyer tout ferait écrire des
   champs que personne n'a touchés, et écraserait ce qu'une autre session vient
   de changer sur le même compte. */
export function corpsDeMiseAJour(
  saisie: SaisieDeProfil,
  original: Profile,
): UpdateProfileInput {
  const corps: UpdateProfileInput = {};
  const pseudo = saisie.pseudo.trim();
  const nom = saisie.nom.trim();

  if (pseudo !== original.username) corps.username = pseudo;
  /* Le nom affiché est NULLABLE au contrat : vidé, il redevient nul plutôt que
     chaîne vide. Une chaîne vide serait un nom qui existe et ne s'affiche pas —
     l'interface écrirait alors un blanc là où elle attend quelqu'un. */
  if (nom !== (original.displayName ?? "")) corps.displayName = nom === "" ? null : nom;
  if (saisie.genre !== original.gender) corps.gender = saisie.genre;
  if (saisie.langue !== original.uiLanguage) corps.uiLanguage = saisie.langue;

  return corps;
}

/* LA RÈGLE DU PSEUDO NE SE RÉÉCRIT PAS ICI. Le contrat la déclare une seule
   fois — « une SEULE déclaration, et c'est le point » —, parce que deux
   formulaires du même champ acceptaient autrefois des pseudos différents, et
   qu'un compte créé à l'inscription pouvait devenir irrecevable à la première
   correction de profil. On appelle donc le schéma ; on ne recopie pas son
   expression rationnelle. */
export function pseudoRecevable(pseudo: string): boolean {
  return usernameSchema.safeParse(pseudo).success;
}

/* Quand demander au serveur si le pseudo est libre.
 *
 * Pas à chaque frappe : « valen » serait interrogé sur le chemin de
 * « valentine ». Pas non plus sur un pseudo inchangé — garder le sien n'est
 * jamais un conflit, le serveur le dit, et l'appel n'apprendrait rien. Et pas
 * sur une forme que le contrat refuse : la réponse serait « libre » sur un
 * pseudo qu'on ne pourra pas enregistrer. */
export function doitVerifierLaDisponibilite(pseudo: string, original: Profile): boolean {
  const propre = pseudo.trim();
  return propre !== original.username && pseudoRecevable(propre);
}

/* Ce qui autorise l'enregistrement.
 *
 * Rien à envoyer, rien à faire : un bouton actif sur un formulaire intact
 * promet un effet qu'il n'aura pas. Et un pseudo mal formé bloque, même si
 * autre chose a changé — l'envoi partirait entier et serait refusé entier. */
export function peutEnregistrer(
  saisie: SaisieDeProfil,
  original: Profile,
  pseudoLibre: boolean | null,
): boolean {
  if (!pseudoRecevable(saisie.pseudo)) return false;
  // `null` = pas encore de réponse. On attend plutôt que d'envoyer vers un refus.
  if (doitVerifierLaDisponibilite(saisie.pseudo, original) && pseudoLibre !== true) return false;
  return Object.keys(corpsDeMiseAJour(saisie, original)).length > 0;
}

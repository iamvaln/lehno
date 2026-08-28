import { AXES_COUVERTURE, type AxeCouverture, type ProfilContenu } from "@lehno/contracts";

/* Ce que les profils de simulation doivent couvrir.
 *
 * « Ce n'est pas une liste, c'est une couverture » (brief de design §6) :
 * l'écran doit pouvoir dire « sept profils · aucun cas sensible » plutôt que
 * de faire lire sept lignes une par une. Sept profils qui éprouvent tous la
 * même chose ne valent pas mieux qu'un.
 *
 * Le calcul est ici, au serveur, parce que la règle est au dictionnaire et non
 * dans le dessin. Deux implémentations de la même liste finiraient par ne plus
 * dire la même chose, et c'est celle de l'écran qu'on croirait.
 */

/* Les seuils. Ils sont assumés, pas déduits — et c'est pourquoi ils sont
 * nommés plutôt qu'écrits en clair au milieu d'une condition.
 *
 * « Deux notes suffisent » pour une fiche pauvre : le brief le dit ainsi. Le
 * seuil de richesse est plus haut que le double, sinon trois notes
 * satisferaient les deux axes à la fois et la couverture se croirait complète
 * avec un seul profil médiocre. */
const NOTES_FICHE_PAUVRE = 2;
const NOTES_FICHE_RICHE = 5;
/* Un prénom usuel tient en six lettres ; la mise en page casse au-delà de
   vingt. Ce sont les deux extrêmes qu'on veut voir passer, pas la moyenne. */
const NOM_COURT = 6;
const NOM_LONG = 20;

const LIENS_FAMILIAUX = ["famille_proche", "famille_etendue", "partenaire"];
const LIENS_PROFESSIONNELS = ["collegue", "relation_pro"];

type Profil = { sensible: boolean; contenu: ProfilContenu };

const COUVRE: Record<AxeCouverture, (p: Profil) => boolean> = {
  fiche_riche: (p) => p.contenu.notes.length >= NOTES_FICHE_RICHE,
  fiche_pauvre: (p) => p.contenu.notes.length <= NOTES_FICHE_PAUVRE,
  nom_court: (p) => p.contenu.nomDUsage.length <= NOM_COURT,
  nom_long: (p) => p.contenu.nomDUsage.length >= NOM_LONG,
  langue_fr: (p) => p.contenu.langue === "fr",
  langue_en: (p) => p.contenu.langue === "en",
  relation_familiale: (p) => p.contenu.lien !== null && LIENS_FAMILIAUX.includes(p.contenu.lien),
  relation_professionnelle: (p) => p.contenu.lien !== null && LIENS_PROFESSIONNELS.includes(p.contenu.lien),
  /* Le drapeau ET l'occasion : marquer un profil « sensible » sans que son
     occasion le soit produirait un essai qui ne dit rien du cas qu'on craint,
     et la couverture se déclarerait complète sur cette foi-là. */
  cas_sensible: (p) => p.sensible && p.contenu.occasionSensible,
};

/** Les axes qu'AUCUN profil ne couvre. Vide veut dire « rien ne manque ». */
export function axesManquants(profils: Profil[]): AxeCouverture[] {
  return AXES_COUVERTURE.filter((axe) => !profils.some((p) => COUVRE[axe](p)));
}

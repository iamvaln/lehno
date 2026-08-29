import { RESEAUX, TRACES_DE_RESEAU, type Reseau } from "./SocialGlyph.data.js";
import type { Couleurs } from "../theme.js";

/* Le palier du système : 17 points. Sous 16, le glyphe TikTok et le X se
   referment sur eux-mêmes et deviennent deux taches. Comme la pastille, la
   primitive tient le plancher elle-même — un appel qui demande 12 ne se relit
   jamais. */
export const TAILLE_MIN_DE_GLYPHE = 17;

export function estUnReseau(nom: string): nom is Reseau {
  return (RESEAUX as readonly string[]).includes(nom);
}

export interface StyleDeGlyphe {
  trace: string;
  taille: number;
  encre: string;
}

/* Le glyphe prend la couleur du TEXTE qu'il accompagne, comme toute icône du
   système — ce que le web obtenait par le masque CSS, et que RN n'a pas. Sans
   encre donnée, c'est celle du texte courant. */
export function styleDeGlyphe({
  couleurs, reseau, taille = TAILLE_MIN_DE_GLYPHE, encre,
}: {
  couleurs: Couleurs;
  reseau: string;
  taille?: number;
  encre?: string | undefined;
}): StyleDeGlyphe | null {
  // Un réseau inconnu ne rend rien plutôt que de faire tomber l'écran : c'est
  // un défaut de charte, pas une raison d'interrompre une lecture.
  if (!estUnReseau(reseau)) return null;
  return {
    trace: TRACES_DE_RESEAU[reseau],
    taille: Math.max(taille, TAILLE_MIN_DE_GLYPHE),
    encre: encre ?? couleurs.textBody,
  };
}

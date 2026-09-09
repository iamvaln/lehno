import * as React from "react";

export type AmbiancePortrait = "papier" | "lilas" | "encre";
export type FormatPortrait = "carre" | "story" | "lien";

/**
 * Le portrait — l'image qu'on offre, et qui part avec un mot. Un système, pas
 * une maquette : la composition tient un message de 2 à 4 phrases, un nom de 3
 * à 20 caractères, avec ou sans signature, en français comme en anglais.
 *
 * Le test du brief : imprimé, aurait-on envie de l'accrocher ?
 *
 * @startingPoint section="Brand" subtitle="Le portrait — trois compositions, trois ambiances, trois formats" viewport="1100x760"
 */
export interface PortraitCompositionProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Le nom d'usage du proche. 3 à 20 caractères ; la taille s'ajuste seule. */
  nom: string;
  /**
   * Le message — **le contenu principal**. Deux à quatre phrases, produites
   * selon l'orientation choisie. Sa taille se déduit de son nombre de mots :
   * quatre paliers, de 7,2 à 4,2 cqw. Ne pas la fixer à la main.
   */
  message: string;
  /**
   * La voie d'image, **une seule à la fois** : les mêler ferait une
   * infographie. `illustration` — une forme dans le vocabulaire du produit ;
   * `photo` — une image de l'utilisateur, désaturée et teintée pour entrer
   * dans la palette ; `aucune` — le message occupe toute la composition.
   * En format `lien`, la voie tombe d'elle-même : le cadre est trop bas.
   */
  voie?: "illustration" | "photo" | "aucune";
  /** L'image de l'utilisateur, quand `voie` vaut `photo`. */
  photo?: string;
  /** Le nom de qui offre le portrait. Facultatif ; le pied se comprime sans lui. */
  signature?: string;
  /**
   * L'ambiance choisie par l'utilisateur. Le fond change, la structure ne
   * change pas — un portrait reste reconnaissable d'une ambiance à l'autre.
   */
  ambiance?: AmbiancePortrait;
  /* Il n'y a pas de prop pour masquer la marque : le portrait circule hors de
     l'application, et c'est le seul contenu qui sort en la portant. */
  /**
   * carre 1080×1080 — le format de référence, celui des conversations.
   * story 1080×1920 · lien 1200×630 (les mots y prennent moins de place).
   */
  format?: FormatPortrait;
  /** Préfixe de chemin vers les actifs si la page n'est pas à la racine. */
  base?: string;
}

export declare function PortraitComposition(props: PortraitCompositionProps): React.ReactElement;

export declare const AMBIANCES: Record<AmbiancePortrait, {
  nom: string; fond: string; registres: string; aplats: string[];
  opacites: number[]; illustration: string[]; titre: string;
  message: string; mention: string; marque: string;
}>;

export declare const FORMATS: Record<FormatPortrait, {
  nom: string; ratio: string; export: string;
}>;

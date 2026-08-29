import type { TextStyle, ViewStyle } from "react-native";
import { nativeBorder, nativeFont } from "@lehno/tokens";
import {
  AMBIANCES, FORMATS, type Ambiance, type AmbianceDePortrait, type FormatDePortrait,
  type RoleDeScene, type StyleDePhoto, type VoieDePortrait,
} from "./PortraitComposition.data.js";

/* Les décisions du portrait.
 *
 * LE WEB TENAIT TOUT EN `cqw` — un pourcentage de la largeur du conteneur. RN
 * n'a ni requête de conteneur ni unité relative : la composition reçoit donc sa
 * largeur, et chaque part se convertit en points. C'est la même règle, écrite
 * autrement — rien ne se pose à la main, tout se déduit de la largeur, du nom
 * et du nombre de mots.
 *
 * L'échelle d'espacement du système ne paraît pas ici, et c'est voulu : ce
 * n'est pas une interface, c'est une image qu'on exporte à 1080 points de côté.
 * Un pas de 16 y vaudrait 1,5 % de la largeur sur un téléphone et 0,3 % à
 * l'export — la composition ne survivrait pas au changement d'échelle.
 */

// Une part de la largeur, en centièmes — l'équivalent exact du cqw du web.
export function enPoints(part: number, largeur: number): number {
  return (part * largeur) / 100;
}

export function hauteurDuPortrait(largeur: number, format: FormatDePortrait): number {
  return largeur * FORMATS[format].rapport;
}

/* LA TAILLE DU NOM se déduit de sa longueur, entre deux bornes. Un prénom de
   trois lettres remplit la ligne ; un nom d'usage de vingt tient encore.
   L'interpolation est bornée aux deux bouts : sans plancher, un nom de trente
   caractères descendrait sous la lisibilité, et un nom vide monterait au-delà
   du cadre. */
export const BORNES_DU_NOM = { hautCar: 5, haut: 11.5, basCar: 20, bas: 6.4 } as const;

export function tailleDuNom(nom: string): number {
  const n = nom.length;
  const B = BORNES_DU_NOM;
  if (n <= B.hautCar) return B.haut;
  if (n >= B.basCar) return B.bas;
  return B.haut - ((n - B.hautCar) / (B.basCar - B.hautCar)) * (B.haut - B.bas);
}

/* LA TAILLE DU MESSAGE se déduit de son nombre de mots, par paliers. C'est ce
   qui fait tenir une composition de deux à quatre phrases, en français comme en
   anglais — où la même phrase s'allonge d'un tiers. */
export const PALIERS_DU_MESSAGE = [
  { jusqua: 16, part: 6.4 },
  { jusqua: 30, part: 5.2 },
  { jusqua: 46, part: 4.4 },
  { jusqua: Number.POSITIVE_INFINITY, part: 3.8 },
] as const;

export function nombreDeMots(texte: string): number {
  return texte.trim().split(/\s+/).filter(Boolean).length;
}

export function tailleDuMessage(message: string): number {
  const mots = nombreDeMots(message);
  // Le dernier palier borne l'échelle : un message de mille mots ne tombe pas
  // dans le vide, il prend la plus petite taille prévue.
  const palier = PALIERS_DU_MESSAGE.find((p) => mots <= p.jusqua) ?? PALIERS_DU_MESSAGE[3];
  return palier.part;
}

/* LE FORMAT VERTICAL PREND LA VERSION COURTE. Agrandir le texte long dans un
   cadre haut le ferait déborder : la génération produit deux longueurs, et le
   gabarit choisit. Sans version courte, il reprend la longue plutôt que de ne
   rien montrer — un portrait vide serait pire qu'un portrait serré. */
export function texteDuPortrait({
  message, messageCourt, format,
}: { message: string; messageCourt?: string | undefined; format: FormatDePortrait }): string {
  if (format === "story" && messageCourt && messageCourt.trim()) return messageCourt;
  return message;
}

// Le vertical resserre l'échelle : le cadre est haut, pas large.
const RESSERRE_VERTICAL = { nom: 0.82, message: 0.86 } as const;

/* DEUX MOTIFS, JAMAIS LES DEUX SUR UN MÊME PORTRAIT.
 *
 * La trame de hampes est le seul motif qui accepte du texte par-dessus ; les
 * registres sont le seul qui ait quelque chose à dire, et ils prennent le fond
 * entier du gabarit sans image. Les poser ensemble ferait un tissu, pas une
 * composition — et c'est le genre de faute qu'un ajout d'ambiance introduit
 * sans qu'on la voie. */
export function motifDuPortrait(voie: VoieDePortrait): "trame" | "registres" {
  return voie === "aucune" ? "registres" : "trame";
}

/* L'image occupe le haut, et cède quand le message s'allonge : un plafond, pas
   une part fixe. La bande, elle, ne cède jamais — c'est elle qui porte le
   texte. La part est plus basse en vertical, où le cadre donne les moyens de
   laisser respirer les mots. */
export function plafondDeLImage(format: FormatDePortrait): number {
  return format === "story" ? 0.44 : 0.46;
}

/* LA TRAME DE HAMPES, en positions plutôt qu'en motif SVG.
 *
 * Le web la posait en `<pattern>`, qui se répète tout seul. RN sait le faire
 * aussi, mais la bande n'a pas de hauteur connue d'avance — elle dépend de la
 * longueur du message — et un motif calé sur une hauteur supposée laisse une
 * bande chauve dès que le texte passe à quatre lignes. Les positions se
 * calculent donc depuis la boîte réelle. */
export const PAS_DE_LA_TRAME = { x: 22, y: 26 } as const;
export const HAMPE = { x: 9, y: 3, largeur: 3, hauteur: 20, rayon: 1.5 } as const;

export function hampesDeLaTrame(
  largeur: number, hauteur: number,
): readonly { x: number; y: number }[] {
  if (largeur <= 0 || hauteur <= 0) return [];
  const hampes: { x: number; y: number }[] = [];
  for (let y = HAMPE.y; y < hauteur; y += PAS_DE_LA_TRAME.y) {
    for (let x = HAMPE.x; x < largeur; x += PAS_DE_LA_TRAME.x) {
      hampes.push({ x, y });
    }
  }
  return hampes;
}

/* LES REGISTRES : une suite qui revient, en fond plein du gabarit sans image. */
export const PAS_DES_REGISTRES = 20;
export const REGISTRE = { y: 18.4, hauteur: 1.6 } as const;

export function lignesDesRegistres(hauteur: number): readonly number[] {
  if (hauteur <= 0) return [];
  const lignes: number[] = [];
  for (let y = REGISTRE.y; y < hauteur; y += PAS_DES_REGISTRES) lignes.push(y);
  return lignes;
}

/* LES COULEURS DE LA SCÈNE. L'hommage neutralise l'abricot : une occasion
   sensible ne peut pas partager le vif d'une déclaration de fierté. */
export function encresDeLaScene(
  ambiance: Ambiance, hommage = false,
): Record<RoleDeScene, string> {
  const [clair, moyen, accent, profond] = ambiance.illustration;
  return { clair, moyen, accent: hommage ? profond : accent, profond };
}

/* LA PHOTO — un traitement, pas un filtre.
 *
 * Le web désaturait par `filter: grayscale()` et fondait la teinte par
 * `mix-blend-mode` : RN n'a ni l'un ni l'autre. Ce qu'il a, c'est `tintColor`,
 * qui rend une image d'une seule encre — c'est exactement la silhouette, et en
 * mieux que le web, qui l'approchait par un contraste poussé à 4.
 *
 * Les deux autres traitements gardent leur teinte et leur opacité, posées en
 * voile par-dessus l'image. Ce qui se perd, c'est la désaturation : une photo
 * très colorée restera plus colorée qu'à l'écran du prototype. La distinction
 * entre les trois, elle, tient. */
export interface TraitementDePhoto {
  teinte: string;
  opacite: number;
  /** Vrai quand l'image entière prend l'encre — la silhouette. */
  monochrome: boolean;
}

export function traitementDePhoto(
  style: StyleDePhoto, ambiance: Ambiance,
): TraitementDePhoto {
  const e = encresDeLaScene(ambiance);
  switch (style) {
    case "lumiere":
      return { teinte: e.profond, opacite: 0.55, monochrome: false };
    case "serigraphie":
      return { teinte: e.moyen, opacite: 0.6, monochrome: false };
    default:
      return { teinte: e.profond, opacite: 1, monochrome: true };
  }
}

export interface StyleDuPortrait {
  cadre: ViewStyle;
  image: ViewStyle;
  bande: ViewStyle;
  contenu: ViewStyle;
  nom: TextStyle;
  message: TextStyle;
  note: TextStyle;
  pied: ViewStyle;
  mention: TextStyle;
  hauteurDeLaMarque: number;
  hauteur: number;
  ambiance: Ambiance;
}

export function styleDuPortrait({
  ambiance = "papier", format = "carre", voie = "illustration",
  nom, message, largeur,
}: {
  ambiance?: AmbianceDePortrait;
  format?: FormatDePortrait;
  voie?: VoieDePortrait;
  nom: string;
  message: string;
  largeur: number;
}): StyleDuPortrait {
  const A = AMBIANCES[ambiance];
  const story = format === "story";
  const sansImage = voie === "aucune";
  const hauteur = hauteurDuPortrait(largeur, format);
  const pt = (part: number) => enPoints(part, largeur);

  const tailleNom = tailleDuNom(nom) * (story ? RESSERRE_VERTICAL.nom : 1);
  const tailleMessage = tailleDuMessage(message) * (story ? RESSERRE_VERTICAL.message : 1);

  return {
    cadre: {
      width: largeur,
      height: hauteur,
      backgroundColor: A.fond,
      overflow: "hidden",
    },
    image: {
      // Un plafond, pas une part fixe : l'image cède quand le message
      // s'allonge, la bande ne cède jamais.
      flex: 1,
      maxHeight: hauteur * plafondDeLImage(format),
      overflow: "hidden",
    },
    bande: sansImage
      ? { flex: 1, justifyContent: "center", backgroundColor: A.fond }
      : { flexShrink: 0, backgroundColor: A.bande },
    contenu: sansImage
      ? { paddingVertical: pt(story ? 12 : 10), paddingHorizontal: pt(9) }
      : { paddingTop: pt(story ? 7 : 6), paddingHorizontal: pt(story ? 8 : 7), paddingBottom: pt(story ? 8 : 7) },
    nom: {
      fontFamily: nativeFont.displayMedium,
      fontSize: pt(tailleNom),
      lineHeight: pt(tailleNom) * 1.05,
      letterSpacing: pt(tailleNom) * -0.025,
      color: A.titre,
    },
    // Le message est le contenu principal : c'est ce qui dit « voilà comment je
    // te vois ». Il s'écrit dans l'italique de titre, comme toute parole.
    message: {
      fontFamily: nativeFont.displayItalic,
      fontSize: pt(tailleMessage),
      lineHeight: pt(tailleMessage) * 1.42,
      color: A.message,
      marginTop: pt(2.6),
    },
    note: {
      fontFamily: nativeFont.bodyRegular,
      fontSize: pt(story ? 2 : 2.6),
      color: A.mention,
      marginTop: pt(2.6),
    },
    pied: {
      flexDirection: "row",
      alignItems: "center",
      gap: pt(2.2),
      marginTop: pt(3),
      paddingTop: pt(2.6),
      // Le filet de la charte, pas un « 1 » écrit ici : le jour où elle passe
      // le filet à 0,5, le pied du portrait suit comme le reste.
      borderTopWidth: nativeBorder.width,
      borderTopColor: A.filet,
    },
    mention: {
      fontFamily: nativeFont.bodyRegular,
      fontSize: pt(story ? 1.8 : 2.3),
      color: A.mention,
      lineHeight: pt(story ? 1.8 : 2.3) * 1.3,
    },
    hauteurDeLaMarque: pt(story ? 2.4 : 3.2),
    hauteur,
    ambiance: A,
  };
}

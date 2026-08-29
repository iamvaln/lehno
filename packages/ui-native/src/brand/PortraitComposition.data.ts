import { nativeColors, type Theme } from "@lehno/tokens";
import type { VarianteDeLogotype } from "./Wordmark.data.js";

/* Le portrait — l'image qu'on offre à un proche, et qui part avec un mot. Le
 * seul contenu du produit qui sorte de l'application en portant la marque.
 *
 * IL N'A PAS DE THÈME CLAIR ET SOMBRE. C'est une image fixe : l'ambiance est un
 * choix de l'utilisateur, pas un réglage du téléphone. Un portrait envoyé le
 * soir et rouvert le matin doit être le même portrait.
 *
 * D'où ce thème épinglé : les couleurs des ambiances se résolvent depuis les
 * rôles du thème CLAIR, quel que soit celui de l'appareil. Sans cela, la
 * marque du pied — qui prend l'encre du texte — virerait au blanc sur le
 * papier blanc de l'ambiance « papier », et disparaîtrait.
 */
export const THEME_DU_PORTRAIT: Theme = "light";

// Les rôles du thème sombre servent aux ambiances foncées : ce sont ceux que
// la charte destine à un fond foncé, et le portrait en emprunte trois.
const CLAIR = nativeColors("light");
const SOMBRE = nativeColors("dark");

export const AMBIANCES_DE_PORTRAIT = ["papier", "lilas", "encre"] as const;
export type AmbianceDePortrait = (typeof AMBIANCES_DE_PORTRAIT)[number];

export interface Ambiance {
  /** Le fond de la composition entière. */
  fond: string;
  /** La bande basse, celle qui porte le texte quand une image occupe le haut. */
  bande: string;
  /** Le motif — trame de hampes ou registres — et sa présence. */
  motif: string;
  opaciteMotif: number;
  /** Le voile qui pose la lisibilité par-dessus le motif. */
  voile: string;
  opaciteVoile: number;
  /* Le gabarit sans image porte un voile plus léger : le texte y respire sur
     toute la surface, et les registres doivent rester visibles dessous. */
  opaciteVoileSansImage: number;
  /** Les quatre rôles de l'illustration : clair, moyen, accent, profond. */
  illustration: readonly [string, string, string, string];
  titre: string;
  message: string;
  mention: string;
  filet: string;
  marque: VarianteDeLogotype;
}

/* Trois ambiances : le fond change, la structure non. Un portrait reste
   reconnaissable d'une ambiance à l'autre.

   Les valeurs viennent des rôles de la charte, pas d'hexadécimaux recopiés du
   web. Deux teintes du prototype n'existaient nulle part dans les jetons — un
   blanc cassé pour la bande lilas et un gris-violet pour la masse de
   l'ambiance encre : elles rejoignent les rôles voisins, à l'œil identiques. */
export const AMBIANCES: Record<AmbianceDePortrait, Ambiance> = {
  papier: {
    fond: CLAIR.surfacePage,
    bande: CLAIR.surfacePage,
    motif: CLAIR.illusMass,
    opaciteMotif: 0.22,
    voile: CLAIR.surfacePage,
    opaciteVoile: 0.62,
    opaciteVoileSansImage: 0.42,
    illustration: [CLAIR.illusForm, CLAIR.illusMass, CLAIR.illusWarm, CLAIR.textAccent],
    titre: CLAIR.textBody,
    message: CLAIR.textBody,
    mention: CLAIR.textMention,
    filet: CLAIR.borderHairline,
    marque: "couleur",
  },
  lilas: {
    fond: CLAIR.surfacePanel,
    bande: CLAIR.surfacePage,
    motif: CLAIR.textAccent,
    opaciteMotif: 0.24,
    voile: CLAIR.surfacePage,
    opaciteVoile: 0.6,
    opaciteVoileSansImage: 0.42,
    illustration: [CLAIR.borderObject, CLAIR.textAccent, CLAIR.illusWarm, CLAIR.illusMass],
    titre: CLAIR.textBody,
    message: CLAIR.textBody,
    mention: CLAIR.textMention,
    filet: CLAIR.borderObject,
    marque: "couleur",
  },
  encre: {
    fond: CLAIR.surfaceBand,
    bande: SOMBRE.surfacePage,
    motif: CLAIR.illusWarm,
    opaciteMotif: 0.26,
    voile: SOMBRE.surfacePage,
    opaciteVoile: 0.58,
    opaciteVoileSansImage: 0.42,
    illustration: [SOMBRE.borderObject, SOMBRE.illusMass, SOMBRE.illusWarm, CLAIR.textAccent],
    titre: CLAIR.textOnAccent,
    message: CLAIR.textOnAccent,
    mention: SOMBRE.textSecondary,
    filet: SOMBRE.borderObject,
    /* Sur l'encre, la marque s'écrit en blanc — variante indépendante du
       thème, comme celle de l'écran d'ouverture. */
    marque: "blanc",
  },
};

/* Deux formats seulement : le carré est la référence, celui des conversations ;
   le vertical en dérive. Pas d'aperçu de lien — le portrait ne s'expose sur
   aucune page. Le contrat de props du web en annonçait un troisième ; le
   prototype ne l'a jamais dessiné. */
export const FORMATS_DE_PORTRAIT = ["carre", "story"] as const;
export type FormatDePortrait = (typeof FORMATS_DE_PORTRAIT)[number];

export const FORMATS: Record<FormatDePortrait, { rapport: number; sortie: string }> = {
  carre: { rapport: 1, sortie: "1080 × 1080" },
  story: { rapport: 16 / 9, sortie: "1080 × 1920" },
};

export const VOIES_DE_PORTRAIT = ["illustration", "photo", "aucune"] as const;
export type VoieDePortrait = (typeof VOIES_DE_PORTRAIT)[number];

export const FAMILLES_ILLUSTREES = ["nature", "animal", "abstrait"] as const;
export type FamilleIllustree = (typeof FAMILLES_ILLUSTREES)[number];

export const STYLES_DE_PHOTO = ["lumiere", "serigraphie", "silhouette"] as const;
export type StyleDePhoto = (typeof STYLES_DE_PHOTO)[number];

/* LA SCÈNE ILLUSTRÉE — trois ou quatre éléments au plus, une scène et non un
 * catalogue, aucun visage, aucun symbole d'occasion.
 *
 * ELLE EST TRACÉE POUR UNE BANDE LARGE, pas pour un carré : la zone qu'elle
 * occupe fait entre 2,6 et 4 de rapport, et sa hauteur varie avec la longueur
 * du message. Le viewBox est donc large — 100 × 30 — et le sujet vit entre
 * y=3 et y=27 : ce qui déborde au rognage n'est jamais ce qui porte la scène.
 *
 * La grammaire est celle des illustrations du système : aplats pleins, aucun
 * contour, aucune ombre, trois rôles de couleur.
 */
export const BOITE_DE_SCENE = { largeur: 100, hauteur: 30 } as const;

/** Les rôles nommés par les tracés, résolus depuis l'ambiance. */
export type RoleDeScene = "clair" | "moyen" | "accent" | "profond";

export type FormeDeScene =
  | ["path", { d: string; fill: RoleDeScene; opacity?: number }]
  | ["rect", { x: number; y: number; width: number; height: number; fill: RoleDeScene }]
  | ["circle", { cx: number; cy: number; r: number; fill: RoleDeScene }];

export const SCENES: Record<FamilleIllustree, readonly FormeDeScene[]> = {
  // Un relief et un astre : deux éléments, une scène. Le relief monte du bas du
  // cadre, l'astre respire à droite.
  nature: [
    ["path", { d: "M0 30 q18 -17 34 -6 q14 -12 28 1 q12 -9 22 5 v6 Z", fill: "moyen" }],
    ["path", { d: "M30 30 q14 -12 26 -3 q10 -8 20 3 v0 Z", fill: "profond", opacity: 0.85 }],
    ["circle", { cx: 76, cy: 9, r: 5.4, fill: "accent" }],
  ],
  // Une silhouette, jamais un visage. Elle se tient sur une ligne de sol qui la
  // pose sans dessiner de décor.
  animal: [
    ["rect", { x: 0, y: 26, width: 100, height: 4, fill: "moyen" }],
    ["path", { d: "M38 26 q-1 -9 5 -11 q1 -5 4 -1.6 q2.4 -3.4 3.6 1.6 q6 1.4 5 11 Z", fill: "profond" }],
    ["path", { d: "M51 21 q7 -1.4 9 -6 q1.4 4 -2 6 Z", fill: "profond" }],
    ["circle", { cx: 20, cy: 10, r: 4.6, fill: "accent" }],
    ["path", { d: "M64 26 q8 -6 16 -2 q6 -4 12 2 Z", fill: "moyen" }],
  ],
  // Un mouvement et une lumière — pour qui échappe aux deux autres. Des arcs
  // qui se recouvrent, sans rien figurer.
  abstrait: [
    ["path", { d: "M0 30 a34 34 0 0 1 68 0 Z", fill: "moyen" }],
    ["path", { d: "M26 30 a26 26 0 0 1 52 0 Z", fill: "profond", opacity: 0.9 }],
    ["circle", { cx: 22, cy: 9, r: 5, fill: "accent" }],
  ],
};

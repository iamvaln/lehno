import { resolve, type SemanticRole } from "./semantic.js";
import type { Theme } from "./primitives.js";
import { typography } from "./typography.js";
import { spacing } from "./spacing.js";
import { shape } from "./shape.js";
import { motion } from "./motion.js";

// L'émission React Native, sœur de css.ts : mêmes sources, autre cible.
//
// RN ne résout pas var(), donc tout traverse en valeurs. Rien ici n'est écrit :
// tout se dérive de la charte. C'est ce qui met le natif sous les tests de
// contraste sans les rejouer — et ce qui empêche la dérive qu'une recopie à la
// main avait déjà produite une fois, sur le gris de mention.

// Le préfixe des jetons CSS range des variables dans un espace de noms plat. Un
// objet a déjà le sien : le porter alourdirait chaque feuille de style du natif.
type SansPrefixe<Cle, Prefixe extends string> =
  Cle extends `${Prefixe}${infer Reste}` ? Uncapitalize<Reste> : never;

export type NomDeTaille = SansPrefixe<keyof typeof typography, "text">;
export type NomDInterlignage = SansPrefixe<keyof typeof typography, "leading">;
export type NomDeDuree = SansPrefixe<keyof typeof motion, "duration">;
export type NomDeCourbe = SansPrefixe<keyof typeof motion, "ease">;
export type Courbe = [number, number, number, number];

function sansUnite(valeur: string): number {
  return Number.parseFloat(valeur);
}

// ── Couleurs ────────────────────────────────────────────────────────────────

export function nativeColors(theme: Theme): Record<SemanticRole, string> {
  return resolve(theme);
}

// ── Échelles ────────────────────────────────────────────────────────────────

export const nativeSize = Object.fromEntries(
  Object.entries(typography)
    .filter(([cle]) => cle.startsWith("text"))
    .map(([cle, valeur]) => [cle.slice(4, 5).toLowerCase() + cle.slice(5), sansUnite(valeur)]),
) as Record<NomDeTaille, number>;

// L'échelle d'espacement seule, lue space[16] comme le web lit --space-16 : le
// pas nomme la valeur. `measure` (62ch), `sectionPadY` (clamp) et la gouttière
// d'une page large décrivent une mise en page de navigateur — RN n'a ni ch ni
// clamp, et un téléphone n'a pas de gouttière. Les convertir donnerait des
// nombres qui ont l'air justes sans l'être.
export type PasDEspacement = SansPrefixe<keyof typeof spacing, "space">;

export const nativeSpace = Object.fromEntries(
  Object.entries(spacing)
    .filter(([cle]) => cle.startsWith("space"))
    .map(([cle, valeur]) => [Number(cle.slice(5)), sansUnite(valeur)]),
) as Record<PasDEspacement, number>;

// Un plancher tactile, pas un pas d'échelle : il vit donc à part. 44, jamais
// moins, même quand le fond visible est plus court.
export const nativeTouchMin = sansUnite(spacing.touchMin);

// Deux rayons sont écartés : `radiusTile` vaut 22%, un pourcentage que RN
// n'applique pas à un rayon ; `radiusDevice` appartient au châssis d'aperçu,
// décor de présentation explicitement hors produit.
export type NomDeRayon = Exclude<SansPrefixe<keyof typeof shape, "radius">, "tile" | "device">;

export const nativeRadius = Object.fromEntries(
  Object.entries(shape)
    .filter(([cle, valeur]) => cle.startsWith("radius") && valeur.endsWith("px"))
    .filter(([cle]) => cle !== "radiusDevice")
    .map(([cle, valeur]) => [cle.slice(6, 7).toLowerCase() + cle.slice(7), sansUnite(valeur)]),
) as Record<NomDeRayon, number>;

// ── Mouvement ───────────────────────────────────────────────────────────────

export const nativeDuration = Object.fromEntries(
  Object.entries(motion)
    .filter(([cle]) => cle.startsWith("duration"))
    .map(([cle, valeur]) => [cle.slice(8, 9).toLowerCase() + cle.slice(9), sansUnite(valeur)]),
) as Record<NomDeDuree, number>;

// « ease-out » est un mot-clé, pas une courbe écrite. La spec CSS en donne
// l'équivalent exact : le traduire vaut mieux que le perdre ou l'approcher.
const MOTS_CLES: Record<string, Courbe> = {
  "ease-out": [0, 0, 0.58, 1],
};

function courbe(valeur: string): Courbe {
  const ecrite = valeur.match(/cubic-bezier\(([^)]+)\)/);
  if (ecrite) return ecrite[1]!.split(",").map((n) => Number.parseFloat(n)) as Courbe;
  const connu = MOTS_CLES[valeur];
  if (connu) return connu;
  throw new Error(`Courbe inconnue : ${valeur}`);
}

// RN ne lit pas cubic-bezier() — Easing.bezier prend quatre nombres. C'est la
// seule façon de garder en natif les courbes du logo animé.
export const nativeEasing = Object.fromEntries(
  Object.entries(motion)
    .filter(([cle]) => cle.startsWith("ease"))
    .map(([cle, valeur]) => [cle.slice(4, 5).toLowerCase() + cle.slice(5), courbe(valeur)]),
) as Record<NomDeCourbe, Courbe>;

// ── Polices ─────────────────────────────────────────────────────────────────

// La première famille de la pile CSS est la police de marque ; les suivantes
// sont des replis de navigateur, dont RN n'a pas l'usage.
function famille(pile: string): string {
  return pile.split(",")[0]!.trim();
}

type CleDeGraisse = Exclude<
  Extract<keyof typeof typography, `font${"Display" | "Body"}${string}`>,
  "fontDisplay" | "fontBody" | "fontDisplaySettings"
>;

export type NomDePolice =
  | SansPrefixe<CleDeGraisse, "font">
  | "displayItalic"
  | "displayMediumItalic";

// RN ne résout pas une famille par graisse : il charge une police par nom. Les
// noms se dérivent donc des jetons de graisse — ce qui garantit que le nom cuit
// par le script des polices est exactement celui que les styles demandent.
const ROMAINES = Object.fromEntries(
  Object.entries(typography)
    .filter(([cle, valeur]) => /^font(Display|Body)./.test(cle) && /^\d+$/.test(valeur))
    .map(([cle]) => {
      const [, groupe, style] = cle.match(/^font(Display|Body)(.+)$/)!;
      const pile = groupe === "Display" ? typography.fontDisplay : typography.fontBody;
      return [groupe!.toLowerCase() + style, `${famille(pile)}-${style}`];
    }),
);

// Les italiques n'ont pas de jeton sur le web : là-bas, fontStyle suffit sur la
// même famille. RN veut un fichier à part, donc un nom à part — et ces deux-là
// n'existent que pour le natif. Sans elles, Quote et la signature du portrait
// rendraient droit, sans erreur ni avertissement.
export const nativeFont = {
  ...ROMAINES,
  displayItalic: `${famille(typography.fontDisplay)}-Italic`,
  displayMediumItalic: `${famille(typography.fontDisplay)}-MediumItalic`,
} as Record<NomDePolice, string>;

// En CSS l'interlignage est un facteur qui suit la taille ; en RN c'est une
// valeur absolue. Le jeton reste donc un facteur, et la conversion se fait à
// l'usage : nativeLineHeight(nativeSize.bodyM, nativeLeading.body).
export const nativeLeading = Object.fromEntries(
  Object.entries(typography)
    .filter(([cle]) => cle.startsWith("leading"))
    .map(([cle, valeur]) => [cle.slice(7, 8).toLowerCase() + cle.slice(8), sansUnite(valeur)]),
) as Record<NomDInterlignage, number>;

export function nativeLineHeight(taille: number, facteur: number): number {
  return Math.round(taille * facteur);
}

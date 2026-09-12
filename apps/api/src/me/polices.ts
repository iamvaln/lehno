import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as fontkit from "fontkit";

/**
 * LES POLICES DE MARQUE, converties en TRACÉS.
 *
 * ─── POURQUOI DES TRACÉS ET NON UNE POLICE
 *
 * `sharp` rend le SVG par librsvg, qui résout les polices par le système :
 * CoreText sur macOS, fontconfig sur Alpine. Trois voies ont été essayées et
 * mesurées, toutes trois sans effet :
 *
 * - un `@font-face` en data-URI dans le SVG — librsvg ne le lit pas ;
 * - `FONTCONFIG_FILE` pointant sur nos fichiers — ignoré sur macOS ;
 * - `font-family="Karla"` sans installation — repli silencieux.
 *
 * Les trois rendaient EXACTEMENT le même nombre de pixels encrés que
 * `font-family="PoliceQuiNExistePas"`. C'est la panne que le script de cuisson
 * décrit : « le système rendrait sa police par défaut, et l'identité tomberait
 * en silence ».
 *
 * Installer les polices dans l'image Docker marcherait — mais serait
 * INVÉRIFIABLE ICI : on ne saurait qu'au premier déploiement si l'identité
 * tient, et une police absente ne lève aucune erreur. Le seul contenu qui sorte
 * du produit en portant la marque ne mérite pas ce risque-là.
 *
 * Converti en tracés, le texte est de la géométrie : identique sur macOS et sur
 * Alpine, rien à installer, et le résultat se vérifie sur la machine où on
 * l'écrit.
 *
 * ─── L'INSTANCE DE MARQUE EST DÉJÀ CUITE
 *
 * Fraunces est une variable, et la marque en emploie une instance précise —
 * `SOFT 40, WONK 1`, celle du logotype. `apps/mobile/polices/cuire.ts` fige ces
 * axes dans des fichiers statiques ; on lit ces fichiers-là, pas la variable.
 * Charger la variable rendrait sa forme neutre, sans que rien ne le signale.
 *
 * Fraunces et Karla sont sous SIL OFL 1.1, sans Reserved Font Name — les
 * licences accompagnent les fichiers dans `apps/mobile/polices`.
 */

/* Les huit fichiers vivent chez le mobile, qui les a cuits. Les recopier ici
   donnerait deux jeux à tenir d'accord, et le jour où la charte change, l'un
   des deux resterait en arrière. */
const DOSSIER = join(
  dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "apps", "mobile", "polices",
);

/* CE QUE LA CHARTE AUTORISE, et rien de plus.
 *
 * Fraunces pour les titres, en 400 ou 500 — jamais en dessous de 22 points.
 * Karla pour le texte, de 400 à 700. Les italiques existent au dossier ; le
 * portrait n'en emploie aucune, et les déclarer ici inviterait à en poser une
 * sans que la charte l'ait prévu. */
export const POLICES = {
  titre: "Fraunces-Regular.ttf",
  titreMoyen: "Fraunces-Medium.ttf",
  texte: "Karla-Regular.ttf",
  texteMoyen: "Karla-Medium.ttf",
  texteFort: "Karla-Semibold.ttf",
} as const;

export type Police = keyof typeof POLICES;

/** La taille sous laquelle Fraunces ne se pose pas. La charte le dit, et une
 *  display trop petite perd exactement ce qui la distingue. */
export const FRAUNCES_MIN = 22;

/* Les fichiers se lisent UNE FOIS. Chacun pèse soixante-dix kilo-octets, et une
   composition en emploie deux : les relire à chaque portrait coûterait un accès
   disque par ligne de texte. */
const chargees = new Map<Police, fontkit.Font>();

/* `fontkit` ET NON `opentype.js`. Le second bute au CHARGEMENT de Fraunces :
   « substitutionType 62 lookupType 6 substFormat 2 is not yet supported ». Nos
   fichiers sont des instances cuites d'une variable, avec les tables de
   substitution qui vont avec ; fontkit les lit. */
function police(quelle: Police): fontkit.Font {
  const deja = chargees.get(quelle);
  if (deja) return deja;
  const f = fontkit.create(readFileSync(join(DOSSIER, POLICES[quelle])));
  if ("fonts" in f) throw new Error(`${POLICES[quelle]} est une collection, pas une police`);
  chargees.set(quelle, f);
  return f;
}

/**
 * Un texte, en données de tracé SVG.
 *
 * LA COMPOSITION SE FAIT PAR `layout`, pas glyphe par glyphe : c'est elle qui
 * applique les ligatures et le crénage. Sans elle, « Te » resterait espacé
 * comme deux lettres sans rapport — et c'est exactement ce qu'une display de
 * marque est faite pour éviter.
 *
 * @param y la LIGNE DE BASE, pas le haut du texte — c'est la convention des
 *   polices, et celle de `<text>` en SVG.
 */
export function tracer(
  texte: string, quelle: Police, taille: number, x: number, y: number,
): string {
  const f = police(quelle);
  const echelle = taille / f.unitsPerEm;
  const run = f.layout(texte);

  const morceaux: string[] = [];
  let avance = 0;
  for (const [i, glyphe] of run.glyphs.entries()) {
    const pos = run.positions[i]!;
    const d = glyphe.path
      /* Y INVERSÉ : une police compte vers le haut depuis la ligne de base, un
         SVG vers le bas depuis le coin. Sans cette symétrie, le texte sort
         retourné — et à l'envers, pas seulement décalé. */
      .scale(echelle, -echelle)
      .translate(x + (avance + pos.xOffset) * echelle, y + pos.yOffset * echelle)
      .toSVG();
    if (d) morceaux.push(d);
    avance += pos.xAdvance;
  }
  return morceaux.join(" ");
}

/** La largeur qu'un texte occupera, mesurée sur la police RÉELLE.
 *
 *  C'est ce qui permet de couper une phrase au bon endroit et de poser une
 *  mention à droite sans la faire dépasser. Compter les caractères donne un
 *  résultat faux dès qu'un mot porte des « i » ou des « m ». */
export function largeur(texte: string, quelle: Police, taille: number): number {
  const f = police(quelle);
  return (f.layout(texte).advanceWidth * taille) / f.unitsPerEm;
}

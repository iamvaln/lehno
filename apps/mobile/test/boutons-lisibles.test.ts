import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* UN BOUTON QUI NE PORTE QU'UNE ICÔNE DOIT SE DIRE.
 *
 * Sans `accessibilityLabel`, un lecteur d'écran annonce « bouton » et rien
 * d'autre. Sur les deux flèches du calendrier, il annonçait « bouton » DEUX
 * FOIS À L'IDENTIQUE, de part et d'autre du titre : rien ne disait laquelle
 * avance et laquelle recule.
 *
 * LE PIÈGE EST QUE ÇA MARCHE. L'écran est juste, le geste fonctionne, aucun
 * test ne tombe — c'est la même classe que la sauvegarde Android laissée
 * ouverte : ce qui réussit silencieusement ne se voit pas. Sauf que là, ça ne
 * se voit pas *pour ceux qui voient*.
 *
 * Ce test ne juge pas la qualité du libellé, seulement sa présence : le reste
 * se relit à l'écran. Mais l'absence, elle, se prouve ici.
 */
const ecrans = (dossier: string): string[] => {
  const base = new URL(`../app/${dossier}`, import.meta.url);
  return readdirSync(base, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? ecrans(`${dossier}${e.name}/`)
      : e.name.endsWith(".tsx") ? [`${dossier}${e.name}`] : []);
};

/* On isole chaque `<Pressable …>` avec ce qu'il contient jusqu'à sa fermeture.
   Un Pressable dont le contenu n'est QU'une icône — pas un mot — n'a rien à
   annoncer si le libellé manque. */
const PRESSABLE = /<Pressable\b([\s\S]*?)>([\s\S]*?)<\/Pressable>/g;

function muets(source: string): string[] {
  const trouves: string[] = [];
  for (const m of source.matchAll(PRESSABLE)) {
    const attributs = m[1]!;
    const contenu = m[2]!;
    const porteUneIcone = /<Icon\b/.test(contenu);
    /* Du TEXTE dans le bouton suffit : le lecteur d'écran le lit. On cherche
       un `<Text` ou une expression de dictionnaire posée nue. */
    const porteDesMots = /<Text\b|\{t\./.test(contenu);
    if (!porteUneIcone || porteDesMots) continue;
    if (/accessibilityLabel/.test(attributs)) continue;
    trouves.push(contenu.trim().slice(0, 60).replace(/\s+/g, " "));
  }
  return trouves;
}

describe("les boutons qui ne portent qu'une icône se disent", () => {
  const fichiers = ecrans("");

  it("trouve des écrans à examiner", () => {
    // Sans ce garde-fou, un changement d'arborescence viderait le test sans
    // le faire échouer — un test qui n'examine rien passe au vert.
    expect(fichiers.length).toBeGreaterThan(20);
  });

  for (const f of fichiers) {
    it(`${f} n'a pas de bouton muet`, () => {
      const source = readFileSync(new URL(`../app/${f}`, import.meta.url), "utf8");
      expect(muets(source)).toEqual([]);
    });
  }
});

/* UN AVATAR NE RÉPÈTE PAS LE NOM QU'ON LIT À CÔTÉ.
 *
 * `Avatar` portait `accessibilityLabel={name}` — l'intention était juste, « le
 * lecteur annonce la personne, pas image ». Mais dans TOUS les endroits où il
 * paraît, le nom est écrit à côté : le rang du carnet s'annonçait « Awa, Awa,
 * rien de noté encore, compléter ».
 *
 * Constaté dans la hiérarchie d'accessibilité du simulateur, pas deviné.
 *
 * Ce test lie le composant à cet usage : le jour où un avatar devra parler,
 * c'est ce test qu'il faudra contredire — en connaissance de cause.
 */
describe("l'avatar se tait, le nom est écrit à côté", () => {
  const source = readFileSync(
    new URL("../../../packages/ui-native/src/core/Avatar.tsx", import.meta.url), "utf8",
  );

  it("ne porte pas d'étiquette d'accessibilité", () => {
    expect(source).not.toMatch(/accessibilityLabel=\{name\}/);
  });

  /* Masqué, pas seulement sans étiquette : sans cela l'initiale dessinée —
     « A » — se lirait à la place du nom, ce qui est pire qu'un doublon. */
  it("se retire de l'arbre d'accessibilité, descendants compris", () => {
    expect(source).toMatch(/accessibilityElementsHidden: true/);
    expect(source).toMatch(/importantForAccessibility: "no-hide-descendants"/);
  });
});

/* UNE BASCULE SE TOUCHE PARTOUT, pas seulement sur son interrupteur.
 *
 * Le libellé était inerte : il fallait viser une cinquantaine de points sur un
 * rang large de trois cent cinquante. Le geste naturel — toucher le texte — ne
 * faisait rien. Le kit demande « 44 px partout » précisément pour ça.
 *
 * Constaté en pilotant l'écran d'identité : l'appui sur « Je ne connais pas
 * l'année » ne basculait rien.
 */
describe("une bascule se touche partout", () => {
  const source = readFileSync(
    new URL("../composants/Bascule.tsx", import.meta.url), "utf8",
  );

  it("enveloppe le rang entier dans un geste", () => {
    expect(source).toMatch(/<Pressable/);
    expect(source).toMatch(/accessibilityRole="switch"/);
  });

  /* L'interrupteur se retire de l'arbre : sinon le libellé s'annonce deux
     fois, une par le rang et une par l'interrupteur qui le reprend. */
  it("ne fait pas annoncer le libellé deux fois", () => {
    expect(source).toMatch(/accessibilityElementsHidden/);
    expect(source).toMatch(/importantForAccessibility="no-hide-descendants"/);
  });
});

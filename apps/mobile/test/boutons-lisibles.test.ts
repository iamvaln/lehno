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

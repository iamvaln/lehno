import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* AUCUNE SURCOUCHE NE SE REND À L'INTÉRIEUR D'UN DÉFILEMENT.
 *
 * Feuille, confirmation, accusé : les trois se posent « par-dessus l'écran ».
 * En natif, « par-dessus » n'existe pas — `position: fixed` non plus. Ces
 * composants s'ancrent au bas de LEUR BOÎTE PARENTE : sœurs du défilement,
 * c'est l'écran ; enfants, c'est le CONTENU, qui est plus haut que l'écran dès
 * qu'il y a de quoi faire défiler.
 *
 * Ce que ça donne, vu à l'appareil : sur un iPhone SE, la feuille payante de
 * la préparation s'ouvrait à 517 points du haut d'un écran qui en fait 667, et
 * finissait à 835 — le coût annoncé et les deux boutons étaient hors champ,
 * sous la barre d'onglets. La feuille s'ouvrait donc bel et bien, et ne
 * pouvait NI se confirmer NI se refuser. Rien à l'écran ne le disait ; le
 * bouton « Préparer » semblait simplement ne rien faire.
 *
 * Le voile souffre du même mal : `position: absolute` sur les quatre côtés de
 * sa boîte, il n'éteint que la portion de contenu qu'il recouvre — l'en-tête
 * et le bouton retour restent touchables pendant qu'on répond à la question.
 *
 * La forme juste est celle de sept écrans sur neuf déjà : un `<View flex: 1>`
 * qui porte le défilement ET la surcouche côte à côte.
 *
 * Le test lit la SOURCE plutôt que de rendre les écrans : `react-native` est
 * typé Flow, et Vitest ne le charge pas.
 */

const DEFILANTS = ["ScrollView", "FlatList", "SectionList"] as const;
const SURCOUCHES = ["Toast", "ConfirmSheet", "PaidActionSheet"] as const;

const RACINE = new URL("../app/", import.meta.url);

/** Tous les `.tsx` sous `app/`, groupes `(…)` compris. */
function ecrans(dossier: URL = RACINE, prefixe = ""): readonly string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    if (entree.isDirectory()) {
      trouves.push(...ecrans(new URL(`${entree.name}/`, dossier), `${prefixe}${entree.name}/`));
    } else if (entree.name.endsWith(".tsx")) {
      trouves.push(`${prefixe}${entree.name}`);
    }
  }
  return trouves;
}

/* LA BALISE NE TIENT PAS SUR UNE LIGNE, et c'est le cas ORDINAIRE ici :
   `<ScrollView` seul, puis ses attributs en dessous. Une garde qui lit ligne à
   ligne ne voit donc rien — elle est passée verte sur les trois écrans fautifs
   avant qu'on ne s'en aperçoive. On balaie le fichier entier, en repérant la
   fin de chaque balise plutôt que la fin de chaque ligne. */

/** L'index du `>` qui ferme la balise ouverte en `depart`, accolades sautées. */
function finDeBalise(source: string, depart: number): number {
  let accolades = 0;
  for (let i = depart; i < source.length; i += 1) {
    const c = source[i];
    if (c === "{") accolades += 1;
    else if (c === "}") accolades -= 1;
    else if (c === ">" && accolades === 0) return i;
  }
  return source.length;
}

interface Repere { readonly index: number; readonly pas: number }

function surcouchesDefilantes(source: string): readonly string[] {
  const reperes: Repere[] = [];

  for (const balise of DEFILANTS) {
    /* `\b` plutôt que `[\s>]` : la balise peut finir la ligne. Et `<` suivi
       de la lettre écarte `</ScrollView>`, qui se compte à part. */
    for (const m of source.matchAll(new RegExp(`<${balise}\\b`, "g"))) {
      const debut = m.index;
      const fin = finDeBalise(source, debut);
      /* Auto-fermante : elle ouvre et referme d'un coup. `<FlatList … />` est
         la forme la plus courante ; la compter comme ouverte ferait passer
         tout ce qui la suit pour imbriqué. */
      reperes.push({ index: debut, pas: source[fin - 1] === "/" ? 0 : 1 });
    }
    for (const m of source.matchAll(new RegExp(`</${balise}>`, "g"))) {
      reperes.push({ index: m.index, pas: -1 });
    }
  }

  const cibles: { index: number; balise: string }[] = [];
  for (const balise of SURCOUCHES) {
    for (const m of source.matchAll(new RegExp(`<${balise}\\b`, "g"))) {
      cibles.push({ index: m.index, balise });
    }
  }

  const ligneDe = (index: number): number => source.slice(0, index).split("\n").length;

  return cibles
    .filter(({ index }) => reperes
      .filter((r) => r.index < index)
      .reduce((somme, r) => somme + r.pas, 0) > 0)
    .sort((a, b) => a.index - b.index)
    .map(({ index, balise }) => `ligne ${ligneDe(index)} : <${balise}>`);
}

describe("les surcouches se posent sur l'écran, pas dans le défilement", () => {
  for (const ecran of ecrans()) {
    it(`app/${ecran}`, () => {
      const source = readFileSync(new URL(ecran, RACINE), "utf8");
      expect(surcouchesDefilantes(source)).toEqual([]);
    });
  }

  /* LES SONDES. Sans elles, on ne saurait pas si la garde compte les balises
     ou regarde ailleurs — et c'est exactement l'erreur qu'elle a déjà faite :
     verte, sur les trois écrans qu'elle devait attraper. La première sonde
     porte donc la balise SUR PLUSIEURS LIGNES, comme les écrans l'écrivent. */
  it("mord sur une feuille rendue dans un défilement multi-lignes", () => {
    const faute = [
      "<ScrollView",
      "  contentContainerStyle={[styles.page, { paddingTop: 8 }]}",
      ">",
      "  <Text>…</Text>",
      "  <PaidActionSheet cout={1} />",
      "</ScrollView>",
    ].join("\n");
    expect(surcouchesDefilantes(faute)).toEqual(["ligne 5 : <PaidActionSheet>"]);
  });

  it("laisse passer une feuille sœur du défilement", () => {
    const juste = [
      "<View>",
      "  <ScrollView>",
      "    <Text>…</Text>",
      "  </ScrollView>",
      "  <PaidActionSheet cout={1} />",
      "</View>",
    ].join("\n");
    expect(surcouchesDefilantes(juste)).toEqual([]);
  });

  it("referme une liste auto-fermante", () => {
    const juste = [
      "<View>",
      "  <FlatList",
      "    data={x}",
      "    renderItem={y}",
      "  />",
      "  <Toast>…</Toast>",
      "</View>",
    ].join("\n");
    expect(surcouchesDefilantes(juste)).toEqual([]);
  });

  /* Une flèche dans un attribut porte un `>` qui n'est PAS la fin de la
     balise. Elle vit entre accolades — c'est pourquoi on les saute. */
  it("ne prend pas une flèche d'attribut pour la fin de la balise", () => {
    const juste = [
      "<View>",
      "  <FlatList",
      "    renderItem={({ item }) => <Rang item={item} />}",
      "  />",
      "  <Toast>…</Toast>",
      "</View>",
    ].join("\n");
    expect(surcouchesDefilantes(juste)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { en } from "../messages/en.js";
import { fr } from "../messages/fr.js";

describe("les deux langues portent les mêmes clés", () => {
  /* Aucun repli d'une langue sur l'autre : un appel qui oublie sa clé doit
     échouer à la compilation, pas s'afficher dans la mauvaise langue. */
  it("aucune clé ne manque d'un côté", () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
  });

  it("chaque clé a la même nature dans les deux", () => {
    for (const cle of Object.keys(fr) as (keyof typeof fr)[]) {
      expect(typeof fr[cle], cle).toBe(typeof en[cle]);
    }
  });
});

/* LE GENRE D'UN TIERS — et ce que cette règle veut vraiment dire.
 *
 * Le produit parle de proches dont il ne connaît pas le genre, et n'a pas de
 * champ pour le demander. Une phrase qui suppose « il » ou « elle » d'une
 * PERSONNE se trompe une fois sur deux.
 *
 * Ce que ce test cherchait au début — tout `il`, `elle`, `son`, `sa`, `ses` —
 * relevait vingt-quatre chaînes pour deux vraies fautes. En français, le
 * possessif s'accorde avec l'OBJET POSSÉDÉ, pas avec la personne : « ses
 * notes » vaut pour tout le monde. Et « elle s'affiche », d'une date, ne genre
 * personne. Vingt-deux reformulations ont alourdi la copy sans rien corriger,
 * et il a fallu les défaire.
 *
 * D'où deux traitements, parce que les deux langues ne se ressemblent pas ici :
 *
 * L'ANGLAIS se vérifie. `he`, `she`, `his`, `her` désignent une personne, sans
 * ambiguïté possible : un objet y prend `it`, et `their` couvre le reste.
 *
 * LE FRANÇAIS ne se vérifie pas ainsi. Aucune expression régulière ne distingue
 * le « elle » d'une date de celui d'une personne. Ce qui se cherche, en
 * revanche, c'est la marque d'un accord — les formes doublées par lesquelles on
 * essaie de genrer les deux à la fois. Elles trahissent une phrase écrite en
 * pensant à quelqu'un.
 */
describe("le genre d'un tiers n'existe pas", () => {
  const chaines = (table: Record<string, unknown>): [string, string][] =>
    Object.entries(table).filter((e): e is [string, string] => typeof e[1] === "string");

  /* Un objet prend `it`, une personne dont on ignore le genre prend `their`.
     Les tournures impersonnelles sont relevées une à une plutôt que tolérées en
     bloc : la liste doit rester courte et se relire. */
  const ADMISES_EN = ["here", "there", "where", "other", "another", "either", "whether", "the rest"];

  it("l'anglais ne suppose pas le genre d'une personne", () => {
    const suspect = /\b(he|she|him|his|her|hers)\b/i;
    const fautes = chaines(en)
      .filter(([, v]) => suspect.test(v))
      .filter(([, v]) => !ADMISES_EN.some((a) => v.toLowerCase().includes(a)))
      .map(([c, v]) => `en.${c} — « ${v} »`);
    expect(fautes).toEqual([]);
  });

  /* Une personne rangée parmi les choses — « Its notes and dates go with it »
     pour un proche — est une faute plus grave qu'un genre supposé. Elle s'est
     produite une fois, et elle est corrigée.
     
     Elle n'a PAS son test : « it » désigne une chose neuf fois sur dix, et la
     règle relevait « Get it filled » ou « its last legs » sans rien trouver de
     vrai. Un test qu'on truffe d'exceptions pour qu'il passe n'éprouve plus
     rien — il apprend à ignorer ses propres alertes. */

  /* Les marques d'accord doublé — « invité(e) », « prêt·e », « celui/celle ».
     Elles n'apparaissent que dans une phrase écrite en pensant à une personne,
     et c'est précisément celle-là qu'il ne faut pas genrer. */
  it("le français ne double aucun accord", () => {
    const doublure = /(\w+\(e\)|\w+·e\b|\bcelui\s*\/\s*celle|\bil\s*\/\s*elle)/i;
    const fautes = chaines(fr)
      .filter(([, v]) => doublure.test(v))
      .map(([c, v]) => `fr.${c} — « ${v} »`);
    expect(fautes).toEqual([]);
  });
});

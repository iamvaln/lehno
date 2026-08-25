import { describe, expect, it } from "vitest";
import { en } from "../messages/en.js";
import { fr } from "../messages/fr.js";

const cles = (o: object) => Object.keys(o).sort();

describe("le dictionnaire", () => {
  /* Une clé présente dans une langue et pas dans l'autre ne casse rien à la
     compilation : l'écran rend « undefined » dans une seule langue, et
     seulement pour qui l'a réglée ainsi. C'est le défaut le plus facile à ne
     jamais voir. */
  it("porte exactement les mêmes clés dans les deux langues", () => {
    expect(cles(fr)).toEqual(cles(en));
  });

  // Une clé qui est une fonction d'un côté et une chaîne de l'autre plante à
  // l'appel, dans une langue seulement.
  it("porte la même forme sous chaque clé", () => {
    for (const cle of cles(fr)) {
      const a = fr[cle as keyof typeof fr];
      const b = en[cle as keyof typeof en];
      expect(typeof a, cle).toBe(typeof b);
    }
  });

  it("ne laisse aucune valeur vide", () => {
    for (const [cle, valeur] of [...Object.entries(fr), ...Object.entries(en)]) {
      if (typeof valeur === "string") expect(valeur.trim(), cle).not.toBe("");
    }
  });
});

/* Le contrôle mécanique de `verifier-genre.md`. La règle « le genre du tiers
   n'existe pas » s'est fait contourner trois fois de suite par de la relecture
   humaine — d'où un test plutôt qu'une consigne.
 *
 * Ce qui est un vrai défaut : tout ce qui désigne UN PROCHE — un pronom, un
 * possessif, ou un accord d'adjectif, celui-ci passant le plus facilement.
 * Ce qui n'en est pas : « il vous reste deux essais » (impersonnel), « pendant
 * qu'elle est fraîche » (une idée, pas une personne). */
describe("le genre du tiers n'existe pas", () => {
  const SUSPECT = /\b(il|elle|ils|elles|son|sa|ses|he|she|his|her|fier|fière)\b/i;

  // Les tournures impersonnelles et les reprises d'objet, relevées une à une
  // plutôt que tolérées en bloc : la liste doit rester courte et se relire.
  const ADMISES = [
    "il vous reste", "il vous en reste", "il ne reste",
    "pendant qu'elle est fraîche", "sans elle",
  ];

  it("aucune chaîne ne genre un tiers", () => {
    const fautes: string[] = [];
    for (const [langue, table] of [["fr", fr], ["en", en]] as const) {
      for (const [cle, valeur] of Object.entries(table)) {
        if (typeof valeur !== "string") continue;
        if (!SUSPECT.test(valeur)) continue;
        if (ADMISES.some((a) => valeur.toLowerCase().includes(a))) continue;
        fautes.push(`${langue}.${cle} — « ${valeur} »`);
      }
    }
    expect(fautes).toEqual([]);
  });
});

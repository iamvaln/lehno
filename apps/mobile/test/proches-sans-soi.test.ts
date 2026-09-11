import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* UN ÉCRAN QUI DIT « MES PROCHES » ÉCARTE LA FICHE DE SOI.
 *
 * `/me/persons` la rend parmi les autres — vérifié au serveur le 11 septembre.
 * Un écran qui lit la liste sans la filtrer met le titulaire dans son propre
 * carnet, et rien ne tombe : la liste est simplement plus longue d'un.
 *
 * La table est ÉCRITE À LA MAIN, et c'est le but : un écran qui se met à lire
 * le carnet doit être inscrit ici, donc DÉCIDÉ. Une détection automatique le
 * laisserait passer en silence — précisément le cas qu'on veut rendre
 * impossible.
 */
const ECRANS: Readonly<Record<string, "sansSoi" | "soiDabord">> = {
  "(app)/proches/index": "sansSoi",
  "(app)/proches/recherche": "sansSoi",
  "note": "sansSoi",
  /* Poser une date VISE quelqu'un, et ce quelqu'un peut être soi — c'est même
     le seul endroit où une date à soi se pose. */
  "evenement": "soiDabord",
};

const source = (nom: string): string =>
  readFileSync(new URL(`../app/${nom}.tsx`, import.meta.url), "utf8");

/* Le prédicat est nommé et partagé plutôt qu'inline dans chaque `it` : c'est
   ce qui rend la sonde plus bas capable d'éprouver la garde elle-même, et pas
   sa propre paraphrase. Une sonde qui vérifierait une autre expression que
   celle de la boucle passerait au vert sans avoir rien mordu. */
const emploie = (source: string, attendu: "sansSoi" | "soiDabord"): boolean =>
  source.includes(`${attendu}(`);

describe("le carnet et la fiche de soi", () => {
  for (const [ecran, attendu] of Object.entries(ECRANS)) {
    it(`app/${ecran}.tsx emploie ${attendu}`, () => {
      expect(emploie(source(ecran), attendu)).toBe(true);
    });
  }

  /* LA SONDE. Une garde qui lit la source doit prouver qu'elle mord — sur une
     ligne fautive ET pas sur une ligne correcte. Le prédicat éprouvé ici est
     EXACTEMENT celui que la boucle ci-dessus emploie : une sonde qui en
     recopierait la logique à côté n'éprouverait que sa propre copie. */
  it("emploie() distingue l'écran qui filtre de celui qui ne filtre pas", () => {
    const faute = "setCarnet(personListSchema.parse(brut).persons);";
    const juste = "setCarnet(sansSoi(personListSchema.parse(brut).persons));";
    expect(emploie(faute, "sansSoi")).toBe(false);
    expect(emploie(juste, "sansSoi")).toBe(true);
  });
});

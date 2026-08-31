import { describe, expect, it } from "vitest";
import { updateWallSchema, type Wall, type WallInterest } from "@lehno/contracts";
import { basculeLInteret, corpsDExposition, peutPartager } from "../lib/mur.js";

const uuid = (n: number): string =>
  `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;

const interet = (n: number, isPublic: boolean): WallInterest => ({
  id: uuid(n), kind: "hobby", value: `goût ${n}`, isPublic,
});

const mur = (isEnabled: boolean): Wall => ({
  slug: "valentine", isEnabled, showBirthdayDate: true, welcomeMessage: null,
  publicUrl: "https://lehno.app/valentine", wishLinkUrl: null, interests: [],
});


describe("ce qui est exposé", () => {
  /* EN ENTIER, jamais par ajout ni retrait : « un patch élément par élément
     laisserait une case décochée à l'écran rester cochée EN BASE si l'appel qui
     la retirait s'est perdu ». */
  it("envoie l'ensemble de ce qui reste public", () => {
    const corps = corpsDExposition([interet(1, true), interet(2, false), interet(3, true)]);
    expect(corps.publicInterestIds).toEqual([uuid(1), uuid(3)]);
  });

  /* Un tableau VIDE est un geste légitime — « plus rien d'exposé » — et non une
     absence de choix. Omettre le champ laisserait tout en place. */
  it("compose le vide plutôt que d'omettre le champ", () => {
    expect(corpsDExposition([interet(1, false)]).publicInterestIds).toEqual([]);
    expect(corpsDExposition([])).toHaveProperty("publicInterestIds");
  });

  it("compose un corps que le contrat accepte", () => {
    expect(updateWallSchema.safeParse(corpsDExposition([interet(1, true)])).success).toBe(true);
  });

  // Muter la liste reçue ferait diverger l'écran de ce que le serveur a
  // confirmé, le jour où l'appel échoue.
  it("bascule sans modifier la liste reçue", () => {
    const source = [interet(1, true), interet(2, false)];
    const apres = basculeLInteret(source, uuid(2));
    expect(apres[1]?.isPublic).toBe(true);
    expect(source[1]?.isPublic).toBe(false);
  });

  it("ne touche que le goût visé", () => {
    const apres = basculeLInteret([interet(1, true), interet(2, false)], uuid(1));
    expect(apres.map((i) => i.isPublic)).toEqual([false, false]);
  });
});

describe("l'adresse du Mur", () => {
  /* Elle se MONTRE avant la publication — « pour qu'on sache ce qu'on s'apprête
     à ouvrir » — et ne se PARTAGE qu'après : la faire circuler avant que la
     page ne réponde enverrait des gens sur un refus. */
  it("ne se partage qu'une fois le Mur allumé", () => {
    expect(peutPartager(mur(true))).toBe(true);
    expect(peutPartager(mur(false))).toBe(false);
  });
});

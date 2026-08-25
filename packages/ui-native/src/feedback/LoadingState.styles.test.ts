import { describe, expect, it } from "vitest";
import { resolve } from "@lehno/tokens";
import { estQuittable, VARIANTES_D_ATTENTE } from "./LoadingState.styles.js";

describe("l'attente", () => {
  it("connaît les trois familles de la charte", () => {
    expect([...VARIANTES_D_ATTENTE]).toEqual(["liste", "envoi", "generation"]);
  });

  /* « Quitter sans perdre » n'est une promesse que pour l'attente longue. La
     tenir sur un envoi — trois secondes — n'aurait aucun sens, et l'offrir sur
     un squelette de liste apprendrait que le bouton ne veut rien dire. */
  it("n'offre de quitter que sur l'attente longue", () => {
    expect(estQuittable("generation")).toBe(true);
    expect(estQuittable("envoi")).toBe(false);
    expect(estQuittable("liste")).toBe(false);
  });
});

describe("le squelette de liste", () => {
  // Les lignes du squelette se posent sur un filet, pas sur un fond : un bloc
  // gris plein annoncerait du contenu là où il n'y en a pas encore.
  it("dessine ses lignes au filet", async () => {
    const { styleDAttente } = await import("./LoadingState.styles.js");
    const s = styleDAttente({ couleurs: resolve("light"), variante: "liste" });
    expect(s.carte?.borderColor).toBe(resolve("light").borderHairline);
    expect(s.carte?.backgroundColor).toBeUndefined();
  });
});

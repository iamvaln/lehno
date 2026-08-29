import { describe, expect, it } from "vitest";
import { estActive, featuresSchema, SOCLE } from "./me-features.js";

describe("les fonctionnalités actives", () => {
  // Le serveur rend LA LISTE RÉSOLUE pour le demandeur — ce qui est actif,
  // jamais l'état brut des drapeaux. Le jour où l'activation devient sélective,
  // rien ne change côté client.
  it("se lit comme une liste de noms", () => {
    expect(featuresSchema.parse({ features: ["wall", "wishes"] }).features).toEqual(["wall", "wishes"]);
  });

  it("accepte une liste vide", () => {
    expect(() => featuresSchema.parse({ features: [] })).not.toThrow();
  });

  /* Un drapeau inconnu vaut éteint : une version installée ignore une clé créée
     après elle, et le parc ne se met pas à jour d'un bloc. Sans cette règle,
     une clé nouvelle ferait afficher un écran que la version ne sait pas rendre. */
  it("tient pour éteint ce qu'elle ne connaît pas", () => {
    expect(estActive(["wall"], "surface-inventee")).toBe(false);
  });

  it("tient pour allumé ce que le serveur a rendu", () => {
    expect(estActive(["wall", "wishes"], "wishes")).toBe(true);
  });

  /* Le socle n'a pas de drapeau : proches, notes, dates, occasions, rappels,
     compte. Il est toujours actif — et c'est lui qui reste debout quand l'appel
     des drapeaux échoue au démarrage, plutôt qu'une application vide. */
  it("tient le socle pour actif, même sans réponse du serveur", () => {
    for (const capacite of SOCLE) {
      expect(estActive([], capacite), capacite).toBe(true);
    }
  });

  it("ne compte pas une capacité hors socle comme active sur une liste vide", () => {
    expect(estActive([], "wall")).toBe(false);
  });
});

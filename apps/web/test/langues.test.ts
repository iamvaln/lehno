import { describe, expect, it } from "vitest";
import { langueDemandee } from "../lib/langues.js";

describe("négociation de langue", () => {
  it("sans en-tête, le français", () => {
    expect(langueDemandee(null)).toBe("fr");
    expect(langueDemandee("")).toBe("fr");
  });

  it("reconnaît une variante régionale", () => {
    expect(langueDemandee("en-GB,en;q=0.9")).toBe("en");
    expect(langueDemandee("fr-CM")).toBe("fr");
  });

  it("respecte le facteur de qualité plutôt que l'ordre d'écriture", () => {
    expect(langueDemandee("fr;q=0.2,en;q=0.9")).toBe("en");
    expect(langueDemandee("en;q=0.3,fr;q=0.8")).toBe("fr");
  });

  it("ignore une langue explicitement refusée", () => {
    expect(langueDemandee("en;q=0, de;q=0.9")).toBe("fr");
  });

  it("retombe sur le français devant une langue que le produit ne parle pas", () => {
    expect(langueDemandee("de-DE,de;q=0.9")).toBe("fr");
  });
});

import { describe, expect, it } from "vitest";
import { LEGAL_DOCUMENTS, LEGAL_LANGUAGES } from "@lehno/contracts";
import { LegalService } from "../src/public/legal.controller.js";

const legal = new LegalService();

describe("la version d'un document légal", () => {
  // C'est cette version qu'on enregistre au compte de chaque inscrit. Si le
  // format de l'en-tête change — ou si quelqu'un le retire en remaniant un
  // document —, la lecture doit ÉCHOUER bruyamment plutôt que de rendre un
  // repli : une acceptation dont on ignore le texte ne vaut rien.
  it.each(LEGAL_DOCUMENTS.flatMap((d) => LEGAL_LANGUAGES.map((l) => [d, l] as const)))(
    "%s.%s porte une version lisible",
    async (document, langue) => {
      const version = await legal.version(document, langue);
      expect(version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    },
  );

  // Les deux langues d'un même document décrivent le même texte : une version
  // qui diverge signalerait qu'une traduction a été oubliée lors d'une mise à
  // jour, et deux inscrits accepteraient des textes différents le même jour.
  it.each([...LEGAL_DOCUMENTS])("%s porte la même version dans les deux langues", async (document) => {
    const fr = await legal.version(document, "fr");
    const en = await legal.version(document, "en");
    expect(en, `${document} : la version anglaise diverge de la française`).toBe(fr);
  });

  it("refuse un document inconnu plutôt que d'inventer une version", async () => {
    await expect(legal.version("inexistant", "fr")).rejects.toMatchObject({ code: "not_found" });
  });
});

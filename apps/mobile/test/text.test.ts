import { describe, expect, it } from "vitest";
import { endSentence } from "../lib/text.js";
import { dateCourte } from "../lib/carnet.js";
import { fr } from "../messages/fr.js";
import { en } from "../messages/en.js";

describe("ending a sentence", () => {
  it("adds the full stop when there is none", () => {
    expect(endSentence("Rien avant le 4 mars")).toBe("Rien avant le 4 mars.");
  });

  it("does not double one that is already there", () => {
    expect(endSentence("Rien avant le 7 nov.")).toBe("Rien avant le 7 nov.");
  });
});

/* LE DÉFAUT, VU À L'ÉCRAN : « Rien avant le 7 nov.. ».
 *
 * Il ne se montre que pour les mois que le français abrège — et « mars » ne
 * l'est pas, ni aucun mois en anglais. Onze cas sur douze cachaient le
 * douzième, et c'est pourquoi ce cas parcourt L'ANNÉE plutôt qu'une date. */
describe("le résumé lointain, sur les douze mois", () => {
  const jours = Array.from({ length: 12 }, (_, m) => `2026-${String(m + 1).padStart(2, "0")}-07`);

  it("n'écrit jamais deux points en français", () => {
    for (const jour of jours) {
      const phrase = fr.etatLointain(dateCourte(jour, "fr"));
      expect(phrase, `${jour} → ${phrase}`).not.toMatch(/\.\./);
      expect(phrase.endsWith("."), `${jour} → ${phrase}`).toBe(true);
    }
  });

  it("ni en anglais", () => {
    for (const jour of jours) {
      const phrase = en.etatLointain(dateCourte(jour, "en"));
      expect(phrase, `${jour} → ${phrase}`).not.toMatch(/\.\./);
      expect(phrase.endsWith("."), `${jour} → ${phrase}`).toBe(true);
    }
  });
});

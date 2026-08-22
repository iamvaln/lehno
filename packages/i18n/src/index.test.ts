import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@lehno/contracts";
import { catalogues, translateError, LOCALES } from "./index.js";

describe("catalogues", () => {
  // Le vrai risque n'est pas la faute de frappe : c'est le code ajouté au serveur
  // que personne ne traduit, et que l'utilisateur lit brut.
  it.each(LOCALES)("%s traduit chaque code d'erreur", (locale) => {
    const manquants = ERROR_CODES.filter((c) => !catalogues[locale].errors[c]);
    expect(manquants).toEqual([]);
  });

  it("les deux catalogues portent exactement les mêmes clés", () => {
    const clefs = (o: object): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        v && typeof v === "object" ? clefs(v).map((s) => `${k}.${s}`) : [k],
      );
    expect(clefs(catalogues.fr).sort()).toEqual(clefs(catalogues.en).sort());
  });

  it("translateError rend la phrase de la langue demandée", () => {
    expect(translateError("otp_expired", "fr")).toBe("Ce code a expiré. Demandez-en un nouveau.");
    expect(translateError("otp_expired", "en")).toBe("That code has expired. Ask for a new one.");
  });
});

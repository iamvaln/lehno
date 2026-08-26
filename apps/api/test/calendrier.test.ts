import { describe, expect, it } from "vitest";
import { ajouterJours, ajouterMois, echeances } from "../src/me/calendrier.js";

describe("arithmétique de dates civiles", () => {
  // Aucun objet Date : « new Date("2026-02-29") » s'interprète en UTC puis se
  // décale du fuseau local, et l'échéance change de jour selon l'endroit d'où
  // l'on regarde. On travaille en chaînes, de bout en bout.
  it("ajoute des jours en franchissant les mois et les années", () => {
    expect(ajouterJours("2026-01-30", 3)).toBe("2026-02-02");
    expect(ajouterJours("2026-12-31", 1)).toBe("2027-01-01");
    expect(ajouterJours("2024-02-28", 1)).toBe("2024-02-29");
    expect(ajouterJours("2026-02-28", 1)).toBe("2026-03-01");
    expect(ajouterJours("2026-03-01", -1)).toBe("2026-02-28");
  });

  describe("les jours absents du calendrier", () => {
    // Règle du dictionnaire : « une échéance qui tomberait sur un jour absent
    // du mois d'arrivée est ramenée au dernier jour de ce mois ».
    it("ramène au dernier jour du mois d'arrivée", () => {
      expect(ajouterMois("2026-01-31", 1)).toBe("2026-02-28");
      expect(ajouterMois("2024-01-31", 1)).toBe("2024-02-29");
      expect(ajouterMois("2026-03-31", 1)).toBe("2026-04-30");
      expect(ajouterMois("2026-05-31", 1)).toBe("2026-06-30");
    });

    it("un 29 février se marque le 28 les années communes", () => {
      expect(ajouterMois("2024-02-29", 12)).toBe("2025-02-28");
      expect(ajouterMois("2024-02-29", 24)).toBe("2026-02-28");
      // Et retrouve son vrai jour l'année bissextile suivante.
      expect(ajouterMois("2024-02-29", 48)).toBe("2028-02-29");
    });

    it("un jour qui existe partout n'est jamais ramené", () => {
      expect(ajouterMois("2026-03-14", 12)).toBe("2027-03-14");
      expect(ajouterMois("2026-01-15", 1)).toBe("2026-02-15");
    });
  });

  describe("l'absence de dérive", () => {
    // LA règle qui coûte cher si on la rate. « Les offsets successifs se
    // calculent toujours depuis la reference_date, jamais depuis une échéance
    // déjà ramenée : le décalage ne s'accumule pas. »
    //
    // Un calcul itératif — chaque échéance depuis la précédente — donnerait
    // 31 janvier → 28 février → 28 mars → 28 avril. La date s'éloignerait un
    // peu plus chaque mois, et au bout d'un an l'anniversaire aurait glissé.
    it("chaque échéance se calcule depuis la référence, jamais depuis la précédente", () => {
      const depuis31Janvier = [1, 2, 3, 4].map((k) => ajouterMois("2026-01-31", k));
      expect(depuis31Janvier).toEqual([
        "2026-02-28", // ramené
        "2026-03-31", // et NON 2026-03-28 : on repart du 31, pas du 28
        "2026-04-30", // ramené
        "2026-05-31", // et NON 2026-05-30
      ]);
    });

    it("un 29 février ne dérive pas non plus sur quatre ans", () => {
      const quatreAns = [12, 24, 36, 48].map((k) => ajouterMois("2024-02-29", k));
      expect(quatreAns).toEqual(["2025-02-28", "2026-02-28", "2027-02-28", "2028-02-29"]);
    });
  });
});

describe("l'engendrement des échéances", () => {
  // « depuis » est inclusif : une échéance qui tombe aujourd'hui approche
  // encore. L'exclure ferait disparaître l'anniversaire le jour même, ce qui
  // est exactement le jour où l'application doit le montrer.
  it("rend les échéances à venir, la date du jour comprise", () => {
    const dates = echeances("1990-03-14", { unite: "year", pas: 1 }, "2026-03-14", 3);
    expect(dates).toEqual(["2026-03-14", "2027-03-14", "2028-03-14"]);
  });

  it("saute les échéances déjà passées", () => {
    const dates = echeances("1990-03-14", { unite: "year", pas: 1 }, "2026-06-01", 2);
    expect(dates).toEqual(["2027-03-14", "2028-03-14"]);
  });

  it("sait engendrer autre chose qu'un anniversaire", () => {
    expect(echeances("2026-01-05", { unite: "month", pas: 3 }, "2026-01-05", 3))
      .toEqual(["2026-01-05", "2026-04-05", "2026-07-05"]);
    expect(echeances("2026-01-05", { unite: "week", pas: 2 }, "2026-01-05", 3))
      .toEqual(["2026-01-05", "2026-01-19", "2026-02-02"]);
    expect(echeances("2026-01-05", { unite: "day", pas: 10 }, "2026-01-05", 3))
      .toEqual(["2026-01-05", "2026-01-15", "2026-01-25"]);
  });

  it("un trimestre vaut trois mois", () => {
    expect(echeances("2026-01-31", { unite: "quarter", pas: 1 }, "2026-01-31", 3))
      .toEqual(["2026-01-31", "2026-04-30", "2026-07-31"]);
  });

  // « tous les 0 » n'est pas une récurrence : c'est une boucle sans fin. Le
  // contrat le refuse déjà à la saisie ; ce cas garde le noyau lui-même, qui
  // sert aussi ailleurs.
  it("refuse un pas nul ou négatif plutôt que de boucler", () => {
    expect(() => echeances("2026-01-01", { unite: "year", pas: 0 }, "2026-01-01", 3)).toThrow();
    expect(() => echeances("2026-01-01", { unite: "year", pas: -1 }, "2026-01-01", 3)).toThrow();
  });
});

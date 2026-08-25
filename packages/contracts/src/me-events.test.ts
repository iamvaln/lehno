import { describe, expect, it } from "vitest";
import {
  createEventSchema, eventSchema, occurrenceSchema, scheduleSchema,
} from "./me-events.js";

const ANNIVERSAIRE = {
  id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  personId: "3f2504e0-4f89-11d3-9a0c-0305e82c3302",
  label: null,
  kind: "birthday" as const,
  nature: "happy" as const,
  referenceDate: "1990-08-24",
  yearKnown: true,
};

describe("les événements", () => {
  it("un anniversaire n'a pas besoin de libellé — il vient des traductions", () => {
    expect(eventSchema.parse(ANNIVERSAIRE).label).toBeNull();
  });

  // Un événement `other` affiche son libellé tel qu'il a été saisi, sans
  // traduction : c'est du contenu utilisateur. Sans libellé, il n'a rien à
  // afficher — et la ligne serait vide dans la liste des dates.
  it("un événement libre exige son libellé", () => {
    expect(() => createEventSchema.parse({
      personId: ANNIVERSAIRE.personId, kind: "other", referenceDate: "2026-09-12",
    })).toThrow();
    expect(() => createEventSchema.parse({
      personId: ANNIVERSAIRE.personId, kind: "other", label: "Mariage", referenceDate: "2026-09-12",
    })).not.toThrow();
  });

  // L'année se saisit ou non — « on peut ne pas la connaître » le dit l'écran.
  // Sans elle, l'âge ne s'affiche pas et la génération ne le mentionne pas.
  it("accepte un anniversaire dont l'année n'est pas connue", () => {
    const sansAnnee = { ...ANNIVERSAIRE, yearKnown: false };
    expect(eventSchema.parse(sansAnnee).yearKnown).toBe(false);
  });

  it("refuse un champ que le serveur ne connaît pas", () => {
    expect(() => eventSchema.parse({ ...ANNIVERSAIRE, couleur: "violet" })).toThrow();
  });
});

// La base impose ces deux règles par une contrainte `check`. Un client qui les
// ignore construit une requête que le serveur rejette — et l'erreur arrive au
// bout du réseau plutôt qu'à la saisie.
describe("les récurrences", () => {
  it("une règle récurrente exige son unité et son intervalle", () => {
    expect(() => scheduleSchema.parse({ type: "recurrent", unit: "year", interval: 1 })).not.toThrow();
    expect(() => scheduleSchema.parse({ type: "recurrent", unit: "year" })).toThrow();
    expect(() => scheduleSchema.parse({ type: "recurrent", interval: 1 })).toThrow();
  });

  it("une règle par décalage exige son unité et son décalage", () => {
    expect(() => scheduleSchema.parse({ type: "offset", offsetUnit: "month", offsetAmount: 1 })).not.toThrow();
    expect(() => scheduleSchema.parse({ type: "offset", offsetUnit: "month" })).toThrow();
  });

  // « tous les 0 ans » n'est pas une récurrence, c'est une boucle infinie côté
  // serveur quand il engendre les échéances suivantes.
  it("refuse un intervalle nul ou négatif", () => {
    expect(() => scheduleSchema.parse({ type: "recurrent", unit: "year", interval: 0 })).toThrow();
    expect(() => scheduleSchema.parse({ type: "recurrent", unit: "year", interval: -1 })).toThrow();
  });

  // Les deux formes ne se mélangent pas : une règle est l'une ou l'autre.
  it("refuse une règle qui serait les deux à la fois", () => {
    expect(() => scheduleSchema.parse({
      type: "recurrent", unit: "year", interval: 1, offsetUnit: "month", offsetAmount: 1,
    })).toThrow();
  });
});

describe("les échéances", () => {
  const ECHEANCE = {
    id: "3f2504e0-4f89-11d3-9a0c-0305e82c3303",
    eventId: ANNIVERSAIRE.id,
    personId: ANNIVERSAIRE.personId,
    personDisplayName: "Awa Diop",
    kind: "birthday" as const,
    nature: "happy" as const,
    label: null,
    occurrenceDate: "2026-08-24",
    occurrenceYear: 2026,
    status: "collecting" as const,
    daysUntil: 0,
    age: 36,
  };

  it("porte de quoi rendre une carte sans second appel", () => {
    const rendu = occurrenceSchema.parse(ECHEANCE);
    expect(rendu.personDisplayName).toBe("Awa Diop");
    expect(rendu.daysUntil).toBe(0);
  });

  // L'âge n'existe que si l'année de naissance est connue. Le rendre nullable
  // plutôt qu'absent oblige l'écran à traiter le cas au lieu de l'oublier.
  it("laisse l'âge vide quand l'année n'est pas connue", () => {
    expect(occurrenceSchema.parse({ ...ECHEANCE, age: null }).age).toBeNull();
  });

  // Une échéance passée se compte en négatif : l'écran Dates montre le mois
  // écoulé, et un décompte non signé rendrait « J−3 » pour trois jours après.
  it("accepte un décompte négatif pour une échéance passée", () => {
    expect(occurrenceSchema.parse({ ...ECHEANCE, daysUntil: -3 }).daysUntil).toBe(-3);
  });
});

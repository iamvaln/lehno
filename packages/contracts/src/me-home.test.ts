import { describe, expect, it } from "vitest";
import { homeSchema } from "./me-home.js";

const ECHEANCE = {
  id: "3f2504e0-4f89-11d3-9a0c-0305e82c3303",
  eventId: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  personId: "3f2504e0-4f89-11d3-9a0c-0305e82c3302",
  personDisplayName: "Awa Diop",
  kind: "birthday" as const,
  nature: "happy" as const,
  label: null,
  occurrenceDate: "2026-08-25",
  occurrenceYear: 2026,
  status: "collecting" as const,
  daysUntil: 0,
  age: 36,
};

const ACCUEIL = {
  firstName: "Valentine",
  occurrences: [ECHEANCE],
  counts: { today: 1, thisWeek: 2 },
  unreadNotifications: 3,
  hasPersons: true,
};

describe("l'accueil en un appel", () => {
  // La phrase d'accueil se compose de décomptes que la liste plafonnée ne donne
  // pas : trois échéances rendues ne disent pas combien il y en a cette semaine.
  // C'est la raison d'être de /me/home — sans quoi l'écran ferait deux appels
  // au démarrage, ou mentirait sur ce qu'il annonce.
  it("porte les décomptes que la liste plafonnée ne donne pas", () => {
    const rendu = homeSchema.parse(ACCUEIL);
    expect(rendu.counts.thisWeek).toBe(2);
    expect(rendu.occurrences).toHaveLength(1);
  });

  // La spec 3.2 veut deux états vides qui ne se ressemblent pas : au premier
  // lancement le bouton est « Ajouter un anniversaire », sinon « Laisser une
  // note » — « il n'y a personne à propos de qui écrire ». Sans ce drapeau, le
  // client ne peut pas les distinguer et doit appeler /me/persons pour le savoir.
  it("distingue le carnet neuf du carnet rempli sans échéance", () => {
    const premier = homeSchema.parse({
      ...ACCUEIL, occurrences: [], counts: { today: 0, thisWeek: 0 }, hasPersons: false,
    });
    const calme = homeSchema.parse({
      ...ACCUEIL, occurrences: [], counts: { today: 0, thisWeek: 0 }, hasPersons: true,
    });
    expect(premier.hasPersons).toBe(false);
    expect(calme.hasPersons).toBe(true);
  });

  // Le décompte de la cloche accompagne la réponse parce que l'en-tête
  // l'affiche dès l'ouverture : le demander à part ferait clignoter la pastille.
  it("porte le décompte de la cloche", () => {
    expect(homeSchema.parse(ACCUEIL).unreadNotifications).toBe(3);
  });

  it("refuse un décompte négatif", () => {
    expect(() => homeSchema.parse({ ...ACCUEIL, counts: { today: -1, thisWeek: 0 } })).toThrow();
    expect(() => homeSchema.parse({ ...ACCUEIL, unreadNotifications: -1 })).toThrow();
  });

  it("refuse un champ que le serveur ne connaît pas", () => {
    expect(() => homeSchema.parse({ ...ACCUEIL, resumables: [] })).toThrow();
  });
});

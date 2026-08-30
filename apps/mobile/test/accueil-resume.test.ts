import { describe, expect, it } from "vitest";
import { homeSchema, type Home } from "@lehno/contracts";
import { resumeDeLAccueil } from "../lib/accueil.js";

/* On repasse par le schéma : un agencement inventé ici tiendrait pendant que
   le vrai tomberait. */
const echeance = (date: string) => ({
  id: "11111111-1111-4111-8111-111111111111",
  label: null, nature: "happy" as const, status: "upcoming" as const,
  personId: "22222222-2222-4222-8222-222222222222",
  kind: "birthday" as const, eventId: "33333333-3333-4333-8333-333333333333",
  personDisplayName: "Ana", occurrenceDate: date, occurrenceYear: 2026,
  daysUntil: 30, age: 30,
});

const home = (today: number, thisWeek: number, dates: string[] = []): Home =>
  homeSchema.parse({
    firstName: "Ana",
    occurrences: dates.map(echeance),
    counts: { today, thisWeek },
    unreadNotifications: 0,
    hasPersons: true,
    remainingOccurrences: 0,
  });

describe("le résumé de ce qui vient", () => {
  /* LE FAIT QUI GOUVERNE TOUT : `thisWeek` INCLUT aujourd'hui — les deux
     décomptes partent du même jour au serveur. Les additionner compterait deux
     fois les dates du jour, et « une aujourd'hui, une autre cette semaine »
     annoncerait deux dates là où il n'y en a qu'une. */
  it("ne compte pas deux fois la date du jour", () => {
    expect(resumeDeLAccueil(home(1, 1))).toEqual({ sorte: "aujourdhui" });
  });

  it("distingue ce qui vient en plus, aujourd'hui mis à part", () => {
    expect(resumeDeLAccueil(home(1, 3))).toEqual({ sorte: "aujourdhuiEtSemaine", autres: 2 });
  });

  it("dit la semaine quand rien n'est aujourd'hui", () => {
    expect(resumeDeLAccueil(home(0, 2))).toEqual({ sorte: "semaine", combien: 2 });
  });

  /* LE DESIGNER N'A PAS ÉCRIT « DEUX DATES AUJOURD'HUI » : ses phrases disent
     toutes « UNE date aujourd'hui ». Plutôt que d'en inventer une, on retombe
     sur la semaine — qui reste VRAIE, puisqu'elle comprend aujourd'hui. Elle
     dit moins, elle ne ment pas. */
  it("retombe sur la semaine quand plusieurs dates tombent aujourd'hui", () => {
    expect(resumeDeLAccueil(home(2, 2))).toEqual({ sorte: "semaine", combien: 2 });
    expect(resumeDeLAccueil(home(3, 5))).toEqual({ sorte: "semaine", combien: 5 });
  });

  /* « Rien avant le 12 octobre » vaut mieux que « rien » : l'un rassure en
     situant, l'autre laisse croire que le carnet est vide. */
  it("situe la prochaine date quand la semaine est creuse", () => {
    expect(resumeDeLAccueil(home(0, 0, ["2026-10-12"])))
      .toEqual({ sorte: "lointain", date: "2026-10-12" });
  });

  it("ne promet rien quand il n'y a rien du tout", () => {
    expect(resumeDeLAccueil(home(0, 0))).toEqual({ sorte: "rien" });
  });

  /* On ne retrie PAS la liste : le serveur la rend par date croissante, et la
     retrier ici donnerait deux vérités sur ce qu'est « la prochaine ». */
  it("prend la première telle que le serveur l'a rangée", () => {
    expect(resumeDeLAccueil(home(0, 0, ["2026-09-03", "2026-12-25"])))
      .toEqual({ sorte: "lointain", date: "2026-09-03" });
  });
});

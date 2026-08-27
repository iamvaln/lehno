import { describe, expect, it } from "vitest";
import type { Occurrence } from "@lehno/contracts";
import {
  JOURS_PAR_SEMAINE, decaleDeMois, echeancesParJour, fenetreDesDates,
  grilleDuMois, parMois,
} from "../lib/dates.js";

function echeance(date: string, kind: Occurrence["kind"] = "birthday", n = date): Occurrence {
  return {
    id: `1111${n.replace(/\D/g, "").slice(0, 4)}-1111-4111-8111-111111111111`,
    eventId: "22222222-2222-4222-8222-222222222222",
    personId: "33333333-3333-4333-8333-333333333333",
    personDisplayName: "Proche", kind, nature: "happy", label: kind === "other" ? "Soutenance" : null,
    occurrenceDate: date, occurrenceYear: Number(date.slice(0, 4)),
    status: "upcoming", daysUntil: 0, age: null,
  };
}

describe("la fenêtre demandée", () => {
  /* Un mois en arrière : `daysUntil` est signé, et la vue montre le mois
     écoulé. On revient voir ce qu'on a manqué, et une liste qui commencerait
     à aujourd'hui l'effacerait. */
  it("remonte d'un mois et descend d'un an", () => {
    expect(fenetreDesDates("2026-08-27")).toEqual({ from: "2026-07-27", to: "2027-08-27" });
  });

  /* Le décalage se fait par le CALENDRIER, jamais par un nombre de jours :
     « dans un mois » n'est pas « dans trente jours ». */
  it("recule d'un mois, pas de trente jours", () => {
    expect(decaleDeMois("2026-03-31", -1)).toBe("2026-02-28");
    expect(decaleDeMois("2026-01-31", 1)).toBe("2026-02-28");
  });

  // Le 31 janvier plus un mois n'existe pas : on tombe sur le dernier jour du
  // mois d'arrivée plutôt que de déborder sur le suivant.
  it("s'arrête au dernier jour quand le jour n'existe pas", () => {
    expect(decaleDeMois("2024-01-31", 1)).toBe("2024-02-29");
  });

  it("franchit l'année sans se tromper", () => {
    expect(decaleDeMois("2026-01-15", -1)).toBe("2025-12-15");
    expect(decaleDeMois("2026-12-15", 1)).toBe("2027-01-15");
  });
});

describe("la liste, groupée par mois", () => {
  /* Le serveur trie déjà. On ne retrie pas : un tri côté client sur une liste
     plafonnée mettrait en tête le plus proche DE LA PAGE, pas du calendrier. */
  it("garde l'ordre reçu", () => {
    const blocs = parMois([echeance("2026-08-28"), echeance("2026-08-30"), echeance("2026-09-01")]);
    expect(blocs.map((b) => b.mois)).toEqual(["2026-08", "2026-09"]);
    expect(blocs[0]!.echeances).toHaveLength(2);
  });

  /* La clé du mois, pas son nom : le nom se met en forme dans la langue de
     lecture, et deux vues qui le composeraient chacune finiraient par ne pas
     l'écrire pareil. */
  it("porte la clé du mois, pas son libellé", () => {
    expect(parMois([echeance("2026-08-28")])[0]!.mois).toBe("2026-08");
  });

  // Un même mois de deux années différentes ne se confond pas : décembre 2026
  // et décembre 2027 sont deux blocs.
  it("ne confond pas deux décembres", () => {
    const blocs = parMois([echeance("2026-12-01"), echeance("2027-12-01")]);
    expect(blocs).toHaveLength(2);
  });

  it("rend une liste vide sans bloc", () => {
    expect(parMois([])).toEqual([]);
  });
});

describe("la grille d'un mois", () => {
  /* Elle se CALCULE. Le kit l'avait figée sur août 2026 ; une grille écrite ne
     suit pas le mois qu'on navigue. */
  it("commence le lundi", () => {
    // 1er août 2026 est un samedi : cinq cases vides avant lui.
    const cases = grilleDuMois("2026-08");
    expect(cases.slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(cases[5]).toBe(1);
  });

  it("commence sans case vide quand le mois s'ouvre un lundi", () => {
    // 1er juin 2026 est un lundi.
    expect(grilleDuMois("2026-06")[0]).toBe(1);
  });

  it("porte tous les jours du mois", () => {
    expect(grilleDuMois("2026-02").filter((c) => c !== null)).toHaveLength(28);
    expect(grilleDuMois("2024-02").filter((c) => c !== null)).toHaveLength(29);
    expect(grilleDuMois("2026-08").filter((c) => c !== null)).toHaveLength(31);
  });

  /* La dernière semaine se complète : une grille tronquée décale la colonne du
     samedi d'un mois à l'autre, et l'œil y lit une densité qui n'est pas là. */
  it("rend des semaines entières", () => {
    for (const mois of ["2026-02", "2026-08", "2026-11", "2024-02"]) {
      expect(grilleDuMois(mois).length % JOURS_PAR_SEMAINE, mois).toBe(0);
    }
  });

  // `null` marque l'absence, jamais le jour 0 : une case vide et le premier du
  // mois ne se distingueraient plus.
  it("marque le vide par rien, pas par zéro", () => {
    expect(grilleDuMois("2026-08")).not.toContain(0);
  });
});

describe("ce que porte chaque jour", () => {
  it("range les échéances sous leur jour", () => {
    const carte = echeancesParJour([echeance("2026-08-28"), echeance("2026-08-30")], "2026-08");
    expect([...carte.keys()].sort()).toEqual([28, 30]);
  });

  /* Plusieurs échéances peuvent tomber le même jour — deux anniversaires le
     même 14 mars. La pastille en compte, elle n'en montre pas qu'une. */
  it("garde les deux quand deux tombent le même jour", () => {
    const carte = echeancesParJour(
      [echeance("2026-08-28", "birthday", "a"), echeance("2026-08-28", "other", "b")], "2026-08",
    );
    expect(carte.get(28)).toHaveLength(2);
  });

  // Un autre mois ne déborde pas dans la grille de celui qu'on regarde.
  it("ignore ce qui n'est pas du mois", () => {
    const carte = echeancesParJour([echeance("2026-09-01")], "2026-08");
    expect(carte.size).toBe(0);
  });
});

describe("ce qui existe ne se masque jamais", () => {
  /* Le kit filtre l'agenda sur `events.other` — « une nature éteinte n'a jamais
     pu être posée ». Vrai d'un déploiement neuf, faux partout ailleurs. Le
     contrat l'écrit sur le chemin : « le drapeau garde la CRÉATION, jamais
     l'existant. NE LE MASQUEZ PAS. »

     Ce test tient l'absence de filtre : aucune de ces fonctions ne prend de
     liste de drapeaux, et lui en passer une serait le premier pas vers un
     masquage. Faire disparaître les dates de quelqu'un parce qu'on a éteint un
     interrupteur serait le pire défaut possible ici. */
  it("un événement libre reste dans la liste et dans la grille", () => {
    const libre = echeance("2026-08-28", "other");
    expect(parMois([libre])[0]!.echeances).toHaveLength(1);
    expect(echeancesParJour([libre], "2026-08").get(28)).toHaveLength(1);
  });
});

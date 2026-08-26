import { describe, expect, it } from "vitest";
import type { Note } from "@lehno/contracts";
import {
  PAGE, basculeDeTri, dateCourte, interetsEtNotes, natureDeLaNote, parametresDuCarnet,
  presseAssezPourSAfficher, resteACharger, sousTitreDuProche,
} from "../lib/carnet.js";

describe("le tri porte sa direction", () => {
  /* « Par date » ne dit rien tant qu'on ne sait pas de quel bout. Un second
     appui sur le critère ACTIF retourne le sens ; un appui sur l'autre
     critère repart au sens naturel, sans hériter du précédent — sinon
     passer de « date, au plus loin » à l'alphabet donnerait Z–A sans que
     personne ne l'ait demandé. */
  it("retourne le sens quand on réappuie sur le critère actif", () => {
    expect(basculeDeTri({ cle: "date", sens: "asc" }, "date")).toEqual({ cle: "date", sens: "desc" });
    expect(basculeDeTri({ cle: "date", sens: "desc" }, "date")).toEqual({ cle: "date", sens: "asc" });
  });

  it("repart au sens naturel en changeant de critère", () => {
    expect(basculeDeTri({ cle: "date", sens: "desc" }, "alpha")).toEqual({ cle: "alpha", sens: "asc" });
  });
});

describe("ce que le serveur reçoit", () => {
  /* Le tri et la pagination sont au SERVEUR, pas ici. Le carnet arrive par
     pages de vingt : trier la page reçue mettrait en tête le plus proche
     des vingt premiers, pas le plus proche du carnet. */
  it("porte le critère, le sens et la page", () => {
    expect(parametresDuCarnet({ cle: "alpha", sens: "desc" }, 40))
      .toBe("?sort=alpha&direction=desc&offset=40&limit=20");
  });

  it("demande la première page sans offset hérité", () => {
    expect(parametresDuCarnet({ cle: "date", sens: "asc" }, 0))
      .toBe("?sort=date&direction=asc&offset=0&limit=20");
  });
});

describe("le décompte ne paraît que s'il presse", () => {
  /* La liste montre « qui a une date qui approche », pas tout le monde classé
     par échéance — sans quoi elle redirait l'onglet Dates avec d'autres
     pixels. Sept jours est la limite du handoff. */
  it("s'affiche jusqu'à sept jours, le jour même compris", () => {
    expect(presseAssezPourSAfficher(0)).toBe(true);
    expect(presseAssezPourSAfficher(7)).toBe(true);
    expect(presseAssezPourSAfficher(8)).toBe(false);
  });

  // `daysUntil` est SIGNÉ. Une prochaine échéance ne devrait pas être passée,
  // mais si elle l'est, « J−−3 » n'a aucun sens : on n'affiche rien.
  it("ne s'affiche pas pour une échéance déjà passée", () => {
    expect(presseAssezPourSAfficher(-1)).toBe(false);
  });

  it("ne s'affiche pas sans date du tout", () => {
    expect(presseAssezPourSAfficher(null)).toBe(false);
  });
});

describe("« Voir plus · n restants »", () => {
  it("compte ce qui reste au serveur, pas ce qui est à l'écran", () => {
    expect(resteACharger(43, 20)).toBe(23);
    expect(resteACharger(43, 40)).toBe(3);
  });

  // Jamais négatif : un total qui rétrécit entre deux pages — une fiche
  // supprimée ailleurs — proposerait sinon de charger « −2 restants ».
  it("ne descend pas sous zéro", () => {
    expect(resteACharger(43, 60)).toBe(0);
  });

  it("pagine par vingt, la page du handoff", () => {
    expect(PAGE).toBe(20);
  });
});

describe("ce qu'une note est", () => {
  const note = (categories: Note["categories"]): Note => ({
    id: "11111111-1111-4111-8111-111111111111",
    personId: "22222222-2222-4222-8222-222222222222",
    content: "vinyles", eventOccurrenceId: null, categories, createdAt: "2026-08-01T00:00:00Z",
  });

  /* Deux natures à l'écran, sept catégories au contrat. « À éviter » se
     distingue parce que la fiche la dessine autrement — en pointillé, sans
     fond : c'est un garde-fou, pas une suggestion. Tout le reste est une
     matière à utiliser. */
  it("distingue ce qu'il faut éviter du reste", () => {
    expect(natureDeLaNote(note(["dislikes_nogo"]))).toBe("eviter");
    expect(natureDeLaNote(note(["gift_ideas"]))).toBe("idee");
  });

  // Une note que le système n'a pas su ranger reste une note : le contrat
  // autorise un tableau vide, et la faire disparaître perdrait la saisie.
  it("garde une note non rangée", () => {
    expect(natureDeLaNote(note([]))).toBe("idee");
  });

  /* Les « intérêts » n'ont pas de champ au contrat : ce sont des notes d'une
     catégorie. La fiche les montre en étiquettes plutôt qu'en cartes — un mot
     par ligne de carte gaspillerait l'écran. */
  it("sort les intérêts des notes pour en faire des étiquettes", () => {
    const { interets, cartes } = interetsEtNotes([
      note(["interests"]), note(["dislikes_nogo"]), note(["facts"]),
    ]);
    expect(interets).toHaveLength(1);
    expect(cartes).toHaveLength(2);
  });

  // Une note peut porter plusieurs catégories. Rangée en intérêt, elle ne
  // doit pas reparaître en carte : elle serait lue deux fois.
  it("ne compte pas deux fois une note à plusieurs catégories", () => {
    const { interets, cartes } = interetsEtNotes([note(["interests", "facts"])]);
    expect(interets).toHaveLength(1);
    expect(cartes).toHaveLength(0);
  });
});


describe("la date en repère", () => {
  it("se dit dans la langue de lecture", () => {
    expect(dateCourte("2026-08-24", "fr")).toMatch(/24/);
    expect(dateCourte("2026-08-24", "en")).toMatch(/24/);
    expect(dateCourte("2026-08-24", "fr")).not.toEqual(dateCourte("2026-08-24", "en"));
  });

  /* Une date CIVILE n'a pas d'heure. La construire dans le fuseau local la
     ferait reculer d'un jour partout à l'ouest de Greenwich : le 1er août
     s'afficherait « 31 juil. » à Douala comme à New York. */
  it("ne recule pas d'un jour selon le fuseau", () => {
    expect(dateCourte("2026-08-01", "fr")).toMatch(/^1\b/);
    expect(dateCourte("2026-01-01", "fr")).toMatch(/^1\b/);
  });

  // L'année n'y figure pas : l'échéance est à venir, et l'écrire ferait lire
  // une date d'archive.
  it("ne dit pas l'année", () => {
    expect(dateCourte("2026-08-24", "fr")).not.toMatch(/2026/);
  });
});

describe("le sous-titre de la fiche", () => {
  it("se compose de ce qu'on sait", () => {
    expect(sousTitreDuProche(["Anniversaire", "24 août", "amical"]))
      .toBe("Anniversaire · 24 août · amical");
  });

  // Un morceau absent emporte son séparateur : « · · amical » se lirait comme
  // un défaut d'affichage plutôt que comme une information manquante.
  it("n'affiche pas les séparateurs de ce qui manque", () => {
    expect(sousTitreDuProche([null, null, "amical"])).toBe("amical");
    expect(sousTitreDuProche(["Anniversaire", null, null])).toBe("Anniversaire");
    expect(sousTitreDuProche([null, null, null])).toBe("");
  });
});

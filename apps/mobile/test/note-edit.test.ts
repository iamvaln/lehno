import { describe, expect, it } from "vitest";
import type { Note } from "@lehno/contracts";
import {
  correctionCall, correctionWorthSending, noteBeingEdited, removalCall,
} from "../lib/noteEdit.js";

const AWA = "b1c4953a-bf9e-4cb4-8328-8b7779f9a298";
const ID = "92fd5b68-617e-43a6-b195-6f396e9da6c3";

const note = (id: string, content: string): Note =>
  ({ id, content, categories: [], createdAt: "2026-09-14T00:00:00.000Z" }) as unknown as Note;

describe("corriger une note", () => {
  it("vise la note sous SON proche", () => {
    expect(correctionCall(AWA, ID, "le texte").path).toBe(`/me/persons/${AWA}/notes/${ID}`);
  });

  /* Le serveur rogne aussi — `updateNoteSchema` le fait. Envoyer le texte brut
     ferait diverger ce qu'on croit avoir enregistré de ce qui l'est. */
  it("rogne le texte envoyé", () => {
    expect(correctionCall(AWA, ID, "  le texte  ").body).toEqual({ content: "le texte" });
  });

  it("s'efface par le même chemin, sans corps", () => {
    const appel = removalCall(AWA, ID);
    expect(appel.path).toBe(`/me/persons/${AWA}/notes/${ID}`);
    expect(appel.body).toBeUndefined();
  });
});

describe("ce qui vaut d'être envoyé", () => {
  it("accepte un texte changé", () => {
    expect(correctionWorthSending("avant", "après")).toBe(true);
  });

  it("refuse le vide — c'est un effacement, et il a son propre geste", () => {
    expect(correctionWorthSending("avant", "")).toBe(false);
    expect(correctionWorthSending("avant", "   ")).toBe(false);
  });

  /* PAS DE LA SIMPLE ÉCONOMIE. Enregistrer RECLASSE les catégories côté
     serveur : une écriture sans changement n'est pas sans effet. Quelqu'un qui
     ouvre une note, la relit et enregistre par habitude verrait « à éviter »
     bouger parce que le classeur a changé d'avis entre-temps. */
  it("refuse un texte inchangé, aux espaces près", () => {
    expect(correctionWorthSending("avant", "avant")).toBe(false);
    expect(correctionWorthSending("avant", "  avant  ")).toBe(false);
  });
});

describe("retrouver la note qu'on corrige", () => {
  const notes = [note(ID, "la sienne"), note("autre", "une autre")];

  it("la trouve parmi celles de la fiche", () => {
    expect(noteBeingEdited(notes, ID)?.content).toBe("la sienne");
  });

  // Sans identifiant, on écrit une note neuve : ce n'est pas une correction.
  it("rend null quand aucun identifiant n'est passé", () => {
    expect(noteBeingEdited(notes, undefined)).toBeNull();
  });

  /* La fiche a pu être rechargée entre-temps, ou la note effacée ailleurs.
     L'écran doit pouvoir le dire plutôt que d'ouvrir un champ vide qui
     enregistrerait par-dessus rien. */
  it("rend null quand la note n'est plus là", () => {
    expect(noteBeingEdited(notes, "disparue")).toBeNull();
  });
});

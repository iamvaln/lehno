import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Content } from "../components/landing/Content.js";
import { messages } from "../messages/index.js";

// La maquette v3 (specs/Landing Lehno v3.dc.html) fait passer les paroles
// rapportées en citation : ideeTexte/nogoTexte deviennent ideeParole/nogoParole,
// chacune suivie d'une ligne de provenance (Provenance, components/ui). Le
// calendrier perd sa ligne « Nour & moi · Six mois » (clés retirées) au profit
// d'une ligne « Celarine, aujourd'hui » — présente dans l'aperçu du héros mais
// absente jusqu'ici de ce second calendrier.
describe("Content — fiche d'un proche", () => {
  const t = messages("fr");

  it("l'idée cadeau se lit comme une parole rapportée, en italique", () => {
    render(<Content t={t} langue="fr" />);
    expect(screen.getByText(t.ideeParole, { exact: false })).toBeInTheDocument();
  });

  it("l'idée cadeau porte sa provenance", () => {
    render(<Content t={t} langue="fr" />);
    expect(screen.getByText(t.provIdee, { exact: false })).toBeInTheDocument();
  });

  it("le no-go se lit lui aussi comme une parole rapportée, avec sa provenance", () => {
    render(<Content t={t} langue="fr" />);
    expect(screen.getByText(t.nogoParole, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(t.provNogo, { exact: false })).toBeInTheDocument();
  });

  it("les anciennes clés ne sont plus employées", () => {
    render(<Content t={t} langue="fr" />);
    expect(screen.queryByText("ideeTexte", { exact: false })).not.toBeInTheDocument();
    expect(("ideeTexte" in t)).toBe(false);
    expect(("ideeDate" in t)).toBe(false);
    expect(("nogoTexte" in t)).toBe(false);
  });
});

describe("Content — station « Ce que l'application contient »", () => {
  const t = messages("fr");

  // La maquette pose un surtitre (contenuKicker) au-dessus de la grille de
  // cette station, comme HowItWorks et Pricing en portent déjà un chacun —
  // seule cette station en était dépourvue.
  it("porte son propre surtitre, au-dessus de la fiche", () => {
    render(<Content t={t} langue="fr" />);
    expect(screen.getByText(t.contenuKicker)).toBeInTheDocument();
  });
});

describe("Content — calendrier", () => {
  const t = messages("fr");

  it("porte une ligne « aujourd'hui » pour Celarine", () => {
    render(<Content t={t} langue="fr" />);
    expect(screen.getByText("Celarine")).toBeInTheDocument();
    expect(screen.getAllByText(t.aujourdhui).length).toBeGreaterThan(0);
  });

  it("ne porte plus la ligne Nour & moi retirée de la maquette", () => {
    render(<Content t={t} langue="fr" />);
    expect(screen.queryByText(/nour/i)).not.toBeInTheDocument();
    expect(("nourEtMoi" in t)).toBe(false);
    expect(("sixMois" in t)).toBe(false);
  });
});

describe("Content — brouillon", () => {
  const t = messages("fr");

  it("le message brouillé porte sa provenance", () => {
    render(<Content t={t} langue="fr" />);
    expect(screen.getByText(t.provBrouillon, { exact: false })).toBeInTheDocument();
  });
});

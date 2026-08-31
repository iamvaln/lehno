import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Introuvable } from "../components/surfaces/Introuvable.js";
import { messages } from "../messages/index.js";

/* Elle dit ce qui s'est passé et propose la suite. Pas d'excuse, pas
   d'illustration, pas d'« Oups » : quelqu'un arrivé là par le lien d'une amie
   n'a pas besoin d'être consolé. */
describe("la page introuvable", () => {
  it("dit ce qui s'est passé et ouvre deux portes", () => {
    const t = messages("fr");
    render(<Introuvable t={t} langue="fr" />);
    expect(screen.getByRole("heading", { level: 1, name: t.introuvableTitre })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.introuvableRetour }).getAttribute("href")).toBe("/fr");
    expect(screen.getByRole("link", { name: t.introuvableFaq }).getAttribute("href")).toBe("/fr/faq");
  });

  /* Le « 404 » est un ornement : il ne dit rien qu'un lecteur d'écran doive
     entendre avant le titre, qui, lui, porte l'information. */
  it("cache le chiffre aux lecteurs d'écran", () => {
    render(<Introuvable t={messages("fr")} langue="fr" />);
    expect(screen.queryByText("404")).toHaveAttribute("aria-hidden", "true");
  });

  /* Elle porte le cadre du site : c'est souvent la première page de Lehno
     qu'un visiteur voit, et une page nue ne lui laisserait aucun moyen d'aller
     voir ce qu'est Lehno. */
  it("garde l'invitation de la coquille", () => {
    const t = messages("en");
    render(<Introuvable t={t} langue="en" />);
    expect(screen.getByText(t.acqTitre)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: t.introuvableRetour }).getAttribute("href")).toBe("/en");
  });
});

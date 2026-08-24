import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "../components/landing/SiteFooter.js";
import { messages } from "../messages/index.js";

// Quatre liens, l'ordre de la maquette v3 : CGU, confidentialité, FAQ,
// contact.
//
// Ce test en attendait cinq. specs/ux-surfaces-publiques-lehno.md demande les
// trois pages légales au pied — « CGU, confidentialité, mentions légales » —
// et la maquette n'en liste que deux. Le propriétaire a tranché le 24/08/2026 :
// **la maquette l'emporte sur la spécification**. La page des mentions légales
// existe toujours et se construit ; elle a simplement perdu son entrée ici.
describe("pied de page", () => {
  const t = messages("fr");

  it("porte les quatre liens de la maquette, dans son ordre", () => {
    render(<SiteFooter t={t} langue="fr" />);
    const liens = screen.getAllByRole("link").map((a) => a.textContent);
    expect(liens).toEqual([t.cgu, t.confidentialite, t.piedFaq, t.contact]);
  });

  it("ne porte pas les mentions légales", () => {
    render(<SiteFooter t={t} langue="fr" />);
    expect(screen.queryByRole("link", { name: t.mentionsLegales })).not.toBeInTheDocument();
  });

  // Contact et FAQ s'écrivent pareil dans les deux langues ; les pages légales,
  // non — « /en/privacy », pas « /en/confidentialite ». Voir lib/chemins.ts.
  it("garde le chemin de la FAQ identique dans les deux langues", () => {
    render(<SiteFooter t={messages("en")} langue="en" />);
    expect(screen.getByRole("link", { name: messages("en").piedFaq })).toHaveAttribute("href", "/en/faq");
  });

  it("traduit le chemin des pages légales", () => {
    render(<SiteFooter t={messages("en")} langue="en" />);
    expect(screen.getByRole("link", { name: messages("en").cgu })).toHaveAttribute("href", "/en/terms");
    expect(screen.getByRole("link", { name: messages("en").confidentialite })).toHaveAttribute("href", "/en/privacy");
  });
});

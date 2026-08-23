import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "../components/landing/SiteFooter.js";
import { messages } from "../messages/index.js";

// Le pied de la landing ne portait que trois liens (conditions,
// confidentialité, contact) : il lui manquait la FAQ et les mentions
// légales. SiteFooter.jsx du paquet de passation fait autorité sur l'ordre
// des liens déjà présents (cgu, confidentialite, faq, contact) ; les mentions
// légales, absentes de ce prototype mais requises par la commande et par
// specs/ux-surfaces-publiques-lehno.md §3.8, prennent place aux côtés des
// autres pages légales.
describe("pied de page", () => {
  const t = messages("fr");

  it("porte les cinq liens, dans l'ordre : CGU, confidentialité, mentions légales, FAQ, contact", () => {
    render(<SiteFooter t={t} langue="fr" />);
    const liens = screen.getAllByRole("link").map((a) => a.textContent);
    expect(liens).toEqual([t.cgu, t.confidentialite, t.mentionsLegales, t.piedFaq, t.contact]);
  });

  it("le lien FAQ pointe vers /fr/faq, le chemin restant en français en anglais aussi", () => {
    render(<SiteFooter t={messages("en")} langue="en" />);
    const lienFaq = screen.getByRole("link", { name: messages("en").piedFaq });
    expect(lienFaq).toHaveAttribute("href", "/en/faq");
  });

  it("le lien des mentions légales pointe vers /fr/mentions-legales", () => {
    render(<SiteFooter t={t} langue="fr" />);
    const lien = screen.getByRole("link", { name: t.mentionsLegales });
    expect(lien).toHaveAttribute("href", "/fr/mentions-legales");
  });
});

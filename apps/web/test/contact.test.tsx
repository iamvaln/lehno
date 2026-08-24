import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContactPage } from "../components/contact/ContactPage.js";
import { messages } from "../messages/index.js";

// Le point d'entrée existe désormais (apps/api/src/public/contact) : la page
// porte un vrai formulaire, plus une adresse mailto en guise de repli. Voir
// test/contact-form.test.tsx pour le comportement du formulaire lui-même —
// ce fichier ne teste que la page qui l'accueille.
describe("page contact", () => {
  it("rend le titre dans la langue demandée", () => {
    render(<ContactPage t={messages("fr")} langue="fr" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Écrivez-nous");
  });

  it("l'anglais est écrit, pas décalqué", () => {
    render(<ContactPage t={messages("en")} langue="en" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Write to us");
  });

  it("porte un seul titre de premier rang", () => {
    render(<ContactPage t={messages("fr")} langue="fr" />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("pose un formulaire — le point d'entrée existe désormais", () => {
    const { container } = render(<ContactPage t={messages("fr")} langue="fr" />);
    expect(container.querySelector("form")).toBeInTheDocument();
  });

  it("liste les six comptes publics, chacun ouvrant un nouvel onglet", () => {
    render(<ContactPage t={messages("fr")} langue="fr" />);
    for (const nom of ["Instagram", "TikTok", "X", "LinkedIn", "Facebook", "YouTube"]) {
      const lien = screen.getByRole("link", { name: new RegExp(nom, "i") });
      expect(lien).toHaveAttribute("target", "_blank");
      expect(lien).toHaveAttribute("rel", expect.stringContaining("noopener"));
    }
  });

  it("chaque image porte un texte de remplacement", () => {
    render(<ContactPage t={messages("fr")} langue="fr" />);
    for (const img of screen.getAllByRole("img")) expect(img).toHaveAccessibleName();
  });

  it("porte l'en-tête et le pied du site public", () => {
    render(<ContactPage t={messages("fr")} langue="fr" />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });
});

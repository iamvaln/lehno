import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Landing } from "../components/landing/Landing.js";
import { messages } from "../messages/index.js";
import type { ConfigPublique } from "../lib/config-publique.js";

const config: ConfigPublique = { signupFreeCredits: 5, creditUnitPrice: 100, currency: "XAF", referralBonusInvited: 0 };

// Landing ne connaît rien de Next : elle reçoit sa configuration toute faite,
// donc les tests la lui posent directement plutôt que de simuler un serveur
// (page.tsx, qui la résout, n'a plus besoin d'être testé ici).
describe("landing", () => {
  it("rend le titre dans la langue demandée", () => {
    render(<Landing t={messages("fr")} langue="fr" configuration={config} avantLancement />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Soyez là le jour J");
  });

  it("l'anglais est écrit, pas décalqué", () => {
    render(<Landing t={messages("en")} langue="en" configuration={config} avantLancement />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Be there on the day");
  });

  it("porte un seul titre de premier rang", () => {
    render(<Landing t={messages("fr")} langue="fr" configuration={config} avantLancement />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  // Un prix figé dans la page devient faux le jour où l'administration le change.
  it("le prix vient de la configuration, jamais du code", () => {
    render(<Landing t={messages("fr")} langue="fr" configuration={{ ...config, creditUnitPrice: 150 }} avantLancement />);
    expect(screen.getByText(/150/)).toBeInTheDocument();
    expect(screen.queryByText(/\b100\b/)).not.toBeInTheDocument();
  });

  it("les crédits offerts viennent aussi de la configuration", () => {
    render(<Landing t={messages("fr")} langue="fr" configuration={{ ...config, signupFreeCredits: 3 }} avantLancement />);
    expect(screen.getByText(/3 crédits/)).toBeInTheDocument();
  });

  it("chaque image porte un texte de remplacement", () => {
    render(<Landing t={messages("fr")} langue="fr" configuration={config} avantLancement />);
    for (const img of screen.getAllByRole("img")) expect(img).toHaveAccessibleName();
  });

  // Le système l'impose : un seul bouton plein par vue.
  it("une seule action est mise en avant", () => {
    const { container } = render(<Landing t={messages("fr")} langue="fr" configuration={config} avantLancement />);
    const pleins = [...container.querySelectorAll("button, a")].filter((e) =>
      (e.getAttribute("style") ?? "").includes("var(--action)"));
    expect(pleins.length).toBeLessThanOrEqual(1);
  });

  // Ce test affirmait l'inverse : « aucune section Mur, c'est une surface à
  // part ». Il confondait deux choses — le Mur EST une surface publique à
  // part, avec sa propre page, mais la landing en montre un aperçu, et la
  // maquette v3 lui donne une section entière (id="mur"). La section avait
  // disparu du code lors de la refonte, et ce test entérinait sa disparition
  // au lieu de la signaler.
  it("montre un aperçu du Mur, que la maquette lui accorde", () => {
    render(<Landing t={messages("fr")} langue="fr" configuration={config} avantLancement />);
    expect(screen.getByRole("heading", { name: /votre page à vous/i })).toBeInTheDocument();
  });
});

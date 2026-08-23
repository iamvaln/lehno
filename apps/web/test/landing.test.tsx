import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Landing from "../app/[locale]/page.js";

const config = { signupFreeCredits: 5, creditUnitPrice: 100, currency: "XAF", referralBonusInvited: 0 };

describe("landing", () => {
  it("rend le titre dans la langue demandée", async () => {
    render(await Landing({ params: { locale: "fr" }, config }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Soyez là le jour J");
  });

  it("l'anglais est écrit, pas décalqué", async () => {
    render(await Landing({ params: { locale: "en" }, config }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Be there on the day");
  });

  it("porte un seul titre de premier rang", async () => {
    render(await Landing({ params: { locale: "fr" }, config }));
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  // Un prix figé dans la page devient faux le jour où l'administration le change.
  it("le prix vient de la configuration, jamais du code", async () => {
    render(await Landing({ params: { locale: "fr" }, config: { ...config, creditUnitPrice: 150 } }));
    expect(screen.getByText(/150/)).toBeInTheDocument();
    expect(screen.queryByText(/\b100\b/)).not.toBeInTheDocument();
  });

  it("les crédits offerts viennent aussi de la configuration", async () => {
    render(await Landing({ params: { locale: "fr" }, config: { ...config, signupFreeCredits: 3 } }));
    expect(screen.getByText(/3 crédits/)).toBeInTheDocument();
  });

  it("chaque image porte un texte de remplacement", async () => {
    render(await Landing({ params: { locale: "fr" }, config }));
    for (const img of screen.getAllByRole("img")) expect(img).toHaveAccessibleName();
  });

  // Le système l'impose : un seul bouton plein par vue.
  it("une seule action est mise en avant", async () => {
    const { container } = render(await Landing({ params: { locale: "fr" }, config }));
    const pleins = [...container.querySelectorAll("button, a")].filter((e) =>
      (e.getAttribute("style") ?? "").includes("var(--action)"));
    expect(pleins.length).toBeLessThanOrEqual(1);
  });

  it("aucune section « Mur » — c'est une surface à part", async () => {
    render(await Landing({ params: { locale: "fr" }, config }));
    expect(screen.queryByRole("heading", { name: /votre page à vous/i })).not.toBeInTheDocument();
  });
});

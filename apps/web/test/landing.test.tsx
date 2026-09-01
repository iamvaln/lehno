import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Landing } from "../components/landing/Landing.js";
import { messages } from "../messages/index.js";
import type { ConfigPublique } from "../lib/config-publique.js";

const config: ConfigPublique = {
  signupFreeCredits: 5, creditUnitPrice: 100, currency: "XAF", referralBonusInvited: 0,
};

// Landing ne connaît rien de Next : elle reçoit sa configuration toute faite,
// donc les tests la lui posent directement plutôt que de simuler un serveur
// (page.tsx, qui la résout, n'a plus besoin d'être testé ici).
/* Tout est ouvert : un test qui ne parle pas des drapeaux ne doit pas changer
   de sujet à cause d'eux. Ceux qui les éprouvent passent leur propre liste. */
const TOUTES = [
  "wall", "wishes", "wishlist.own", "reservation", "referral",
  "generation.message", "generation.ideas", "generation.portrait",
];

describe("landing", () => {
  it("rend le titre dans la langue demandée", () => {
    render(<Landing t={messages("fr")} langue="fr" configuration={config} avantLancement features={TOUTES} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Soyez là le jour J");
  });

  it("l'anglais est écrit, pas décalqué", () => {
    render(<Landing t={messages("en")} langue="en" configuration={config} avantLancement features={TOUTES} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Be there on the day");
  });

  it("porte un seul titre de premier rang", () => {
    render(<Landing t={messages("fr")} langue="fr" configuration={config} avantLancement features={TOUTES} />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  // Un prix figé dans la page devient faux le jour où l'administration le change.
  it("le prix vient de la configuration, jamais du code", () => {
    render(<Landing t={messages("fr")} langue="fr" configuration={{ ...config, creditUnitPrice: 150 }} avantLancement features={TOUTES} />);
    expect(screen.getByText(/150/)).toBeInTheDocument();
    expect(screen.queryByText(/\b100\b/)).not.toBeInTheDocument();
  });

  it("les crédits offerts viennent aussi de la configuration", () => {
    render(<Landing t={messages("fr")} langue="fr" configuration={{ ...config, signupFreeCredits: 3 }} avantLancement features={TOUTES} />);
    expect(screen.getByText(/3 crédits/)).toBeInTheDocument();
  });

  it("chaque image porte un texte de remplacement", () => {
    render(<Landing t={messages("fr")} langue="fr" configuration={config} avantLancement features={TOUTES} />);
    for (const img of screen.getAllByRole("img")) expect(img).toHaveAccessibleName();
  });

  // Ce test n'en autorisait qu'un : « un seul bouton plein par vue », la règle
  // de specs/design-system-lehno.md. La maquette v3 en pose deux — celui de
  // l'en-tête et celui du formulaire du héros — et la maquette l'emporte sur
  // la spécification (tranché le 24/08/2026).
  //
  // Les deux mènent au même endroit : l'en-tête garde l'action sous les yeux
  // au défilement, le héros la porte. Ce n'est pas deux actions concurrentes,
  // c'est la même, rappelée. Le plafond reste bas pour que ça ne dérive pas.
  it("met en avant l'action de la page, sans la multiplier", () => {
    const { container } = render(<Landing t={messages("fr")} langue="fr" configuration={config} avantLancement features={TOUTES} />);
    const pleins = [...container.querySelectorAll("button, a")].filter((e) =>
      (e.getAttribute("style") ?? "").includes("var(--action)"));
    expect(pleins.length, "l'en-tête et le héros, pas davantage").toBeLessThanOrEqual(2);
  });

  // Les deux doivent viser la même chose, sinon ce sont bien deux actions.
  it("fait pointer l'appel de l'en-tête vers le formulaire du héros", () => {
    const { container } = render(<Landing t={messages("fr")} langue="fr" configuration={config} avantLancement features={TOUTES} />);
    const appel = container.querySelector(".ent-cta");
    expect(appel).not.toBeNull();
    expect(appel).toHaveAttribute("href", "/fr#commencer");
    expect(container.querySelector("#commencer"), "l'ancre visée doit exister").not.toBeNull();
  });

  it("ramène à l'accueil quand on clique la marque", () => {
    const { container } = render(<Landing t={messages("fr")} langue="fr" configuration={config} avantLancement features={TOUTES} />);
    const marque = container.querySelector("header a");
    expect(marque).toHaveAttribute("href", "/fr");
  });

  // Ce test affirmait l'inverse : « aucune section Mur, c'est une surface à
  // part ». Il confondait deux choses — le Mur EST une surface publique à
  // part, avec sa propre page, mais la landing en montre un aperçu, et la
  // maquette v3 lui donne une section entière (id="mur"). La section avait
  // disparu du code lors de la refonte, et ce test entérinait sa disparition
  // au lieu de la signaler.
  it("montre un aperçu du Mur, que la maquette lui accorde", () => {
    render(<Landing t={messages("fr")} langue="fr" configuration={config} avantLancement features={TOUTES} />);
    expect(screen.getByRole("heading", { name: /votre page à vous/i })).toBeInTheDocument();
  });
});

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SiteHeader } from "../components/landing/SiteHeader.js";
import { messages } from "../messages/index.js";

// Sous 920px, la navigation quitte la rangée de l'en-tête pour occuper sa
// propre ligne — base.css lui pose flex-basis: 100%. Encore faut-il que le
// conteneur autorise le retour à la ligne : sans flexWrap, elle restait
// collée à la marque et recouvrait le contenu de la page.
//
// jsdom n'applique pas les requêtes de conteneur, donc ce test ne mesure pas
// le rendu : il vérifie les deux conditions dont dépend le repli, celles qui
// avaient disparu sans que rien ne le dise.
describe("en-tête, repli mobile", () => {
  const t = messages("fr");

  it("autorise le retour à la ligne dans la rangée de l'en-tête", () => {
    const { container } = render(<SiteHeader t={t} langue="fr" />);
    const rangee = container.querySelector("header > div");

    expect(rangee).not.toBeNull();
    expect(
      (rangee as HTMLElement).style.flexWrap,
      "sans retour à la ligne, la navigation ne peut pas passer sous l'en-tête",
    ).toBe("wrap");
  });

  it("ferme la navigation par défaut et l'ouvre au clavier", async () => {
    render(<SiteHeader t={t} langue="fr" />);
    const nav = document.querySelector(".site-nav");

    expect(nav).toHaveAttribute("data-ferme", "1");
    await userEvent.click(screen.getByRole("button", { name: t.menuOuvrir }));
    expect(nav).toHaveAttribute("data-ferme", "0");
  });
});

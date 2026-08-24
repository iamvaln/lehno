import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FaqAccordion } from "../components/faq/FaqAccordion.js";
import { messages } from "../messages/index.js";

// L'accordéon doit rester utilisable au clavier seul, sans souris : un
// visiteur qui navigue au Tab doit pouvoir atteindre une question, l'ouvrir
// avec Entrée ou Espace, et la refermer de la même façon. C'est le vrai test
// d'un <button type="button"> avec aria-expanded/aria-controls — un <div>
// cliquable réussirait au clic mais échouerait ici.
describe("accordéon de la FAQ", () => {
  const t = messages("fr");

  it("chaque question est un vrai bouton, replié au départ et annoncé comme tel", () => {
    render(<FaqAccordion groupes={t.faq.groupes} />);
    const boutons = screen.getAllByRole("button");
    expect(boutons).toHaveLength(15);
    for (const bouton of boutons) {
      expect(bouton.tagName).toBe("BUTTON");
      expect(bouton).toHaveAttribute("aria-expanded", "false");
      expect(bouton).toHaveAttribute("aria-controls");
    }
  });

  it("le Tab seul atteint la première question, sans clic ni souris", async () => {
    render(<FaqAccordion groupes={t.faq.groupes} />);
    const premiere = screen.getByRole("button", { name: t.faq.groupes[0]!.items[0]!.q });

    await userEvent.tab();

    expect(premiere).toHaveFocus();
  });

  it("Entrée ouvre la question focalisée au clavier, et révèle sa réponse", async () => {
    render(<FaqAccordion groupes={t.faq.groupes} />);
    const question = t.faq.groupes[0]!.items[0]!.q;
    const reponse = t.faq.groupes[0]!.items[0]!.reponse!;
    const bouton = screen.getByRole("button", { name: question });

    await userEvent.tab();
    expect(bouton).toHaveFocus();

    await userEvent.keyboard("{Enter}");

    expect(bouton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(reponse)).toBeVisible();
  });

  it("Espace referme une question déjà ouverte au clavier", async () => {
    render(<FaqAccordion groupes={t.faq.groupes} />);
    const bouton = screen.getByRole("button", { name: t.faq.groupes[0]!.items[0]!.q });

    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(bouton).toHaveAttribute("aria-expanded", "true");

    await userEvent.keyboard(" ");
    expect(bouton).toHaveAttribute("aria-expanded", "false");
  });

  // Le prototype de référence (FaqPage.jsx) est explicite : rien ne se
  // referme tout seul. Ouvrir la deuxième question ne doit pas replier la
  // première.
  it("ouvrir une deuxième question laisse la première ouverte", async () => {
    render(<FaqAccordion groupes={t.faq.groupes} />);
    const premiere = screen.getByRole("button", { name: t.faq.groupes[0]!.items[0]!.q });
    const seconde = screen.getByRole("button", { name: t.faq.groupes[0]!.items[1]!.q });

    premiere.focus();
    await userEvent.keyboard("{Enter}");
    seconde.focus();
    await userEvent.keyboard("{Enter}");

    expect(premiere).toHaveAttribute("aria-expanded", "true");
    expect(seconde).toHaveAttribute("aria-expanded", "true");
  });

  // Les deux réponses en attente de décision affichent le bloc « à rédiger »,
  // avec son libellé et sa mention d'auteur — jamais un texte vide.
  // Un test vérifiait ici le bloc « à rédiger » d'une réponse en attente.
  // Les deux dernières ont été tranchées, le bloc a été retiré avec elles.
  // Ce qui compte à sa place : toute question ouverte montre sa réponse.
  it("montre la réponse une fois la question ouverte", async () => {
    render(<FaqAccordion groupes={t.faq.groupes} />);
    const item = t.faq.groupes.flatMap((g) => g.items)[0]!;
    const bouton = screen.getByRole("button", { name: new RegExp(item.q.slice(0, 20), "i") });

    bouton.focus();
    await userEvent.keyboard("{Enter}");

    const panneau = document.getElementById(bouton.getAttribute("aria-controls")!)!;
    expect(within(panneau).getByText(item.reponse)).toBeVisible();
  });
});

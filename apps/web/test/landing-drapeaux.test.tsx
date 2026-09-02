import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Landing } from "../components/landing/Landing.js";
import { messages } from "../messages/index.js";
import { CONFIG_REPLI } from "../lib/config-publique.js";

const t = messages("fr");

const poser = (features: string[]) =>
  render(
    <Landing
      t={t} langue="fr" configuration={CONFIG_REPLI}
      avantLancement features={features}
    />,
  );

/**
 * **La page ne promet jamais ce que le serveur ne sert pas.**
 *
 * C'est la règle centrale de la maquette, et elle vaut bloc par bloc — pas
 * seulement pour la bascule du lancement. Une landing qui annonce le Mur, les
 * idées de cadeau ou le parrainage alors que rien ne les sert vend ce qu'on ne
 * livre pas.
 */
describe("la landing se réduit à ce qui est ouvert", () => {
  it("n'annonce le Mur que s'il existe", () => {
    const { unmount } = poser(["generation.message"]);
    expect(screen.queryByText(t.murTitre)).toBeNull();
    unmount();

    poser(["generation.message", "wall"]);
    expect(screen.getByText(t.murTitre)).toBeInTheDocument();
  });

  /* Énumérer une génération fermée, c'est vendre ce qu'on ne livre pas. Au
     moins le message est toujours ouvert : la liste n'est jamais vide. */
  it("n'énumère que les générations ouvertes", () => {
    const { unmount } = poser(["generation.message"]);
    expect(screen.getByText(/pour vous : le message\./)).toBeInTheDocument();
    expect(screen.queryByText(/portrait/)).toBeNull();
    unmount();

    poser(["generation.message", "generation.ideas", "generation.portrait"]);
    expect(
      screen.getByText(/le message, les idées de cadeau et le portrait/),
    ).toBeInTheDocument();
  });

  /* Promettre deux crédits par invitation quand rien ne les distribue, c'est
     une promesse qu'on ne tiendra pas. */
  it("ne promet le parrainage que s'il est ouvert", () => {
    const { unmount } = poser(["generation.message"]);
    expect(screen.queryByText(new RegExp(t.prixParrainage))).toBeNull();
    unmount();

    poser(["generation.message", "referral"]);
    expect(screen.getByText(new RegExp(t.prixParrainage))).toBeInTheDocument();
  });

  /* L'onglet « Moi » n'existe que si l'une de ses sections existe — une
     conséquence que le serveur n'envoie jamais, et qui se déduit ici. */
  it("retire l'onglet « Moi » quand aucune de ses sections n'existe", () => {
    const { unmount } = poser(["generation.message"]);
    expect(screen.queryByText(t.tabMoi)).toBeNull();
    expect(screen.getByText(t.tabReglages)).toBeInTheDocument();
    unmount();

    poser(["generation.message", "wishes"]);
    expect(screen.getByText(t.tabMoi)).toBeInTheDocument();
  });

  it("ne montre la liste et le mot du Mur que sous leurs drapeaux", () => {
    const { unmount } = poser(["generation.message", "wall"]);
    expect(screen.queryByText(t.murListe)).toBeNull();
    expect(screen.queryByText(t.murMot)).toBeNull();
    unmount();

    poser(["generation.message", "wall", "wishlist.own", "wishes"]);
    expect(screen.getByText(t.murListe)).toBeInTheDocument();
    expect(screen.getByText(t.murMot)).toBeInTheDocument();
  });
});

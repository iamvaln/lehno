import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Alerte, Dashboard } from "@lehno/contracts";

import { TableauDeBord } from "../src/pages/TableauDeBord.js";
import { dashboard } from "../src/fixtures/index.js";
import { fr, en, type Messages } from "../src/i18n/index.js";

// Le tableau de bord est le seul écran du back-office qui ne demande rien : il
// dit ce qui ne va pas, puis les chiffres, puis ce qui attend une décision.
// C'est cet ordre — et le plafond de trois alertes — que ces tests tiennent.

function alerte(n: number, notifieA: string | null = null): Alerte {
  return {
    id: `al-${n}`,
    cause: "echec_modele",
    libelle: `Anomalie ${n}`,
    ton: "danger",
    section: `section-${n}`,
    notifieA,
  };
}

function poser(donnees: Dashboard = dashboard, t: Messages = fr) {
  const onAller = vi.fn();
  const rendu = render(<TableauDeBord donnees={donnees} t={t} onAller={onAller} />);
  return { ...rendu, onAller };
}

const rangDes = (titre: string) => screen.getByRole("region", { name: titre });

describe("le tableau de bord", () => {
  it("rend son en-tête depuis le dictionnaire", () => {
    poser();
    expect(screen.getByRole("heading", { level: 1, name: fr.tableau.titre })).toBeInTheDocument();
    expect(screen.getByText(fr.tableau.sous)).toBeInTheDocument();
  });
});

// --------------------------------------------------------------------------
// Le rang d'alertes — trois au plus, et d'abord
// --------------------------------------------------------------------------

describe("le rang d'alertes", () => {
  // `dashboardSchema` plafonne déjà à trois. Le rendu ne doit pas le
  // contredire : une source bavarde — une API pas encore alignée, une fixture
  // de mise au point — ne doit pas casser la ligne.
  it("ne rend jamais plus de trois alertes, même si on en passe cinq", () => {
    poser({ ...dashboard, alertes: [1, 2, 3, 4, 5].map((n) => alerte(n)) });

    const rang = rangDes(fr.tableau.alertesTitre);
    expect(within(rang).getAllByRole("button")).toHaveLength(3);
    expect(screen.queryByText("Anomalie 4")).toBeNull();
    expect(screen.queryByText("Anomalie 5")).toBeNull();
  });

  // Ce qui ne va pas se lit avant tout chiffre : ce n'est pas une préférence de
  // mise en page, c'est ce que la page a à dire.
  it("rend les alertes avant le premier indicateur dans l'ordre du document", () => {
    poser();

    const premiereAlerte = screen.getByRole("button", { name: /22 % d'échecs/ });
    const premierIndicateur = screen.getByRole("button", { name: /Comptes actifs/ });
    const position = premiereAlerte.compareDocumentPosition(premierIndicateur);

    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // Le panel et le courriel sont deux vues d'un même événement : l'écran dit
  // que le mail est déjà parti, il ne prévient pas une deuxième fois.
  it("porte le rappel d'une alerte déjà notifiée, et rien de tel sinon", () => {
    poser({ ...dashboard, alertes: [alerte(1, "14 h"), alerte(2, null)] });

    expect(screen.getByText(fr.alerte.notifie.replace("{heure}", "14 h"))).toBeInTheDocument();
    expect(screen.queryAllByText(/notifié à/)).toHaveLength(1);

    const sansRappel = screen.getByRole("button", { name: /Anomalie 2/ });
    expect(sansRappel.textContent).not.toMatch(/notifié/);
  });

  it("remonte la section d'une alerte au clic", async () => {
    const { onAller } = poser();

    await userEvent.click(screen.getByRole("button", { name: /22 % d'échecs/ }));

    expect(onAller).toHaveBeenCalledWith("parametres");
  });

  it("dit qu'il n'y a rien de bloqué quand aucune alerte n'arrive", () => {
    poser({ ...dashboard, alertes: [] });

    const rang = rangDes(fr.tableau.alertesTitre);
    expect(within(rang).getByText(fr.tableau.alertesVide.titre)).toBeInTheDocument();
    expect(within(rang).getByText(fr.tableau.alertesVide.texte)).toBeInTheDocument();
    expect(within(rang).queryAllByRole("button")).toHaveLength(0);
  });
});

// --------------------------------------------------------------------------
// Les cartes d'indicateurs
// --------------------------------------------------------------------------

describe("les cartes d'indicateurs", () => {
  it("rend un indicateur par entrée, avec son chiffre et sa variation", () => {
    poser();

    const rang = rangDes(fr.tableau.indicateursTitre);
    expect(within(rang).getByText("Comptes actifs")).toBeInTheDocument();
    expect(within(rang).getByText("1 284")).toBeInTheDocument();
    expect(within(rang).getByText("+38 ce mois")).toBeInTheDocument();
    expect(within(rang).getAllByRole("button")).toHaveLength(dashboard.indicateurs.length);
  });

  it("remonte la section d'une carte au clic", async () => {
    const { onAller } = poser();

    await userEvent.click(screen.getByRole("button", { name: /Crédits vendus/ }));

    expect(onAller).toHaveBeenCalledWith("credits");
  });

  // Un chiffre qui ne mène nulle part n'est pas une commande : il ne s'atteint
  // pas au clavier et ne promet pas un écran qui n'existe pas.
  it("ne fait pas une commande d'un indicateur sans section", () => {
    poser({
      ...dashboard,
      indicateurs: [{ id: "seul", libelle: "Sans suite", valeur: "7", variation: null, section: null }],
    });

    const rang = rangDes(fr.tableau.indicateursTitre);
    expect(within(rang).queryAllByRole("button")).toHaveLength(0);
    expect(within(rang).getByText("Sans suite")).toBeInTheDocument();
  });
});

// --------------------------------------------------------------------------
// La file « à traiter »
// --------------------------------------------------------------------------

describe("la file à traiter", () => {
  it("rend une ligne par élément, avec sa section, son état et son ancienneté", () => {
    poser();

    const rang = rangDes(fr.tableau.aTraiterTitre);
    // Une ligne d'en-tête, puis une ligne par élément.
    expect(within(rang).getAllByRole("row")).toHaveLength(dashboard.aTraiter.length + 1);
    expect(within(rang).getByText("Contenu signalé sur un Mur")).toBeInTheDocument();
    expect(within(rang).getByText("Modération")).toBeInTheDocument();
    expect(within(rang).getByText("À décider")).toBeInTheDocument();
    expect(within(rang).getByText("il y a 2 h")).toBeInTheDocument();
  });

  it("nomme ses colonnes depuis le dictionnaire", () => {
    poser();

    const rang = rangDes(fr.tableau.aTraiterTitre);
    for (const titre of Object.values(fr.tableau.col)) {
      expect(within(rang).getByRole("columnheader", { name: titre })).toBeInTheDocument();
    }
  });

  // « Rien à traiter » dit ce qui est — le service tourne —, pas « aucune
  // donnée ».
  it("dit ce qui est quand la file est vide", () => {
    poser({ ...dashboard, aTraiter: [] });

    const rang = rangDes(fr.tableau.aTraiterTitre);
    expect(within(rang).getByText(fr.tableau.vide.titre)).toBeInTheDocument();
    expect(within(rang).getByText(fr.tableau.vide.texte)).toBeInTheDocument();
    expect(within(rang).queryByRole("table")).toBeNull();
  });
});

// --------------------------------------------------------------------------
// Les deux langues, et l'adhérence
// --------------------------------------------------------------------------

describe("les deux langues", () => {
  it("rend les libellés français", () => {
    poser(dashboard, fr);
    expect(screen.getByRole("heading", { level: 1, name: fr.tableau.titre })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: fr.tableau.alertesTitre })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: fr.tableau.aTraiterTitre })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: fr.tableau.col.element })).toBeInTheDocument();
  });

  it("rend les libellés anglais", () => {
    poser(dashboard, en);
    expect(screen.getByRole("heading", { level: 1, name: en.tableau.titre })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: en.tableau.alertesTitre })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: en.tableau.aTraiterTitre })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: en.tableau.col.element })).toBeInTheDocument();
  });

  it("porte le rappel de notification dans la langue de lecture", () => {
    poser({ ...dashboard, alertes: [alerte(1, "2 p.m.")] }, en);
    expect(screen.getByText(en.alerte.notifie.replace("{heure}", "2 p.m."))).toBeInTheDocument();
  });
});

describe("l'adhérence de la page", () => {
  const source = readFileSync("src/pages/TableauDeBord.tsx", "utf-8");
  const feuille = readFileSync("src/styles/tableau.css", "utf-8");

  // Un style en ligne ne porte ni :hover, ni :focus-visible, ni requête de
  // média, et une couleur posée en ligne échappe au thème sombre.
  it("ne pose aucun style en ligne", () => {
    expect(source).not.toMatch(/style=\{/);
  });

  // Tout le texte vient de src/i18n : la page n'a pas un mot à elle.
  it("n'écrit aucune couleur en dur dans sa feuille", () => {
    expect(feuille).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(feuille).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
  });

  // « Cartes d'indicateurs — grille auto-fit, minimum 170 px » : le paquet de
  // passation le dit, la feuille le tient.
  it("pose la grille des indicateurs en auto-fit à 170 px", () => {
    expect(feuille).toMatch(/repeat\(auto-fit,\s*minmax\(170px,\s*1fr\)\)/);
  });
});

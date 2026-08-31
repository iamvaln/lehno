import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Topbar } from "../src/composants/coquille/index.js";
import { DataTable } from "../src/composants/donnees/index.js";
import { ExportButton } from "../src/composants/actions/index.js";

const T = {
  compte: "Mon compte", profil: "Mon profil", acces: "Accès administrateurs",
  deconnexion: "Se déconnecter", langue: "Langue",
  roleAdmin: "Administrateur", roleSupport: "Support",
  menu: "Ouvrir la navigation", theme: "Changer de thème",
};

const ADRESSE = "sam@lehno.app";

const monter = () => render(<Topbar compte={ADRESSE} role="admin" t={T} />);

describe("le panneau de compte se dit pour ce qu'il est", () => {
  // Un role="menu" engage une navigation aux flèches, et n'admet que des
  // menuitem pour enfants. Ce panneau porte un en-tête non interactif, un choix
  // de langue à deux états et trois actions : ce n'est pas un menu, c'est un
  // dépliant. Le dire menu promettait à un lecteur d'écran un comportement que
  // l'outil n'a jamais eu.
  it("n'est pas annoncé comme un menu", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    monter();
    await utilisateur.click(screen.getByRole("button", { name: ADRESSE }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: ADRESSE })).not.toHaveAttribute("aria-haspopup", "menu");
  });

  it("le déclencheur dit ce qu'il ouvre, et le panneau existe vraiment", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    monter();
    const declencheur = screen.getByRole("button", { name: ADRESSE });
    expect(declencheur).toHaveAttribute("aria-expanded", "false");

    await utilisateur.click(declencheur);

    expect(declencheur).toHaveAttribute("aria-expanded", "true");
    const cible = declencheur.getAttribute("aria-controls");
    expect(cible).toBeTruthy();
    expect(document.getElementById(cible as string)).toBeInTheDocument();
  });

  it("le panneau porte un nom, pour qu'on sache où l'on est entré", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    monter();
    await utilisateur.click(screen.getByRole("button", { name: ADRESSE }));

    expect(screen.getByRole("group", { name: ADRESSE })).toBeInTheDocument();
  });

  // Sans ça, ouvrir au clavier ne mène nulle part : le panneau paraît, et la
  // tabulation suivante continue dans la page derrière lui.
  it("ouvrir place le focus sur la première commande du panneau", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    monter();
    await utilisateur.click(screen.getByRole("button", { name: ADRESSE }));

    const panneau = screen.getByRole("group", { name: ADRESSE });
    expect(panneau.contains(document.activeElement)).toBe(true);
  });

  // Et l'inverse : refermer sans rendre le focus laisse le clavier au début du
  // document, très loin d'où l'on était.
  it("échap referme et rend le focus au déclencheur", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    monter();
    const declencheur = screen.getByRole("button", { name: ADRESSE });
    await utilisateur.click(declencheur);

    await utilisateur.keyboard("{Escape}");

    expect(declencheur).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(declencheur);
  });

  it("le choix de langue est un groupe nommé, à deux boutons à état", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    monter();
    await utilisateur.click(screen.getByRole("button", { name: ADRESSE }));

    const groupe = screen.getByRole("group", { name: T.langue });
    const boutons = within(groupe).getAllByRole("button");
    expect(boutons).toHaveLength(2);
    for (const bouton of boutons) expect(bouton).toHaveAttribute("aria-pressed");
  });
});

describe("les vrais menus le restent", () => {
  // Non-régression : ceux-là ne portent que des actions, le motif menu leur va.
  it("le menu de ligne d'un tableau n'a que des menuitem pour enfants", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    render(
      <DataTable
        colonnes={[{ cle: "nom", titre: "Nom" }]}
        lignes={[{ id: "1", nom: "Awa" }]}
        actions={() => [{ id: "suspendre", label: "Suspendre" }]}
        libelles={{ actions: "Actions" }}
      />,
    );
    await utilisateur.click(screen.getByRole("button", { name: "Actions" }));

    const menu = screen.getByRole("menu");
    expect(within(menu).getAllByRole("menuitem").length).toBeGreaterThan(0);
    // Rien d'autre qu'un menuitem : un lecteur d'écran saute ce qu'il ne
    // reconnaît pas, et le compte annoncé (« 1 sur 3 ») devient faux.
    for (const enfant of Array.from(menu.children)) {
      expect(enfant.getAttribute("role"), enfant.outerHTML.slice(0, 80)).toBe("menuitem");
    }
  });

  it("le menu d'export n'a que des menuitem pour enfants", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    render(
      <ExportButton
        formats={["csv", "json"]}
        onExport={() => {}}
        libelles={{ exporter: "Exporter", journal: "L'export est journalisé.", formats: { csv: "CSV", json: "JSON" } }}
      />,
    );
    await utilisateur.click(screen.getByRole("button", { name: /Exporter/ }));

    const menu = screen.getByRole("menu");
    for (const enfant of Array.from(menu.children)) {
      expect(enfant.getAttribute("role"), enfant.outerHTML.slice(0, 80)).toBe("menuitem");
    }
  });
});

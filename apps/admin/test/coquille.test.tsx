import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminShell, Sidebar, Topbar } from "../src/composants/coquille/index.js";
import type { SidebarFamille } from "../src/composants/coquille/index.js";

// Les libellés viennent du dictionnaire de l'outil, jamais du composant : le
// back-office se lit dans les deux langues du produit. Le test les fournit donc
// comme le fera l'application.
const FAMILLES: SidebarFamille[] = [
  // Le tableau de bord n'est pas une tâche : c'est l'accueil. Pas d'en-tête.
  { titre: null, items: [{ id: "tableau", label: "Tableau de bord", icon: "layout-dashboard" }] },
  {
    titre: "À traiter",
    items: [
      { id: "alertes", label: "Alertes", icon: "triangle-alert", ton: "alerte" },
      { id: "contact", label: "Messages de contact", icon: "mail" },
    ],
  },
  { titre: "Finances", items: [{ id: "transactions", label: "Transactions", icon: "receipt-text", ton: "alerte" }] },
  {
    titre: "Gestion",
    items: [
      { id: "comptes", label: "Utilisateurs", icon: "users" },
      { id: "acces", label: "Administrateurs", icon: "user-cog" },
    ],
  },
  { titre: "Suivi", items: [{ id: "audit", label: "Journal d'audit", icon: "scroll-text" }] },
  { titre: "Outils", items: [{ id: "liens", label: "Liens externes", icon: "external-link" }] },
];

const T = {
  recherche: "Rechercher un utilisateur, un paiement, un contenu",
  langue: "Langue",
  roleAdmin: "Administrateur",
  roleSupport: "Support",
  acces: "Accès des administrateurs",
  deconnexion: "Se déconnecter",
  profil: "Mon profil",
  menu: "Sections",
  theme: "Thème",
  compte: "Compte",
};

function coquille(container: HTMLElement, classe: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(classe);
  if (!element) throw new Error(`élément introuvable : ${classe}`);
  return element;
}

describe("AdminShell", () => {
  it("pose la grille sur la largeur de la barre latérale, le reste au contenu", () => {
    const { container } = render(
      <AdminShell sidebar={<nav />} topbar={<header />}>{null}</AdminShell>,
    );
    expect(coquille(container, ".coquille")).toHaveStyle({
      display: "grid",
      gridTemplateColumns: "var(--sidebar-width) 1fr",
    });
  });

  it("colle la barre latérale : une liste de quarante lignes ne fait pas défiler la navigation", () => {
    const { container } = render(
      <AdminShell sidebar={<nav />} topbar={<header />}>{null}</AdminShell>,
    );
    expect(coquille(container, ".coquille-rail")).toHaveStyle({ position: "sticky", top: "0px" });
  });

  it("rend la barre haute, la barre latérale et le contenu", () => {
    render(
      <AdminShell sidebar={<nav aria-label="Sections" />} topbar={<header>barre</header>}>
        <p>page</p>
      </AdminShell>,
    );
    expect(screen.getByRole("navigation", { name: "Sections" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("page");
  });

  it("ne pose aucun voile tant que la navigation est fermée", () => {
    const { container } = render(
      <AdminShell sidebar={<nav />} topbar={<header />}>{null}</AdminShell>,
    );
    expect(container.querySelector(".coquille-voile")).toBeNull();
    expect(coquille(container, ".coquille-rail")).not.toHaveAttribute("data-ouvert");
  });

  it("marque le rail ouvert et pose le voile quand la navigation glisse par-dessus le contenu", () => {
    const { container } = render(
      <AdminShell sidebar={<nav />} topbar={<header />} navOuverte>{null}</AdminShell>,
    );
    expect(coquille(container, ".coquille-rail")).toHaveAttribute("data-ouvert", "1");
    expect(coquille(container, ".coquille-voile")).toHaveStyle({ position: "fixed" });
  });

  it("referme la navigation quand on touche le voile", async () => {
    const fermer = vi.fn();
    const { container } = render(
      <AdminShell sidebar={<nav />} topbar={<header />} navOuverte onFermerNav={fermer}>{null}</AdminShell>,
    );
    await userEvent.click(coquille(container, ".coquille-voile"));
    expect(fermer).toHaveBeenCalledOnce();
  });
});

describe("Sidebar", () => {
  it("garde l'ordre des familles : à traiter, finances, gestion, suivi, outils", () => {
    const { container } = render(<Sidebar familles={FAMILLES} marque="Lehno" />);
    const titres = [...container.querySelectorAll(".coquille-famille-titre")].map((n) => n.textContent);
    expect(titres).toEqual(["À traiter", "Finances", "Gestion", "Suivi", "Outils"]);
  });

  it("pose le tableau de bord au-dessus, sans en-tête de famille", () => {
    const { container } = render(<Sidebar familles={FAMILLES} marque="Lehno" />);
    const items = [...container.querySelectorAll(".coquille-item")];
    expect(items[0]).toHaveTextContent("Tableau de bord");
    const premierTitre = container.querySelector(".coquille-famille-titre");
    expect(premierTitre).not.toBeNull();
    // L'en-tête « À traiter » vient après le tableau de bord dans le document.
    expect(items[0]!.compareDocumentPosition(premierTitre!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("porte un point de 6 px sur un item d'alerte, jamais un chiffre", () => {
    render(<Sidebar familles={FAMILLES} marque="Lehno" />);
    const alertes = screen.getByRole("button", { name: "Alertes" });
    const point = alertes.querySelector<HTMLElement>("[data-ton='alerte']");
    expect(point).not.toBeNull();
    expect(point!).toHaveStyle({ width: "6px", height: "6px" });
    expect(alertes.textContent).toBe("Alertes");
    expect(alertes.textContent).not.toMatch(/\d/);
  });

  it("ne pose rien sur un item sans ton", () => {
    render(<Sidebar familles={FAMILLES} marque="Lehno" />);
    const contact = screen.getByRole("button", { name: "Messages de contact" });
    expect(contact.querySelector("[data-ton='alerte']")).toBeNull();
  });

  it("remonte la section choisie", async () => {
    const choisir = vi.fn();
    render(<Sidebar familles={FAMILLES} marque="Lehno" onSelect={choisir} />);
    await userEvent.click(screen.getByRole("button", { name: "Utilisateurs" }));
    expect(choisir).toHaveBeenCalledWith("comptes");
  });

  it("marque la section courante pour les lecteurs d'écran", () => {
    render(<Sidebar familles={FAMILLES} marque="Lehno" active="comptes" />);
    expect(screen.getByRole("button", { name: "Utilisateurs" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Journal d'audit" })).not.toHaveAttribute("aria-current");
  });

  it("affiche le rôle du compte connecté, et rien quand il n'est pas connu", () => {
    const { rerender, container } = render(<Sidebar familles={[]} marque="Lehno" role="admin" />);
    expect(coquille(container, ".coquille-role")).toHaveTextContent("admin");
    rerender(<Sidebar familles={[]} marque="Lehno" />);
    expect(container.querySelector(".coquille-role")).toBeNull();
  });

  it("n'écrit aucun libellé en dur : sans props, il ne dit rien", () => {
    const { container } = render(<Sidebar familles={[]} marque="" />);
    expect(container.textContent).toBe("");
  });
});

describe("Topbar", () => {
  it("remonte la saisie de la recherche globale", async () => {
    const chercher = vi.fn();
    render(<Topbar t={T} onSearch={chercher} />);
    await userEvent.type(screen.getByPlaceholderText(T.recherche), "awa");
    expect(chercher).toHaveBeenCalled();
  });

  it("bascule le thème", async () => {
    const theme = vi.fn();
    render(<Topbar t={T} onTheme={theme} />);
    await userEvent.click(screen.getByRole("button", { name: T.theme }));
    expect(theme).toHaveBeenCalledOnce();
  });

  it("ouvre le bandeau latéral sous 900 px", async () => {
    const menu = vi.fn();
    render(<Topbar t={T} onMenu={menu} />);
    await userEvent.click(screen.getByRole("button", { name: T.menu }));
    expect(menu).toHaveBeenCalledOnce();
  });

  it("le compte est un menu, pas une étiquette", async () => {
    render(<Topbar t={T} compte="sam@lehno.app" role="support" />);
    const bouton = screen.getByRole("button", { name: /sam@lehno.app/ });
    expect(bouton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).toBeNull();
    await userEvent.click(bouton);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(bouton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(T.roleSupport)).toBeInTheDocument();
  });

  it("referme le menu du compte sur Échap", async () => {
    render(<Topbar t={T} compte="sam@lehno.app" />);
    await userEvent.click(screen.getByRole("button", { name: /sam@lehno.app/ }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("ouvre l'accès des administrateurs pour le rôle admin", async () => {
    const acces = vi.fn();
    render(<Topbar t={T} compte="sam@lehno.app" role="admin" onAcces={acces} />);
    await userEvent.click(screen.getByRole("button", { name: /sam@lehno.app/ }));
    expect(screen.getByText(T.roleAdmin)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: T.acces }));
    expect(acces).toHaveBeenCalledOnce();
  });

  // Le rôle conditionne ce que l'interface expose : une entrée grisée dirait au
  // support qu'il lui manque un droit. Elle n'est pas rendue du tout.
  it("retire l'entrée des accès pour le support, sans la griser", async () => {
    render(<Topbar t={T} compte="sam@lehno.app" role="support" onAcces={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /sam@lehno.app/ }));
    expect(screen.queryByText(T.acces)).toBeNull();
    expect(screen.getByText(T.profil)).toBeInTheDocument();
    for (const bouton of screen.getAllByRole("button")) {
      expect(bouton).not.toBeDisabled();
    }
  });

  it("remonte le changement de langue et referme sur une sortie", async () => {
    const langue = vi.fn();
    const sortir = vi.fn();
    render(<Topbar t={T} compte="sam@lehno.app" langue="fr" onLangue={langue} onDeconnexion={sortir} />);
    await userEvent.click(screen.getByRole("button", { name: /sam@lehno.app/ }));
    await userEvent.click(screen.getByRole("button", { name: "en" }));
    expect(langue).toHaveBeenCalledWith("en");
    await userEvent.click(screen.getByRole("button", { name: T.deconnexion }));
    expect(sortir).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("n'écrit aucun libellé en dur : sans dictionnaire ni compte, il ne dit rien", () => {
    const { container } = render(<Topbar />);
    expect(container.textContent).toBe("");
  });
});

describe("la feuille de la coquille", () => {
  const css = readFileSync("src/styles/coquille.css", "utf-8");

  it("porte les deux paliers étroits", () => {
    expect(css).toMatch(/@media\s*\(max-width:\s*900px\)/);
    expect(css).toMatch(/@media\s*\(max-width:\s*620px\)/);
  });

  it("porte ce qu'un style en ligne ne peut pas porter : le survol et le focus", () => {
    expect(css).toContain(":hover");
    expect(css).toContain(":focus-visible");
  });

  it("n'écrit ni couleur, ni ombre, ni durée en dur", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
    expect(css).not.toMatch(/box-shadow/);
    expect(css.replace(/var\(--[a-z-]+\)/g, "")).not.toMatch(/\b\d+m?s\b/);
  });
});

describe("les trois composants ne s'écartent pas du système de design", () => {
  for (const nom of ["AdminShell", "Sidebar", "Topbar"]) {
    it(`${nom}.tsx ne pose ni couleur, ni ombre, ni rayon en dur`, () => {
      const source = readFileSync(`src/composants/coquille/${nom}.tsx`, "utf-8");
      expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(source).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
      expect(source).not.toMatch(/boxShadow/);
      expect(source).not.toMatch(/borderRadius:\s*["'`]?\d/);
    });
  }
});

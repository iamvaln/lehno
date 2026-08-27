import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";
import { NAVIGATION, sectionsVisibles } from "../src/navigation.js";
import { dashboard } from "../src/fixtures/index.js";

const t = messages("fr");

function ouvrir(role: "support" | "admin") {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role });
  render(<App />);
  return screen.getByRole("navigation");
}

/**
 * Le menu promet, l'écran tient. Ce fichier vérifie le lien entre les deux :
 * qu'aucune entrée ne mène nulle part, et qu'aucune section livrée ne se
 * présente encore comme à venir.
 */
describe("ce que le menu promet, l'écran le tient", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // Une section pas encore livrée annonce le gabarit qu'elle emploiera. Encore
  // faut-il qu'elle le nomme : « Gabarit : » suivi de rien n'est pas une
  // annonce, c'est un trou dans une phrase.
  it("une section encore à venir nomme le gabarit qu'elle emploiera", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const nav = ouvrir("admin");
    const annonces = Object.values(t.gabarits).map((nom) =>
      t.attente.gabarit.replace("{gabarit}", nom),
    );

    for (const section of sectionsVisibles("admin")) {
      await utilisateur.click(within(nav).getByText(t.sections[section as keyof typeof t.sections]));
      const contenu = screen.getByRole("main").textContent ?? "";
      if (!contenu.includes(t.attente.titre)) continue; // la section est livrée
      expect(
        annonces.some((annonce) => contenu.includes(annonce)),
        `« ${section} » s'annonce à venir sans nommer son gabarit`,
      ).toBe(true);
    }
  });

  // Le corollaire : une section qui a son écran ne doit plus se présenter comme
  // à venir. Le repli attrape tout ce qui n'a pas de route — une route perdue
  // dans un remaniement se lirait « Section à venir » sans que rien n'échoue.
  it("une section livrée ne se présente plus comme à venir", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const nav = ouvrir("admin");

    for (const section of ["comptes", "credits", "assistance", "acces", "audit", "connexions", "parametres", "fonctionnalites", "modeles", "liens", "studio"]) {
      await utilisateur.click(within(nav).getByText(t.sections[section as keyof typeof t.sections]));
      expect(
        screen.getByRole("main").textContent ?? "",
        `« ${section} » a un écran et se présente pourtant comme à venir`,
      ).not.toContain(t.attente.titre);
    }
  });

  // Retirer une section du menu ne doit pas la rendre inatteignable. Celles qui
  // n'y figurent pas doivent avoir un chemin dit, sinon leur retrait est une
  // suppression déguisée. Et l'inverse : un libellé que rien n'atteint finit par
  // se faire désigner — c'est ainsi qu'une donnée d'aperçu s'est mise à mener
  // vers « transactions », une section qui n'a jamais existé.
  it("toute section qui porte un libellé a un chemin, menu ou non", () => {
    const auMenu = new Set(NAVIGATION.flatMap(({ items }) => items));
    const horsMenu: Record<string, string> = {
      profil: "le menu de compte de la barre haute",
      suppressions: "une file « à traiter » du tableau de bord",
    };

    for (const section of Object.keys(t.sections)) {
      expect(
        auMenu.has(section) || section in horsMenu,
        `« ${section} » porte un libellé sans qu'aucun chemin n'y mène`,
      ).toBe(true);
    }
  });

  // Les données d'aperçu servent la maquette, la barre de développement et
  // plusieurs tests. Une cible qui n'ouvre rien y apprend un chemin faux : le
  // clic mène à « Section à venir » pour un écran parfois déjà livré ailleurs.
  it("les données d'aperçu ne désignent que des sections qu'on peut ouvrir", () => {
    const ouvrables = new Set([
      ...NAVIGATION.flatMap(({ items }) => items),
      // Les files du tableau de bord, hors menu mais bien rendues.
      "suppressions",
    ]);

    const cibles = [
      ...dashboard.alertes.map((a) => a.section),
      ...dashboard.indicateurs.map((i) => i.section),
    ];

    expect(cibles.length).toBeGreaterThan(0);
    for (const cible of cibles) {
      if (cible === null || cible === undefined) continue; // un chiffre peut ne mener nulle part
      expect(ouvrables.has(cible), `l'aperçu mène vers « ${cible} », qui n'ouvre rien`).toBe(true);
    }
  });
});

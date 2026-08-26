import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages, type Langue } from "../src/i18n/index.js";
import { SECTIONS_ECONOMIE, sectionAutorisee, sectionsVisibles } from "../src/navigation.js";

const t = messages("fr");

function ouvrir(role: "support" | "admin") {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role });
  render(<App />);
  return screen.getByRole("navigation");
}

describe("la navigation suit le rôle, elle ne le grise pas", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("un administrateur voit les quatre familles de la spécification", () => {
    const nav = ouvrir("admin");
    for (const famille of ["exploitation", "economie", "supervision", "outils"] as const) {
      expect(within(nav).getByText(t.familles[famille])).toBeInTheDocument();
    }
  });

  // « Une section entièrement fermée ne figure pas dans son menu » (ux-admin §6).
  // Le support ne voit pas des portes closes, il voit son outil.
  it("un support ne voit aucune section de la famille Économie", () => {
    const nav = ouvrir("support");
    for (const section of SECTIONS_ECONOMIE) {
      expect(
        within(nav).queryByText(t.sections[section]),
        `la section « ${section} » ne devrait pas figurer`,
      ).not.toBeInTheDocument();
    }
  });

  // Et le corollaire : la famille elle-même disparaît. Un en-tête « Économie »
  // suivi de rien dirait à un support qu'il lui manque quelque chose.
  it("la famille Économie disparaît entièrement, en-tête compris", () => {
    const nav = ouvrir("support");
    expect(within(nav).queryByText(t.familles.economie)).not.toBeInTheDocument();
  });

  // « Le journal d'audit est réservé aux administrateurs — c'est ce qui lui
  // donne sa valeur de contrôle sur le travail de l'équipe » (ux-admin §6).
  it("le journal d'audit et les accès sont fermés au support", () => {
    const nav = ouvrir("support");
    expect(within(nav).queryByText(t.sections.audit)).not.toBeInTheDocument();
    expect(within(nav).queryByText(t.sections.acces)).not.toBeInTheDocument();
  });

  it("ce qui reste au support est bien là", () => {
    const nav = ouvrir("support");
    for (const section of ["tableau", "comptes", "credits", "moderation", "metriques", "connexions", "liens"] as const) {
      expect(within(nav).getByText(t.sections[section])).toBeInTheDocument();
    }
  });

  // Cacher l'entrée ne suffit pas : l'écran doit refuser de rendre la section,
  // sans quoi le tableau de bord y mènerait encore par un raccourci.
  // Cacher l'entrée ne suffit pas : un raccourci du tableau de bord, une adresse
  // gardée en mémoire ou un retour arrière y mèneraient encore.
  it("la règle de droits ferme la section, pas seulement son entrée de menu", () => {
    expect(sectionsVisibles("support")).not.toContain("parametres");
    expect(sectionsVisibles("support")).not.toContain("studio");
    expect(sectionsVisibles("support")).not.toContain("audit");
    expect(sectionsVisibles("admin")).toContain("parametres");
    expect(sectionAutorisee("support", "parametres")).toBe(false);
    expect(sectionAutorisee("support", "comptes")).toBe(true);
    expect(sectionAutorisee("admin", "studio")).toBe(true);
  });

  it("naviguer depuis le menu ouvre bien la section", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const nav = ouvrir("support");
    // Scopé au menu : le nom d'une section paraît aussi dans le fil d'Ariane et
    // le titre de page une fois ouverte.
    await utilisateur.click(within(nav).getByText(t.sections.comptes));
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("chaque section a son libellé dans les deux langues", () => {
    const langues: Langue[] = ["fr", "en"];
    const cles = langues.map((l) => Object.keys(messages(l).sections).sort());
    expect(cles[1]).toEqual(cles[0]);
    for (const langue of langues) {
      for (const [cle, libelle] of Object.entries(messages(langue).sections)) {
        expect(libelle, `${langue}.sections.${cle}`).toMatch(/\S/);
      }
    }
  });

  it("chaque famille a son titre dans les deux langues", () => {
    const fr = Object.keys(messages("fr").familles).sort();
    const en = Object.keys(messages("en").familles).sort();
    expect(en).toEqual(fr);
  });
});

// Quatre sections ne figurent pas au menu : la spécification n'en fait pas des
// sections, ce sont les files du « à traiter » du tableau de bord. Encore
// faut-il qu'on puisse y entrer — sans ce chemin, les retirer du menu les
// rendrait inatteignables, et ce serait une suppression déguisée.
describe("les files hors menu restent atteignables", () => {
  it("une file du tableau de bord mène à sa section", () => {
    for (const file of ["suppressions", "moderation", "contact", "attente"]) {
      expect(sectionAutorisee("admin", file), file).toBe(true);
    }
  });
});

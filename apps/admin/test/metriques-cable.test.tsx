import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";

const t = messages("fr");

const METRIQUES = (over: Record<string, unknown> = {}) => ({
  periode: "30j",
  retention: {
    cohortes: [
      { mois: "2026-07", inscrits: 120, actifsA7j: 48, actifsA30j: 30 },
      { mois: "2026-08", inscrits: 90, actifsA7j: 40, actifsA30j: 0 },
    ],
  },
  conversion: {
    comptes: 210, acheteurs: 24, delaiMedianJours: 3,
    parPalier: [{ credits: 500, achats: 9 }, { credits: 2000, achats: 15 }],
  },
  consommation: { credits: 8400, mouvements: 512 },
  manques: ["usage_par_fonctionnalite", "issue_des_actions", "contributions"],
  ...over,
});

const reponse = (statut: number, corps?: unknown, texte?: string): Response =>
  new Response(texte ?? (corps === undefined ? null : JSON.stringify(corps)), {
    status: statut,
    headers: texte
      ? { "content-type": "text/csv; charset=utf-8" }
      : (corps === undefined ? {} : { "content-type": "application/json" }),
  });

function serveur(donnees: ReturnType<typeof METRIQUES> = METRIQUES()) {
  const appels = vi.fn((url: string) => {
    if (String(url).includes("/admin/metrics/export")) {
      return Promise.resolve(reponse(200, undefined, "mois,entrees\n\"2026-07\",120"));
    }
    if (String(url).includes("/admin/metrics")) return Promise.resolve(reponse(200, donnees));
    return Promise.resolve(reponse(200, { alertes: [], indicateurs: [], aTraiter: [] }));
  });
  vi.stubGlobal("fetch", appels);
  return appels;
}

const lectures = (appels: ReturnType<typeof vi.fn>): string[] =>
  appels.mock.calls.map(([u]) => String(u)).filter((u) => u.includes("/admin/metrics") && !u.includes("export"));

const sorties = (appels: ReturnType<typeof vi.fn>): string[] =>
  appels.mock.calls.map(([u]) => String(u)).filter((u) => u.includes("/admin/metrics/export"));

async function ouvrir(role: "admin" | "support" = "admin") {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role, email: "sam@lehno.app" });
  render(<App />);
  const utilisateur = userEvent.setup({ delay: null });
  await utilisateur.click(within(screen.getByRole("navigation")).getByText(t.sections.metriques));
  return utilisateur;
}

describe("les métriques à l'écran", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.stubGlobal("URL", Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:essai"),
      revokeObjectURL: vi.fn(),
    }));
  });

  it("rend les trois rangs que le serveur sait mesurer", async () => {
    serveur();
    await ouvrir();

    await screen.findByText(t.metriques.retention.titre);
    expect(screen.getByText(t.metriques.conversion.titre)).toBeTruthy();
    expect(screen.getByText(t.metriques.consommation.titre)).toBeTruthy();
  });

  // « Choisir la période » (ux-admin §5.11). Sans que la requête l'emporte, le
  // sélecteur changerait l'étiquette sans changer les chiffres — et personne ne
  // saurait que la page ment.
  it("emporte la période choisie dans la requête", async () => {
    const appels = serveur();
    const utilisateur = await ouvrir();
    await screen.findByText(t.metriques.retention.titre);

    await utilisateur.selectOptions(
      screen.getByLabelText(t.metriques.periode),
      "90j",
    );

    await waitFor(() => expect(lectures(appels).some((u) => u.includes("periode=90j"))).toBe(true));
  });

  // Zéro dirait « le jour même ». Les deux valeurs existent et ne disent pas la
  // même chose : le contrat les distingue, l'écran doit suivre.
  it("dit que personne n'a acheté plutôt que d'afficher zéro jour", async () => {
    serveur(METRIQUES({
      conversion: { comptes: 40, acheteurs: 0, delaiMedianJours: null, parPalier: [] },
    }));
    await ouvrir();

    await screen.findByText(t.metriques.conversion.sansDelai);
    expect(screen.queryByText(t.metriques.conversion.jours.replace("{n}", "0"))).toBeNull();
  });

  // Le cœur de la section : trois contenus de §5.11 n'ont pas de source. Un rang
  // vide se prendrait pour une mesure à zéro (écart H).
  it("nomme ce qu'il ne sait pas encore mesurer", async () => {
    serveur();
    await ouvrir();

    await screen.findByText(t.metriques.manques.titre);
    for (const manque of [
      t.metriques.manques.usage_par_fonctionnalite.quoi,
      t.metriques.manques.issue_des_actions.quoi,
      t.metriques.manques.contributions.quoi,
    ]) expect(screen.getByText(manque)).toBeTruthy();
  });

  it("ne montre pas ce rang le jour où plus rien ne manque", async () => {
    serveur(METRIQUES({ manques: [] }));
    await ouvrir();

    await screen.findByText(t.metriques.retention.titre);
    expect(screen.queryByText(t.metriques.manques.titre)).toBeNull();
  });

  // Voir une liste et pouvoir la sortir sont deux choses : §6 ouvre la lecture
  // au support, la décision du 27/08 lui ferme la sortie. On ne montre pas un
  // geste que le serveur refuserait.
  it("n'offre pas l'export au support", async () => {
    serveur();
    await ouvrir("support");

    await screen.findByText(t.metriques.retention.titre);
    expect(screen.queryByRole("button", { name: new RegExp(t.exporter.bouton, "i") })).toBeNull();
  });

  it("l'offre à l'administrateur, et la sortie emporte la période", async () => {
    const appels = serveur();
    const utilisateur = await ouvrir("admin");
    await screen.findByText(t.metriques.retention.titre);

    await utilisateur.selectOptions(screen.getByLabelText(t.metriques.periode), "7j");
    await utilisateur.click(screen.getByRole("button", { name: new RegExp(t.exporter.bouton, "i") }));

    await waitFor(() => expect(sorties(appels).some((u) => u.includes("periode=7j"))).toBe(true));
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";
import { allerA } from "./aide-navigation.js";

const t = messages("fr");
const d = t.transactionsStats;

const STATS = (over: Record<string, unknown> = {}) => ({
  periode: "30j", sens: "tous", mode: "tous",
  tentatives: 120, aboutis: 110, encaisse: 110000, frais: 4200, median: 1000,
  jours: [{ jour: "2026-08-29", encaisse: 4000, echoue: 500 }],
  parMoyen: [{ cle: "mobile_money", tentatives: 100, aboutis: 92 }],
  parPays: [{ cle: "CM", tentatives: 100, aboutis: 92 }],
  ...over,
});

const reponse = (statut: number, corps?: unknown): Response =>
  new Response(corps === undefined ? null : JSON.stringify(corps), {
    status: statut,
    ...(corps === undefined ? {} : { headers: { "content-type": "application/json" } }),
  });

function serveur(donnees: ReturnType<typeof STATS> = STATS()) {
  const appels = vi.fn((url: string, _init?: RequestInit) => {
    if (String(url).includes("/admin/payment-stats")) return Promise.resolve(reponse(200, donnees));
    return Promise.resolve(reponse(200, { alertes: [], indicateurs: [], aTraiter: [] }));
  });
  vi.stubGlobal("fetch", appels);
  return appels;
}

const lectures = (appels: ReturnType<typeof vi.fn>): string[] =>
  appels.mock.calls.map(([u]) => String(u)).filter((u) => u.includes("/admin/payment-stats"));

async function ouvrir() {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role: "admin", email: "sam@lehno.app" });
  render(<App />);
  const utilisateur = userEvent.setup({ delay: null });
  await allerA(utilisateur, "transactionsStats");
  return utilisateur;
}

describe("les statistiques des transactions", () => {
  beforeEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

  it("rend les quatre chiffres de tête", async () => {
    serveur();
    await ouvrir();

    await screen.findByText(d.cartes.aboutis);
    /* Borné aux cartes : « Encaissé » nomme aussi une série du graphe, dans la
       table que le lecteur d'écran lit. Chercher dans tout le document
       trouverait les deux. */
    const cartes = screen.getByText(d.cartes.aboutis).closest(".admin-section-cartes") as HTMLElement;
    expect(within(cartes).getByText(d.cartes.encaisse)).toBeInTheDocument();
    expect(screen.getByText(d.cartes.frais)).toBeInTheDocument();
    expect(screen.getByText(d.cartes.panier)).toBeInTheDocument();
  });

  /* Un ratio se retient là où un pourcentage se survole : dix échecs sur cent
     vingt tentatives, c'est « un sur douze ». */
  it("dit l'échec en ratio, pas en pourcentage", async () => {
    serveur();
    await ouvrir();

    await screen.findByText(d.cartes.aboutisRatio.replace("{n}", "12"));
  });

  // « Un sur l'infini » n'est pas une phrase.
  it("dit qu'il n'y a aucun échec plutôt que de diviser par zéro", async () => {
    serveur(STATS({ tentatives: 100, aboutis: 100 }));
    await ouvrir();

    await screen.findByText(d.cartes.aucunEchec);
  });

  /* Nul n'est pas zéro : « aucun paiement n'a abouti » et « le paiement médian
     vaut zéro franc » sont deux nouvelles opposées. */
  it("dit qu'aucun paiement n'a abouti plutôt que d'annoncer zéro franc", async () => {
    serveur(STATS({ median: null, aboutis: 0, encaisse: 0 }));
    await ouvrir();

    await screen.findByText(d.cartes.sansPanier);
  });

  // ——— Les trois axes ———

  it("emporte la période choisie dans la requête", async () => {
    const appels = serveur();
    const utilisateur = await ouvrir();
    await screen.findByText(d.cartes.aboutis);

    await utilisateur.selectOptions(screen.getByLabelText(d.graphe.periodeLabel), "7j");

    await waitFor(() => expect(lectures(appels).some((u) => u.includes("periode=7j"))).toBe(true));
  });

  it("emporte le sens et le mode", async () => {
    const appels = serveur();
    const utilisateur = await ouvrir();
    await screen.findByText(d.cartes.aboutis);

    await utilisateur.selectOptions(screen.getByLabelText(d.graphe.typeLabel), "retrait");
    await utilisateur.selectOptions(screen.getByLabelText(d.graphe.modeLabel), "manuel");

    await waitFor(() => {
      const derniere = lectures(appels).at(-1) ?? "";
      expect(derniere).toContain("sens=retrait");
      expect(derniere).toContain("mode=manuel");
    });
  });

  /* La mention nomme la coupe active. Sans elle, le graphe cesse de dire ce
     qu'il montre dès qu'on a touché un axe — et deux lectures d'une même page
     se ressemblent alors trait pour trait. */
  it("nomme la coupe qu'il montre", async () => {
    serveur(STATS({ periode: "7j", sens: "depot", mode: "manuel" }));
    await ouvrir();

    await screen.findByText(
      d.graphe.coupe
        .replace("{periode}", d.graphe.periodes["7j"])
        .replace("{sens}", d.graphe.types.depot)
        .replace("{mode}", d.graphe.modes.manuel),
    );
  });

  // ——— Les deux ventilations ———

  it("rend le taux d'aboutissement par moyen et par pays", async () => {
    serveur();
    await ouvrir();

    await screen.findByText(d.parMoyen);
    expect(screen.getByText(d.moyens.mobile_money)).toBeInTheDocument();
    expect(screen.getByText("CM")).toBeInTheDocument();
    // 92 sur 100.
    expect(screen.getAllByText("92 %").length).toBeGreaterThan(0);
  });

  // Un groupe sans tentative n'a pas de taux : « 0 % » se lirait « rien
  // n'aboutit », ce qui est une mesure — et elle serait fausse.
  it("n'annonce pas zéro pour cent sur un groupe sans tentative", async () => {
    serveur(STATS({ parPays: [{ cle: "CI", tentatives: 0, aboutis: 0 }] }));
    await ouvrir();

    await screen.findByText(d.parPays);
    const tables = screen.getAllByRole("table");
    const paysTable = tables.at(-1) as HTMLElement;
    expect(within(paysTable).getByText("—")).toBeInTheDocument();
  });
});

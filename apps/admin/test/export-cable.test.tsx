import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";
import { allerA } from "./aide-navigation.js";

const t = messages("fr");

const LIGNE = (n: number, over: Record<string, unknown> = {}) => ({
  id: `u-${n}`, pseudo: `compte${n}`, email: `c${n}@exemple.cm`,
  etat: "actif", credits: 0, inscritLe: "2026-01-01T09:00:00.000Z", ...over,
});

const PAIEMENT = {
  id: "p-1", utilisateur: "awa", mode: "manual", etat: "pending",
  montant: 1000, devise: "XAF", credits: 10, methode: null,
  attenduSurLeCompte: null, recuSurLeCompte: null, ecart: null,
  creeLe: "2026-08-20T09:00:00.000Z",
};

const MOUVEMENT = {
  id: "m-1", utilisateur: "awa", type: "grant", source: "signup_grant",
  montant: 5, paiementId: null, note: null, creeLe: "2026-08-20T09:00:00.000Z",
};

const reponse = (statut: number, corps?: unknown, texte?: string): Response =>
  new Response(texte ?? (corps === undefined ? null : JSON.stringify(corps)), {
    status: statut,
    headers: texte
      ? { "content-type": "text/csv; charset=utf-8" }
      : (corps === undefined ? {} : { "content-type": "application/json" }),
  });

function serveur(routes: Record<string, (url: string, init?: RequestInit) => Response> = {}) {
  const table: Record<string, (url: string, init?: RequestInit) => Response> = {
    "/admin/users/export": () => reponse(200, undefined, "pseudo,email\n\"compte1\",\"c1@exemple.cm\""),
    "/admin/payments/export": () => reponse(200, undefined, "date,utilisateur\n\"2026\",\"awa\""),
    "/admin/credit-transactions/export": () => reponse(200, undefined, "date,utilisateur\n\"2026\",\"awa\""),
    "/admin/users": () => reponse(200, { items: [LIGNE(1)], nextCursor: null }),
    "/admin/payments": () => reponse(200, { items: [PAIEMENT], nextCursor: null }),
    "/admin/credit-transactions": () => reponse(200, { items: [MOUVEMENT], nextCursor: null }),
    ...routes,
  };
  const chemins = Object.keys(table).sort((a, b) => b.length - a.length);
  const appels = vi.fn((url: string, init?: RequestInit) => {
    for (const chemin of chemins) {
      if (url.includes(chemin)) return Promise.resolve(table[chemin]!(url, init));
    }
    return Promise.resolve(reponse(200, { alertes: [], indicateurs: [], aTraiter: [] }));
  });
  vi.stubGlobal("fetch", appels);
  return appels;
}

const sorties = (appels: ReturnType<typeof vi.fn>, chemin: string): string[] =>
  appels.mock.calls
    .filter(([u, i]) => String(u).includes(chemin) && (i as RequestInit)?.method === "POST")
    .map(([u]) => String(u));

async function ouvrir(section: string, role: "admin" | "support" = "admin") {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role, email: "sam@lehno.app" });
  render(<App />);
  const utilisateur = userEvent.setup({ delay: null });
  await allerA(utilisateur, section);
  return utilisateur;
}

/**
 * « Les listes filtrées s'exportent, pour l'analyse ou la conformité »
 * (ux-admin §7). Le journal et les connexions le faisaient déjà ; les comptes,
 * les paiements et les mouvements de crédits sont ce qu'on demande le jour d'un
 * contrôle, et n'avaient rien.
 */

describe("l'export emporte la sélection affichée", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    // jsdom n'implémente ni la création d'URL d'objet ni le clic de
    // téléchargement : on les remplace pour que le geste aille au bout.
    vi.stubGlobal("URL", Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:essai"),
      revokeObjectURL: vi.fn(),
    }));
  });

  it("sort les comptes, sans filtre quand rien n'est filtré", async () => {
    const appels = serveur();
    const utilisateur = await ouvrir("comptes");
    await screen.findByText("compte1");

    await utilisateur.click(screen.getByRole("button", { name: new RegExp(t.exporter.bouton, "i") }));

    await waitFor(() => expect(sorties(appels, "/admin/users/export")).toHaveLength(1));
  });

  // Le cœur de l'affaire : sans les filtres dans la requête, on exporterait la
  // table entière en croyant exporter ce qu'on regarde.
  it("emporte le filtre d'état des comptes", async () => {
    const appels = serveur();
    const utilisateur = await ouvrir("comptes");
    await screen.findByText("compte1");

    await utilisateur.selectOptions(
      screen.getByLabelText(t.comptes.filtreEtat),
      t.etats.suspendu,
    );
    await waitFor(() => expect(screen.getByLabelText(t.comptes.filtreEtat)).toHaveValue("suspendu"));
    await utilisateur.click(screen.getByRole("button", { name: new RegExp(t.exporter.bouton, "i") }));

    await waitFor(() => {
      const url = sorties(appels, "/admin/users/export")[0] ?? "";
      expect(url).toContain("status=suspended");
    });
  });

  it("emporte le filtre d'état des paiements", async () => {
    const appels = serveur();
    const utilisateur = await ouvrir("credits");
    await screen.findByText("awa");

    await utilisateur.selectOptions(
      screen.getByLabelText(t.credits.paiements.filtreEtat),
      "succeeded",
    );
    await utilisateur.click(screen.getByRole("button", { name: new RegExp(t.exporter.bouton, "i") }));

    await waitFor(() => {
      const url = sorties(appels, "/admin/payments/export")[0] ?? "";
      expect(url).toContain("etat=succeeded");
    });
  });

  it("sort les mouvements depuis leur onglet", async () => {
    const appels = serveur();
    const utilisateur = await ouvrir("credits");
    await utilisateur.click(screen.getByRole("tab", { name: t.credits.onglets.mouvements }));
    await screen.findByText("awa");

    await utilisateur.click(screen.getByRole("button", { name: new RegExp(t.exporter.bouton, "i") }));

    await waitFor(() => expect(sorties(appels, "/admin/credit-transactions/export")).toHaveLength(1));
  });

  // On ne montre pas un geste que le serveur refuserait. « Aucun export pour le
  // support » vaut pour les cinq listes — décision du 27/08 : voir une liste et
  // pouvoir la sortir sont deux choses.
  it("n'offre pas l'export des comptes au support", async () => {
    serveur();
    await ouvrir("comptes", "support");
    await screen.findByText("compte1");

    expect(screen.queryByRole("button", { name: new RegExp(t.exporter.bouton, "i") })).toBeNull();
  });

  it("n'offre pas l'export des crédits au support", async () => {
    serveur();
    await ouvrir("credits", "support");
    await screen.findByText("awa");

    expect(screen.queryByRole("button", { name: new RegExp(t.exporter.bouton, "i") })).toBeNull();
  });

  // Les connexions étaient le seul export ouvert au support, au motif que sa
  // liste l'est. C'était l'incohérence, et elle est levée.
  it("n'offre pas l'export des connexions au support", async () => {
    serveur({ "/admin/login-activity": () => reponse(200, { items: [], nextCursor: null }) });
    await ouvrir("connexions", "support");

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: new RegExp(t.exporter.bouton, "i") })).toBeNull();
    });
  });

  it("l'offre encore à l'administrateur", async () => {
    serveur({ "/admin/login-activity": () => reponse(200, { items: [], nextCursor: null }) });
    await ouvrir("connexions", "admin");

    expect(await screen.findByRole("button", { name: new RegExp(t.exporter.bouton, "i") })).toBeInTheDocument();
  });

  it("dit le code du serveur quand l'export échoue", async () => {
    serveur({ "/admin/users/export": () => reponse(403, { code: "forbidden" }) });
    const utilisateur = await ouvrir("comptes");
    await screen.findByText("compte1");

    await utilisateur.click(screen.getByRole("button", { name: new RegExp(t.exporter.bouton, "i") }));

    expect(await screen.findByText(t.codes.forbidden)).toBeInTheDocument();
  });
});

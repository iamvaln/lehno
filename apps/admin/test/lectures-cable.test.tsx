import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";

const t = messages("fr");

const JOURNAL = {
  items: [
    {
      id: "a-1", date: "2026-08-25T09:00:00.000Z", acteurType: "admin",
      acteurId: "ad-1", action: "user_status_update", motif: "Compte signalé trois fois",
      cibleType: "user", cibleId: "u-1", details: { from: "active", to: "suspended" },
    },
    {
      id: "a-2", date: "2026-08-24T09:00:00.000Z", acteurType: "user",
      acteurId: "u-9", action: "account_deletion_requested", motif: null,
      cibleType: null, cibleId: null, details: null,
    },
  ],
  nextCursor: "a-2",
};

const CONNEXIONS = {
  items: [
    { id: "c-1", date: "2026-08-25T09:00:00.000Z", compte: "awa", adresseTentee: "awa@exemple.cm", resultat: "success", appareil: "Chrome — macOS", lieu: "Douala, CM" },
    { id: "c-2", date: "2026-08-25T08:00:00.000Z", compte: null, adresseTentee: "inconnu@exemple.cm", resultat: "failure", appareil: null, lieu: null },
  ],
  nextCursor: null,
};

const reponse = (statut: number, corps?: unknown): Response =>
  new Response(corps === undefined ? null : JSON.stringify(corps), {
    status: statut,
    headers: corps === undefined ? {} : { "content-type": "application/json" },
  });

function serveur(routes: Record<string, (url: string) => Response>) {
  const appels = vi.fn((url: string) => {
    for (const [chemin, rendre] of Object.entries(routes)) {
      if (url.includes(chemin)) return Promise.resolve(rendre(url));
    }
    return Promise.resolve(reponse(200, { alertes: [], indicateurs: [], aTraiter: [] }));
  });
  vi.stubGlobal("fetch", appels);
  return appels;
}

async function aller(utilisateur: ReturnType<typeof userEvent.setup>, section: string) {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role: "admin" });
  render(<App />);
  await utilisateur.click(within(screen.getByRole("navigation")).getByText(section));
}

const ROUTES = {
  "/admin/audit-log": () => reponse(200, JOURNAL),
  "/admin/login-activity": () => reponse(200, CONNEXIONS),
};

describe("le journal d'audit", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("lit les traces auprès du serveur", async () => {
    const utilisateur = userEvent.setup();
    const appels = serveur(ROUTES);
    await aller(utilisateur, t.sections.audit);

    expect(await screen.findByText("Compte signalé trois fois")).toBeInTheDocument();
    expect(appels.mock.calls.some(([u]) => String(u).includes("/admin/audit-log"))).toBe(true);
  });

  // Une trace qui fait foi ne se modifie ni ne s'efface. Un menu d'actions ici
  // serait une promesse que le serveur ne tient pas — et ne doit pas tenir.
  it("n'offre aucun geste sur une trace", async () => {
    const utilisateur = userEvent.setup();
    serveur(ROUTES);
    await aller(utilisateur, t.sections.audit);
    await screen.findByText("Compte signalé trois fois");

    expect(screen.queryAllByRole("button", { name: t.table.actions })).toHaveLength(0);
  });

  // Un utilisateur agissant chez lui n'a rien à justifier ; un administrateur,
  // si. L'absence de motif se dit, elle ne se rend pas par une case vide qu'on
  // prendrait pour un oubli.
  it("dit l'absence de motif au lieu de laisser une case vide", async () => {
    const utilisateur = userEvent.setup();
    serveur(ROUTES);
    await aller(utilisateur, t.sections.audit);
    await screen.findByText("Compte signalé trois fois");

    expect(screen.getByText(t.journal.sansMotif)).toBeInTheDocument();
  });

  it("suit le curseur du serveur", async () => {
    const utilisateur = userEvent.setup();
    const appels = serveur({
      "/admin/audit-log": (url) => reponse(200, url.includes("cursor=a-2")
        ? { items: [{ ...JOURNAL.items[0], id: "a-3", motif: "Deuxième page" }], nextCursor: null }
        : JOURNAL),
      "/admin/login-activity": () => reponse(200, CONNEXIONS),
    });
    await aller(utilisateur, t.sections.audit);
    await screen.findByText("Compte signalé trois fois");

    await utilisateur.click(screen.getByRole("button", { name: t.table.suivant }));

    expect(await screen.findByText("Deuxième page")).toBeInTheDocument();
    expect(appels.mock.calls.some(([u]) => String(u).includes("cursor=a-2"))).toBe(true);
  });
});

describe("les connexions", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("lit les tentatives auprès du serveur", async () => {
    const utilisateur = userEvent.setup();
    const appels = serveur(ROUTES);
    await aller(utilisateur, t.sections.connexions);

    expect(await screen.findByText("Douala, CM")).toBeInTheDocument();
    expect(appels.mock.calls.some(([u]) => String(u).includes("/admin/login-activity"))).toBe(true);
  });

  // C'est l'adresse tentée qui montre qu'on essaie mille adresses à la suite.
  // La masquer parce qu'aucun compte n'y correspond reviendrait à cacher
  // exactement ce qu'on vient regarder.
  it("montre l'adresse tentée même sans compte derrière", async () => {
    const utilisateur = userEvent.setup();
    serveur(ROUTES);
    await aller(utilisateur, t.sections.connexions);

    expect(await screen.findByText("inconnu@exemple.cm")).toBeInTheDocument();
  });

  // La spécification technique §9 dit que l'adresse IP ne descend pas en base.
  // Le paquet de passation en annonçait une : ce test tient la décision.
  it("n'affiche aucune colonne d'adresse IP", async () => {
    const utilisateur = userEvent.setup();
    serveur(ROUTES);
    await aller(utilisateur, t.sections.connexions);
    await screen.findByText("Douala, CM");

    for (const entete of screen.getAllByRole("columnheader")) {
      expect(entete.textContent ?? "").not.toMatch(/\bIP\b/i);
    }
  });
});

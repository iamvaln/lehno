import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";

const t = messages("fr");

const TRACE = {
  id: "a-1", date: "2026-08-26T09:00:00.000Z", acteurType: "admin",
  acteurId: "ad-1", action: "user_status_update", motif: "Compte signalé",
  cibleType: "user", cibleId: "u-1", details: null,
};

const CONNEXION = {
  id: "c-1", date: "2026-08-26T09:00:00.000Z", compte: "awa",
  adresseTentee: "awa@exemple.cm", resultat: "success",
  appareil: "Chrome — macOS", lieu: "Douala, CM",
};

const reponse = (statut: number, corps?: unknown, entetes?: Record<string, string>): Response =>
  new Response(corps === undefined ? null : (typeof corps === "string" ? corps : JSON.stringify(corps)), {
    status: statut,
    headers: { ...(corps === undefined ? {} : { "content-type": "application/json" }), ...entetes },
  });

function serveur(routes: Record<string, (url: string, init?: RequestInit) => Response> = {}) {
  const parDefaut: Record<string, (url: string, init?: RequestInit) => Response> = {
    "/admin/audit-log/export": () => reponse(200, "date,action\n\"x\",\"y\"", { "content-type": "text/csv" }),
    "/admin/login-activity/export": () => reponse(200, "date,compte\n\"x\",\"y\"", { "content-type": "text/csv" }),
    "/admin/audit-log": () => reponse(200, { items: [TRACE], nextCursor: null }),
    "/admin/login-activity": () => reponse(200, { items: [CONNEXION], nextCursor: null }),
  };
  const table = { ...parDefaut, ...routes };
  const appels = vi.fn((url: string, init?: RequestInit) => {
    for (const [chemin, rendre] of Object.entries(table)) {
      if (url.includes(chemin)) return Promise.resolve(rendre(url, init));
    }
    return Promise.resolve(reponse(200, { alertes: [], indicateurs: [], aTraiter: [] }));
  });
  vi.stubGlobal("fetch", appels);
  return appels;
}

const urlsVers = (appels: ReturnType<typeof vi.fn>, chemin: string): string[] =>
  appels.mock.calls.map(([u]) => String(u)).filter((u) => u.includes(chemin));

async function aller(utilisateur: ReturnType<typeof userEvent.setup>, section: string, role: "admin" | "support" = "admin") {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role });
  render(<App />);
  await utilisateur.click(within(screen.getByRole("navigation")).getByText(section));
}

describe("les filtres et l'export des deux lectures", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    // Le téléchargement s'appuie sur ces deux-là, absents de jsdom.
    vi.stubGlobal("URL", Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:essai"),
      revokeObjectURL: vi.fn(),
    }));
  });

  // ─── Le journal d'audit ────────────────────────────────────────────────────

  // « Rechercher, filtrer par auteur, par période, par nature » (§5.12). Le
  // serveur les acceptait déjà ; l'écran n'en proposait aucun.
  it("filtrer par nature part au serveur", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur();
    await aller(utilisateur, t.sections.audit);
    await screen.findByText("Compte signalé");

    await utilisateur.selectOptions(screen.getByLabelText(t.journal.filtres.action), "parameter_update");

    await waitFor(() => expect(
      urlsVers(appels, "/admin/audit-log").some((u) => u.includes("action=parameter_update")),
    ).toBe(true));
  });

  it("filtrer par période part au serveur", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur();
    await aller(utilisateur, t.sections.audit);
    await screen.findByText("Compte signalé");

    await utilisateur.selectOptions(screen.getByLabelText(t.journal.filtres.periode), "7");

    await waitFor(() => expect(
      urlsVers(appels, "/admin/audit-log").some((u) => u.includes("since=")),
    ).toBe(true));
  });

  // Un filtre posé puis oublié fait lire une liste partielle en la croyant
  // complète. La remise à zéro se voit dès qu'un filtre est actif.
  it("la remise à zéro n'apparaît qu'une fois un filtre posé", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await aller(utilisateur, t.sections.audit);
    await screen.findByText("Compte signalé");

    expect(screen.queryByRole("button", { name: t.table.reinitialiser })).not.toBeInTheDocument();

    await utilisateur.selectOptions(screen.getByLabelText(t.journal.filtres.action), "parameter_update");

    expect(await screen.findByRole("button", { name: t.table.reinitialiser })).toBeInTheDocument();
  });

  // Sinon on chercherait les paramètres à partir du centième geste, et les
  // premiers resteraient invisibles.
  it("un nouveau filtre repart de la première page", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur({
      "/admin/audit-log": (url) => reponse(200, url.includes("cursor=")
        ? { items: [{ ...TRACE, id: "a-3", motif: "Deuxième page" }], nextCursor: null }
        : { items: [TRACE], nextCursor: "a-1" }),
    });
    await aller(utilisateur, t.sections.audit);
    await screen.findByText("Compte signalé");
    await utilisateur.click(screen.getByRole("button", { name: t.table.suivant }));
    await screen.findByText("Deuxième page");

    await utilisateur.selectOptions(screen.getByLabelText(t.journal.filtres.action), "parameter_update");

    await waitFor(() => {
      const avecFiltre = urlsVers(appels, "/admin/audit-log").filter((u) => u.includes("action=parameter_update"));
      expect(avecFiltre.length).toBeGreaterThan(0);
      for (const url of avecFiltre) expect(url).not.toContain("cursor=");
    });
  });

  // ─── L'export ──────────────────────────────────────────────────────────────

  it("exporter appelle le serveur", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur();
    await aller(utilisateur, t.sections.audit);
    await screen.findByText("Compte signalé");

    await utilisateur.click(screen.getByRole("button", { name: new RegExp(t.exporter.bouton) }));

    await waitFor(() => expect(
      appels.mock.calls.some(([u, i]) =>
        String(u).includes("/admin/audit-log/export") && (i as RequestInit)?.method === "POST"),
    ).toBe(true));
  });

  // « Les listes FILTRÉES s'exportent » : sortir tout quand on regarde une
  // semaine serait un autre geste, et le fichier ne dirait pas lequel.
  it("l'export emporte les filtres de la liste", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur();
    await aller(utilisateur, t.sections.audit);
    await screen.findByText("Compte signalé");
    await utilisateur.selectOptions(screen.getByLabelText(t.journal.filtres.action), "parameter_update");

    await utilisateur.click(screen.getByRole("button", { name: new RegExp(t.exporter.bouton) }));

    await waitFor(() => expect(
      urlsVers(appels, "/admin/audit-log/export").some((u) => u.includes("action=parameter_update")),
    ).toBe(true));
  });

  // Le fichier arrive tout de suite. La copie promettait un courriel : il
  // n'existe ni file d'attente ni envoi de pièce jointe, et annoncer un
  // courriel qui n'arrive jamais est pire qu'un téléchargement.
  it("le fichier se télécharge, il ne s'annonce pas par courriel", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await aller(utilisateur, t.sections.audit);
    await screen.findByText("Compte signalé");

    await utilisateur.click(screen.getByRole("button", { name: new RegExp(t.exporter.bouton) }));

    expect(await screen.findByText(t.exporter.telecharge)).toBeInTheDocument();
    expect(screen.queryByText(/courriel/i)).not.toBeInTheDocument();
  });

  it("un export refusé le dit, plutôt que de laisser croire qu'il est parti", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur({
      "/admin/audit-log/export": () => reponse(500, { code: "internal_error", message: "boom" }),
    });
    await aller(utilisateur, t.sections.audit);
    await screen.findByText("Compte signalé");

    await utilisateur.click(screen.getByRole("button", { name: new RegExp(t.exporter.bouton) }));

    expect(await screen.findByText(t.codes.internal_error)).toBeInTheDocument();
  });

  // ─── Les connexions ────────────────────────────────────────────────────────

  it("les connexions se filtrent par résultat", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur();
    await aller(utilisateur, t.sections.connexions);
    await screen.findByText("Douala, CM");

    await utilisateur.selectOptions(screen.getByLabelText(t.entrees.filtres.resultat), "failure");

    await waitFor(() => expect(
      urlsVers(appels, "/admin/login-activity").some((u) => u.includes("result=failure")),
    ).toBe(true));
  });

  it("les connexions s'exportent aussi", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur();
    await aller(utilisateur, t.sections.connexions);
    await screen.findByText("Douala, CM");

    await utilisateur.click(screen.getByRole("button", { name: new RegExp(t.exporter.bouton) }));

    await waitFor(() => expect(
      urlsVers(appels, "/admin/login-activity/export").length,
    ).toBeGreaterThan(0));
  });

  // Le journal est réservé aux administrateurs : son export l'est aussi, et
  // l'écran ne doit pas proposer un geste que le serveur refusera.
  it("le support ne voit pas le bouton d'export du journal", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await aller(utilisateur, t.sections.connexions, "support");
    await screen.findByText("Douala, CM");

    // Les connexions lui sont ouvertes : le bouton y est.
    expect(screen.getByRole("button", { name: new RegExp(t.exporter.bouton) })).toBeInTheDocument();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";

const t = messages("fr");

const CATALOGUE = {
  items: [
    { id: "m-1", fournisseur: "anthropic", modele: "claude-opus-5", rang: 1, actif: true, coutEntree: 3, coutSortie: 15, misAJourLe: "2026-08-20T09:00:00.000Z" },
    { id: "m-2", fournisseur: "deepseek", modele: "deepseek-chat", rang: 2, actif: true, coutEntree: null, coutSortie: null, misAJourLe: "2026-08-20T09:00:00.000Z" },
  ],
};

const reponse = (statut: number, corps?: unknown): Response =>
  new Response(corps === undefined ? null : JSON.stringify(corps), {
    status: statut,
    headers: corps === undefined ? {} : { "content-type": "application/json" },
  });

function serveur(routes: Record<string, (url: string, init?: RequestInit) => Response>) {
  const appels = vi.fn((url: string, init?: RequestInit) => {
    for (const [chemin, rendre] of Object.entries(routes)) {
      if (url.includes(chemin)) return Promise.resolve(rendre(url, init));
    }
    return Promise.resolve(reponse(200, { alertes: [], indicateurs: [], aTraiter: [] }));
  });
  vi.stubGlobal("fetch", appels);
  return appels;
}

const ecritures = (appels: ReturnType<typeof vi.fn>) =>
  appels.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "PATCH");

async function ouvrir(utilisateur: ReturnType<typeof userEvent.setup>, role: "admin" | "support" = "admin") {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role });
  render(<App />);
  await utilisateur.click(within(screen.getByRole("navigation")).getByText(t.sections.modeles));
}

describe("les modèles d'IA", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("lit le catalogue auprès du serveur", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur({ "/admin/ai-models": () => reponse(200, CATALOGUE) });
    await ouvrir(utilisateur);

    expect(await screen.findByText("claude-opus-5")).toBeInTheDocument();
    expect(appels.mock.calls.some(([u]) => String(u).includes("/admin/ai-models"))).toBe(true);
  });

  // Le rang est l'ordre dans lequel on essaie. L'afficher sans le dire
  // laisserait croire à une note ou à une préférence.
  it("montre l'ordre de repli, du premier essayé au dernier", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur({ "/admin/ai-models": () => reponse(200, CATALOGUE) });
    await ouvrir(utilisateur);
    await screen.findByText("claude-opus-5");

    const lignes = screen.getAllByRole("row").slice(1);
    expect(lignes[0]).toHaveTextContent("claude-opus-5");
    expect(lignes[1]).toHaveTextContent("deepseek-chat");
  });

  // Un coût absent n'est pas un coût nul : c'est un modèle qu'on n'a pas encore
  // tarifé. Afficher « 0 » le ferait passer pour gratuit dans un calcul de
  // marge.
  it("dit qu'un coût manque au lieu d'afficher zéro", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur({ "/admin/ai-models": () => reponse(200, CATALOGUE) });
    await ouvrir(utilisateur);
    await screen.findByText("deepseek-chat");

    const ligne = screen.getByText("deepseek-chat").closest("tr");
    expect(within(ligne as HTMLElement).getAllByText(t.modeles.sansCout).length).toBeGreaterThan(0);
    expect(within(ligne as HTMLElement).queryByText("0")).not.toBeInTheDocument();
  });

  it("éteindre un modèle demande un motif, et l'envoie", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur({
      "/admin/ai-models": (_url, init) => (init?.method === "PATCH"
        ? reponse(200, { id: "m-1", enabled: false })
        : reponse(200, CATALOGUE)),
    });
    await ouvrir(utilisateur);
    await screen.findByText("claude-opus-5");

    await utilisateur.click(screen.getAllByRole("button", { name: t.table.actions })[0] as HTMLElement);
    await utilisateur.click(await screen.findByRole("menuitem", { name: t.modeles.eteindre }));
    await utilisateur.selectOptions(
      screen.getByLabelText(t.confirmation.motif),
      t.modeles.dialogueEteindre.motifs[0] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    await waitFor(() => {
      expect(ecritures(appels)).toHaveLength(1);
      const corps = JSON.parse((ecritures(appels)[0]?.[1] as RequestInit).body as string);
      expect(corps).toEqual({ id: "m-1", enabled: false, reason: t.modeles.dialogueEteindre.motifs[0] });
    });
  });

  // Le serveur refuse d'éteindre le dernier modèle actif — couper toute
  // génération sans que rien ne le dise avant la première panne. L'écran doit
  // traduire ce refus, pas afficher « erreur interne ».
  it("traduit le refus d'éteindre le dernier modèle actif", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur({
      "/admin/ai-models": (_url, init) => (init?.method === "PATCH"
        ? reponse(422, { code: "validation_failed", message: "last enabled model" })
        : reponse(200, { items: [CATALOGUE.items[0]] })),
    });
    await ouvrir(utilisateur);
    await screen.findByText("claude-opus-5");

    await utilisateur.click(screen.getAllByRole("button", { name: t.table.actions })[0] as HTMLElement);
    await utilisateur.click(await screen.findByRole("menuitem", { name: t.modeles.eteindre }));
    await utilisateur.selectOptions(
      screen.getByLabelText(t.confirmation.motif),
      t.modeles.dialogueEteindre.motifs[0] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    expect(await screen.findByText(t.codes.validation_failed)).toBeInTheDocument();
  });

  // « Le rôle support n'a accès à aucune section de la famille Économie »
  // (brief §2), et une section fermée ne figure pas dans son menu.
  it("reste hors de portée du support", async () => {
    localStorage.clear();
    magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role: "support" });
    serveur({ "/admin/ai-models": () => reponse(200, CATALOGUE) });
    render(<App />);

    expect(within(screen.getByRole("navigation")).queryByText(t.sections.modeles)).not.toBeInTheDocument();
  });
});

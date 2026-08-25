import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";

const t = messages("fr");

const FILE = {
  items: [
    { id: "u-1", compte: "awa", demandeeLe: "2026-08-01T09:00:00.000Z", echeance: "2026-08-31T09:00:00.000Z", joursRestants: 6, etat: "en_cours" },
    { id: "u-2", compte: "valery", demandeeLe: "2026-07-01T09:00:00.000Z", echeance: "2026-07-31T09:00:00.000Z", joursRestants: -25, etat: "echue" },
  ],
  nextCursor: null,
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

async function ouvrirSuppressions(utilisateur: ReturnType<typeof userEvent.setup>, role: "admin" | "support" = "admin") {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role });
  render(<App />);
  // La section ne figure pas au menu : c'est une file du « à traiter » du
  // tableau de bord, qui y mène (ux-admin §5.2).
  await utilisateur.click(within(screen.getByRole("navigation")).getByText(t.sections.tableau));
}

describe("les demandes de suppression, sur le serveur", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("lit la file auprès du serveur", async () => {
    const utilisateur = userEvent.setup();
    const appels = serveur({
      "/admin/dashboard": () => reponse(200, {
        alertes: [], indicateurs: [],
        aTraiter: [{ id: "f1", element: "Suppressions", section: "suppressions", etat: "en attente", depuis: "2 jours" }],
      }),
      "/admin/deletions": () => reponse(200, FILE),
    });
    await ouvrirSuppressions(utilisateur);
    await utilisateur.click(await screen.findByText("Suppressions"));

    expect(await screen.findByText("awa")).toBeInTheDocument();
    expect(appels.mock.calls.some(([u]) => String(u).includes("/admin/deletions"))).toBe(true);
  });

  // Les deux gestes du délai de grâce passent par le même chemin d'écriture que
  // tout changement d'état de compte : un second finirait par diverger, l'un
  // journalisant et l'autre non.
  it("effacer sans attendre passe par le changement d'état, avec son motif", async () => {
    const utilisateur = userEvent.setup();
    const appels = serveur({
      "/admin/dashboard": () => reponse(200, {
        alertes: [], indicateurs: [],
        aTraiter: [{ id: "f1", element: "Suppressions", section: "suppressions", etat: "en attente", depuis: "2 jours" }],
      }),
      "/admin/deletions": () => reponse(200, FILE),
      "/admin/users/u-1": () => reponse(200, { id: "u-1", status: "deleted" }),
    });
    await ouvrirSuppressions(utilisateur);
    await utilisateur.click(await screen.findByText("Suppressions"));
    await screen.findByText("awa");

    await utilisateur.click(screen.getAllByRole("button", { name: t.table.actions })[0] as HTMLElement);
    await utilisateur.click(await screen.findByRole("menuitem", { name: t.suppressions.effacer }));
    await utilisateur.selectOptions(
      screen.getByLabelText(t.confirmation.motif),
      t.suppressions.dialogueEffacer.motifs[0] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    await waitFor(() => {
      expect(ecritures(appels)).toHaveLength(1);
      const corps = JSON.parse((ecritures(appels)[0]?.[1] as RequestInit).body as string);
      expect(corps).toEqual({
        status: "deleted",
        reason: t.suppressions.dialogueEffacer.motifs[0],
      });
    });
  });

  it("restaurer remet le compte en service", async () => {
    const utilisateur = userEvent.setup();
    const appels = serveur({
      "/admin/dashboard": () => reponse(200, {
        alertes: [], indicateurs: [],
        aTraiter: [{ id: "f1", element: "Suppressions", section: "suppressions", etat: "en attente", depuis: "2 jours" }],
      }),
      "/admin/deletions": () => reponse(200, FILE),
      "/admin/users/u-1": () => reponse(200, { id: "u-1", status: "active" }),
    });
    await ouvrirSuppressions(utilisateur);
    await utilisateur.click(await screen.findByText("Suppressions"));
    await screen.findByText("awa");

    await utilisateur.click(screen.getAllByRole("button", { name: t.table.actions })[0] as HTMLElement);
    await utilisateur.click(await screen.findByRole("menuitem", { name: t.suppressions.restaurer }));
    await utilisateur.selectOptions(
      screen.getByLabelText(t.confirmation.motif),
      t.suppressions.dialogueRestaurer.motifs[0] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    await waitFor(() => {
      const corps = JSON.parse((ecritures(appels)[0]?.[1] as RequestInit).body as string);
      expect(corps.status).toBe("active");
    });
  });

  it("un échec de chargement se voit", async () => {
    const utilisateur = userEvent.setup();
    serveur({
      "/admin/dashboard": () => reponse(200, {
        alertes: [], indicateurs: [],
        aTraiter: [{ id: "f1", element: "Suppressions", section: "suppressions", etat: "en attente", depuis: "2 jours" }],
      }),
      "/admin/deletions": () => reponse(500, { code: "internal_error", message: "boom" }),
    });
    await ouvrirSuppressions(utilisateur);
    await utilisateur.click(await screen.findByText("Suppressions"));

    expect(await screen.findByText(t.echecs.chargement)).toBeInTheDocument();
  });
});

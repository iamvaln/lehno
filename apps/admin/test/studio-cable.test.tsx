import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";

const t = messages("fr");

const V2 = {
  id: "g-2", genre: "message", cle: "gratitude", version: 2,
  corps: "Écris trois phrases, et bannis les formules de carte de vœux.",
  gardeFous: null, modele: { id: "m-1", fournisseur: "anthropic", cle: "claude-opus-5" },
  actif: true, parQui: "sam@lehno.app", quand: "2026-08-22T14:02:00.000Z",
};
const V1 = {
  id: "g-1", genre: "message", cle: "gratitude", version: 1,
  corps: "Écris deux à quatre phrases à la première personne.",
  gardeFous: null, modele: null,
  actif: false, parQui: null, quand: "2026-08-20T09:41:00.000Z",
};
const AUTRE = {
  id: "g-3", genre: "illustration", cle: "aquarelle", version: 1,
  corps: "Une aquarelle claire, sans texte.",
  gardeFous: null, modele: null,
  actif: true, parQui: "dora@lehno.app", quand: "2026-08-18T09:41:00.000Z",
};

const CATALOGUE = { items: [V2, V1, AUTRE] };

const reponse = (statut: number, corps?: unknown): Response =>
  new Response(corps === undefined ? null : JSON.stringify(corps), {
    status: statut,
    headers: corps === undefined ? {} : { "content-type": "application/json" },
  });

function serveur(routes: Record<string, (url: string, init?: RequestInit) => Response> = {}) {
  const table: Record<string, (url: string, init?: RequestInit) => Response> = {
    "/admin/portrait-studio/templates": (_u, init) => (init && init.method !== "GET"
      ? reponse(200, { ...V1, actif: true })
      : reponse(200, CATALOGUE)),
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

async function ouvrirStudio(role: "admin" | "support" = "admin") {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role, email: "sam@lehno.app" });
  render(<App />);
  const utilisateur = userEvent.setup({ delay: null });
  await utilisateur.click(within(screen.getByRole("navigation")).getByText(t.sections.studio));
  return utilisateur;
}

const ecritures = (appels: ReturnType<typeof vi.fn>) =>
  appels.mock.calls.filter(([u, i]) =>
    String(u).includes("/admin/portrait-studio/templates/")
    && ((i as RequestInit)?.method ?? "GET") !== "GET");

/**
 * Le studio du portrait — ux-admin §5.9, entrée « réglages en service ».
 *
 * L'écran ne couvre pas les deux autres entrées : la composition suppose un
 * brouillon que le modèle n'a pas, le banc d'essai un fournisseur d'IA que rien
 * ne branche. Il le dit, plutôt que d'ouvrir des onglets vides.
 */
describe("le studio, sur les données du serveur", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("demande le catalogue des gabarits", async () => {
    const appels = serveur();
    await ouvrirStudio();

    await waitFor(() => {
      expect(appels.mock.calls.some(([u]) => String(u).includes("/admin/portrait-studio/templates"))).toBe(true);
    });
  });

  // Une seule version est en service par gabarit. L'écran raisonne par gabarit,
  // là où le serveur rend une liste plate de versions : sans ce regroupement,
  // « gratitude » paraîtrait deux fois et on ne saurait pas laquelle tourne.
  it("regroupe les versions par gabarit, une ligne chacune", async () => {
    serveur();
    await ouvrirStudio();

    const table = await screen.findByRole("table");
    // Deux gabarits, trois versions : deux lignes, plus l'en-tête.
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getByText("gratitude")).toBeInTheDocument();
    expect(within(table).getByText("aquarelle")).toBeInTheDocument();
  });

  it("dit quelle version tourne, et laquelle", async () => {
    serveur();
    await ouvrirStudio();

    const table = await screen.findByRole("table");
    expect(within(table).getByText(t.studio.version.replace("{n}", "2"))).toBeInTheDocument();
  });

  // Un modèle absent n'est pas un modèle inconnu : le gabarit s'en remet au
  // routage par priorité, et c'est un réglage, pas une lacune.
  it("dit le routage par priorité quand aucun modèle n'est nommé", async () => {
    serveur();
    await ouvrirStudio();

    const table = await screen.findByRole("table");
    expect(within(table).getAllByText(t.studio.parPriorite).length).toBeGreaterThan(0);
  });

  it("ouvre l'historique d'un gabarit", async () => {
    serveur();
    const utilisateur = await ouvrirStudio();

    await utilisateur.click(await screen.findByText("gratitude"));

    expect(await screen.findByText(t.studio.historique.replace("{cle}", "gratitude"))).toBeInTheDocument();
    expect(screen.getByText(V1.corps)).toBeInTheDocument();
  });

  it("remet une version antérieure en service, avec son motif", async () => {
    const appels = serveur();
    const utilisateur = await ouvrirStudio();

    await utilisateur.click(await screen.findByText("gratitude"));
    await utilisateur.click((await screen.findAllByRole("button", { name: t.table.actions }))[0] as HTMLElement);
    await utilisateur.click(await screen.findByRole("menuitem", { name: t.studio.revenir }));

    // Le motif rejoint le journal : sans lui, le geste ne dit pas pourquoi.
    await utilisateur.selectOptions(
      screen.getByLabelText(t.confirmation.motif),
      t.studio.dialogue.motifs[0] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    await waitFor(() => {
      const [url, init] = ecritures(appels)[0] ?? [];
      expect(String(url)).toContain("/admin/portrait-studio/templates/g-1");
      expect((init as RequestInit)?.method).toBe("PATCH");
      expect(JSON.parse(String((init as RequestInit)?.body))).toMatchObject({
        isActive: true,
        reason: t.studio.dialogue.motifs[0],
      });
    });
  });

  // Y « revenir » ne changerait rien, et l'offrir laisserait croire le contraire.
  it("n'offre pas de revenir à la version déjà en service", async () => {
    serveur();
    const utilisateur = await ouvrirStudio();

    await utilisateur.click(await screen.findByText("gratitude"));

    // Trois versions au tableau du haut et à l'historique, mais une seule ligne
    // porte un geste : celle qui n'est pas en service.
    await utilisateur.click((await screen.findAllByRole("button", { name: t.table.actions }))[0] as HTMLElement);
    expect(await screen.findByRole("menuitem", { name: t.studio.revenir })).toBeInTheDocument();
    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
  });

  it("dit le code du serveur quand la republication échoue", async () => {
    const appels = serveur({
      "/admin/portrait-studio/templates/": (_u, init) => (init && init.method !== "GET"
        ? reponse(409, { code: "conflict" })
        : reponse(200, CATALOGUE)),
    });
    const utilisateur = await ouvrirStudio();

    await utilisateur.click(await screen.findByText("gratitude"));
    await utilisateur.click((await screen.findAllByRole("button", { name: t.table.actions }))[0] as HTMLElement);
    await utilisateur.click(await screen.findByRole("menuitem", { name: t.studio.revenir }));
    await utilisateur.selectOptions(
      screen.getByLabelText(t.confirmation.motif),
      t.studio.dialogue.motifs[0] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    expect(await screen.findByText(t.codes.conflict)).toBeInTheDocument();
    // Et l'on relit : ce qui reste affiché vient du serveur, pas d'une
    // supposition faite de notre côté.
    await waitFor(() => {
      const lectures = appels.mock.calls.filter(([u, i]) =>
        String(u).includes("/admin/portrait-studio/templates")
        && ((i as RequestInit)?.method ?? "GET") === "GET");
      expect(lectures.length).toBeGreaterThan(1);
    });
  });

  // La section entière est fermée au support, y compris en lecture (§5.9). Le
  // menu ne la lui montre pas ; l'écran ne se demande donc jamais pour lui.
  it("n'est pas au menu du support", async () => {
    serveur();
    localStorage.clear();
    magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role: "support", email: "d@lehno.app" });
    render(<App />);

    expect(within(screen.getByRole("navigation")).queryByText(t.sections.studio)).toBeNull();
  });

  // Ce que la section ne couvre pas se dit, plutôt que de s'ouvrir en onglets
  // vides : un onglet vide se lit comme une panne, une phrase comme un état.
  it("dit ce qu'elle ne couvre pas encore", async () => {
    serveur();
    await ouvrirStudio();

    expect(await screen.findByText(t.studio.portee)).toBeInTheDocument();
  });
});

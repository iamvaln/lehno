import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";
import { profil as profilDemo } from "../src/fixtures/index.js";

const t = messages("fr");

const PROFIL = {
  email: "nadia@lehno.app",
  role: "admin",
  ajoutePar: "dora@lehno.app",
  derniereConnexion: "2026-08-20T09:00:00.000Z",
  sessions: [
    { id: "f-1", appareil: "Firefox — macOS", ip: "10.0.0.1", depuis: "2026-08-20T09:00:00.000Z", courante: true },
    { id: "f-2", appareil: null, ip: null, depuis: "2026-08-12T09:00:00.000Z", courante: false },
  ],
};

const reponse = (statut: number, corps?: unknown): Response =>
  new Response(corps === undefined ? null : JSON.stringify(corps), {
    status: statut,
    headers: corps === undefined ? {} : { "content-type": "application/json" },
  });

function serveur(routes: Record<string, (url: string, init?: RequestInit) => Response> = {}) {
  const table: Record<string, (url: string, init?: RequestInit) => Response> = {
    "/admin/me/sessions": () => reponse(200, { fermees: 1 }),
    "/admin/me": () => reponse(200, PROFIL),
    // En dernier, pour que la surcharge d'un test l'emporte sur le défaut.
    ...routes,
  };
  // Le chemin le plus long d'abord : la recherche se fait par `includes`, et
  // « /admin/me » attraperait sinon « /admin/me/sessions ».
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

async function ouvrirProfil() {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role: "admin", email: "nadia@lehno.app" });
  render(<App />);
  const utilisateur = userEvent.setup({ delay: null });
  // « Mon profil » ne vit pas dans la navigation : on y entre par le panneau de
  // compte de la barre haute, comme le fait un administrateur.
  await utilisateur.click(screen.getByRole("button", { name: "nadia@lehno.app" }));
  await utilisateur.click(await screen.findByRole("button", { name: t.barre.profil }));
  return utilisateur;
}

/**
 * « Mon profil » branché au serveur.
 *
 * L'écran a rendu une fixture pendant tout le premier lot : un e-mail, un rôle
 * et des sessions inventés, avec leurs adresses IP. Rien ne pouvait le signaler
 * — la page se construisait, et ce qu'elle montrait avait l'air d'un compte.
 * Ces tests sont ce qui manquait.
 */
describe("mon profil est branché, non simulé", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("demande le compte au serveur", async () => {
    const appels = serveur();
    await ouvrirProfil();

    await waitFor(() => {
      expect(appels.mock.calls.some(([u]) => String(u).includes("/admin/me"))).toBe(true);
    });
  });

  it("rend ce que le serveur dit, et rien de la fixture", async () => {
    serveur();
    await ouvrirProfil();

    // Scopé à la page : l'adresse paraît aussi dans la barre haute, qui la
    // tient de la session et non de cette lecture.
    const page = within(await screen.findByRole("main"));
    expect(page.getAllByText(PROFIL.email, { exact: false }).length).toBeGreaterThan(0);
    // La fixture porte une autre adresse : si elle reparaît, c'est qu'un défaut
    // de props l'a remise en place.
    expect(page.queryByText(profilDemo.email, { exact: false })).toBeNull();
  });

  it("écrit un tiret là où le serveur ne dit rien", async () => {
    serveur();
    await ouvrirProfil();

    const table = await screen.findByRole("table");
    // Deux tiret : l'appareil et l'adresse manquent tous les deux sur la
    // session ouverte avant qu'on les trace.
    expect(within(table).getAllByText(t.profil.inconnu)).toHaveLength(2);
  });

  // Le bouton retirait les lignes du tableau et laissait les sessions ouvertes.
  it("ferme réellement les autres sessions, puis relit", async () => {
    const appels = serveur();
    const utilisateur = await ouvrirProfil();

    await utilisateur.click(await screen.findByRole("button", { name: t.profil.fermer }));

    await waitFor(() => {
      const fermeture = appels.mock.calls.filter(([u, i]) =>
        String(u).includes("/admin/me/sessions") && (i as RequestInit)?.method === "DELETE");
      expect(fermeture).toHaveLength(1);
    });
    // Et l'on relit : ce qui reste à l'écran vient du serveur, pas d'une
    // soustraction faite de notre côté.
    await waitFor(() => {
      const lectures = appels.mock.calls.filter(([u, i]) =>
        String(u).includes("/admin/me") && !String(u).includes("sessions")
        && ((i as RequestInit)?.method ?? "GET") === "GET");
      expect(lectures.length).toBeGreaterThan(1);
    });
  });

  it("dit le code du serveur quand la fermeture échoue", async () => {
    // 403 et non 401 : un 401 ferait tenter un échange de jeton au client, puis
    // une déconnexion. On éprouve ici le rendu du code, pas cette mécanique-là.
    serveur({
      "/admin/me/sessions": () => reponse(403, { code: "forbidden" }),
    });
    const utilisateur = await ouvrirProfil();

    await utilisateur.click(await screen.findByRole("button", { name: t.profil.fermer }));

    expect(await screen.findByText(t.codes.forbidden)).toBeInTheDocument();
  });
});

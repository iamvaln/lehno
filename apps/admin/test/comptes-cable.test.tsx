import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";

const t = messages("fr");

const ligne = (n: number, over: Record<string, unknown> = {}) => ({
  id: `u-${n}`, pseudo: `compte${n}`, email: `c${n}@exemple.cm`,
  etat: "actif", credits: null, inscritLe: "2026-01-0" + n + "T09:00:00.000Z", ...over,
});

const FICHE = {
  id: "u-1", pseudo: "compte1", email: "c1@exemple.cm", etat: "actif", langue: "fr",
  inscritLe: "2026-01-01T09:00:00.000Z", derniereConnexion: null, suppressionDemandeeLe: null,
  volumetrie: { proches: 4, occasions: 7, notes: 12, murs: null },
  credits: null,
};

const reponse = (statut: number, corps?: unknown): Response =>
  new Response(corps === undefined ? null : JSON.stringify(corps), {
    status: statut,
    headers: corps === undefined ? {} : { "content-type": "application/json" },
  });

const TABLEAU_VIDE = { alertes: [], indicateurs: [], aTraiter: [] };

function serveur(routes: Record<string, (url: string, init?: RequestInit) => Response>) {
  const appels = vi.fn((url: string, init?: RequestInit) => {
    for (const [chemin, rendre] of Object.entries(routes)) {
      if (url.includes(chemin)) return Promise.resolve(rendre(url, init));
    }
    return Promise.resolve(reponse(200, TABLEAU_VIDE));
  });
  vi.stubGlobal("fetch", appels);
  return appels;
}

const urlsVers = (appels: ReturnType<typeof vi.fn>, chemin: string): string[] =>
  appels.mock.calls.map(([u]) => String(u)).filter((u) => u.includes(chemin));

async function ouvrirComptes(utilisateur: ReturnType<typeof userEvent.setup>) {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role: "admin" });
  render(<App />);
  await utilisateur.click(within(screen.getByRole("navigation")).getByText(t.sections.comptes));
}

describe("les comptes, sur les données du serveur", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("lit la première page auprès du serveur", async () => {
    const utilisateur = userEvent.setup();
    const appels = serveur({
      "/admin/users": () => reponse(200, { items: [ligne(1), ligne(2)], nextCursor: null }),
    });
    await ouvrirComptes(utilisateur);

    expect(await screen.findByText("compte1")).toBeInTheDocument();
    expect(urlsVers(appels, "/admin/users").length).toBeGreaterThan(0);
  });

  // Le serveur pagine par curseur et ne rend aucun total (spec technique §3).
  // L'écran ne doit donc pas en inventer un.
  it("suit le curseur du serveur, sans afficher de total", async () => {
    const utilisateur = userEvent.setup();
    const appels = serveur({
      "/admin/users": (url) => reponse(200, url.includes("cursor=u-2")
        ? { items: [ligne(3)], nextCursor: null }
        : { items: [ligne(1), ligne(2)], nextCursor: "u-2" }),
    });
    await ouvrirComptes(utilisateur);
    await screen.findByText("compte1");

    await utilisateur.click(screen.getByRole("button", { name: t.table.suivant }));

    expect(await screen.findByText("compte3")).toBeInTheDocument();
    expect(urlsVers(appels, "/admin/users").some((u) => u.includes("cursor=u-2"))).toBe(true);
  });

  // Filtrer localement ne filtrerait que la page chargée : un compte suspendu
  // qui vit à la page trois resterait introuvable, et l'écran dirait « aucun
  // résultat » avec aplomb.
  it("la recherche part au serveur, elle ne trie pas la page en place", async () => {
    const utilisateur = userEvent.setup();
    const appels = serveur({
      "/admin/users": () => reponse(200, { items: [ligne(1)], nextCursor: null }),
    });
    await ouvrirComptes(utilisateur);
    await screen.findByText("compte1");

    await utilisateur.type(screen.getByPlaceholderText(t.comptes.recherche), "awa");

    await waitFor(() => expect(urlsVers(appels, "/admin/users").some((u) => u.includes("q=awa"))).toBe(true));
  });

  it("le filtre d'état part au serveur", async () => {
    const utilisateur = userEvent.setup();
    const appels = serveur({
      "/admin/users": () => reponse(200, { items: [ligne(1)], nextCursor: null }),
    });
    await ouvrirComptes(utilisateur);
    await screen.findByText("compte1");

    await utilisateur.selectOptions(
      screen.getByLabelText(t.comptes.filtreEtat),
      "suspendu",
    );

    await waitFor(() => expect(
      urlsVers(appels, "/admin/users").some((u) => u.includes("status=suspended")),
    ).toBe(true));
  });

  // Le serveur ne cherche pas comme l'écran : il ignore la casse et les
  // accents, et pourrait demain chercher sur un identifiant ou un numéro. Une
  // liste qui refiltrerait ce qu'il vient de retenir n'afficherait rien, et
  // annoncerait « aucun résultat » sur une réponse qui en contenait.
  it("affiche ce que le serveur a retenu, sans le refiltrer", async () => {
    const utilisateur = userEvent.setup();
    serveur({
      // La recherche « awa » ramène un compte dont ni le pseudo ni l'adresse ne
      // portent ces trois lettres — le serveur a trouvé autrement.
      "/admin/users": () => reponse(200, {
        items: [ligne(9, { pseudo: "Awá", email: "contact@exemple.cm" })],
        nextCursor: null,
      }),
    });
    await ouvrirComptes(utilisateur);
    await screen.findByText("Awá");

    await utilisateur.type(screen.getByPlaceholderText(t.comptes.recherche), "awa");

    expect(await screen.findByText("Awá")).toBeInTheDocument();
  });

  // Sinon on chercherait « awa » à partir du centième compte, et les premiers
  // résultats resteraient invisibles.
  it("une nouvelle question repart de la première page", async () => {
    const utilisateur = userEvent.setup();
    const appels = serveur({
      "/admin/users": (url) => reponse(200, url.includes("cursor=")
        ? { items: [ligne(3)], nextCursor: null }
        : { items: [ligne(1)], nextCursor: "u-2" }),
    });
    await ouvrirComptes(utilisateur);
    await screen.findByText("compte1");
    await utilisateur.click(screen.getByRole("button", { name: t.table.suivant }));
    await screen.findByText("compte3");

    await utilisateur.type(screen.getByPlaceholderText(t.comptes.recherche), "a");

    await waitFor(() => {
      const avecQ = urlsVers(appels, "/admin/users").filter((u) => u.includes("q=a"));
      expect(avecQ.length).toBeGreaterThan(0);
      for (const url of avecQ) expect(url).not.toContain("cursor=");
    });
  });

  it("ouvrir une fiche la demande au serveur", async () => {
    const utilisateur = userEvent.setup();
    const appels = serveur({
      "/admin/users/u-1": () => reponse(200, FICHE),
      "/admin/users": () => reponse(200, { items: [ligne(1)], nextCursor: null }),
    });
    await ouvrirComptes(utilisateur);
    await utilisateur.click(await screen.findByText("compte1"));

    await waitFor(() => expect(urlsVers(appels, "/admin/users/u-1").length).toBeGreaterThan(0));
    expect(await screen.findByText("12")).toBeInTheDocument();
  });

  it("un échec de chargement se voit, la liste ne paraît pas vide", async () => {
    const utilisateur = userEvent.setup();
    serveur({
      "/admin/users": () => reponse(500, { code: "internal_error", message: "boom" }),
    });
    await ouvrirComptes(utilisateur);

    expect(await screen.findByText(t.echecs.chargement)).toBeInTheDocument();
  });
});

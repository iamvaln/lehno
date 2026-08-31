import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";
import { allerA } from "./aide-navigation.js";

const t = messages("fr");
const d = t.studioEssais;

const bilingue = (fr: string, en: string) => ({ fr, en });

const REGLAGES = {
  motifs: { bande: "trame_de_hampes", fondSansImage: "registres" },
  modeles: { illustration: "anthropic:claude-opus-5", photo_style: "replicate:flux-1" },
  voiesImage: [
    { id: "illustration", actif: true, libelle: bilingue("Illustration", "Illustration"), description: null },
  ],
  ambiances: [{
    id: "papier", groupe: "illustration_family", actif: true,
    libelle: bilingue("Papier", "Paper"), description: null,
    consigne: bilingue("Un papier grené.", "Grained paper."),
  }],
};

const config = (id: string, etat: string) => ({
  id, etat, version: etat === "published" ? 7 : null, empreinte: "abc", reglages: REGLAGES,
  note: null, publieeLe: null, parQui: null, creeeLe: "2026-08-30T08:00:00.000Z",
  essaisReussis: 1, publiable: false, blocage: null,
});

const EN_SERVICE = config("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "published");
const BROUILLON = config("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "draft");

const essai = (sur: Record<string, unknown> = {}) => ({
  id: "44444444-4444-4444-8444-444444444444",
  configId: BROUILLON.id, profilId: null, etat: "success",
  modele: { fournisseur: "anthropic", cle: "anthropic:claude-opus-5" },
  sortie: { cle: "k", url: "https://example.test/p.png" },
  cout: 12, erreur: null, parQui: "sam@lehno.app", quand: "2026-08-30T09:00:00.000Z",
  verdict: null,
  ...sur,
});

const reponse = (statut: number, corps?: unknown): Response =>
  new Response(corps === undefined ? null : JSON.stringify(corps), {
    status: statut,
    headers: corps === undefined ? {} : { "content-type": "application/json" },
  });

function serveur(essais: unknown[]) {
  const table: Record<string, () => Response> = {
    "/admin/portrait-studio/config/history": () => reponse(200, { items: [EN_SERVICE, BROUILLON] }),
    "/admin/portrait-studio/trials": () => reponse(200, { items: essais }),
  };
  const chemins = Object.keys(table).sort((a, b) => b.length - a.length);
  const appels = vi.fn((url: string) => {
    for (const chemin of chemins) {
      if (url.includes(chemin)) return Promise.resolve(table[chemin]!());
    }
    return Promise.resolve(reponse(200, { alertes: [], indicateurs: [], aTraiter: [] }));
  });
  vi.stubGlobal("fetch", appels);
  return appels;
}

async function ouvrir() {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "a", rafraichissement: "r", role: "admin", email: "sam@lehno.app" });
  render(<App />);
  const utilisateur = userEvent.setup({ delay: null });
  await allerA(utilisateur, "essais");
  return utilisateur;
}

/**
 * Les essais — on voit les résultats, pas une liste de réglages.
 */
describe("les essais, sur les données du serveur", () => {
  beforeEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

  /* « Publié » n'est pas un verdict : il se déduit de l'état de la
     configuration. Sans l'historique, l'écran dirait « gardé » d'un essai qui
     tourne en production. */
  it("demande les essais ET les versions publiées", async () => {
    const appels = serveur([essai()]);
    await ouvrir();
    await waitFor(() => expect(screen.getByText(d.sorts.nonJuge)).toBeInTheDocument());
    const urls = appels.mock.calls.map(([u]) => String(u));
    expect(urls.some((u) => u.includes("/portrait-studio/trials"))).toBe(true);
    expect(urls.some((u) => u.includes("/portrait-studio/config/history"))).toBe(true);
  });

  it("déduit « publié » de la configuration, pas du verdict", async () => {
    serveur([essai({ configId: EN_SERVICE.id, verdict: "kept" })]);
    await ouvrir();
    await waitFor(() => expect(screen.getByText(d.sorts.publie)).toBeInTheDocument());
    // Publié l'emporte : dire « gardé » perdrait la seule information qui compte.
    expect(screen.queryByText(d.sorts.kept)).toBeNull();
  });

  /* Un essai écarté NE DISPARAÎT PAS : on l'a jugé mauvais, c'est une
     information, et le revoir évite de refaire le même. */
  it("montre les écartés comme les autres", async () => {
    serveur([
      essai({ id: "11111111-1111-4111-8111-111111111111", verdict: "discarded" }),
      essai({ id: "22222222-2222-4222-8222-222222222222", verdict: "kept" }),
    ]);
    await ouvrir();
    await waitFor(() => expect(screen.getByText(d.sorts.discarded)).toBeInTheDocument());
    expect(screen.getByText(d.sorts.kept)).toBeInTheDocument();
  });

  it("filtre par sort", async () => {
    serveur([
      essai({ id: "11111111-1111-4111-8111-111111111111", verdict: "discarded" }),
      essai({ id: "22222222-2222-4222-8222-222222222222", verdict: "kept" }),
    ]);
    const utilisateur = await ouvrir();
    await waitFor(() => expect(screen.getByText(d.sorts.discarded)).toBeInTheDocument());

    await utilisateur.selectOptions(screen.getByLabelText(d.filtre.libelle), "kept");
    await waitFor(() => expect(screen.queryByText(d.sorts.discarded)).toBeNull());
    expect(screen.getByText(d.sorts.kept)).toBeInTheDocument();
  });

  /* On voit les RÉSULTATS : l'image d'abord, la fiche technique en légende. */
  it("montre ce qui a été produit, la fiche en légende", async () => {
    serveur([essai()]);
    await ouvrir();
    await waitFor(() => expect(screen.getByRole("img", { name: d.carte.alt })).toBeInTheDocument());
    expect(screen.getByText(/anthropic:claude-opus-5/)).toBeInTheDocument();
  });

  /* Aucun essai ne s'efface à la main : ce qui a coûté un appel se garde. Un
     bouton de suppression n'aurait servi qu'à perdre la trace d'une dépense. */
  it("n'offre aucun effacement", async () => {
    serveur([essai({ verdict: "discarded" })]);
    await ouvrir();
    await waitFor(() => expect(screen.getByText(d.rappel)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /supprimer|effacer/i })).toBeNull();
  });

  it("dit quand rien n'a été produit", async () => {
    serveur([]);
    await ouvrir();
    await waitFor(() => expect(screen.getByText(d.vide.titre)).toBeInTheDocument());
  });
});

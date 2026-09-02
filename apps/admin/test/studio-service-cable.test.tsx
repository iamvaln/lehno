import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";
import { allerA } from "./aide-navigation.js";

const t = messages("fr");
const d = t.studioService;

const bilingue = (fr: string, en: string) => ({ fr, en });

const REGLAGES = {
  motifs: { bande: "trame_de_hampes", fondSansImage: "registres" },
  // `fournisseur:modèle` — la forme que le contrat impose.
  modeles: { illustration: "anthropic:claude-opus-5", photo_style: "replicate:flux-1" },
  voiesImage: [
    { id: "photo", actif: true, libelle: bilingue("Photo", "Photo"), description: null },
    { id: "illustration", actif: true, libelle: bilingue("Illustration", "Illustration"), description: null },
  ],
  ambiances: [
    {
      id: "papier", groupe: "illustration_family", actif: true,
      libelle: bilingue("Papier", "Paper"), description: null,
      consigne: bilingue("Un papier grené.", "Grained paper."),
    },
    {
      id: "lilas", groupe: "photo_style", actif: true,
      libelle: bilingue("Lilas", "Lilac"), description: null,
      consigne: bilingue("Une lumière lilas.", "Lilac light."),
    },
  ],
};

const config = (sur: Record<string, unknown> = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  etat: "published", version: 7, empreinte: "abc",
  reglages: REGLAGES,
  note: "Garde-fou raccourci sur les hommages",
  publieeLe: "2026-08-28T09:00:00.000Z", parQui: "sam@lehno.app",
  creeeLe: "2026-08-28T08:00:00.000Z",
  essaisReussis: 3, publiable: false, blocage: "deja_en_service",
  ...sur,
});

const RANGEE = config({
  id: "22222222-2222-4222-8222-222222222222",
  etat: "superseded", version: 6, note: "Atelier 3 Sonnet en premier rang",
  publieeLe: "2026-08-20T09:00:00.000Z", parQui: "dora@lehno.app",
  publiable: true, blocage: null,
});

const reponse = (statut: number, corps?: unknown): Response =>
  new Response(corps === undefined ? null : JSON.stringify(corps), {
    status: statut,
    headers: corps === undefined ? {} : { "content-type": "application/json" },
  });

function serveur(sur: Record<string, (u: string, i?: RequestInit) => Response> = {}) {
  const table: Record<string, (u: string, i?: RequestInit) => Response> = {
    "/admin/portrait-studio/config/history": () => reponse(200, { items: [config(), RANGEE] }),
    "/admin/portrait-studio/config/rollback": () => reponse(200, config()),
    "/admin/portrait-studio/config": () => reponse(200, { enService: config(), brouillon: null }),
    ...sur,
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

async function ouvrir(role: "admin" | "support" = "admin") {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role, email: "sam@lehno.app" });
  render(<App />);
  const utilisateur = userEvent.setup({ delay: null });
  await allerA(utilisateur, "studioService");
  return utilisateur;
}

/**
 * Réglages en service — un écran de LECTURE qui répond à deux questions :
 * qu'est-ce qui tourne, et qui l'a mis là.
 */
describe("les réglages en service, sur les données du serveur", () => {
  beforeEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

  /* Deux appels, un seul état d'écran : ce qui tourne et ce qui l'a précédé se
     lisent ensemble ou pas du tout. */
  it("demande l'état ET l'historique", async () => {
    const appels = serveur();
    await ouvrir();
    await waitFor(() => expect(screen.getByRole("region", { name: d.enService })).toHaveTextContent("Version 7"));
    const chemins = appels.mock.calls.map(([u]) => String(u));
    expect(chemins.some((u) => u.includes("/portrait-studio/config") && !u.includes("history"))).toBe(true);
    expect(chemins.some((u) => u.includes("/portrait-studio/config/history"))).toBe(true);
  });

  it("dit ce qui tourne, avec son auteur et son motif", async () => {
    serveur();
    await ouvrir();
    await waitFor(() => expect(screen.getByRole("region", { name: d.enService })).toHaveTextContent("Version 7"));
    const fiche = screen.getByRole("region", { name: d.enService });
    expect(fiche).toHaveTextContent("sam@lehno.app");
    expect(fiche).toHaveTextContent("Garde-fou raccourci sur les hommages");
  });

  /* On ne change rien ici, et l'écran le dit : un administrateur qui cherche où
     modifier ne doit pas avoir à le déduire de l'absence de champs. */
  it("dit qu'on ne modifie pas ici", async () => {
    serveur();
    await ouvrir();
    await waitFor(() => expect(screen.getByText(d.lecture)).toBeInTheDocument());
  });

  /* Le taux de régénération serait la mesure de l'écran ; aucune route ne le
     sert. On le dit plutôt que d'afficher un zéro, qui se prendrait pour une
     mesure. */
  it("annonce la mesure qui manque plutôt qu'un zéro", async () => {
    serveur();
    await ouvrir();
    await waitFor(() => expect(screen.getByText(d.tauxAbsent)).toBeInTheDocument());
    expect(screen.queryByText("0 %")).toBeNull();
  });

  /* Rien n'a jamais été publié : l'écran le dit et ne montre pas une fiche à
     trous, qui se lirait comme une panne. */
  it("dit quand rien n'est en service", async () => {
    serveur({
      "/admin/portrait-studio/config": () => reponse(200, { enService: null, brouillon: null }),
      "/admin/portrait-studio/config/history": () => reponse(200, { items: [] }),
    });
    await ouvrir();
    await waitFor(() => expect(screen.getByText(d.premier.titre)).toBeInTheDocument());
  });

  it("remet une version antérieure en service, avec son motif", async () => {
    const appels = serveur();
    const utilisateur = await ouvrir();
    await waitFor(() => expect(screen.getByText("Atelier 3 Sonnet en premier rang")).toBeInTheDocument());

    await utilisateur.click(screen.getAllByRole("button", { name: t.table.actions })[0]!);
    await utilisateur.click(await screen.findByText(d.revenir));
    await utilisateur.selectOptions(
      screen.getByLabelText(t.confirmation.motif),
      d.dialogue.motifs[0] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    await waitFor(() => {
      const ecriture = appels.mock.calls.find(([u, i]) =>
        String(u).includes("/config/rollback") && (i as RequestInit)?.method === "POST");
      expect(ecriture).toBeDefined();
      expect(JSON.parse(String((ecriture![1] as RequestInit).body))).toMatchObject({
        configId: RANGEE.id, reason: d.dialogue.motifs[0],
      });
    });
  });

  /* Une version DÉJÀ en service ne se remet pas en service : le geste n'aurait
     rien à défaire. */
  it("n'offre pas de revenir à celle qui tourne", async () => {
    serveur({
      "/admin/portrait-studio/config/history": () => reponse(200, { items: [config()] }),
    });
    const utilisateur = await ouvrir();
    await waitFor(() => expect(screen.getByRole("region", { name: d.enService })).toHaveTextContent("Version 7"));
    const actions = screen.queryAllByRole("button", { name: t.table.actions });
    if (actions.length > 0) {
      await utilisateur.click(actions[0]!);
      expect(screen.queryByText(d.revenir)).toBeNull();
    }
  });

  /* Le support ne voit pas ce qu'il ne peut pas faire : RoleGate retire, il ne
     grise pas. Et cette section lui est fermée en entier. */
  it("reste fermée au support", async () => {
    serveur();
    localStorage.clear();
    magasinLocal.ecrire({ acces: "a", rafraichissement: "r", role: "support", email: "e@lehno.app" });
    render(<App />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());
    expect(screen.queryByText(t.sections.studioService)).toBeNull();
  });
});

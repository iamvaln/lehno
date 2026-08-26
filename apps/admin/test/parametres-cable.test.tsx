import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";

const t = messages("fr");

const REGLAGES = {
  economie: [
    { cle: "signup_free_credits", valeur: "5", type: "number", valeurPrecedente: null, misAJourLe: "2026-08-01T09:00:00.000Z" },
    { cle: "credit_unit_price", valeur: "100", type: "money", valeurPrecedente: "80", misAJourLe: "2026-08-02T09:00:00.000Z" },
  ],
  typesEvenement: [
    { id: "birthday", actif: true, sensible: false, reglable: false },
    { id: "other", actif: true, sensible: false, reglable: false },
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

async function ouvrirParametres(utilisateur: ReturnType<typeof userEvent.setup>) {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role: "admin" });
  render(<App />);
  await utilisateur.click(within(screen.getByRole("navigation")).getByText(t.sections.parametres));
}

describe("les paramètres, sur le serveur", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("lit les réglages auprès du serveur", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur({ "/admin/parameters": () => reponse(200, REGLAGES) });
    await ouvrirParametres(utilisateur);

    expect(await screen.findByText(t.parametres.cles.signup_free_credits.libelle)).toBeInTheDocument();
  });

  // Le serveur envoie une clé, jamais une phrase. Une clé qu'on ne connaît pas
  // s'affiche telle quelle : ça se voit et ça se corrige, là où une ligne vide
  // passerait pour une place libre.
  it("une clé inconnue du dictionnaire s'affiche telle quelle", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur({
      "/admin/parameters": () => reponse(200, {
        ...REGLAGES,
        economie: [{ cle: "cle_inventee_demain", valeur: "1", type: "number", valeurPrecedente: null, misAJourLe: "2026-08-01T09:00:00.000Z" }],
      }),
    });
    await ouvrirParametres(utilisateur);

    expect(await screen.findByText("cle_inventee_demain")).toBeInTheDocument();
  });

  it("rappelle la valeur précédente quand il y en a une", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur({ "/admin/parameters": () => reponse(200, REGLAGES) });
    await ouvrirParametres(utilisateur);
    await screen.findByText(t.parametres.cles.credit_unit_price.libelle);

    // L'unité accompagne la valeur : « 80 » seul se lirait comme un compte.
    const unite = t.parametres.cles.credit_unit_price.unite;
    expect(screen.getByText(t.parametres.precedente.replace("{valeur}", `80 ${unite}`))).toBeInTheDocument();
  });

  // Le serveur refuse une écriture sans motif d'au moins six caractères : la
  // contrainte est posée en base. L'écran doit le demander avant d'appeler,
  // plutôt que d'essuyer un refus qu'il ne saurait pas expliquer.
  it("enregistrer demande un motif, et l'envoie", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur({ "/admin/parameters": () => reponse(200, REGLAGES) });
    await ouvrirParametres(utilisateur);
    const champ = await screen.findByLabelText(t.parametres.cles.signup_free_credits.libelle);

    await utilisateur.clear(champ);
    await utilisateur.type(champ, "9");
    await utilisateur.click(screen.getByRole("button", { name: t.parametres.enregistrer }));

    await utilisateur.selectOptions(
      await screen.findByLabelText(t.parametres.motif.question),
      t.parametres.motif.motifs[0] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    await waitFor(() => {
      const ecritures = appels.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "PATCH");
      expect(ecritures).toHaveLength(1);
      const corps = JSON.parse((ecritures[0]?.[1] as RequestInit).body as string);
      expect(corps).toEqual({ key: "signup_free_credits", value: "9", reason: t.parametres.motif.motifs[0] });
    });
  });

  it("un motif trop court ne laisse pas confirmer", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur({ "/admin/parameters": () => reponse(200, REGLAGES) });
    await ouvrirParametres(utilisateur);
    const champ = await screen.findByLabelText(t.parametres.cles.signup_free_credits.libelle);
    await utilisateur.clear(champ);
    await utilisateur.type(champ, "9");
    await utilisateur.click(screen.getByRole("button", { name: t.parametres.enregistrer }));

    // « Autre — préciser » ouvre le champ libre, seul endroit où un motif trop
    // court peut être écrit.
    await utilisateur.selectOptions(
      await screen.findByLabelText(t.parametres.motif.question),
      t.confirmation.autre,
    );
    await utilisateur.type(screen.getByLabelText(t.confirmation.autrePlaceholder), "court");

    expect(screen.getByRole("button", { name: t.confirmation.confirmer })).toBeDisabled();
    expect(appels.mock.calls.filter(([, i]) => (i as RequestInit)?.method === "PATCH")).toHaveLength(0);
  });

  // Un interrupteur qui n'enregistre rien est pire que pas d'interrupteur :
  // l'administrateur croit avoir réglé quelque chose.
  it("les types d'occasion se montrent sans se régler", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur({ "/admin/parameters": () => reponse(200, REGLAGES) });
    await ouvrirParametres(utilisateur);
    await screen.findByText(t.parametres.cles.signup_free_credits.libelle);

    await utilisateur.click(screen.getByRole("tab", { name: new RegExp(t.parametres.onglets.occasions) }));

    expect(await screen.findByText(t.parametres.nonReglable)).toBeInTheDocument();
    // Le contrôle est un select, pas un interrupteur : chercher un « switch »
    // ne parcourait rien et passait à vide.
    const controles = REGLAGES.typesEvenement.map((type) => screen.getByLabelText(type.id));
    expect(controles).toHaveLength(2);
    for (const controle of controles) expect(controle).toBeDisabled();
  });
});

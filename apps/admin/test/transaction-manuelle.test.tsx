import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";
import { allerA } from "./aide-navigation.js";

const t = messages("fr");
const d = t.transactionManuelle;

const COMPTES = {
  items: [
    {
      id: "u-1", pseudo: "awa", email: "awa@exemple.cm",
      etat: "actif", credits: 12, inscritLe: "2026-01-01T09:00:00.000Z",
    },
    {
      id: "u-2", pseudo: "awaa", email: "awaa@exemple.cm",
      etat: "actif", credits: 3, inscritLe: "2026-01-02T09:00:00.000Z",
    },
  ],
  nextCursor: null,
};

const reponse = (statut: number, corps?: unknown): Response =>
  new Response(corps === undefined ? null : JSON.stringify(corps), {
    status: statut,
    ...(corps === undefined ? {} : { headers: { "content-type": "application/json" } }),
  });

function serveur() {
  const appels = vi.fn((url: string, _init?: RequestInit) => {
    if (String(url).includes("/credits")) return Promise.resolve(reponse(200, { solde: 17 }));
    if (String(url).includes("/admin/users")) return Promise.resolve(reponse(200, COMPTES));
    return Promise.resolve(reponse(200, { alertes: [], indicateurs: [], aTraiter: [] }));
  });
  vi.stubGlobal("fetch", appels);
  return appels;
}

const ecritures = (appels: ReturnType<typeof vi.fn>) =>
  appels.mock.calls.filter(([u, i]) =>
    String(u).includes("/credits") && (i as RequestInit)?.method === "POST");

async function ouvrir() {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role: "admin", email: "sam@lehno.app" });
  render(<App />);
  const utilisateur = userEvent.setup({ delay: null });
  await allerA(utilisateur, "transactionManuelle");
  return utilisateur;
}

/**
 * Écrire un mouvement de crédits à la main.
 *
 * Deux choses ne se tapent pas sur cet écran : le compte, et le sens.
 */
describe("la transaction manuelle", () => {
  beforeEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

  it("s'atteint depuis la section Crédits", async () => {
    serveur();
    await ouvrir();
    expect(await screen.findByText(d.sous)).toBeInTheDocument();
  });

  /* Le geste reste fermé tant qu'un compte RÉEL n'est pas retenu : ce qui est
     écrit dans la boîte de recherche ne vaut pas sélection. */
  it("n'ouvre pas le geste sans compte retenu", async () => {
    serveur();
    const utilisateur = await ouvrir();
    await screen.findByText(d.sous);

    await utilisateur.type(screen.getByLabelText(d.chercher), "awa@exemple.cm");
    await utilisateur.type(screen.getByLabelText(d.montant), "5");

    expect(screen.getByRole("button", { name: d.ecrire })).toBeDisabled();
  });

  it("n'ouvre pas le geste sans montant", async () => {
    serveur();
    const utilisateur = await ouvrir();
    await screen.findByText(d.sous);

    await utilisateur.type(screen.getByLabelText(d.chercher), "awa");
    await utilisateur.click(await screen.findByRole("option", { name: /awaa/ }));

    expect(screen.getByRole("button", { name: d.ecrire })).toBeDisabled();
  });

  /* Le sens vient de la nature choisie, jamais d'un moins tapé. « Reprise de
     crédits » envoie un montant NÉGATIF sans que personne ait saisi de signe. */
  it("écrit au débit sans qu'on ait tapé de moins", async () => {
    const appels = serveur();
    const utilisateur = await ouvrir();
    await screen.findByText(d.sous);

    await utilisateur.type(screen.getByLabelText(d.chercher), "awa");
    await utilisateur.click(await screen.findByRole("option", { name: /awaa/ }));
    await utilisateur.selectOptions(screen.getByLabelText(d.nature), "correctionMoins");
    await utilisateur.type(screen.getByLabelText(d.montant), "5");
    await utilisateur.click(screen.getByRole("button", { name: d.ecrire }));
    await utilisateur.selectOptions(
      screen.getByLabelText(t.confirmation.motif),
      d.dialogue.motifs[1] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    await waitFor(() => {
      const [envoi] = ecritures(appels);
      expect(envoi).toBeTruthy();
      const corps = JSON.parse((envoi?.[1] as RequestInit).body as string) as {
        montant: number; nature: string;
      };
      expect(corps.montant).toBe(-5);
      expect(corps.nature).toBe("correction");
    });
  });

  it("écrit au crédit pour un cadeau", async () => {
    const appels = serveur();
    const utilisateur = await ouvrir();
    await screen.findByText(d.sous);

    await utilisateur.type(screen.getByLabelText(d.chercher), "awa");
    await utilisateur.click(await screen.findByRole("option", { name: /awaa/ }));
    await utilisateur.type(screen.getByLabelText(d.montant), "5");
    await utilisateur.click(screen.getByRole("button", { name: d.ecrire }));
    await utilisateur.selectOptions(
      screen.getByLabelText(t.confirmation.motif),
      d.dialogue.motifs[0] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    await waitFor(() => {
      const corps = JSON.parse((ecritures(appels)[0]?.[1] as RequestInit).body as string) as {
        montant: number; nature: string;
      };
      expect([corps.montant, corps.nature]).toEqual([5, "gift"]);
    });
  });

  /* La phrase redit le sens une fois l'option retenue, quand elle a défilé.
     Sans elle, on relit un intitulé de liste fermée pour se rassurer. */
  it("redit le sens sous le champ", async () => {
    serveur();
    const utilisateur = await ouvrir();
    await screen.findByText(d.sous);

    await utilisateur.selectOptions(screen.getByLabelText(d.nature), "correctionMoins");
    await utilisateur.type(screen.getByLabelText(d.montant), "5");

    expect(screen.getByText(d.sensDebit.replace("{n}", "5"))).toBeInTheDocument();
  });

  // « Le compte recevra 0 crédits » n'informe pas, il meuble.
  it("ne dit rien tant qu'aucun montant n'est saisi", async () => {
    serveur();
    await ouvrir();
    await screen.findByText(d.sous);

    expect(screen.queryByText(d.sensCredit.replace("{n}", "0"))).toBeNull();
  });

  // Rien ne part tant que rien n'est cherché : ouvrir l'écran ne doit pas
  // rapatrier une page de comptes qu'on n'a pas demandée.
  it("n'interroge aucun compte tant qu'on ne cherche pas", async () => {
    const appels = serveur();
    await ouvrir();
    await screen.findByText(d.sous);

    expect(appels.mock.calls.filter(([u]) => String(u).includes("/admin/users"))).toHaveLength(0);
  });
});

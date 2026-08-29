import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";
import { allerA } from "./aide-navigation.js";

const t = messages("fr");

const COMPTES = { items: [{ id: "u-1", pseudo: "awa", email: "awa@exemple.cm", etat: "actif", credits: 0, inscritLe: "2026-01-01" }], nextCursor: null };
const PALIERS = { items: [
  { id: "b-1", montant: 500, devise: "XAF", credits: 5, remisePourcent: null, position: 1, actif: true },
  { id: "b-2", montant: 1000, devise: "XAF", credits: 10, remisePourcent: null, position: 2, actif: true },
  { id: "b-3", montant: 2000, devise: "XAF", credits: 22, remisePourcent: 10, position: 3, actif: false },
] };
const CANAUX = { items: [
  { id: "c-1", nature: "mobile_money", operateur: "orange_money", pays: "CM", libelle: "Orange Money", fraisPourcent: 2, fraisFixe: 0, fraisMin: null, fraisMax: null, fraisPortesPar: "payer", devise: "XAF", actif: true, position: 1 },
  { id: "c-2", nature: "mobile_money", operateur: "mtn_momo", pays: "CM", libelle: "MTN MoMo", fraisPourcent: 2, fraisFixe: 0, fraisMin: null, fraisMax: null, fraisPortesPar: "payer", devise: "XAF", actif: false, position: 2 },
] };
const COLLECTE = { items: [
  { id: "a-1", libelle: "Orange Money principal", operateur: "orange_money", numero: "690000000", visibleDansApp: true, actif: true, position: 1 },
  { id: "a-2", libelle: "Compte fermé", operateur: "mtn_momo", numero: "670000000", visibleDansApp: false, actif: false, position: 2 },
] };

const reponse = (statut: number, corps?: unknown): Response =>
  new Response(corps === undefined ? null : JSON.stringify(corps), {
    status: statut,
    headers: corps === undefined ? {} : { "content-type": "application/json" },
  });

function serveur(routes: Record<string, (url: string, init?: RequestInit) => Response> = {}) {
  const parDefaut: Record<string, (url: string, init?: RequestInit) => Response> = {
    "/admin/payments": (_u, init) => (init?.method === "POST"
      ? reponse(201, { id: "p-9", etat: "pending", montant: 1000, frais: 20, attenduSurLeCompte: 1000, credits: 10, devise: "XAF" })
      : reponse(200, { items: [], nextCursor: null })),
    "/admin/credit-bundles": () => reponse(200, PALIERS),
    "/admin/payment-channels": () => reponse(200, CANAUX),
    "/admin/collection-accounts": () => reponse(200, COLLECTE),
    "/admin/users": () => reponse(200, COMPTES),
    "/admin/credit-transactions": () => reponse(200, { items: [], nextCursor: null }),
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

const ecritures = (appels: ReturnType<typeof vi.fn>) =>
  appels.mock.calls.filter(([u, i]) =>
    (i as RequestInit)?.method === "POST" && String(u).includes("/admin/payments"));

async function ouvrirSaisie(utilisateur: ReturnType<typeof userEvent.setup>, role: "admin" | "support" = "admin") {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role });
  render(<App />);
  await allerA(utilisateur, "credits");
  await screen.findByRole("tab", { name: new RegExp(t.credits.onglets.paiements) });
}


describe("la saisie manuelle d'un paiement", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("un administrateur peut ouvrir la saisie", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrirSaisie(utilisateur);

    await utilisateur.click(await screen.findByRole("button", { name: t.credits.saisie.ouvrir }));

    expect(await screen.findByText(t.credits.saisie.titre)).toBeInTheDocument();
  });

  // Saisir un paiement fait entrer de l'argent dans le registre : c'est un
  // levier de la famille Économie, et le serveur le refuse au support.
  it("le support ne voit pas le geste", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrirSaisie(utilisateur, "support");

    expect(screen.queryByRole("button", { name: t.credits.saisie.ouvrir })).not.toBeInTheDocument();
  });

  // Un palier retiré ne se vend plus, un compte fermé ne reçoit plus, un canal
  // désactivé n'a plus de barème. Les proposer ferait échouer la saisie au
  // dernier moment, sur un refus qu'on ne saurait pas expliquer.
  it("ne propose que ce qui est encore en service", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrirSaisie(utilisateur);
    await utilisateur.click(await screen.findByRole("button", { name: t.credits.saisie.ouvrir }));

    const paliers = await screen.findByLabelText(t.credits.saisie.champs.palier);
    expect(within(paliers).queryByText(/2 000/)).not.toBeInTheDocument();
    expect(within(screen.getByLabelText(t.credits.saisie.champs.canal)).queryByText("MTN MoMo")).not.toBeInTheDocument();
    expect(within(screen.getByLabelText(t.credits.saisie.champs.compte)).queryByText("Compte fermé")).not.toBeInTheDocument();
  });

  // Ce qu'on attend sur le compte se calcule à l'aperçu, pas après le
  // versement : l'administrateur doit savoir combien il devrait voir arriver
  // avant de constater un écart.
  it("annonce ce qu'on doit voir arriver sur le compte", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrirSaisie(utilisateur);
    await utilisateur.click(await screen.findByRole("button", { name: t.credits.saisie.ouvrir }));

    await utilisateur.selectOptions(await screen.findByLabelText(t.credits.saisie.champs.palier), "b-2");
    await utilisateur.selectOptions(screen.getByLabelText(t.credits.saisie.champs.canal), "c-1");

    // 1 000 F, 2 % à la charge du client : il verse 1 020, il en arrive 1 000.
    // On lit dans le rang qui porte la question, pas au large : le palier
    // affiche lui aussi « 1 000 » dans son libellé.
    const apercu = (await screen.findByText(t.credits.saisie.apercu.titre)).closest("section") as HTMLElement;
    expect(within(apercu).getByText(/1 020/)).toBeInTheDocument();
    expect(within(apercu).getByText(/^1 000/)).toBeInTheDocument();
  });

  it("enregistrer envoie ce qui a été choisi, avec le motif", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur();
    await ouvrirSaisie(utilisateur);
    await utilisateur.click(await screen.findByRole("button", { name: t.credits.saisie.ouvrir }));

    await utilisateur.selectOptions(await screen.findByLabelText(t.credits.saisie.champs.compteClient), "u-1");
    await utilisateur.selectOptions(screen.getByLabelText(t.credits.saisie.champs.palier), "b-2");
    await utilisateur.selectOptions(screen.getByLabelText(t.credits.saisie.champs.canal), "c-1");
    await utilisateur.selectOptions(screen.getByLabelText(t.credits.saisie.champs.compte), "a-1");
    await utilisateur.click(screen.getByRole("button", { name: t.credits.saisie.enregistrer }));
    await utilisateur.selectOptions(
      await screen.findByLabelText(t.confirmation.motif),
      t.credits.saisie.motifs[0] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    await waitFor(() => {
      expect(ecritures(appels)).toHaveLength(1);
      const corps = JSON.parse((ecritures(appels)[0]?.[1] as RequestInit).body as string);
      expect(corps).toEqual({
        utilisateurId: "u-1", palierId: "b-2", canalId: "c-1", compteCollecteId: "a-1",
        reason: t.credits.saisie.motifs[0],
      });
    });
  });

  // Le montant et les crédits viennent du palier : le contrat n'a pas de champ
  // pour eux, et l'écran ne doit pas en offrir un.
  it("n'offre aucun champ de montant libre", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrirSaisie(utilisateur);
    await utilisateur.click(await screen.findByRole("button", { name: t.credits.saisie.ouvrir }));

    await screen.findByLabelText(t.credits.saisie.champs.palier);
    expect(screen.queryByLabelText(/montant/i)).not.toBeInTheDocument();
  });

  it("enregistrer reste indisponible tant qu'un choix manque", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrirSaisie(utilisateur);
    await utilisateur.click(await screen.findByRole("button", { name: t.credits.saisie.ouvrir }));

    await screen.findByLabelText(t.credits.saisie.champs.palier);

    expect(screen.getByRole("button", { name: t.credits.saisie.enregistrer })).toBeDisabled();
  });

  // Un refus du serveur — palier devenu inactif entre-temps, par exemple — se
  // traduit plutôt que de laisser croire à une panne de l'outil.
  it("un refus du serveur se dit dans ses mots", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur({
      "/admin/payments": (_u, init) => (init?.method === "POST"
        ? reponse(422, { code: "resource_inactive", message: "credit bundle is not active" })
        : reponse(200, { items: [], nextCursor: null })),
    });
    await ouvrirSaisie(utilisateur);
    await utilisateur.click(await screen.findByRole("button", { name: t.credits.saisie.ouvrir }));
    await utilisateur.selectOptions(await screen.findByLabelText(t.credits.saisie.champs.compteClient), "u-1");
    await utilisateur.selectOptions(screen.getByLabelText(t.credits.saisie.champs.palier), "b-2");
    await utilisateur.selectOptions(screen.getByLabelText(t.credits.saisie.champs.canal), "c-1");
    await utilisateur.selectOptions(screen.getByLabelText(t.credits.saisie.champs.compte), "a-1");
    await utilisateur.click(screen.getByRole("button", { name: t.credits.saisie.enregistrer }));
    await utilisateur.selectOptions(
      await screen.findByLabelText(t.confirmation.motif),
      t.credits.saisie.motifs[0] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    expect(await screen.findByText(t.codes.resource_inactive)).toBeInTheDocument();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";

const t = messages("fr");

const PAIEMENT = {
  id: "p-1", utilisateur: "awa", mode: "manual", etat: "pending",
  montant: 1000, devise: "XAF", credits: 10, methode: "MTN MoMo ••••1234",
  attenduSurLeCompte: 1000, recuSurLeCompte: null, ecart: null,
  creeLe: "2026-08-26T09:00:00.000Z",
};

const PAIEMENTS = { items: [PAIEMENT], nextCursor: null };

const DETAIL = {
  ...PAIEMENT, etat: "succeeded", recuSurLeCompte: 900, ecart: -100,
  reference: "MP260826.1200.A11111", motifEchec: null, frais: 20,
  compteCollecte: "Orange Money principal",
  histoire: [
    {
      etat: "pending", debut: "2026-08-26T09:00:00.000Z", fin: "2026-08-26T09:30:00.000Z",
      dureeSecondes: 1800, origine: "admin", parQui: "sam@lehno.app", motif: "Versement constaté",
    },
    {
      etat: "succeeded", debut: "2026-08-26T09:30:00.000Z", fin: null,
      dureeSecondes: null, origine: "admin", parQui: "sam@lehno.app", motif: "Réception constatée",
    },
  ],
};

const MOUVEMENTS = {
  items: [
    { id: "m-1", utilisateur: "awa", type: "purchase", source: "purchase", montant: 10, paiementId: "p-1", note: null, creeLe: "2026-08-26T09:30:00.000Z" },
    { id: "m-2", utilisateur: "awa", type: "adjustment", source: "correction", montant: -2, paiementId: null, note: "Octroi en double", creeLe: "2026-08-26T10:00:00.000Z" },
  ],
  nextCursor: null,
};

const PALIERS = { items: [{ id: "b-1", montant: 1000, devise: "XAF", credits: 10, remisePourcent: null, position: 2, actif: true }] };
const CANAUX = { items: [{ id: "c-1", nature: "mobile_money", operateur: "mtn_momo", pays: "CM", libelle: "MTN Mobile Money", fraisPourcent: 2, fraisFixe: 0, fraisMin: null, fraisMax: null, fraisPortesPar: "payer", devise: "XAF", actif: true, position: 1 }] };
const COMPTES = { items: [{ id: "a-1", libelle: "Orange Money principal", operateur: "orange_money", numero: "690000000", visibleDansApp: true, actif: true, position: 1 }] };

const reponse = (statut: number, corps?: unknown): Response =>
  new Response(corps === undefined ? null : JSON.stringify(corps), {
    status: statut,
    headers: corps === undefined ? {} : { "content-type": "application/json" },
  });

function serveur(routes: Record<string, (url: string, init?: RequestInit) => Response> = {}) {
  const parDefaut: Record<string, (url: string, init?: RequestInit) => Response> = {
    "/admin/payments/p-1": () => reponse(200, DETAIL),
    "/admin/payments": () => reponse(200, PAIEMENTS),
    "/admin/credit-transactions": () => reponse(200, MOUVEMENTS),
    "/admin/credit-bundles": () => reponse(200, PALIERS),
    "/admin/payment-channels": () => reponse(200, CANAUX),
    "/admin/collection-accounts": () => reponse(200, COMPTES),
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
  appels.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "POST");

async function ouvrir(utilisateur: ReturnType<typeof userEvent.setup>, role: "admin" | "support" = "admin") {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role });
  render(<App />);
  await allerA(utilisateur, "credits");
}

/* Ouvrir l'entrée d'une section : les paiements vivent désormais dans un
   accordéon, et l'entrée est repliée tant qu'on n'a pas déplié son intitulé.
   Le geste est celui d'un humain — on ouvre, puis on choisit. */
async function allerA(utilisateur: ReturnType<typeof userEvent.setup>, section: string): Promise<void> {
  // Le fil d'Ariane est lui aussi une région de navigation : on vise la
  // première, celle de la barre latérale.
  const nav = screen.getAllByRole("navigation")[0] as HTMLElement;
  const t2 = t as unknown as { sections: Record<string, string> };
  const PARENTS: Record<string, string> = {
    credits: "paiements", transactionsToutes: "paiements",
    versementsManuels: "paiements", canauxPaiement: "paiements",
  };
  /* On OUVRE si besoin, on ne bascule pas : l'intitulé est un interrupteur, et
     le cliquer alors que la section est déjà ouverte la referme — le deuxième
     écran d'une même section devenait alors introuvable. */
  const parent = PARENTS[section];
  if (parent && !within(nav).queryByText(t2.sections[section] as string)) {
    const intitule = within(nav).queryByText(t2.sections[parent] as string);
    if (intitule) await utilisateur.click(intitule);
  }
  await utilisateur.click(within(nav).getByText(t2.sections[section] as string));
}

describe("les crédits et paiements", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("lit les paiements auprès du serveur", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur();
    await ouvrir(utilisateur);

    expect(await screen.findByText("awa")).toBeInTheDocument();
    expect(appels.mock.calls.some(([u]) => String(u).includes("/admin/payments"))).toBe(true);
  });

  // Un écart non constaté n'est pas un écart nul : le premier dit « personne
  // n'a regardé », le second « on a regardé et il n'y avait rien ».
  it("un écart non constaté ne s'affiche pas zéro", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);
    await screen.findByText("awa");

    const ligne = screen.getByText("awa").closest("tr") as HTMLElement;
    expect(within(ligne).getAllByText(t.credits.paiements.nonConstate).length).toBeGreaterThan(0);
    expect(within(ligne).queryByText("0")).not.toBeInTheDocument();
  });

  it("la méthode ne paraît que par ses derniers chiffres", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);

    expect(await screen.findByText("MTN MoMo ••••1234")).toBeInTheDocument();
  });

  it("le filtre d'état part au serveur", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur();
    await ouvrir(utilisateur);
    await screen.findByText("awa");

    await utilisateur.selectOptions(screen.getByLabelText(t.credits.paiements.filtreEtat), "succeeded");

    await waitFor(() => expect(
      appels.mock.calls.some(([u]) => String(u).includes("etat=succeeded")),
    ).toBe(true));
  });

  // ─── Le détail et son histoire ─────────────────────────────────────────────

  it("ouvrir un paiement demande son détail", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur();
    await ouvrir(utilisateur);
    await utilisateur.click(await screen.findByText("awa"));

    await waitFor(() => expect(
      appels.mock.calls.some(([u]) => String(u).includes("/admin/payments/p-1")),
    ).toBe(true));
  });

  // « L'historique de ses états — chacun avec sa durée. » C'est ce qu'on vient
  // chercher : combien de temps ce paiement est resté en attente.
  it("l'histoire montre la durée de chaque état", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);
    await utilisateur.click(await screen.findByText("awa"));

    expect(await screen.findByText("30 min")).toBeInTheDocument();
  });

  // L'état courant dure encore : lui donner une durée figerait une mesure qui
  // bouge.
  it("l'état courant se dit en cours, sans durée", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);
    await utilisateur.click(await screen.findByText("awa"));

    expect(await screen.findByText(t.credits.detail.enCours)).toBeInTheDocument();
  });

  it("l'écart constaté se lit sur le détail", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);
    await utilisateur.click(await screen.findByText("awa"));

    expect(await screen.findByText("-100 XAF")).toBeInTheDocument();
  });

  // ─── La décision ───────────────────────────────────────────────────────────

  // « Le justificatif ne prouve rien. L'écran doit porter ce rappel — il évite
  // l'approbation machinale. »
  it("le rappel que le reçu ne prouve rien est sur l'écran", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur({ "/admin/payments/p-1": () => reponse(200, { ...DETAIL, etat: "pending" }) });
    await ouvrir(utilisateur);
    await utilisateur.click(await screen.findByText("awa"));

    expect(await screen.findByText(t.credits.decision.avertissement)).toBeInTheDocument();
  });

  it("confirmer envoie le montant constaté, la référence et le motif", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur({
      "/admin/payments/p-1": (_u, init) => (init?.method === "POST"
        ? reponse(200, { id: "p-1", etat: "succeeded", creditsOctroyes: 10, ecart: 0 })
        : reponse(200, { ...DETAIL, etat: "pending", recuSurLeCompte: null, ecart: null })),
    });
    await ouvrir(utilisateur);
    await utilisateur.click(await screen.findByText("awa"));

    await utilisateur.type(await screen.findByLabelText(t.credits.decision.montantRecu), "1000");
    await utilisateur.type(screen.getByLabelText(t.credits.decision.reference), "MP260826.1200.A11111");
    await utilisateur.click(screen.getByRole("button", { name: t.credits.decision.confirmer }));
    await utilisateur.selectOptions(
      await screen.findByLabelText(t.confirmation.motif),
      t.credits.decision.dialogueConfirmer.motifs[0] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    await waitFor(() => {
      expect(ecritures(appels)).toHaveLength(1);
      const corps = JSON.parse((ecritures(appels)[0]?.[1] as RequestInit).body as string);
      expect(corps).toEqual({
        decision: "confirmer", montantRecu: 1000,
        reference: "MP260826.1200.A11111",
        reason: t.credits.decision.dialogueConfirmer.motifs[0],
      });
    });
  });

  // Le montant reçu se renseigne toujours : sans lui, on ne saurait pas si le
  // silence vaut « rien à signaler » ou « personne n'a regardé ».
  it("confirmer sans montant constaté n'est pas possible", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur({ "/admin/payments/p-1": () => reponse(200, { ...DETAIL, etat: "pending", recuSurLeCompte: null }) });
    await ouvrir(utilisateur);
    await utilisateur.click(await screen.findByText("awa"));

    await screen.findByLabelText(t.credits.decision.montantRecu);

    expect(screen.getByRole("button", { name: t.credits.decision.confirmer })).toBeDisabled();
  });

  it("un paiement déjà tranché n'offre plus de décision", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);
    await utilisateur.click(await screen.findByText("awa"));
    await screen.findByText(t.credits.detail.enCours);

    expect(screen.queryByRole("button", { name: t.credits.decision.confirmer })).not.toBeInTheDocument();
  });

  // ─── Les mouvements ────────────────────────────────────────────────────────

  it("l'onglet des mouvements lit sa liste", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur();
    await ouvrir(utilisateur);
    await screen.findByText("awa");

    await utilisateur.click(screen.getByRole("tab", { name: new RegExp(t.credits.onglets.mouvements) }));

    await waitFor(() => expect(
      appels.mock.calls.some(([u]) => String(u).includes("/admin/credit-transactions")),
    ).toBe(true));
  });

  // Une correction ne s'annonce pas comme un cadeau : c'est toute la raison de
  // la scission.
  it("chaque origine se dit dans le mot qui lui revient", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);
    await screen.findByText("awa");
    await utilisateur.click(screen.getByRole("tab", { name: new RegExp(t.credits.onglets.mouvements) }));

    expect(await screen.findByText(t.credits.mouvements.sources.correction)).toBeInTheDocument();
    expect(screen.queryByText(t.credits.mouvements.sources.gift)).not.toBeInTheDocument();
  });

  // ─── Les réglages ──────────────────────────────────────────────────────────

  it("l'onglet des réglages porte les trois tables", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);
    await screen.findByText("awa");

    await utilisateur.click(screen.getByRole("tab", { name: new RegExp(t.credits.onglets.reglages) }));

    /* Borné au contenu : « Canaux et barèmes » nomme désormais AUSSI l'entrée
       de menu qui ouvre cet onglet. Chercher dans tout le document trouverait
       les deux — et le test échouerait pour une raison qui n'est pas la
       sienne. */
    const contenu = screen.getByRole("main");
    expect(await within(contenu).findByText(t.credits.reglages.paliers.titre)).toBeInTheDocument();
    expect(within(contenu).getByText(t.credits.reglages.canaux.titre)).toBeInTheDocument();
    expect(within(contenu).getByText(t.credits.reglages.comptes.titre)).toBeInTheDocument();
  });

  // Le numéro d'un compte de collecte est un compte du SERVICE : il se dicte à
  // un client et se lit sur l'application de l'opérateur. Il paraît en entier.
  it("le numéro d'un compte de collecte paraît en entier", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);
    await screen.findByText("awa");
    await utilisateur.click(screen.getByRole("tab", { name: new RegExp(t.credits.onglets.reglages) }));

    expect(await screen.findByText("690000000")).toBeInTheDocument();
  });

  // ─── Les droits ────────────────────────────────────────────────────────────

  // « Consulter les paiements et les mouvements » appartient au support ; en
  // revanche il ne décide pas, et les réglages sont de la famille Économie.
  it("le support lit les paiements sans pouvoir décider", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur({ "/admin/payments/p-1": () => reponse(200, { ...DETAIL, etat: "pending" }) });
    await ouvrir(utilisateur, "support");
    await utilisateur.click(await screen.findByText("awa"));

    expect(screen.queryByRole("button", { name: t.credits.decision.confirmer })).not.toBeInTheDocument();
  });

  it("le support ne voit pas l'onglet des réglages", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur, "support");
    await screen.findByText("awa");

    expect(screen.queryByRole("tab", { name: new RegExp(t.credits.onglets.reglages) })).not.toBeInTheDocument();
  });
});

/* Les quatre entrées de la section « Paiements » ouvrent le MÊME écran avec un
   cadrage différent. Sans ces cas, rien ne distinguerait quatre entrées qui
   mènent au même endroit d'une seule entrée répétée quatre fois. */
describe("les quatre cadrages de la section Paiements", () => {
  beforeEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

  const lectures = (appels: ReturnType<typeof vi.fn>): string[] =>
    appels.mock.calls.map(([u]) => String(u)).filter((u) => u.includes("/admin/payments?") || u.endsWith("/admin/payments"));

  async function entrer(section: string) {
    const utilisateur = userEvent.setup({ delay: null });
    localStorage.clear();
    magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role: "admin" });
    render(<App />);
    await allerA(utilisateur, section);
    return utilisateur;
  }

  // C'est là qu'on ouvre la section : ce qui attend une décision.
  it("« À vérifier » demande les paiements en attente", async () => {
    const appels = serveur();
    await entrer("credits");

    await waitFor(() => expect(lectures(appels).some((u) => u.includes("etat=pending"))).toBe(true));
  });

  /* Les DEUX voies humaines, pas une : au lancement c'est la seule façon de
     recharger, et n'en montrer qu'une moitié ferait manquer des versements. */
  it("« Versements manuels » demande les deux voies humaines", async () => {
    const appels = serveur();
    await entrer("versementsManuels");

    await waitFor(() => expect(lectures(appels).some((u) => u.includes("mode=manuel"))).toBe(true));
  });

  it("« Toutes les transactions » ne pose aucun filtre", async () => {
    const appels = serveur();
    await entrer("transactionsToutes");

    await waitFor(() => expect(lectures(appels).length).toBeGreaterThan(0));
    const derniere = lectures(appels).at(-1) ?? "";
    expect(derniere).not.toContain("etat=");
    expect(derniere).not.toContain("mode=");
  });

  it("« Canaux et barèmes » ouvre l'onglet des réglages", async () => {
    serveur();
    await entrer("canauxPaiement");

    const contenu = screen.getByRole("main");
    expect(await within(contenu).findByText(t.credits.reglages.canaux.titre)).toBeInTheDocument();
  });

  /* Le cadrage est un point de départ, pas une prison. Changer de filtre ensuite
     ne fait pas quitter l'entrée : on n'a pas changé de page, on l'a réglée. */
  it("changer de filtre ne quitte pas l'entrée", async () => {
    const appels = serveur();
    const utilisateur = await entrer("versementsManuels");
    await screen.findByText("awa");

    await utilisateur.selectOptions(
      screen.getByLabelText(t.credits.paiements.filtreEtat),
      "succeeded",
    );

    await waitFor(() => expect(lectures(appels).some((u) => u.includes("etat=succeeded"))).toBe(true));
    // L'entrée reste celle où l'on est : le filtre a changé, pas la section.
    const nav = screen.getAllByRole("navigation")[0] as HTMLElement;
    expect(within(nav).getByText(t.sections.versementsManuels)).toBeInTheDocument();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";

const t = messages("fr");

const DEMANDE = {
  id: "s-1", utilisateur: "awa", sujet: "Rappels", corps: "Mon rappel n'est pas parti",
  version: "1.0.0", plateforme: "ios", etat: "open", creeLe: "2026-08-20T09:00:00.000Z",
};
const CLOSE = { ...DEMANDE, id: "s-2", corps: "Déjà réglée", etat: "closed" };
const MESSAGE = {
  id: "m-1", nom: "Karim", email: "karim@exemple.cm", sujet: "question",
  message: "Comment ça marche ?", langue: "fr", creeLe: "2026-08-25T09:00:00.000Z",
};
const INSCRIT = { id: "w-1", email: "Awa+lehno@Exemple.cm", langue: "fr", source: "landing", creeLe: "2026-08-01T09:00:00.000Z" };
const RETOUR_ANONYME = { id: "f-1", utilisateur: null, note: 5, corps: "Pratique", version: "1.0.0", creeLe: "2026-08-24T09:00:00.000Z" };

const reponse = (statut: number, corps?: unknown): Response =>
  new Response(corps === undefined ? null : JSON.stringify(corps), {
    status: statut,
    headers: corps === undefined ? {} : { "content-type": "application/json" },
  });

function serveur(routes: Record<string, (url: string, init?: RequestInit) => Response> = {}) {
  const parDefaut: Record<string, (url: string, init?: RequestInit) => Response> = {
    "/admin/support-requests": (url) => reponse(200, {
      items: url.includes("etat=closed") ? [CLOSE] : [DEMANDE, CLOSE], nextCursor: null,
    }),
    "/admin/contact-messages": () => reponse(200, { items: [MESSAGE], nextCursor: null }),
    "/admin/waitlist": () => reponse(200, { items: [INSCRIT], nextCursor: null }),
    "/admin/feedback": () => reponse(200, { items: [RETOUR_ANONYME], nextCursor: null }),
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

const urlsVers = (appels: ReturnType<typeof vi.fn>, chemin: string): string[] =>
  appels.mock.calls.map(([u]) => String(u)).filter((u) => u.includes(chemin));

async function ouvrir(utilisateur: ReturnType<typeof userEvent.setup>, role: "admin" | "support" = "support") {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role, email: "sam@lehno.app" });
  render(<App />);
  await utilisateur.click(within(screen.getByRole("navigation")).getByText(t.sections.assistance));
}

describe("les quatre files d'assistance", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("lit les demandes auprès du serveur", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur();
    await ouvrir(utilisateur);

    expect(await screen.findByText("Mon rappel n'est pas parti")).toBeInTheDocument();
    expect(urlsVers(appels, "/admin/support-requests").length).toBeGreaterThan(0);
  });

  // « Répondre aux utilisateurs et traiter les cas courants » est la raison
  // d'être du support : la section lui est ouverte.
  it("la section est ouverte au support", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur, "support");

    expect(await screen.findByText("Mon rappel n'est pas parti")).toBeInTheDocument();
  });

  it("le filtre d'état part au serveur", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur();
    await ouvrir(utilisateur);
    await screen.findByText("Mon rappel n'est pas parti");

    await utilisateur.selectOptions(screen.getByLabelText(t.assistance.demandes.filtreEtat), "closed");

    await waitFor(() => expect(
      urlsVers(appels, "/admin/support-requests").some((u) => u.includes("etat=closed")),
    ).toBe(true));
  });

  it("solder une demande envoie l'état et le motif", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur();
    await ouvrir(utilisateur);
    await screen.findByText("Mon rappel n'est pas parti");

    const ligne = screen.getByText("Mon rappel n'est pas parti").closest("tr") as HTMLElement;
    await utilisateur.click(within(ligne).getByRole("button", { name: t.table.actions }));
    await utilisateur.click(await screen.findByRole("menuitem", { name: t.assistance.demandes.gestes.repondre }));
    await utilisateur.selectOptions(
      await screen.findByLabelText(t.confirmation.motif),
      t.assistance.demandes.dialogue.motifs[0] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    await waitFor(() => {
      const ecriture = appels.mock.calls.find(([, i]) => (i as RequestInit)?.method === "PATCH");
      expect(ecriture).toBeDefined();
      expect(String(ecriture?.[0])).toContain("/admin/support-requests/s-1");
      expect(JSON.parse((ecriture?.[1] as RequestInit).body as string)).toEqual({
        etat: "answered", reason: t.assistance.demandes.dialogue.motifs[0],
      });
    });
  });

  // Une demande close ne se marque pas répondue : on la rouvre, ou rien.
  it("une demande close n'offre que sa réouverture", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);
    await screen.findByText("Déjà réglée");

    const ligne = screen.getByText("Déjà réglée").closest("tr") as HTMLElement;
    await utilisateur.click(within(ligne).getByRole("button", { name: t.table.actions }));

    expect(await screen.findByRole("menuitem", { name: t.assistance.demandes.gestes.rouvrir })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: t.assistance.demandes.gestes.repondre })).not.toBeInTheDocument();
  });

  // ─── Les trois registres ───────────────────────────────────────────────────

  // Le serveur transporte une clé, jamais la phrase : c'est ce qui rend l'outil
  // bilingue sans qu'il connaisse la langue de qui l'appelle.
  it("le sujet d'un message est traduit, pas affiché brut", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);
    await screen.findByText("Mon rappel n'est pas parti");

    await utilisateur.click(screen.getByRole("tab", { name: new RegExp(t.assistance.onglets.contact) }));

    expect(await screen.findByText(t.assistance.contact.sujets.question)).toBeInTheDocument();
    expect(screen.queryByText("question")).not.toBeInTheDocument();
  });

  // Aucune de ces trois tables ne porte d'état : leur donner des gestes
  // promettrait un travail qu'aucune ne saurait retenir.
  it("les registres n'offrent aucun geste", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);
    await screen.findByText("Mon rappel n'est pas parti");

    for (const onglet of [t.assistance.onglets.contact, t.assistance.onglets.attente, t.assistance.onglets.retours]) {
      await utilisateur.click(screen.getByRole("tab", { name: new RegExp(onglet) }));
      await waitFor(() => expect(
        screen.queryAllByRole("button", { name: t.table.actions }),
      ).toHaveLength(0));
    }
  });

  // C'est l'adresse saisie qu'on montre, pas sa forme canonique : c'est elle
  // que la personne reconnaîtra.
  it("la liste d'attente montre l'adresse telle qu'elle a été saisie", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);
    await screen.findByText("Mon rappel n'est pas parti");

    await utilisateur.click(screen.getByRole("tab", { name: new RegExp(t.assistance.onglets.attente) }));

    expect(await screen.findByText("Awa+lehno@Exemple.cm")).toBeInTheDocument();
  });

  // Un retour survit au compte qui l'a laissé : l'absence se dit plutôt que de
  // laisser une case vide qu'on prendrait pour un oubli.
  it("un retour sans compte le dit", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);
    await screen.findByText("Mon rappel n'est pas parti");

    await utilisateur.click(screen.getByRole("tab", { name: new RegExp(t.assistance.onglets.retours) }));

    expect(await screen.findByText(t.assistance.retours.anonyme)).toBeInTheDocument();
  });
});

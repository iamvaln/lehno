import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";

const t = messages("fr");

const drapeau = (over: Record<string, unknown> = {}) => ({
  cle: "wall", gouverne: "Le Mur, sa gestion et sa page publique",
  portee: ["app", "public"], requiert: [], emporte: ["wishes", "reservation"],
  ecrans: ["3.10", "public 3.4"], chemins: ["/me/wall*", "/public/walls/{username}"],
  actif: true, effectif: true, misAJourLe: "2026-08-25T09:00:00.000Z", parQui: "sam@lehno.app",
  ...over,
});

const REGISTRE = {
  items: [
    drapeau(),
    drapeau({
      cle: "wishes", gouverne: "Le dépôt de vœux et les vœux reçus",
      portee: ["app", "public"], requiert: ["wall"], emporte: [],
      ecrans: ["public 3.5"], chemins: ["/public/wishes/{token}"],
      // Allumé, mais inerte : son prérequis est éteint.
      actif: true, effectif: false, parQui: null,
    }),
    drapeau({
      cle: "launch.live", gouverne: "Sur la landing : les liens vers les magasins",
      portee: ["public"], requiert: [], emporte: [], ecrans: ["public 3.1"],
      chemins: ["/public/waitlist"], actif: false, effectif: false, parQui: null,
    }),
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

const ecritures = (appels: ReturnType<typeof vi.fn>) =>
  appels.mock.calls.filter(([, init]) => (init as RequestInit)?.method === "PATCH");

const ROUTES = { "/admin/feature-flags": () => reponse(200, REGISTRE) };

async function ouvrir(utilisateur: ReturnType<typeof userEvent.setup>) {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role: "admin" });
  render(<App />);
  await utilisateur.click(within(screen.getByRole("navigation")).getByText(t.sections.fonctionnalites));
}

describe("les fonctionnalités, allumées et éteintes", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("lit le registre auprès du serveur", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur(ROUTES);
    await ouvrir(utilisateur);

    expect(await screen.findByText("Le Mur, sa gestion et sa page publique")).toBeInTheDocument();
    expect(appels.mock.calls.some(([u]) => String(u).includes("/admin/feature-flags"))).toBe(true);
  });

  // « Un administrateur doit voir ce qu'il éteint avant de basculer, sans avoir
  // à lire le code » (§5.7). La couverture vient du registre, pas d'une liste
  // recopiée dans l'outil.
  it("montre ce que chaque drapeau couvre", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur(ROUTES);
    await ouvrir(utilisateur);
    await screen.findByText("Le Mur, sa gestion et sa page publique");

    const ligne = screen.getByText("wall").closest("tr") as HTMLElement;
    expect(within(ligne).getByText(/3\.10/)).toBeInTheDocument();
    expect(within(ligne).getByText(/\/me\/wall\*/)).toBeInTheDocument();
  });

  // Un drapeau allumé dont un prérequis est éteint reste inerte. Ne montrer que
  // l'interrupteur laisserait croire qu'une fonctionnalité tourne alors que
  // personne ne la voit.
  it("distingue l'interrupteur de ce qui se produit vraiment", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur(ROUTES);
    await ouvrir(utilisateur);
    await screen.findByText("Le Mur, sa gestion et sa page publique");

    const ligne = screen.getByText("wishes").closest("tr") as HTMLElement;
    expect(within(ligne).getByText(t.drapeaux.etats.inerte)).toBeInTheDocument();
  });

  // Le cœur du §5.7 : les conséquences s'annoncent avant la bascule, pas après.
  it("annonce ce que l'extinction emporte, avant de la faire", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur(ROUTES);
    await ouvrir(utilisateur);
    await screen.findByText("Le Mur, sa gestion et sa page publique");

    await utilisateur.click(screen.getAllByRole("button", { name: t.table.actions })[0] as HTMLElement);
    await utilisateur.click(await screen.findByRole("menuitem", { name: t.drapeaux.eteindre }));

    const dialogue = await screen.findByRole("dialog");
    expect(within(dialogue).getByText(/wishes/)).toBeInTheDocument();
    expect(within(dialogue).getByText(/reservation/)).toBeInTheDocument();
  });

  it("un drapeau qui n'emporte rien ne promet pas de cascade", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur(ROUTES);
    await ouvrir(utilisateur);
    await screen.findByText("Le Mur, sa gestion et sa page publique");

    // « launch.live » est éteint : le geste proposé est de l'allumer.
    await utilisateur.click(screen.getAllByRole("button", { name: t.table.actions })[2] as HTMLElement);
    await utilisateur.click(await screen.findByRole("menuitem", { name: t.drapeaux.allumer }));

    const dialogue = await screen.findByRole("dialog");
    expect(within(dialogue).queryByText(t.drapeaux.emporte)).not.toBeInTheDocument();
  });

  it("basculer envoie la clé, l'état voulu et le motif", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur({
      "/admin/feature-flags": (_u, init) => (init?.method === "PATCH"
        ? reponse(200, { cle: "wall", actif: false })
        : reponse(200, REGISTRE)),
    });
    await ouvrir(utilisateur);
    await screen.findByText("Le Mur, sa gestion et sa page publique");

    await utilisateur.click(screen.getAllByRole("button", { name: t.table.actions })[0] as HTMLElement);
    await utilisateur.click(await screen.findByRole("menuitem", { name: t.drapeaux.eteindre }));
    await utilisateur.selectOptions(
      screen.getByLabelText(t.confirmation.motif),
      t.drapeaux.dialogueEteindre.motifs[0] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    await waitFor(() => {
      expect(ecritures(appels)).toHaveLength(1);
      const corps = JSON.parse((ecritures(appels)[0]?.[1] as RequestInit).body as string);
      expect(corps).toEqual({ cle: "wall", actif: false, reason: t.drapeaux.dialogueEteindre.motifs[0] });
    });
  });

  it("dit qui a basculé en dernier, et se tait quand personne ne l'a fait", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur(ROUTES);
    await ouvrir(utilisateur);
    await screen.findByText("Le Mur, sa gestion et sa page publique");

    expect(within(screen.getByText("wall").closest("tr") as HTMLElement).getByText(/sam@lehno\.app/)).toBeInTheDocument();
    expect(within(screen.getByText("launch.live").closest("tr") as HTMLElement).getByText(t.drapeaux.jamais)).toBeInTheDocument();
  });

  // Le socle n'est pas extinguible : il ne figure pas au registre, donc il ne
  // peut pas paraître ici. Le test le tient depuis l'écran, là où un
  // administrateur le chercherait.
  it("ne propose aucun interrupteur sur le socle", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur(ROUTES);
    await ouvrir(utilisateur);
    await screen.findByText("Le Mur, sa gestion et sa page publique");

    for (const socle of ["persons", "notes", "events", "reminders", "account"]) {
      expect(screen.queryByText(socle)).not.toBeInTheDocument();
    }
  });

  it("reste hors de portée du support", async () => {
    localStorage.clear();
    magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role: "support" });
    serveur(ROUTES);
    render(<App />);

    expect(within(screen.getByRole("navigation")).queryByText(t.sections.fonctionnalites)).not.toBeInTheDocument();
  });
});

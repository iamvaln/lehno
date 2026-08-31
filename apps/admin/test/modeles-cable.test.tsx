import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";

const t = messages("fr");

const modele = (
  id: string, fournisseur: string, modele: string,
  extra: Record<string, unknown> = {},
) => ({
  id, fournisseur, modele, capacite: "text", actif: true,
  enPanneJusquA: null, motifDePanne: null, echecsConsecutifs: 0,
  coutEntree: null, coutSortie: null, emplois: [],
  misAJourLe: "2026-08-20T09:00:00.000Z", ...extra,
});

const CATALOGUE = {
  items: [
    modele("m-1", "anthropic", "claude-opus-5", {
      coutEntree: 3, coutSortie: 15, emplois: [{ tache: "message", rang: 1 }],
    }),
    modele("m-2", "deepseek", "deepseek-chat", {
      emplois: [{ tache: "message", rang: 2 }],
    }),
  ],
};

const CHAINES = {
  items: [{
    tache: "message",
    capaciteRequise: "text",
    rangs: [
      { rang: 1, modeleId: "m-1", fournisseur: "anthropic", modele: "claude-opus-5", actif: true, enPanne: false },
      { rang: 2, modeleId: "m-2", fournisseur: "deepseek", modele: "deepseek-chat", actif: true, enPanne: false },
    ],
    avertissements: [{ code: "chaine_courte", rangs: 2, recommande: 3 }],
  }],
};

// Les deux lectures de l'écran. L'ordre compte : « /admin/ai-models » est un
// préfixe de rien, mais « /admin/ai-routes » doit être reconnu avant le
// repli générique.
const LECTURES = {
  "/admin/ai-routes": () => reponse(200, CHAINES),
  "/admin/ai-models": () => reponse(200, CATALOGUE),
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

/* Le nom d'un modèle figure DEUX fois à l'écran depuis que les chaînes y sont :
   une fois au catalogue, une fois à son rang. Les recherches se portent donc
   sur le tableau, sinon elles tombent sur « plusieurs éléments » — un échec qui
   ressemble à un défaut d'affichage alors que c'est le test qui vise mal. */
const tableau = (): HTMLElement => screen.getAllByRole("table")[0] as HTMLElement;

const attendreCatalogue = async (nom = "claude-opus-5"): Promise<HTMLElement> =>
  (await waitFor(() => within(tableau()).getByText(nom))) as HTMLElement;

async function ouvrir(utilisateur: ReturnType<typeof userEvent.setup>, role: "admin" | "support" = "admin") {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role });
  render(<App />);
  await utilisateur.click(within(screen.getByRole("navigation")).getByText(t.sections.modeles));
}

describe("les modèles d'IA", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("lit le catalogue auprès du serveur", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur(LECTURES);
    await ouvrir(utilisateur);

    expect(await attendreCatalogue()).toBeInTheDocument();
    expect(appels.mock.calls.some(([u]) => String(u).includes("/admin/ai-models"))).toBe(true);
    // Les deux lectures partent ensemble : une chaîne qui cite un modèle que le
    // catalogue n'a pas encore rendu afficherait un rang sans nom.
    expect(appels.mock.calls.some(([u]) => String(u).includes("/admin/ai-routes"))).toBe(true);
  });

  // Le rang est l'ordre dans lequel on essaie. L'afficher sans le dire
  // laisserait croire à une note ou à une préférence.
  it("montre l'ordre de repli, du premier essayé au dernier", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur(LECTURES);
    await ouvrir(utilisateur);
    await attendreCatalogue();

    const lignes = within(tableau()).getAllByRole("row").slice(1);
    expect(lignes[0]).toHaveTextContent("claude-opus-5");
    expect(lignes[1]).toHaveTextContent("deepseek-chat");
  });

  // Un coût absent n'est pas un coût nul : c'est un modèle qu'on n'a pas encore
  // tarifé. Afficher « 0 » le ferait passer pour gratuit dans un calcul de
  // marge.
  it("dit qu'un coût manque au lieu d'afficher zéro", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur(LECTURES);
    await ouvrir(utilisateur);
    await attendreCatalogue("deepseek-chat");

    const ligne = within(tableau()).getByText("deepseek-chat").closest("tr");
    expect(within(ligne as HTMLElement).getAllByText(t.modeles.sansCout).length).toBeGreaterThan(0);
    expect(within(ligne as HTMLElement).queryByText("0")).not.toBeInTheDocument();
  });

  it("éteindre un modèle demande un motif, et l'envoie", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur({
      "/admin/ai-routes": () => reponse(200, CHAINES),
      "/admin/ai-models": (_url, init) => (init?.method === "PATCH"
        ? reponse(200, { id: "m-1", enabled: false })
        : reponse(200, CATALOGUE)),
    });
    await ouvrir(utilisateur);
    await attendreCatalogue();

    await utilisateur.click(screen.getAllByRole("button", { name: t.table.actions })[0] as HTMLElement);
    await utilisateur.click(await screen.findByRole("menuitem", { name: t.modeles.eteindre }));
    await utilisateur.selectOptions(
      screen.getByLabelText(t.confirmation.motif),
      t.modeles.dialogueEteindre.motifs[0] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    await waitFor(() => {
      expect(ecritures(appels)).toHaveLength(1);
      const corps = JSON.parse((ecritures(appels)[0]?.[1] as RequestInit).body as string);
      expect(corps).toEqual({ id: "m-1", enabled: false, reason: t.modeles.dialogueEteindre.motifs[0] });
    });
  });

  /* Le serveur refuse d'éteindre le dernier modèle en service D'UNE TÂCHE.
     L'écran doit traduire ce refus, pas afficher « erreur interne » — sinon on
     cherche la panne au lieu de lire la règle. */
  it("traduit le refus d'éteindre le dernier modèle d'une tâche", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur({
      "/admin/ai-routes": () => reponse(200, CHAINES),
      "/admin/ai-models": (_url, init) => (init?.method === "PATCH"
        ? reponse(400, { code: "validation_failed", message: "would leave a task with no usable model" })
        : reponse(200, { items: [CATALOGUE.items[0]] })),
    });
    await ouvrir(utilisateur);
    await attendreCatalogue();

    await utilisateur.click(screen.getAllByRole("button", { name: t.table.actions })[0] as HTMLElement);
    await utilisateur.click(await screen.findByRole("menuitem", { name: t.modeles.eteindre }));
    await utilisateur.selectOptions(
      screen.getByLabelText(t.confirmation.motif),
      t.modeles.dialogueEteindre.motifs[0] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    expect(await screen.findByText(t.codes.validation_failed)).toBeInTheDocument();
  });

  // « Le rôle support n'a accès à aucune section de la famille Économie »
  // (brief §2), et une section fermée ne figure pas dans son menu.
  it("reste hors de portée du support", async () => {
    localStorage.clear();
    magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role: "support" });
    serveur(LECTURES);
    render(<App />);

    expect(within(screen.getByRole("navigation")).queryByText(t.sections.modeles)).not.toBeInTheDocument();
  });

  /* Éteint et injoignable se réparent par des gestes opposés : le premier
     attend qu'on le rallume, le second se rouvre seul. Les confondre ferait
     attendre une reprise qui ne viendra jamais. */
  it("distingue un modèle éteint d'un modèle momentanément injoignable", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur({
      "/admin/ai-routes": () => reponse(200, CHAINES),
      "/admin/ai-models": () => reponse(200, {
        items: [modele("m-1", "anthropic", "claude-opus-5", {
          actif: true, enPanneJusquA: "2030-01-01T00:00:00.000Z", echecsConsecutifs: 3,
        })],
      }),
    });
    await ouvrir(utilisateur);
    await attendreCatalogue();

    const ligne = within(tableau()).getByText("claude-opus-5").closest("tr") as HTMLElement;
    // En service ET injoignable : c'est justement l'état où l'on se demande
    // pourquoi rien ne sort.
    expect(within(ligne).getByText(t.modeles.etats.actif)).toBeInTheDocument();
    expect(within(ligne).getByText(t.modeles.etats.enPanne)).toBeInTheDocument();
  });

  /* Le fournisseur est rappelé à chaque rang, et pas seulement au catalogue :
     c'est ce qui rend visible qu'on vient d'aligner deux modèles du même
     hébergeur — une chaîne qu'une seule panne emporte en entier. */
  it("montre le fournisseur à chaque rang de la chaîne", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur(LECTURES);
    await ouvrir(utilisateur);
    await attendreCatalogue();

    const chaine = screen.getByLabelText(t.modeles.taches["message"] as string);
    const rangs = within(chaine).getAllByRole("listitem");
    expect(rangs[0]).toHaveTextContent("anthropic");
    expect(rangs[1]).toHaveTextContent("deepseek");
  });

  // Une chaîne courte n'est pas une erreur : deux fournisseurs seulement
  // produisent des images. On le dit sans l'interdire.
  it("affiche l'avertissement d'une chaîne courte sans le présenter comme une erreur", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur(LECTURES);
    await ouvrir(utilisateur);
    await attendreCatalogue();

    expect(screen.getByText(
      t.modeles.chaines.avertissements.courte.replace("{rangs}", "2").replace("{recommande}", "3"),
    )).toBeInTheDocument();
  });

  /* Promouvoir envoie l'ORDRE ENTIER, jamais un échange de deux rangs : la base
     porte une unicité sur (tâche, rang), et un échange en deux écritures la
     viole au milieu du chemin. */
  it("promouvoir un rang envoie la chaîne entière, réordonnée", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur({
      "/admin/ai-routes": (_url, init) => (init?.method === "PATCH"
        ? reponse(200, { task: "message", ranks: [] })
        : reponse(200, CHAINES)),
      "/admin/ai-models": () => reponse(200, CATALOGUE),
    });
    await ouvrir(utilisateur);
    await attendreCatalogue();

    const chaine = screen.getByLabelText(t.modeles.taches["message"] as string);
    const rangs = within(chaine).getAllByRole("listitem");
    await utilisateur.click(within(rangs[1] as HTMLElement).getByRole("button", { name: t.modeles.chaines.promouvoir }));
    await utilisateur.selectOptions(
      screen.getByLabelText(t.confirmation.motif),
      t.modeles.chaines.dialogue.motifs[0] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    await waitFor(() => {
      const corps = JSON.parse((ecritures(appels)[0]?.[1] as RequestInit).body as string);
      expect(corps.modelIds).toEqual(["m-2", "m-1"]);
      expect(corps.task).toBe("message");
    });
  });

  // Le premier rang ne peut pas monter, le dernier ne peut pas descendre.
  it("n'offre pas de monter le rang qui est déjà premier", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur(LECTURES);
    await ouvrir(utilisateur);
    await attendreCatalogue();

    const chaine = screen.getByLabelText(t.modeles.taches["message"] as string);
    const rangs = within(chaine).getAllByRole("listitem");
    expect(within(rangs[0] as HTMLElement).getByRole("button", { name: t.modeles.chaines.promouvoir })).toBeDisabled();
  });
});

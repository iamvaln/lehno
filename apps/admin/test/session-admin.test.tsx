import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { messages } from "../src/i18n/index.js";
import { magasinLocal, CLE_SESSION } from "../src/api/session.js";

const t = messages("fr");
const ADRESSE = "sam@lehno.app";

const reponse = (statut: number, corps?: unknown): Response =>
  new Response(corps === undefined ? null : JSON.stringify(corps), {
    status: statut,
    headers: corps === undefined ? {} : { "content-type": "application/json" },
  });

// Le serveur rend « support » ; la bande d'aperçu, elle, part sur ce qu'elle
// veut. C'est le serveur qui doit gagner.
const PAIRE = { accessToken: "acces", refreshToken: "refresh", expiresIn: 1800, role: "support" };

// Routé par chemin, pas par ordre d'appel : l'outil charge son tableau de bord
// dès l'entrée, et une file de réponses ordonnée se décale au premier écran qui
// se met à parler tout seul.
const TABLEAU_VIDE = { alertes: [], indicateurs: [], aTraiter: [] };

function serveur(reponses: Record<string, Response> = {}) {
  const appels = vi.fn((url: string) => {
    for (const [chemin, r] of Object.entries(reponses)) {
      if (url.includes(chemin)) return Promise.resolve(r.clone());
    }
    return Promise.resolve(reponse(200, TABLEAU_VIDE));
  });
  vi.stubGlobal("fetch", appels);
  return appels;
}

/** Le premier appel vers ce chemin, quel que soit son rang. */
function appelVers(appels: ReturnType<typeof vi.fn>, chemin: string): [string, RequestInit] {
  const trouve = appels.mock.calls.find(([url]) => String(url).includes(chemin));
  if (!trouve) throw new Error(`aucun appel vers ${chemin}`);
  return trouve as [string, RequestInit];
}

async function entrer(utilisateur: ReturnType<typeof userEvent.setup>) {
  await utilisateur.type(screen.getByLabelText(t.connexion.adresse), ADRESSE);
  await utilisateur.click(screen.getByRole("button", { name: t.connexion.envoyer }));
  await screen.findByLabelText(t.connexion.code);
  await utilisateur.type(screen.getByLabelText(t.connexion.code), "123456");
  await utilisateur.click(screen.getByRole("button", { name: t.connexion.entrer }));
}

describe("la session d'administration, du serveur à l'écran", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("demander un code appelle le serveur avec l'adresse saisie", async () => {
    const appels = serveur({ "/admin/auth/otp": reponse(200, { envoye: true }) });
    const utilisateur = userEvent.setup({ delay: null });
    render(<App />);

    await utilisateur.type(screen.getByLabelText(t.connexion.adresse), ADRESSE);
    await utilisateur.click(screen.getByRole("button", { name: t.connexion.envoyer }));
    await screen.findByLabelText(t.connexion.code);

    const [, init] = appelVers(appels, "/admin/auth/otp");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ email: ADRESSE });
  });

  // Le point de la tâche : le rôle n'est plus un état local qu'on bascule, c'est
  // une réponse du serveur. Un support qui se déclarerait administrateur dans
  // son navigateur ne doit rien y gagner.
  it("le rôle affiché après entrée est celui du serveur", async () => {
    serveur({
      "/admin/auth/otp/verify": reponse(200, PAIRE),
      "/admin/auth/otp": reponse(200, { envoye: true }),
    });
    const utilisateur = userEvent.setup({ delay: null });
    render(<App />);

    await entrer(utilisateur);

    await waitFor(() => expect(screen.getByRole("main")).toBeInTheDocument());

    // Le rôle se lit dans le menu de compte, pas n'importe où sur la page : la
    // bande d'aperçu porte elle aussi le mot « Support », sur son bouton de
    // bascule. Chercher le texte au large attraperait celui-là et passerait
    // même si l'outil affichait « Administrateur ».
    await utilisateur.click(screen.getByRole("button", { name: ADRESSE }));
    const menu = await screen.findByRole("group", { name: ADRESSE });
    expect(within(menu).getByText(t.barre.roleSupport)).toBeInTheDocument();
    expect(within(menu).queryByText(t.barre.roleAdmin)).not.toBeInTheDocument();
  });

  it("une session en magasin ouvre l'outil sans repasser par la connexion", async () => {
    magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role: "admin" });
    serveur();
    render(<App />);

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.queryByLabelText(t.connexion.adresse)).not.toBeInTheDocument();
  });

  it("se déconnecter ferme la session côté serveur et vide le magasin", async () => {
    magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role: "admin" });
    const appels = serveur({ "/admin/auth/session": reponse(204) });
    const utilisateur = userEvent.setup({ delay: null });
    render(<App />);

    // La déconnexion vit dans le menu de compte : c'est la seule sortie de
    // l'outil, et elle n'a pas à être à portée de clic accidentel.
    await utilisateur.click(screen.getByRole("button", { name: "sam@lehno.app" }));
    await utilisateur.click(await screen.findByRole("button", { name: t.barre.deconnexion }));

    await waitFor(() => expect(screen.getByLabelText(t.connexion.adresse)).toBeInTheDocument());
    const [, init] = appelVers(appels, "/admin/auth/session");
    expect(init.method).toBe("DELETE");
    expect(magasinLocal.lire()).toBeNull();
  });

  // Un onglet privé peut refuser le stockage. L'outil doit s'ouvrir quand même,
  // et la session tenir le temps de la visite.
  it("survit à un stockage qui refuse d'écrire", () => {
    const ecrire = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("stockage refusé");
    });
    expect(() => magasinLocal.ecrire({ acces: "a", rafraichissement: "r", role: "admin" })).not.toThrow();
    ecrire.mockRestore();
  });

  it("ignore une session illisible plutôt que de planter au démarrage", () => {
    localStorage.setItem(CLE_SESSION, "{ceci n'est pas du JSON");
    expect(magasinLocal.lire()).toBeNull();
  });

  // Une session dont le rôle ne fait pas partie de ceux qu'on connaît est une
  // session bricolée à la main dans le navigateur.
  it("refuse une session dont la forme ne tient pas", () => {
    localStorage.setItem(CLE_SESSION, JSON.stringify({ acces: "a", rafraichissement: "r", role: "dieu" }));
    expect(magasinLocal.lire()).toBeNull();
  });

  /* Le tableau de bord est la section par DÉFAUT : sa ressource partait au
     montage, avant toute connexion, et recevait 401. Comme `section` ne change
     pas quand on entre, elle ne repartait jamais — l'écran d'accueil affichait
     « le chargement n'a pas abouti » à quiconque venait de se connecter, et il
     fallait cliquer « Réessayer » pour voir son propre tableau de bord.

     Trouvé en pilotant un navigateur, le 28/08. Invisible dans les suites
     jusque-là : les cas d'écran posent une session AVANT de rendre l'outil, si
     bien que le premier appel partait toujours authentifié. */
  it("n'interroge pas le tableau de bord tant qu'on n'est pas entré", async () => {
    const appels = serveur({ "/admin/auth/otp": reponse(200, { envoye: true }) });
    render(<App />);

    await screen.findByLabelText(t.connexion.adresse);
    expect(appels.mock.calls.filter(([u]) => String(u).includes("/admin/dashboard"))).toHaveLength(0);
  });

  it("charge le tableau de bord dès l'entrée, sans qu'on ait à réessayer", async () => {
    const appels = serveur({
      "/admin/auth/otp/verify": reponse(200, PAIRE),
      "/admin/auth/otp": reponse(200, { envoye: true }),
    });
    const utilisateur = userEvent.setup({ delay: null });
    render(<App />);

    await entrer(utilisateur);

    await waitFor(() =>
      expect(appels.mock.calls.some(([u]) => String(u).includes("/admin/dashboard"))).toBe(true));
    expect(screen.queryByRole("button", { name: t.actions.reessayer })).toBeNull();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";

const t = messages("fr");

const MOI = {
  id: "ad-1", email: "sam@lehno.app", displayName: "Sam",
  role: "admin", isActive: true, createdAt: "2026-08-01T09:00:00.000Z",
};
const AUTRE = {
  id: "ad-2", email: "dora@lehno.app", displayName: "Dora",
  role: "support", isActive: true, createdAt: "2026-08-10T09:00:00.000Z",
};
const REVOQUE = {
  id: "ad-3", email: "ancien@lehno.app", displayName: null,
  role: "support", isActive: false, createdAt: "2026-07-01T09:00:00.000Z",
};

const COMPTES = { items: [MOI, AUTRE, REVOQUE] };
const PROFIL = { email: "sam@lehno.app", role: "admin", ajoutePar: null, derniereConnexion: null, sessions: [] };

const reponse = (statut: number, corps?: unknown): Response =>
  new Response(corps === undefined ? null : JSON.stringify(corps), {
    status: statut,
    headers: corps === undefined ? {} : { "content-type": "application/json" },
  });

function serveur(routes: Record<string, (url: string, init?: RequestInit) => Response> = {}) {
  const parDefaut: Record<string, (url: string, init?: RequestInit) => Response> = {
    "/admin/admins": (_u, init) => (init && init.method !== "GET"
      ? reponse(200, { id: "ad-2", role: "admin", isActive: true })
      : reponse(200, COMPTES)),
    "/admin/profile": () => reponse(200, PROFIL),
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
  appels.mock.calls.filter(([u, i]) => {
    const m = (i as RequestInit)?.method;
    return String(u).includes("/admin/admins") && m !== undefined && m !== "GET";
  });

async function ouvrir(utilisateur: ReturnType<typeof userEvent.setup>, role: "admin" | "support" = "admin") {
  localStorage.clear();
  // L'adresse identifie « moi » dans la liste : c'est elle qui décide qu'on ne
  // touche ni à son rôle ni à son accès.
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role, email: "sam@lehno.app" });
  render(<App />);
  await utilisateur.click(within(screen.getByRole("navigation")).getByText(t.sections.acces));
}

describe("les accès d'administration", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("lit la liste auprès du serveur", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur();
    await ouvrir(utilisateur);

    expect(await screen.findByText("dora@lehno.app")).toBeInTheDocument();
    expect(appels.mock.calls.some(([u]) => String(u).includes("/admin/admins"))).toBe(true);
  });

  // « Désactiver, jamais effacer » : le journal garde un acteur sans clé
  // étrangère, précisément pour que la trace survive au compte — mais elle doit
  // encore désigner quelqu'un qu'on puisse nommer.
  it("un compte révoqué reste visible, marqué comme tel", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);
    await screen.findByText("dora@lehno.app");

    const ligne = screen.getByText("ancien@lehno.app").closest("tr") as HTMLElement;
    expect(within(ligne).getByText(t.acces.etats.revoque)).toBeInTheDocument();
  });

  it("inviter envoie l'adresse, le rôle et le motif", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur();
    await ouvrir(utilisateur);
    await screen.findByText("dora@lehno.app");

    await utilisateur.click(screen.getByRole("button", { name: t.acces.inviter.ouvrir }));
    await utilisateur.type(await screen.findByLabelText(t.acces.inviter.email), "karim@lehno.app");
    await utilisateur.selectOptions(screen.getByLabelText(t.acces.inviter.role), "support");
    await utilisateur.click(screen.getByRole("button", { name: t.acces.inviter.confirmer }));
    await utilisateur.selectOptions(
      await screen.findByLabelText(t.confirmation.motif),
      t.acces.inviter.motifs[0] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    await waitFor(() => {
      const corps = JSON.parse((ecritures(appels)[0]?.[1] as RequestInit).body as string);
      expect(corps).toEqual({
        email: "karim@lehno.app", role: "support", reason: t.acces.inviter.motifs[0],
      });
    });
  });

  // « On ne se rétrograde pas soi-même : c'est la même porte que la révocation,
  // ouverte d'un cran de moins. » Le serveur refuse ; l'écran ne doit pas
  // proposer un geste qu'il refusera.
  it("on ne peut agir ni sur son propre rôle ni sur son propre accès", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);
    await screen.findByText("dora@lehno.app");

    // L'adresse paraît aussi dans la barre haute : on lit dans le tableau.
    const tableau = screen.getByRole("table");
    const moi = within(tableau).getByText("sam@lehno.app").closest("tr") as HTMLElement;
    expect(within(moi).queryByRole("button", { name: t.table.actions })).not.toBeInTheDocument();
  });

  it("les autres comptes, eux, portent leurs gestes", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);
    await screen.findByText("dora@lehno.app");

    const autre = screen.getByText("dora@lehno.app").closest("tr") as HTMLElement;
    expect(within(autre).getByRole("button", { name: t.table.actions })).toBeInTheDocument();
  });

  it("changer un rôle envoie le nouveau et son motif", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur();
    await ouvrir(utilisateur);
    await screen.findByText("dora@lehno.app");

    const autre = screen.getByText("dora@lehno.app").closest("tr") as HTMLElement;
    await utilisateur.click(within(autre).getByRole("button", { name: t.table.actions }));
    await utilisateur.click(await screen.findByRole("menuitem", { name: t.acces.gestes.promouvoir }));
    await utilisateur.selectOptions(
      await screen.findByLabelText(t.confirmation.motif),
      t.acces.dialogueRole.motifs[0] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    await waitFor(() => {
      const [url, init] = ecritures(appels)[0] as [string, RequestInit];
      expect(url).toContain("/admin/admins/ad-2");
      expect(init.method).toBe("PATCH");
      expect(JSON.parse(init.body as string)).toEqual({
        role: "admin", reason: t.acces.dialogueRole.motifs[0],
      });
    });
  });

  // La révocation ferme les sessions ouvertes : le dialogue le dit, parce que
  // c'est ce qui distingue « retirer l'accès » de « le retirer plus tard ».
  it("révoquer annonce que les sessions tombent", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);
    await screen.findByText("dora@lehno.app");

    const autre = screen.getByText("dora@lehno.app").closest("tr") as HTMLElement;
    await utilisateur.click(within(autre).getByRole("button", { name: t.table.actions }));
    await utilisateur.click(await screen.findByRole("menuitem", { name: t.acces.gestes.revoquer }));

    // On lit le dictionnaire pour vérifier qu'il DIT quelque chose, pas pour se
    // comparer à lui-même : comparer la conséquence affichée à la conséquence
    // du dictionnaire est vrai par construction, et survivrait à une réécriture
    // qui laisserait tomber le fait. C'est le fait qu'on fixe — les sessions
    // ouvertes tombent —, pas sa formulation.
    const dialogue = await screen.findByRole("dialog");
    expect(dialogue.textContent ?? "").toMatch(/sessions?/i);
    expect(dialogue.textContent ?? "").toMatch(/désactivé|jamais effacé/i);
  });

  it("un compte déjà révoqué ne se révoque pas deux fois", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);
    await screen.findByText("dora@lehno.app");

    // Aucun geste possible : pas de bouton du tout. Un menu qui s'ouvrirait
    // vide promettrait quelque chose sans le tenir.
    const ancien = screen.getByText("ancien@lehno.app").closest("tr") as HTMLElement;

    expect(within(ancien).queryByRole("button", { name: t.table.actions })).not.toBeInTheDocument();
  });

  // Une adresse déjà employée est refusée par le serveur : le refus se traduit,
  // plutôt que de laisser croire à une panne.
  it("une adresse déjà prise se dit dans ses mots", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur({
      "/admin/admins": (_u, init) => (init && init.method !== "GET"
        ? reponse(409, { code: "conflict", message: "an admin already uses this address" })
        : reponse(200, COMPTES)),
    });
    await ouvrir(utilisateur);
    await screen.findByText("dora@lehno.app");

    await utilisateur.click(screen.getByRole("button", { name: t.acces.inviter.ouvrir }));
    await utilisateur.type(await screen.findByLabelText(t.acces.inviter.email), "dora@lehno.app");
    await utilisateur.click(screen.getByRole("button", { name: t.acces.inviter.confirmer }));
    await utilisateur.selectOptions(
      await screen.findByLabelText(t.confirmation.motif),
      t.acces.inviter.motifs[0] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    expect(await screen.findByText(t.codes.conflict)).toBeInTheDocument();
  });

  // « Gérer les accès des administrateurs » figure parmi ce que le support ne
  // fait pas (ux-admin §6), et la section est absente de sa navigation.
  it("la section reste hors de portée du support", async () => {
    localStorage.clear();
    magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role: "support" });
    serveur();
    render(<App />);

    expect(within(screen.getByRole("navigation")).queryByText(t.sections.acces)).not.toBeInTheDocument();
  });
});

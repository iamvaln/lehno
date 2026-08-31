import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";
import { interventions as interventionsDemo } from "../src/fixtures/index.js";

const t = messages("fr");

const COMPTE = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";

const LIGNE = {
  id: COMPTE, pseudo: "awa", email: "awa@lehno.app", etat: "actif", credits: 12,
  inscritLe: "2026-05-02T09:00:00.000Z",
};

const FICHE = {
  id: COMPTE, pseudo: "awa", email: "awa@lehno.app", etat: "actif", langue: "fr",
  inscritLe: "2026-05-02T09:00:00.000Z", derniereConnexion: null, suppressionDemandeeLe: null,
  volumetrie: { proches: 4, occasions: 7, notes: 77, murs: null },
  credits: { solde: 22, achetes: 20, offerts: 5 },
};

const TRACE = {
  items: [
    {
      id: "au-1", date: "2026-08-22T14:02:00.000Z", acteurType: "admin",
      acteurId: "ad-1", action: "credit_adjustment", motif: "Génération échouée de notre fait",
      cibleType: "user", cibleId: COMPTE,
    },
    {
      id: "au-2", date: "2026-08-20T09:41:00.000Z", acteurType: "user",
      acteurId: COMPTE, action: "user_status_update", motif: null,
      cibleType: "user", cibleId: COMPTE,
    },
  ],
  nextCursor: null,
};

const reponse = (statut: number, corps?: unknown): Response =>
  new Response(corps === undefined ? null : JSON.stringify(corps), {
    status: statut,
    headers: corps === undefined ? {} : { "content-type": "application/json" },
  });

function serveur(routes: Record<string, (url: string, init?: RequestInit) => Response> = {}) {
  const table: Record<string, (url: string, init?: RequestInit) => Response> = {
    "/admin/audit-log": () => reponse(200, TRACE),
    [`/admin/users/${COMPTE}`]: () => reponse(200, FICHE),
    "/admin/users": () => reponse(200, { items: [LIGNE], nextCursor: null }),
    ...routes,
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

async function ouvrirFiche(role: "admin" | "support") {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role, email: "sam@lehno.app" });
  render(<App />);
  const utilisateur = userEvent.setup({ delay: null });
  const nav = screen.getByRole("navigation");
  await utilisateur.click(within(nav).getByText(t.sections.comptes));
  await utilisateur.click(await screen.findByText("awa"));
  return utilisateur;
}

/**
 * « Sur chaque objet, l'historique des interventions est consultable depuis son
 * détail » (ux-admin §7).
 *
 * Le pied de fiche a rendu pendant tout le premier lot le même historique
 * fabriqué pour chaque compte, parce qu'un défaut de props le fournissait.
 */
describe("la traçabilité d'un compte vient du journal", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("demande le journal filtré sur ce compte, et sur lui seul", async () => {
    const appels = serveur();
    await ouvrirFiche("admin");

    await waitFor(() => {
      const lecture = appels.mock.calls.map(([u]) => String(u))
        .find((u) => u.includes("/admin/audit-log"));
      expect(lecture).toBeDefined();
      expect(lecture).toContain(`targetId=${COMPTE}`);
      expect(lecture).toContain("targetType=user");
    });
  });

  it("rend ce que le journal dit, et rien de la fixture", async () => {
    serveur();
    await ouvrirFiche("admin");

    const journal = within(await screen.findByRole("list"));
    expect(journal.getByText(TRACE.items[0]!.motif!)).toBeInTheDocument();
    // La fixture portait ses propres motifs : s'ils reparaissent, c'est qu'un
    // défaut de props les a remis en place.
    expect(screen.queryByText(interventionsDemo.items[0]!.motif)).toBeNull();
  });

  it("dit l'action en clair, pas son code", async () => {
    serveur();
    await ouvrirFiche("admin");

    const journal = within(await screen.findByRole("list"));
    expect(journal.getByText(t.journal.filtres.actions.credit_adjustment)).toBeInTheDocument();
    expect(journal.queryByText("credit_adjustment")).toBeNull();
  });

  // Le journal ne porte pas de nom d'auteur — `actorId` n'est pas une clé
  // étrangère, pour qu'une trace survive au compte qu'elle décrit. On dit la
  // qualité plutôt que d'inventer un nom.
  it("dit la qualité de l'auteur, sans inventer de nom", async () => {
    serveur();
    await ouvrirFiche("admin");

    const journal = within(await screen.findByRole("list"));
    expect(journal.getByText(t.journal.acteurs.admin)).toBeInTheDocument();
    expect(journal.getByText(t.journal.acteurs.user)).toBeInTheDocument();
  });

  it("dit l'absence de motif plutôt que de laisser un blanc", async () => {
    serveur();
    await ouvrirFiche("admin");

    const journal = within(await screen.findByRole("list"));
    expect(journal.getByText(t.journal.sansMotif)).toBeInTheDocument();
  });

  // « Le journal d'audit est réservé aux administrateurs » (ux-admin §6). La
  // fiche reste ouverte au support ; c'est son pied de page qui disparaît.
  it("ne demande rien au journal pour un support", async () => {
    const appels = serveur();
    await ouvrirFiche("support");

    await screen.findByText("77");
    expect(appels.mock.calls.map(([u]) => String(u)).some((u) => u.includes("/admin/audit-log"))).toBe(false);
  });

  // La fiche ne doit pas attendre son annexe : un journal lent ou en panne
  // laisse le compte lisible, avec un historique vide.
  it("rend la fiche même si le journal échoue", async () => {
    serveur({ "/admin/audit-log": () => reponse(500, { code: "internal_error" }) });
    await ouvrirFiche("admin");

    expect(await screen.findByText("77")).toBeInTheDocument(); // un compte que seule la fiche porte
  });
});

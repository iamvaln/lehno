import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";

const t = messages("fr");
const c = t.clientsApi;

const client = (sur: Record<string, unknown> = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  clientId: "lehno-ios-prod",
  label: "iOS — production",
  clientType: "mobile_ios",
  environment: "prod",
  isActive: true,
  rotatedAt: null,
  createdAt: "2026-09-01T08:00:00.000Z",
  ...sur,
});

/* LE REGISTRE, DE LA FORME QUE LE SERVEUR LUI DONNE — `{ motifs }`, avec `fr`,
   `en` et `actif`, et les gestes SOUS LEUR NOM SERVEUR. Le schéma est strict :
   un gabarit d'une autre forme ne se lit pas, la liste des motifs revient vide,
   et chaque épreuve éprouve alors le dictionnaire de repli au lieu du registre.
   C'est ainsi qu'un écran qui interrogeait le registre sous « tourner » — un nom
   qui n'existe que chez lui — est resté vert alors que la coupure échouait. */
const MOTIFS = {
  motifs: [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      code: "access_compromised", fr: "Accès compromis", en: "Access compromised",
      actif: true, gestes: ["api_client_rotate", "api_client_update"],
    },
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      code: "new_contract", fr: "Nouveau contrat", en: "New contract",
      actif: true, gestes: ["api_client_create"],
    },
  ],
};

const reponse = (statut: number, corps?: unknown): Response =>
  new Response(corps === undefined ? null : JSON.stringify(corps), {
    status: statut,
    headers: corps === undefined ? {} : { "content-type": "application/json" },
  });

function serveur(routes: Record<string, (url: string, init?: RequestInit) => Response> = {}) {
  const table: Record<string, (url: string, init?: RequestInit) => Response> = {
    "/admin/reasons/all": () => reponse(200, MOTIFS),
    "/admin/api-clients": () => reponse(200, { items: [client()] }),
    ...routes,
  };
  /* Le plus long chemin gagne : la table compare par `includes`, et
     « /api-clients » est un préfixe de « /api-clients/{id}/rotate ». */
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

async function ouvrir(utilisateur: ReturnType<typeof userEvent.setup>, role: "admin" | "support" = "admin") {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role });
  render(<App />);
  const nav = within(screen.getByRole("navigation"));
  await utilisateur.click(nav.getByText(t.familles.outils));
  await utilisateur.click(nav.getByText(t.sections.clientsApi));
}

describe("les clients de l'API", () => {
  beforeEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

  it("liste les paires, avec leur état", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);

    expect(await screen.findByText("iOS — production")).toBeInTheDocument();
    expect(screen.getByText("lehno-ios-prod")).toBeInTheDocument();
    /* JAMAIS TOURNÉE SE DIT : une clé qui n'a pas bougé depuis l'ouverture est
       une information, pas une case vide. */
    expect(screen.getByText(c.jamaisTournee)).toBeInTheDocument();
  });

  /* LA CLÉ NE PARAÎT QU'UNE FOIS, et l'écran le DIT — c'est le seul instant où
     quelqu'un peut la copier. Un panneau qui l'afficherait comme une donnée
     ordinaire ferait perdre des clés. */
  it("montre la clé une fois, en disant qu'elle ne reviendra pas", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur({
      "/admin/api-clients": (_u, init) => (init?.method === "POST"
        ? reponse(201, { ...client(), cle: "lk_secrete_123" })
        : reponse(200, { items: [client()] })),
    });
    await ouvrir(utilisateur);

    await utilisateur.click(await screen.findByRole("button", { name: c.ouvrir }));
    await utilisateur.type(screen.getByLabelText(c.champs.libelle), "Android — recette");
    await utilisateur.selectOptions(screen.getByLabelText(t.confirmation.motif), "Nouveau contrat");
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    expect(await screen.findByText("lk_secrete_123")).toBeInTheDocument();
    // L'avertissement est là, et il précède le secret dans le panneau.
    expect(screen.getByText(c.cle.unique)).toBeInTheDocument();
  });

  /* COUPER OU ROUVRIR NE TOUCHE PAS À LA CLÉ. Attendre une clé d'une réponse
     qui n'en porte pas ferait échouer la lecture sur un geste qui a pourtant
     abouti — et l'écran afficherait une erreur sur une coupure réussie. */
  it("coupe sans attendre de clé", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur({
      "/admin/api-clients/11111111-1111-4111-8111-111111111111": (_u, init) =>
        (init?.method === "PATCH"
          ? reponse(200, client({ isActive: false }))
          : reponse(200, { items: [client()] })),
    });
    await ouvrir(utilisateur);

    const ligne = (await screen.findByText("iOS — production")).closest("tr") as HTMLElement;
    await utilisateur.click(within(ligne).getByRole("button", { name: t.table.actions }));
    await utilisateur.click(await screen.findByRole("menuitem", { name: c.couper }));
    await utilisateur.selectOptions(screen.getByLabelText(t.confirmation.motif), "Accès compromis");
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    await waitFor(() => {
      const envoi = appels.mock.calls.find(([, i]) => (i as RequestInit)?.method === "PATCH");
      expect(envoi).toBeDefined();
      expect(JSON.parse((envoi?.[1] as RequestInit).body as string))
        .toMatchObject({ isActive: false, reasonCode: "access_compromised" });
    });
    // Aucune clé ne s'affiche : le geste n'en produit pas.
    expect(screen.queryByText(c.cle.unique)).toBeNull();
  });

  /* Le support consulte — comprendre quel client a produit un appel fait partie
     de l'assistance —, mais ne coupe rien : c'est un levier, pas une lecture. */
  it("n'offre aucun geste au support", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur, "support");

    expect(await screen.findByText("iOS — production")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: c.ouvrir })).toBeNull();
    expect(screen.queryByRole("button", { name: t.table.actions })).toBeNull();
  });
});

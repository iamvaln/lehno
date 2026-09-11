import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";

const t = messages("fr");
const p = t.studioProfils;

/* La forme EXACTE du contrat : « un profil n'est pas une fiche allégée, c'est
   exactement la matière qu'un gabarit reçoit ». Un décor plus pauvre serait
   refusé à la lecture — le serveur relit `payload` par le schéma —, et l'écran
   n'afficherait rien du tout. */
const contenu = (notes: number) => ({
  langue: "fr" as const,
  orientation: "notre_relation" as const,
  nomDUsage: "Awa",
  registre: "familier" as const,
  lien: "famille_proche" as const, relation: "ma grande sœur",
  genreDuProche: "female" as const, genreDeLAuteur: "male" as const,
  occasionSensible: false,
  notes: Array.from({ length: notes }, (_, i) => ({
    categorie: "gift_ideas", date: "2026-01-0" + ((i % 9) + 1), contenu: `note ${i}`,
  })),
  aEviter: [], texteLibre: null, age: 34,
});

const profil = (over: Record<string, unknown> = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  libelle: "Sœur, fiche riche", sensible: false, contenu: contenu(3),
  creeLe: "2026-09-01T10:00:00.000Z",
  ...over,
});

const REGISTRE = {
  items: [profil(), profil({ id: "22222222-2222-4222-8222-222222222222", libelle: "Collègue", sensible: true })],
  manquant: ["langue_en", "cas_sensible"],
};

const reponse = (statut: number, corps?: unknown): Response =>
  new Response(corps === undefined ? null : JSON.stringify(corps), {
    status: statut,
    headers: corps === undefined ? {} : { "content-type": "application/json" },
  });

function serveur(routes: Record<string, (url: string, init?: RequestInit) => Response> = {}) {
  /* Le type est posé : sans lui il s'infère de la première entrée, qui ne prend
     aucun argument, et les suivantes ne peuvent plus lire l'appel. */
  const table: Record<string, (url: string, init?: RequestInit) => Response> = {
    "/admin/portrait-studio/profiles": () => reponse(200, REGISTRE), ...routes,
  };
  const appels = vi.fn((url: string, init?: RequestInit) => {
    for (const [chemin, rendre] of Object.entries(table)) {
      if (url.includes(chemin)) return Promise.resolve(rendre(url, init));
    }
    return Promise.resolve(reponse(200, { alertes: [], indicateurs: [], aTraiter: [] }));
  });
  vi.stubGlobal("fetch", appels);
  return appels;
}

const ecriture = (appels: ReturnType<typeof vi.fn>, methode: string) =>
  appels.mock.calls.find(([, init]) => (init as RequestInit)?.method === methode);

async function ouvrir(utilisateur: ReturnType<typeof userEvent.setup>, role: "admin" | "support" = "admin") {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role });
  render(<App />);
  const nav = within(screen.getByRole("navigation"));
  await utilisateur.click(nav.getByText(t.sections.studio));
  await utilisateur.click(nav.getByText(t.sections.studioProfils));
}

/** Le menu de la ligne visée : deux profils, donc deux menus. */
async function menuDe(utilisateur: ReturnType<typeof userEvent.setup>, libelle: string) {
  const ligne = (await screen.findByText(libelle)).closest("tr");
  await utilisateur.click(within(ligne!).getByRole("button", { name: t.table.actions }));
}

describe("les profils de simulation du studio", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("liste les éprouvettes avec leur nature et leur richesse", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);

    expect(await screen.findByText("Sœur, fiche riche")).toBeInTheDocument();
    expect(screen.getByText("Collègue")).toBeInTheDocument();
    // Le nombre de notes dit d'un coup d'œil si l'éprouvette est riche ou nue.
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
  });

  /* CE QUI MANQUE, AVANT CE QU'ON A. Le serveur calcule la couverture — « la
     règle est au dictionnaire, pas dans le dessin » — et rien ne l'affichait.
     Un jeu qui ne couvre aucun cas sensible rend des essais rassurants sur une
     configuration qui ne l'est pas. */
  it("annonce les axes qu'aucun profil ne couvre", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);

    const ligne = await screen.findByText(new RegExp(p.couverture.manque));
    expect(ligne).toHaveTextContent(p.axes.langue_en);
    expect(ligne).toHaveTextContent(p.axes.cas_sensible);
  });

  it("se tait quand le jeu couvre tout", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur({ "/admin/portrait-studio/profiles": () => reponse(200, { ...REGISTRE, manquant: [] }) });
    await ouvrir(utilisateur);

    expect(await screen.findByText(p.couverture.complete)).toBeInTheDocument();
  });

  it("renomme un profil sans toucher à son contenu", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur();
    await ouvrir(utilisateur);
    await menuDe(utilisateur, "Sœur, fiche riche");
    await utilisateur.click(screen.getByRole("menuitem", { name: p.renommer }));

    await utilisateur.clear(screen.getByLabelText(p.champs.libelle));
    await utilisateur.type(screen.getByLabelText(p.champs.libelle), "Sœur aînée");
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    const appel = ecriture(appels, "PATCH");
    expect(JSON.parse((appel?.[1] as RequestInit).body as string)).toEqual({ libelle: "Sœur aînée" });
  });

  /* LE CONTRAT REFUSE UN CORPS VIDE — « au moins un champ doit être fourni ».
     Sans ce verrou, refermer le dialogue sans rien toucher partirait en 422, et
     l'écran annoncerait une panne là où il ne s'est rien passé. */
  it("n'envoie rien quand rien n'a bougé", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);
    await menuDe(utilisateur, "Sœur, fiche riche");
    await utilisateur.click(screen.getByRole("menuitem", { name: p.renommer }));

    expect(screen.getByRole("button", { name: t.confirmation.confirmer })).toBeDisabled();
  });

  it("supprime un profil après l'avoir nommé dans la confirmation", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur();
    await ouvrir(utilisateur);
    await menuDe(utilisateur, "Collègue");
    await utilisateur.click(screen.getByRole("menuitem", { name: p.supprimer }));

    /* Le libellé PARAÎT dans la confirmation : sur deux lignes voisines, « ce
       profil » ne dit pas lequel, et c'est irréversible. */
    const dialogue = within(screen.getByRole("dialog"));
    expect(dialogue.getByText(new RegExp("Collègue"))).toBeInTheDocument();
    await utilisateur.click(screen.getByRole("button", { name: p.supprimer }));

    const appel = ecriture(appels, "DELETE");
    expect(String(appel?.[0])).toContain("/admin/portrait-studio/profiles/22222222-2222-4222-8222-222222222222");
  });

  /* Le studio dépense de l'argent réel à chaque essai : il est fermé au
     support « y compris en lecture ». L'écran n'a donc même pas d'entrée. */
  it("reste hors de portée du support", async () => {
    localStorage.clear();
    magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role: "support" });
    serveur();
    render(<App />);

    expect(within(screen.getByRole("navigation")).queryByText(t.sections.studio)).not.toBeInTheDocument();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";
import { allerA } from "./aide-navigation.js";

const t = messages("fr");
const d = t.studioAtelier;

const bilingue = (fr: string, en: string) => ({ fr, en });

const REGLAGES = {
  motifs: { bande: "trame_de_hampes", fondSansImage: "registres" },
  modeles: { illustration: "anthropic:claude-opus-5", photo_style: "replicate:flux-1" },
  voiesImage: [
    { id: "illustration", actif: true, libelle: bilingue("Illustration", "Illustration"), description: null },
  ],
  ambiances: [
    {
      id: "papier", groupe: "illustration_family", actif: true,
      libelle: bilingue("Papier", "Paper"), description: null,
      consigne: bilingue("Un papier grené.", "Grained paper."),
    },
  ],
};

const CONFIG = {
  id: "11111111-1111-4111-8111-111111111111",
  etat: "draft", version: null, empreinte: "abc", reglages: REGLAGES,
  note: null, publieeLe: null, parQui: null, creeeLe: "2026-08-30T08:00:00.000Z",
  essaisReussis: 0, publiable: false, blocage: "aucun_essai_reussi",
};

const PROFIL = {
  id: "22222222-2222-4222-8222-222222222222",
  libelle: "Une amie proche", sensible: false, creeLe: "2026-08-20T08:00:00.000Z",
  // Champ pour champ ce que `ContexteMessage` attend : un profil n'est pas une
  // fiche allégée, c'est exactement la matière qu'un gabarit reçoit.
  contenu: {
    langue: "fr", orientation: "notre_relation", nomDUsage: "Awa",
    registre: "familier", lien: null, relation: "amie",
    genreDuProche: "female", genreDeLAuteur: "unspecified",
    occasionSensible: false, notes: [], aEviter: [], texteLibre: null, age: null,
  },
};

const MODELE = {
  id: "33333333-3333-4333-8333-333333333333",
  cle: "anthropic:claude-opus-5", fournisseur: "anthropic", modele: "claude-opus-5",
  capacite: "image", actif: true, enPanneJusqua: null,
  tarifs: { entree: 1, sortie: 2 },
};

const CANDIDATS = {
  modeles: [MODELE], orientations: ["notre_relation"],
  groupesAmbiance: ["illustration_family"], motifs: ["trame_de_hampes", "registres"],
  champsDuProche: ["prenom"], gabarits: [],
};

const essai = (sur: Record<string, unknown> = {}) => ({
  id: "44444444-4444-4444-8444-444444444444",
  configId: CONFIG.id, profilId: PROFIL.id, etat: "success",
  modele: { fournisseur: "anthropic", cle: "anthropic:claude-opus-5" },
  sortie: { cle: "k", url: "https://example.test/p.png" },
  cout: 12, erreur: null, parQui: "sam@lehno.app", quand: "2026-08-30T09:00:00.000Z",
  ...sur,
});

const reponse = (statut: number, corps?: unknown): Response =>
  new Response(corps === undefined ? null : JSON.stringify(corps), {
    status: statut,
    headers: corps === undefined ? {} : { "content-type": "application/json" },
  });

function serveur(sur: Record<string, (u: string, i?: RequestInit) => Response> = {}) {
  const table: Record<string, (u: string, i?: RequestInit) => Response> = {
    "/admin/portrait-studio/config/publish": () => reponse(200, CONFIG),
    "/admin/portrait-studio/config/history": () => reponse(200, { items: [] }),
    "/admin/portrait-studio/config": () => reponse(200, { enService: null, brouillon: CONFIG }),
    "/admin/portrait-studio/profiles": () => reponse(200, { items: [PROFIL], manquant: [] }),
    "/admin/portrait-studio/candidates": () => reponse(200, CANDIDATS),
    "/admin/portrait-studio/trials": () => reponse(200, { items: [] }),
    ...sur,
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

async function ouvrir(role: "admin" | "support" = "admin") {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "a", rafraichissement: "r", role, email: "sam@lehno.app" });
  render(<App />);
  const utilisateur = userEvent.setup({ delay: null });
  await allerA(utilisateur, "atelier");
  return utilisateur;
}

/**
 * L'Atelier — quatre gestes qui coûtent quatre choses différentes.
 */
describe("l'Atelier, sur les données du serveur", () => {
  beforeEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

  /* Tout est visible en même temps : la chaîne, les deux familles de réglages,
     l'ouvrage, le journal. Un écran qui n'aurait que trois des quatre appels ne
     se lirait pas d'un regard. */
  /* Le faux serveur doit parler LE CONTRAT, pas une forme approchante.
     Une enveloppe incomplète — ici `manquant`, oublié sur les profils — fait
     échouer l'analyse, l'écran reste en erreur, et les huit tests suivants
     tombent sur « introuvable » pour une raison qui n'a rien à voir avec ce
     qu'ils éprouvent. Une heure perdue le 30/08. */
  it("les formes du serveur simulé passent le contrat", async () => {
    const { etatPortraitSchema, profilsStudioSchema, candidatsStudioSchema, essaisStudioSchema } =
      await import("@lehno/contracts");
    for (const [nom, schema, valeur] of [
      ["config", etatPortraitSchema, { enService: null, brouillon: CONFIG }],
      ["profiles", profilsStudioSchema, { items: [PROFIL], manquant: [] }],
      ["candidates", candidatsStudioSchema, CANDIDATS],
      ["trials", essaisStudioSchema, { items: [essai()] }],
    ] as const) {
      const r = (schema as { safeParse: (v: unknown) => { success: boolean; error?: unknown } }).safeParse(valeur);
      expect(r.success, `${nom} : ${JSON.stringify((r as { error?: { issues?: unknown } }).error?.issues)}`).toBe(true);
    }
  });

  it("demande de quoi partir, les profils, les modèles et les essais", async () => {
    const appels = serveur();
    await ouvrir();
    await waitFor(() => expect(screen.getByText(d.chaine.titre)).toBeInTheDocument());
    const urls = appels.mock.calls.map(([u]) => String(u));
    for (const chemin of ["/config", "/profiles", "/candidates", "/trials"]) {
      expect(urls.some((u) => u.includes(`/portrait-studio${chemin}`))).toBe(true);
    }
  });

  /* Garder et Écarter n'existent qu'après un essai, ET LE DISENT : cacher le
     second ferait croire qu'un essai raté est irréversible. */
  it("n'ouvre Garder et Écarter qu'après un essai, et le dit", async () => {
    serveur();
    await ouvrir();
    await waitFor(() => expect(screen.getByText(d.gestes.avantEssai)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: d.gestes.garder })).toBeDisabled();
    expect(screen.getByRole("button", { name: d.gestes.ecarter })).toBeDisabled();
  });

  /* Publier reste inerte sans essai réussi et DIT ce qui lui manque : on ne met
     pas en service ce qu'on n'a pas vu. */
  it("laisse Publier inerte, en disant ce qui manque", async () => {
    serveur();
    await ouvrir();
    await waitFor(() => expect(screen.getByText(d.gestes.publierSansEssai)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: d.gestes.publier })).toBeDisabled();
  });

  it("lance un essai avec l'ambiance et le profil choisis", async () => {
    const appels = serveur();
    const utilisateur = await ouvrir();
    await waitFor(() => expect(screen.getByText(d.chaine.titre)).toBeInTheDocument());
    await utilisateur.click(screen.getByRole("button", { name: d.gestes.essayer }));

    await waitFor(() => {
      const envoi = appels.mock.calls.find(([u, i]) =>
        String(u).includes("/portrait-studio/trials") && (i as RequestInit)?.method === "POST");
      expect(envoi).toBeDefined();
      expect(JSON.parse(String((envoi![1] as RequestInit).body))).toMatchObject({
        profileId: PROFIL.id, ambianceId: "papier",
      });
    });
  });

  /* Garder retient le brouillon SANS appeler le modèle : fondre l'enregistrement
     dans la prévisualisation obligerait à payer un appel pour ne pas perdre son
     travail. */
  it("garde le brouillon sans appeler le modèle", async () => {
    const appels = serveur({ "/admin/portrait-studio/trials": () => reponse(200, { items: [essai()] }) });
    const utilisateur = await ouvrir();
    await waitFor(() => expect(screen.getByRole("button", { name: d.gestes.garder })).toBeEnabled());
    await utilisateur.click(screen.getByRole("button", { name: d.gestes.garder }));

    await waitFor(() => {
      const garde = appels.mock.calls.find(([u, i]) =>
        String(u).includes("/portrait-studio/config") && (i as RequestInit)?.method === "PATCH");
      expect(garde).toBeDefined();
    });
    const essaisLances = appels.mock.calls.filter(([u, i]) =>
      String(u).includes("/trials") && (i as RequestInit)?.method === "POST");
    expect(essaisLances).toHaveLength(0);
  });

  /* Trois issues, trois gestes. Un seul « échec » les confondrait, et on
     réessaierait trente fois une demande que le modèle refusera toujours. */
  it("distingue le refus du modèle d'une panne", async () => {
    serveur({
      "/admin/portrait-studio/trials": () => reponse(200, {
        items: [essai({ etat: "refused", sortie: null, erreur: "content_policy" })],
      }),
    });
    await ouvrir();
    await waitFor(() => expect(screen.getByText(d.ouvrage.echecRefus)).toBeInTheDocument());
    expect(screen.queryByText(d.ouvrage.echecPanne)).toBeNull();
    // Pas de repli : c'est bien ce modèle qui a refusé.
    expect(screen.getByText(d.ouvrage.sansRepli)).toBeInTheDocument();
  });

  it("publie avec sa note, une fois un essai réussi", async () => {
    const appels = serveur({
      "/admin/portrait-studio/config": (_u, i) => ((i?.method ?? "GET") === "GET"
        ? reponse(200, { enService: null, brouillon: { ...CONFIG, blocage: null, publiable: true } })
        : reponse(200, CONFIG)),
      "/admin/portrait-studio/trials": () => reponse(200, { items: [essai()] }),
    });
    const utilisateur = await ouvrir();
    await waitFor(() => expect(screen.getByRole("button", { name: d.gestes.publier })).toBeEnabled());
    await utilisateur.click(screen.getByRole("button", { name: d.gestes.publier }));
    await utilisateur.selectOptions(
      screen.getByLabelText(t.confirmation.motif),
      d.publier.motifs[0] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    await waitFor(() => {
      const envoi = appels.mock.calls.find(([u, i]) =>
        String(u).includes("/config/publish") && (i as RequestInit)?.method === "POST");
      expect(envoi).toBeDefined();
      expect(JSON.parse(String((envoi![1] as RequestInit).body))).toMatchObject({
        configId: CONFIG.id, note: d.publier.motifs[0],
      });
    });
  });

  /* Un essai se lance contre un proche simulé : sans profil, l'Atelier le dit
     plutôt que d'offrir un bouton qui échouerait. */
  it("dit qu'il manque un profil d'essai", async () => {
    serveur({ "/admin/portrait-studio/profiles": () => reponse(200, { items: [], manquant: [] }) });
    await ouvrir();
    await waitFor(() => expect(screen.getByText(d.sansProfil.titre)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: d.gestes.essayer })).toBeNull();
  });

  // Le support ne voit pas ce qu'il ne peut pas faire : la section lui est fermée.
  it("reste fermé au support", async () => {
    serveur();
    localStorage.clear();
    magasinLocal.ecrire({ acces: "a", rafraichissement: "r", role: "support", email: "e@lehno.app" });
    render(<App />);
    await waitFor(() => expect(screen.getByRole("navigation")).toBeInTheDocument());
    expect(screen.queryByText(t.sections.atelier)).toBeNull();
  });
});

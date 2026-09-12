import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";
import { allerA } from "./aide-navigation.js";

const t = messages("fr");
const d = t.studioEssais;

const bilingue = (fr: string, en: string) => ({ fr, en });

const REGLAGES = {
  motifs: { bande: "trame_de_hampes", fondSansImage: "registres" },
  modeles: { illustration: "anthropic:claude-opus-5", photo_style: "replicate:flux-1" },
  voiesImage: [
    { id: "illustration", actif: true, libelle: bilingue("Illustration", "Illustration"), description: null },
  ],
  ambiances: [{
    id: "papier", groupe: "illustration_family", actif: true,
    libelle: bilingue("Papier", "Paper"), description: null,
    consigne: bilingue("Un papier grené.", "Grained paper."),
  }],
  /* Même manque que dans la maquette de l'Atelier, et même effet : sans
     `compositions`, le schéma `.strict()` refuse la configuration entière, et
     l'écran ne rend rien. Le symptôme — « Non jugé » introuvable — ne dit rien
     de la cause. */
  compositions: [{
    id: "papier", actif: true,
    libelle: bilingue("Papier", "Paper"), description: null,
    palette: ["#EDEAF7", "#7B6BB7", "#F0CFB4", "#5A4B93"],
    cadre: { fond: "#FFFFFF", bande: "#EDEAF7", texte: "#221F2B", mention: "#5A4B93" },
  }],
};

const config = (id: string, etat: string) => ({
  id, etat, version: etat === "published" ? 7 : null, empreinte: "abc", reglages: REGLAGES,
  note: null, publieeLe: null, parQui: null, creeeLe: "2026-08-30T08:00:00.000Z",
  essaisReussis: 1, publiable: false, blocage: null,
});

const EN_SERVICE = config("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "published");
const BROUILLON = config("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "draft");

const essai = (sur: Record<string, unknown> = {}) => ({
  id: "44444444-4444-4444-8444-444444444444",
  configId: BROUILLON.id, nature: "portrait", profilId: null, etat: "success",
  modele: { fournisseur: "anthropic", cle: "anthropic:claude-opus-5" },
  sortie: { cle: "k", url: "https://example.test/p.png" },
  cout: 12, erreur: null, parQui: "sam@lehno.app", quand: "2026-08-30T09:00:00.000Z",
  verdict: null,
  // L'ambiance éprouvée : nulle pour un essai de message.
  ambianceId: "papier",
  ...sur,
});

const reponse = (statut: number, corps?: unknown): Response =>
  new Response(corps === undefined ? null : JSON.stringify(corps), {
    status: statut,
    headers: corps === undefined ? {} : { "content-type": "application/json" },
  });

function serveur(essais: unknown[], tete: unknown = BROUILLON) {
  const table: Record<string, () => Response> = {
    "/admin/portrait-studio/config/history": () => reponse(200, { items: [EN_SERVICE, BROUILLON] }),
    /* LA TÊTE — déclarée AVANT `trials`, et le tri par longueur s'en charge :
       c'est elle qui dit quelle vignette chaque ambiance porte aujourd'hui. */
    "/admin/portrait-studio/config": () => reponse(200, { enService: EN_SERVICE, brouillon: tete }),
    "/admin/portrait-studio/trials": () => reponse(200, { items: essais }),
  };
  const chemins = Object.keys(table).sort((a, b) => b.length - a.length);
  /* `init` est ignoré par la table mais DÉCLARÉ : c'est lui qu'on relit pour
     savoir ce que l'écran a envoyé, et un faux `fetch` typé sur la seule URL
     passe à l'exécution mais fait rougir le typecheck — c'est-à-dire la CI. */
  const appels = vi.fn((url: string, _init?: RequestInit) => {
    for (const chemin of chemins) {
      if (url.includes(chemin)) return Promise.resolve(table[chemin]!());
    }
    return Promise.resolve(reponse(200, { alertes: [], indicateurs: [], aTraiter: [] }));
  });
  vi.stubGlobal("fetch", appels);
  return appels;
}

async function ouvrir() {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "a", rafraichissement: "r", role: "admin", email: "sam@lehno.app" });
  render(<App />);
  const utilisateur = userEvent.setup({ delay: null });
  await allerA(utilisateur, "essais");
  return utilisateur;
}

/**
 * Les essais — on voit les résultats, pas une liste de réglages.
 */
describe("les essais, sur les données du serveur", () => {
  beforeEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

  /* « Publié » n'est pas un verdict : il se déduit de l'état de la
     configuration. Sans l'historique, l'écran dirait « gardé » d'un essai qui
     tourne en production. */
  it("demande les essais ET les versions publiées", async () => {
    const appels = serveur([essai()]);
    await ouvrir();
    await waitFor(() => expect(screen.getByText(d.sorts.nonJuge)).toBeInTheDocument());
    const urls = appels.mock.calls.map(([u]) => String(u));
    expect(urls.some((u) => u.includes("/portrait-studio/trials"))).toBe(true);
    expect(urls.some((u) => u.includes("/portrait-studio/config/history"))).toBe(true);
  });

  it("déduit « publié » de la configuration, pas du verdict", async () => {
    serveur([essai({ configId: EN_SERVICE.id, verdict: "kept" })]);
    await ouvrir();
    await waitFor(() => expect(screen.getByText(d.sorts.publie)).toBeInTheDocument());
    // Publié l'emporte : dire « gardé » perdrait la seule information qui compte.
    expect(screen.queryByText(d.sorts.kept)).toBeNull();
  });

  /* Un essai écarté NE DISPARAÎT PAS : on l'a jugé mauvais, c'est une
     information, et le revoir évite de refaire le même. */
  it("montre les écartés comme les autres", async () => {
    serveur([
      essai({ id: "11111111-1111-4111-8111-111111111111", verdict: "discarded" }),
      essai({ id: "22222222-2222-4222-8222-222222222222", verdict: "kept" }),
    ]);
    await ouvrir();
    await waitFor(() => expect(screen.getByText(d.sorts.discarded)).toBeInTheDocument());
    expect(screen.getByText(d.sorts.kept)).toBeInTheDocument();
  });

  it("filtre par sort", async () => {
    serveur([
      essai({ id: "11111111-1111-4111-8111-111111111111", verdict: "discarded" }),
      essai({ id: "22222222-2222-4222-8222-222222222222", verdict: "kept" }),
    ]);
    const utilisateur = await ouvrir();
    await waitFor(() => expect(screen.getByText(d.sorts.discarded)).toBeInTheDocument());

    await utilisateur.selectOptions(screen.getByLabelText(d.filtre.libelle), "kept");
    await waitFor(() => expect(screen.queryByText(d.sorts.discarded)).toBeNull());
    expect(screen.getByText(d.sorts.kept)).toBeInTheDocument();
  });

  /* On voit les RÉSULTATS : l'image d'abord, la fiche technique en légende. */
  it("montre ce qui a été produit, la fiche en légende", async () => {
    serveur([essai()]);
    await ouvrir();
    await waitFor(() => expect(screen.getByRole("img", { name: d.carte.alt })).toBeInTheDocument());
    expect(screen.getByText(/anthropic:claude-opus-5/)).toBeInTheDocument();
  });

  /* Aucun essai ne s'efface à la main : ce qui a coûté un appel se garde. Un
     bouton de suppression n'aurait servi qu'à perdre la trace d'une dépense. */
  it("n'offre aucun effacement", async () => {
    serveur([essai({ verdict: "discarded" })]);
    await ouvrir();
    await waitFor(() => expect(screen.getByText(d.rappel)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /supprimer|effacer/i })).toBeNull();
  });

  it("dit quand rien n'a été produit", async () => {
    serveur([]);
    await ouvrir();
    await waitFor(() => expect(screen.getByText(d.vide.titre)).toBeInTheDocument());
  });

  /* L'ambiance décide du modèle appelé : sans elle, deux portraits du même
     modèle sous deux ambiances se ressemblent sans qu'on sache lequel
     éprouvait quoi. La galerie doit donc pouvoir s'y réduire. */
  it("filtre sur l'ambiance éprouvée", async () => {
    serveur([
      essai({ id: "11111111-1111-4111-8111-111111111111", ambianceId: "papier" }),
      essai({ id: "22222222-2222-4222-8222-222222222222", ambianceId: "lilas" }),
    ]);
    const utilisateur = await ouvrir();
    await waitFor(() => expect(screen.getAllByRole("img", { name: d.carte.alt })).toHaveLength(2));

    await utilisateur.selectOptions(screen.getByLabelText(d.filtre.ambiance), "lilas");
    await waitFor(() => expect(screen.getAllByRole("img", { name: d.carte.alt })).toHaveLength(1));
  });

  /* Un filtre qui ne rend jamais rien fait douter du filtre, pas des données :
     on ne propose que les ambiances qui ont produit quelque chose. */
  it("ne propose pas d'ambiance quand aucune n'a produit", async () => {
    serveur([essai({ ambianceId: null })]);
    await ouvrir();
    await waitFor(() => expect(screen.getAllByRole("img", { name: d.carte.alt })).toHaveLength(1));
    expect(screen.queryByLabelText(d.filtre.ambiance)).toBeNull();
  });
  /* ─── Les quatre natures ────────────────────────────────────────────────── */

  /* LA GALERIE RENDAIT DÉJÀ LES QUATRE NATURES — elles partagent la table des
     essais, et `GET trials` n'a pas de filtre. Ce qui manquait était de pouvoir
     les DIRE : deux essais du même modèle, l'un pour le portrait et l'autre
     pour les idées, se ressemblaient. La forme de la sortie ne les sépare pas
     non plus, les trois natures de texte rendant toutes un message. */
  it("nomme la nature de chaque essai", async () => {
    serveur([essai({ nature: "idees", sortie: { message: "Trois idées." } })]);
    await ouvrir();

    expect(await screen.findByText(new RegExp(d.natures.idees))).toBeInTheDocument();
  });

  it("filtre par nature dès qu'il y en a deux", async () => {
    serveur([
      essai({ id: "11111111-1111-4111-8111-111111111111", nature: "portrait" }),
      essai({
        id: "22222222-2222-4222-8222-222222222222",
        nature: "message", ambianceId: null, sortie: { message: "Bon anniversaire." },
      }),
    ]);
    const utilisateur = await ouvrir();
    await waitFor(() => expect(screen.getByText("Bon anniversaire.")).toBeInTheDocument());

    await utilisateur.selectOptions(screen.getByLabelText(d.filtre.nature), "message");

    await waitFor(() => expect(screen.queryByRole("img", { name: d.carte.alt })).toBeNull());
    expect(screen.getByText("Bon anniversaire.")).toBeInTheDocument();
  });

  /* Même raison que pour l'ambiance : un filtre à une seule valeur ne réduit
     rien, et sa présence fait douter des données. */
  it("ne propose pas le filtre quand tout est de la même nature", async () => {
    serveur([essai({ nature: "portrait" })]);
    await ouvrir();
    await waitFor(() => expect(screen.getAllByRole("img", { name: d.carte.alt })).toHaveLength(1));

    expect(screen.queryByLabelText(d.filtre.nature)).toBeNull();
  });

  /* CHANGER DE NATURE REMET L'AMBIANCE. Sans cela, on garderait celle d'une
     nature qu'on vient de quitter — et comme les textes n'en portent aucune, la
     galerie s'ouvrirait vide sans dire pourquoi. */
  it("remet l'ambiance en changeant de nature", async () => {
    serveur([
      essai({ id: "11111111-1111-4111-8111-111111111111", nature: "portrait", ambianceId: "papier" }),
      essai({
        id: "22222222-2222-4222-8222-222222222222",
        nature: "message", ambianceId: null, sortie: { message: "Bon anniversaire." },
      }),
    ]);
    const utilisateur = await ouvrir();
    await waitFor(() => expect(screen.getByText("Bon anniversaire.")).toBeInTheDocument());

    await utilisateur.selectOptions(screen.getByLabelText(d.filtre.ambiance), "papier");
    await waitFor(() => expect(screen.queryByText("Bon anniversaire.")).toBeNull());

    await utilisateur.selectOptions(screen.getByLabelText(d.filtre.nature), "message");

    expect(await screen.findByText("Bon anniversaire.")).toBeInTheDocument();
  });
  /* ─── La vignette d'une ambiance ────────────────────────────────────────── */

  /* PERSONNE NE SAIT DÉPARTAGER « chaleureux » et « sobre » dans l'abstrait : le
     catalogue montre l'image qu'on aura, et le panneau est le seul endroit où
     elle se pose. Le geste était servi et n'existait nulle part à l'écran. */
  it("offre de faire d'un essai la vignette de son ambiance", async () => {
    const appels = serveur([essai()]);
    const utilisateur = await ouvrir();

    await utilisateur.click(await screen.findByRole("button", { name: d.vignette.poser }));

    const envoi = appels.mock.calls.find(([u, i]) =>
      (i as RequestInit)?.method === "PATCH" && String(u).includes("/trials/"));
    /* UN SEUL APPEL pose le verdict ET la référence : les séparer laisserait un
       essai « retenu » sans la vignette demandée, et personne ne saurait que la
       moitié du geste a échoué. */
    expect(JSON.parse((envoi?.[1] as RequestInit).body as string))
      .toEqual({ verdict: "kept", reference: true });
  });

  it("dit celle qui l'est déjà, plutôt que de l'offrir", async () => {
    const tete = config("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "draft");
    tete.reglages = {
      ...REGLAGES,
      ambiances: REGLAGES.ambiances.map((a) => ({ ...a, apercuCle: "k" })),
    };
    serveur([essai()], tete);
    await ouvrir();

    expect(await screen.findByText(d.vignette.estLa)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: d.vignette.poser })).toBeNull();
  });

  /* TROIS REFUS DU SERVEUR, fermés d'avance : une sortie de texte n'a pas
     d'image, un essai sans ambiance n'a rien à représenter, et une ambiance
     disparue de la tête ne se représente plus. */
  it.each([
    ["une sortie sans image", { sortie: { message: "Bon anniversaire." } }],
    ["un essai sans ambiance", { ambianceId: null }],
    ["une ambiance absente de la tête", { ambianceId: "disparue" }],
  ])("n'offre pas le geste sur %s", async (_nom, sur) => {
    serveur([essai(sur)]);
    await ouvrir();
    await waitFor(() => expect(screen.getByText(new RegExp(d.natures.portrait))).toBeInTheDocument());

    expect(screen.queryByRole("button", { name: d.vignette.poser })).toBeNull();
  });

  /* Le studio est fermé au support, et un geste qu'il ne peut pas faire ne
     s'affiche pas — pas même en gris. */
  it("ne l'offre pas au support", async () => {
    localStorage.clear();
    magasinLocal.ecrire({ acces: "a", rafraichissement: "r", role: "support", email: "sam@lehno.app" });
    serveur([essai()]);
    render(<App />);

    expect(within(screen.getByRole("navigation")).queryByText(t.sections.studio)).toBeNull();
  });
});

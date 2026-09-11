import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";

const t = messages("fr");
const a = t.studioTextes;

const orientation = (id: string, actif: boolean) => ({
  id, actif,
  libelle: { fr: `Orientation ${id}`, en: `Angle ${id}` },
  /* Les deux bilingues FACULTATIFS ne le sont ni par un nul ni par une chaîne
     vide : le contrat exige au moins un caractère quand la clé est là. Un décor
     approximatif faisait échouer l'union entière, et l'écran n'affichait rien —
     sept épreuves rouges qui ne parlaient pas de l'écran. */
  description: { fr: "ce qui la distingue", en: "what sets it apart" },
  avertissement: { fr: "à manier avec soin", en: "handle with care" },
  consigne: { fr: "consigne", en: "instruction" },
});

const REGLAGES_MESSAGE = {
  consigneCommune: "Écris court.",
  gardeFous: ["pas d'emoji"],
  champsDuProche: ["relation", "notes"],
  modele: "anthropic:claude-sonnet-5",
  orientations: [orientation("notre_relation", true), orientation("ma_fierte", false)],
};

const REGLAGES_IDEES = {
  consigneCommune: "Reste concret.",
  gardeFous: [],
  champsDuProche: ["relation"],
  modele: "anthropic:claude-sonnet-5",
  nombreDemande: 4,
};

const config = (reglages: unknown, over: Record<string, unknown> = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  etat: "draft", version: null, empreinte: "abc",
  reglages, note: null, publieeLe: null, parQui: null,
  creeeLe: "2026-09-11T08:00:00.000Z",
  essaisReussis: 0, publiable: false, blocage: "aucun_essai_reussi",
  ...over,
});

/* Une version rangée, publiée jadis : c'est la seule sur laquelle on revient.
   L'écran ferme le geste sur une version en service et sur un brouillon jamais
   publié — le serveur refuse les deux. */
const HISTORIQUE = config(REGLAGES_MESSAGE, {
  id: "55555555-5555-4555-8555-555555555555",
  etat: "superseded", version: 3, empreinte: "def",
  note: "Consigne resserrée après un signalement.",
  publieeLe: "2026-09-02T11:00:00.000Z", parQui: "sam@lehno.app",
});

const PROFILS = {
  items: [{
    id: "22222222-2222-4222-8222-222222222222",
    libelle: "Sœur, fiche riche", sensible: false,
    contenu: {
      langue: "fr", orientation: "notre_relation", nomDUsage: "Awa", registre: "familier",
      lien: "famille_proche", relation: "ma grande sœur",
      genreDuProche: "female", genreDeLAuteur: "male", occasionSensible: false,
      notes: [], aEviter: [], texteLibre: null, age: 34,
    },
    creeLe: "2026-09-01T10:00:00.000Z",
  }],
  manquant: [],
};

const CANDIDATS = {
  modeles: [{
    id: "33333333-3333-4333-8333-333333333333",
    cle: "anthropic:claude-sonnet-5", fournisseur: "anthropic", modele: "claude-sonnet-5",
    capacite: "text", actif: true, enPanneJusqua: null,
    /* `tarifs` est un OBJET, jamais nul : « zéro se prendrait pour un fait »,
       donc ce sont ses deux montants qui le sont quand personne ne les a
       saisis. Un `null` ici faisait refuser la réponse entière. */
    tarifs: { entree: null, sortie: null },
  }],
  orientations: ["notre_relation", "ma_fierte"],
  groupesAmbiance: [],
  motifs: [],
  champsDuProche: ["relation", "age", "notes", "texte_libre"],
};

const reponse = (statut: number, corps?: unknown): Response =>
  new Response(corps === undefined ? null : JSON.stringify(corps), {
    status: statut,
    headers: corps === undefined ? {} : { "content-type": "application/json" },
  });

function serveur(routes: Record<string, (url: string, init?: RequestInit) => Response> = {}) {
  const table: Record<string, (url: string, init?: RequestInit) => Response> = {
    /* L'HISTORIQUE SE DÉCLARE AVANT LA CONFIGURATION. La table se parcourt dans
       l'ordre et compare par `includes` : « …/message/config » est un préfixe de
       « …/message/config/history », et le déclarer après lui ferait rendre la
       configuration à la place de l'historique — huit épreuves rouges qui ne
       parleraient pas de l'écran. */
    "/admin/text-studio/message/config/history": () => reponse(200, { items: [HISTORIQUE] }),
    "/admin/text-studio/idees/config/history": () => reponse(200, { items: [] }),
    "/admin/text-studio/message/config": () => reponse(200, {
      enService: null, brouillon: config(REGLAGES_MESSAGE),
    }),
    "/admin/text-studio/idees/config": () => reponse(200, {
      enService: null, brouillon: config(REGLAGES_IDEES),
    }),
    "/admin/portrait-studio/profiles": () => reponse(200, PROFILS),
    "/admin/portrait-studio/candidates": () => reponse(200, CANDIDATS),
    ...routes,
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

const corpsDe = (appel: unknown[] | undefined): Record<string, unknown> =>
  JSON.parse(((appel?.[1] as RequestInit)?.body as string) ?? "{}") as Record<string, unknown>;

async function ouvrir(utilisateur: ReturnType<typeof userEvent.setup>, role: "admin" | "support" = "admin") {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role });
  render(<App />);
  const nav = within(screen.getByRole("navigation"));
  await utilisateur.click(nav.getByText(t.sections.studio));
  await utilisateur.click(nav.getByText(t.sections.textes));
}

describe("l'atelier des textes", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("ouvre sur le message, et lit ce que le serveur en dit", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur();
    await ouvrir(utilisateur);

    expect(await screen.findByLabelText(a.champs.consigne)).toHaveValue("Écris court.");
    expect(appels.mock.calls.some(([u]) => String(u).includes("/text-studio/message/config"))).toBe(true);
  });

  /* CHANGER D'ONGLET CHANGE DE ROUTE, et repart des réglages de la nouvelle
     nature. Sans cette remise, on publierait les garde-fous du message sur les
     idées — et rien à l'écran ne le dirait. */
  it("change de nature, et repart de ses réglages à elle", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur();
    await ouvrir(utilisateur);
    await screen.findByLabelText(a.champs.consigne);

    await utilisateur.click(screen.getByRole("tab", { name: a.natures.idees }));

    expect(await screen.findByLabelText(a.champs.nombreDemande)).toHaveValue(4);
    expect(screen.getByLabelText(a.champs.consigne)).toHaveValue("Reste concret.");
    expect(appels.mock.calls.some(([u]) => String(u).includes("/text-studio/idees/config"))).toBe(true);
    // Le champ propre au message a disparu avec lui.
    expect(screen.queryByText(a.orientations.titre)).not.toBeInTheDocument();
  });

  it("enregistre un brouillon avec les réglages entiers", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur();
    await ouvrir(utilisateur);

    await utilisateur.type(await screen.findByLabelText(a.champs.consigne), " Et vrai.");
    await utilisateur.click(screen.getByRole("button", { name: a.gestes.enregistrer }));

    const corps = corpsDe(ecriture(appels, "PATCH"));
    const reglages = corps["reglages"] as Record<string, unknown>;
    expect(reglages["consigneCommune"]).toBe("Écris court. Et vrai.");
    /* L'OBJET ENTIER part, pas le seul champ touché : c'est lui que le contrat
       valide, et n'envoyer que la différence ferait refuser la requête. */
    expect(reglages["orientations"]).toHaveLength(2);
  });

  /* AU MOINS UNE ORIENTATION ACTIVE. Le contrat le refuse à l'enregistrement ;
     l'écran le dit AVANT d'envoyer, sinon le refus tombe après l'aller-retour. */
  it("ferme l'enregistrement quand plus aucune orientation n'est active", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);

    const cases = await screen.findAllByLabelText(a.orientations.active);
    await utilisateur.click(cases[0]!);

    expect(screen.getByText(a.orientations.aucuneActive)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: a.gestes.enregistrer })).toBeDisabled();
  });

  /* LE SERVEUR DÉCIDE DE LA PUBLICATION. L'écran lit `publiable` et `blocage`
     et dit lequel des trois empêche, plutôt que d'offrir un geste refusé. */
  it("n'offre pas de publier, et dit pourquoi", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);

    expect(await screen.findByText(a.blocages.aucun_essai_reussi)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: a.gestes.publier })).not.toBeInTheDocument();
  });

  it("offre de publier dès que le serveur le permet", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur({
      "/admin/text-studio/message/config": () => reponse(200, {
        enService: null,
        brouillon: config(REGLAGES_MESSAGE, { publiable: true, blocage: null, essaisReussis: 1 }),
      }),
    });
    await ouvrir(utilisateur);

    expect(await screen.findByRole("button", { name: a.gestes.publier })).toBeInTheDocument();
  });

  it("essaie sur une éprouvette et retient le résultat", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur({
      "/admin/text-studio/message/trials": () => reponse(201, {
        configId: "11111111-1111-4111-8111-111111111111",
        essai: {
          id: "44444444-4444-4444-8444-444444444444",
          configId: "11111111-1111-4111-8111-111111111111",
          nature: "message",
          profilId: "22222222-2222-4222-8222-222222222222",
          etat: "success",
          modele: { fournisseur: "anthropic", cle: "claude-sonnet-5" },
          sortie: { message: "Bon anniversaire." }, cout: 0.004, erreur: null,
          parQui: "sam@lehno.app", quand: "2026-09-11T09:00:00.000Z",
          verdict: null, ambianceId: null,
        },
      }),
    });
    await ouvrir(utilisateur);
    await screen.findByLabelText(a.champs.consigne);

    await utilisateur.click(screen.getByRole("button", { name: a.gestes.essayer }));

    const corps = corpsDe(ecriture(appels, "POST"));
    expect(corps["profileId"]).toBe("22222222-2222-4222-8222-222222222222");
    expect(await screen.findByText(new RegExp(a.etats.success))).toBeInTheDocument();
  });

  /* Le studio dépense de l'argent réel à chaque essai : il est fermé au support
     « y compris en lecture ». L'écran n'a donc même pas d'entrée. */
  it("reste hors de portée du support", async () => {
    localStorage.clear();
    magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role: "support" });
    serveur();
    render(<App />);

    expect(within(screen.getByRole("navigation")).queryByText(t.sections.studio)).not.toBeInTheDocument();
  });
  /* ─── L'historique, et le retour arrière ───────────────────────────────── */

  it("liste les publications de la nature affichée", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur();
    await ouvrir(utilisateur);

    expect(await screen.findByText("Consigne resserrée après un signalement.")).toBeInTheDocument();
    expect(appels.mock.calls.some(([u]) => String(u).includes("/text-studio/message/config/history"))).toBe(true);
  });

  /* L'HISTORIQUE SUIT LA NATURE. Le laisser hors de la clé ferait lire les
     publications du message sous l'onglet des idées, et rien ne le dirait. */
  it("relit l'historique en changeant de nature", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur();
    await ouvrir(utilisateur);
    await screen.findByText("Consigne resserrée après un signalement.");

    await utilisateur.click(screen.getByRole("tab", { name: a.natures.idees }));

    expect(await screen.findByText(a.historique.aucune.titre)).toBeInTheDocument();
    expect(screen.queryByText("Consigne resserrée après un signalement.")).not.toBeInTheDocument();
    expect(appels.mock.calls.some(([u]) => String(u).includes("/text-studio/idees/config/history"))).toBe(true);
  });

  it("revient sur une version rangée, avec son motif", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur();
    await ouvrir(utilisateur);

    const ligne = (await screen.findByText("Consigne resserrée après un signalement."))
      .closest("tr") as HTMLElement;
    await utilisateur.click(within(ligne).getByRole("button", { name: t.table.actions }));
    await utilisateur.click(await screen.findByRole("menuitem", { name: a.historique.revenir }));
    await utilisateur.selectOptions(
      await screen.findByLabelText(t.confirmation.motif),
      a.historique.dialogue.motifs[0] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    await waitFor(() => {
      const envoi = appels.mock.calls.find(([u, i]) =>
        (i as RequestInit)?.method === "POST" && String(u).includes("/config/rollback"));
      expect(envoi).toBeDefined();
      /* `reason`, et non `note` : le retour arrière ne dit pas ce que la version
         apporte — elle l'a dit à sa publication —, il dit pourquoi on y revient.
         Et LA NATURE N'Y EST PAS : la configuration visée la porte. */
      expect(corpsDe(envoi)).toEqual({
        configId: "55555555-5555-4555-8555-555555555555",
        reason: a.historique.dialogue.motifs[0],
      });
    });
  });

  /* DEUX LIGNES N'OFFRENT PAS LE GESTE, et le serveur refuserait les deux :
     celle qui est DÉJÀ en service n'a rien à défaire, et un brouillon jamais
     publié n'a été validé par personne — y « revenir » le mettrait en service
     par la porte que la publication ferme. */
  it("ferme le retour sur ce qui sert déjà et sur un brouillon", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur({
      "/admin/text-studio/message/config/history": () => reponse(200, {
        items: [
          config(REGLAGES_MESSAGE, {
            id: "66666666-6666-4666-8666-666666666666",
            etat: "published", version: 4, note: "Celle qui tourne.",
            publieeLe: "2026-09-05T11:00:00.000Z", parQui: "sam@lehno.app",
          }),
          config(REGLAGES_MESSAGE, {
            id: "77777777-7777-4777-8777-777777777777",
            etat: "draft", version: null, note: "Jamais publiée.",
          }),
        ],
      }),
    });
    await ouvrir(utilisateur);

    for (const texte of ["Celle qui tourne.", "Jamais publiée."]) {
      const ligne = (await screen.findByText(texte)).closest("tr") as HTMLElement;
      expect(within(ligne).queryByRole("button", { name: t.table.actions })).not.toBeInTheDocument();
    }
  });
});

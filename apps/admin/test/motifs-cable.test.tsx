import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";

const t = messages("fr");
const m = t.motifs;

const motif = (over: Record<string, unknown> = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  code: "fraude_suspectee", fr: "Fraude suspectée", en: "Suspected fraud",
  actif: true, gestes: ["user_suspend", "credit_adjust"],
  ...over,
});

const REGISTRE = {
  motifs: [
    motif(),
    // Un motif RETIRÉ reste au registre : il doit pouvoir se remettre.
    motif({ id: "22222222-2222-4222-8222-222222222222", code: "erreur_de_saisie", fr: "Erreur de saisie", en: "Data entry error", actif: false, gestes: [] }),
  ],
};

const reponse = (statut: number, corps?: unknown): Response =>
  new Response(corps === undefined ? null : JSON.stringify(corps), {
    status: statut,
    headers: corps === undefined ? {} : { "content-type": "application/json" },
  });

function serveur(routes: Record<string, (url: string, init?: RequestInit) => Response> = {}) {
  /* Le type est POSÉ, sinon il s'infère de la première entrée — qui ne prend
     aucun argument — et les suivantes ne peuvent plus lire l'appel. */
  const table: Record<string, (url: string, init?: RequestInit) => Response> = {
    "/admin/reasons/all": () => reponse(200, REGISTRE), ...routes,
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

const corpsDe = (appels: ReturnType<typeof vi.fn>, methode: string): Record<string, unknown> | null => {
  const appel = appels.mock.calls.find(([, init]) => (init as RequestInit)?.method === methode);
  const brut = appel ? (appel[1] as RequestInit).body : null;
  return typeof brut === "string" ? (JSON.parse(brut) as Record<string, unknown>) : null;
};

async function ouvrir(utilisateur: ReturnType<typeof userEvent.setup>, role: "admin" | "support" = "admin") {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role });
  render(<App />);
  await utilisateur.click(within(screen.getByRole("navigation")).getByText(t.sections.motifs));
}

/** Remplit le dialogue : un motif de la liste, puis on confirme. */
async function confirmer(utilisateur: ReturnType<typeof userEvent.setup>) {
  await utilisateur.selectOptions(screen.getByLabelText(t.confirmation.motif), m.dialogue.motifs[0]!);
  await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));
}

describe("le registre des motifs d'audit", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("lit le registre entier, retirés compris", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);

    expect(await screen.findByText("fraude_suspectee")).toBeInTheDocument();
    /* Le retiré paraît AUSSI : le registre le garde pour qu'on puisse le
       remettre, et un écran qui le cacherait rendrait ce geste impossible. */
    expect(screen.getByText("erreur_de_saisie")).toBeInTheDocument();
  });

  it("ajoute un motif avec son code, ses libellés et sa portée", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur({ "/admin/reasons": (url, init) => reponse((init as RequestInit)?.method === "POST" ? 201 : 200, (init as RequestInit)?.method === "POST" ? { id: "neuf" } : REGISTRE) });
    await ouvrir(utilisateur);
    await utilisateur.click(await screen.findByRole("button", { name: m.ajouter }));

    await utilisateur.type(screen.getByLabelText(m.champs.code), "cout_trop_eleve");
    await utilisateur.type(screen.getByLabelText(m.champs.fr), "Coût trop élevé");
    await utilisateur.type(screen.getByLabelText(m.champs.en), "Cost too high");
    await utilisateur.type(screen.getByLabelText(m.champs.gestes), "feature_flag_update, parameter_update");
    await confirmer(utilisateur);

    expect(corpsDe(appels, "POST")).toMatchObject({
      code: "cout_trop_eleve", fr: "Coût trop élevé", en: "Cost too high",
      // Découpés, élagués : la saisie est libre, ce qui part ne l'est pas.
      gestes: ["feature_flag_update", "parameter_update"],
    });
  });

  /* LE PLANCHER EST CELUI DU CONTRAT, et il se dit à l'écran. Un code refusé
     après quatre champs remplis et un motif choisi fait tout recommencer. */
  it("retient un code que le serveur refuserait", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);
    await utilisateur.click(await screen.findByRole("button", { name: m.ajouter }));

    await utilisateur.type(screen.getByLabelText(m.champs.code), "Fraude Suspectée");
    await utilisateur.type(screen.getByLabelText(m.champs.fr), "Fraude");
    await utilisateur.type(screen.getByLabelText(m.champs.en), "Fraud");
    await utilisateur.type(screen.getByLabelText(m.champs.gestes), "user_suspend");
    await utilisateur.selectOptions(screen.getByLabelText(t.confirmation.motif), m.dialogue.motifs[0]!);

    expect(screen.getByRole("button", { name: t.confirmation.confirmer })).toBeDisabled();
    expect(screen.getByText(m.champs.codeFaux)).toBeInTheDocument();
  });

  /* UN CODE NE SE RENOMME PAS : « le renommer couperait en deux l'historique de
     tout ce qu'il a justifié ». Le champ n'existe donc pas en modification, et
     le code s'affiche en lecture pour qu'on sache lequel on touche. */
  it("n'offre aucun champ de code en modification", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur();
    await ouvrir(utilisateur);
    const ligne = (await screen.findByText("fraude_suspectee")).closest("tr");
    await utilisateur.click(within(ligne!).getByRole("button", { name: t.table.actions }));
    await utilisateur.click(screen.getByRole("menuitem", { name: m.modifier }));

    expect(screen.queryByLabelText(m.champs.code)).not.toBeInTheDocument();
    expect(screen.getByText(m.champs.codeFige)).toBeInTheDocument();
  });

  /* N'ENVOYER QUE CE QUI A BOUGÉ : un PATCH complet rouvrirait une version
     d'historique sur des champs inchangés, et l'on lirait « libellé modifié »
     le jour où l'on a seulement retiré le motif. */
  it("n'envoie que les champs modifiés", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur({ "/admin/reasons/1111": () => reponse(200, { id: "1111" }) });
    await ouvrir(utilisateur);
    const ligne = (await screen.findByText("fraude_suspectee")).closest("tr");
    await utilisateur.click(within(ligne!).getByRole("button", { name: t.table.actions }));
    await utilisateur.click(screen.getByRole("menuitem", { name: m.modifier }));

    await utilisateur.click(screen.getByLabelText(m.champs.actif));
    await confirmer(utilisateur);

    const corps = corpsDe(appels, "PATCH");
    expect(corps).toMatchObject({ actif: false });
    expect(corps).not.toHaveProperty("fr");
    expect(corps).not.toHaveProperty("gestes");
  });

  /* « Le support les emploie, il ne les fabrique pas » : la section est
     réservée à `admin`, et le serveur garde d'ailleurs les trois routes. */
  it("reste hors de portée du support", async () => {
    localStorage.clear();
    magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role: "support" });
    serveur();
    render(<App />);

    expect(within(screen.getByRole("navigation")).queryByText(t.sections.motifs)).not.toBeInTheDocument();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";

const t = messages("fr");

const PARAMETRES = {
  economie: [{
    cle: "credit_price_xaf", valeur: 100, type: "money",
    valeurPrecedente: null, misAJourLe: "2026-08-27T09:00:00.000Z",
  }],
  typesEvenement: [],
};

const reponse = (statut: number, corps?: unknown): Response =>
  new Response(corps === undefined ? null : JSON.stringify(corps), {
    status: statut,
    ...(corps === undefined ? {} : { headers: { "content-type": "application/json" } }),
  });

function serveur(arret: { maintenance: boolean; retryAfterSeconds: number | null; until: string | null }) {
  const appels = vi.fn((url: string) => {
    if (String(url).includes("/admin/maintenance")) return Promise.resolve(reponse(200, arret));
    if (String(url).includes("/admin/parameters")) return Promise.resolve(reponse(200, PARAMETRES));
    return Promise.resolve(reponse(200, { alertes: [], indicateurs: [], aTraiter: [] }));
  });
  vi.stubGlobal("fetch", appels);
  return appels;
}

const gestes = (appels: ReturnType<typeof vi.fn>, methode: string) =>
  appels.mock.calls.filter(([u, i]) =>
    String(u).includes("/admin/maintenance") && (i as RequestInit)?.method === methode);

async function ouvrir() {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role: "admin", email: "sam@lehno.app" });
  render(<App />);
  const utilisateur = userEvent.setup({ delay: null });
  await utilisateur.click(within(screen.getByRole("navigation")).getByText(t.sections.parametres));
  return utilisateur;
}

const OUVERT = { maintenance: false, retryAfterSeconds: null, until: null };
const ARRETE = { maintenance: true, retryAfterSeconds: 900, until: "2026-08-27T20:30:00.000Z" };

describe("l'arrêt pour intervention, dans les paramètres", () => {
  beforeEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

  // L'arrêt vit dans les Paramètres et non dans Fonctionnalités : éteindre une
  // fonctionnalité retire une surface, arrêter le service les suspend toutes.
  it("se trouve dans les paramètres", async () => {
    serveur(OUVERT);
    await ouvrir();

    await screen.findByText(t.arret.titre);
    expect(screen.getByText(t.arret.etats.ouvert)).toBeTruthy();
  });

  it("dit que le service est arrêté, et jusqu'à quand", async () => {
    serveur(ARRETE);
    await ouvrir();

    await screen.findByText(t.arret.etats.arrete);
    // L'heure est mise à celle du lecteur : on vérifie qu'elle est annoncée,
    // pas sa graphie — le fuseau de la machine d'essai n'est pas une règle.
    expect(screen.queryByText(new RegExp(t.arret.sansHeure))).toBeNull();
  });

  // « Pas de "bientôt", pas d'estimation inventée » : sans heure, on le dit.
  it("dit qu'aucune heure n'est annoncée quand il n'y en a pas", async () => {
    serveur({ ...ARRETE, until: null });
    await ouvrir();

    await screen.findByText(new RegExp(t.arret.sansHeure));
  });

  // On ne propose pas de rouvrir ce qui est déjà ouvert : le geste n'aurait
  // aucun effet, et sa présence ferait douter de l'état affiché.
  it("n'offre de rouvrir que si le service est arrêté", async () => {
    serveur(OUVERT);
    await ouvrir();
    await screen.findByText(t.arret.titre);
    expect(screen.queryByRole("button", { name: t.arret.rouvrir })).toBeNull();
  });

  it("l'offre une fois le service arrêté", async () => {
    serveur(ARRETE);
    await ouvrir();
    expect(await screen.findByRole("button", { name: t.arret.rouvrir })).toBeTruthy();
  });

  it("emporte la durée choisie et le motif", async () => {
    const appels = serveur(OUVERT);
    const utilisateur = await ouvrir();
    await screen.findByText(t.arret.titre);

    await utilisateur.selectOptions(screen.getByLabelText(t.arret.duree), "h2");
    await utilisateur.click(screen.getByRole("button", { name: t.arret.arreter }));
    await utilisateur.selectOptions(
      screen.getByLabelText(t.confirmation.motif),
      t.arret.dialogueArreter.motifs[0] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    await waitFor(() => {
      const [envoi] = gestes(appels, "POST");
      expect(envoi).toBeTruthy();
      expect(JSON.parse((envoi?.[1] as RequestInit).body as string)).toEqual({
        dureeMinutes: 120, reason: t.arret.dialogueArreter.motifs[0],
      });
    });
  });

  // « Je ne sais pas encore » n'est pas une durée par défaut : c'est un choix,
  // et il doit voyager comme tel plutôt que d'être remplacé par une valeur.
  it("porte l'absence de durée sans en inventer une", async () => {
    const appels = serveur(OUVERT);
    const utilisateur = await ouvrir();
    await screen.findByText(t.arret.titre);

    await utilisateur.selectOptions(screen.getByLabelText(t.arret.duree), "inconnue");
    await utilisateur.click(screen.getByRole("button", { name: t.arret.arreter }));
    await utilisateur.selectOptions(
      screen.getByLabelText(t.confirmation.motif),
      t.arret.dialogueArreter.motifs[1] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    await waitFor(() => {
      const [envoi] = gestes(appels, "POST");
      expect(JSON.parse((envoi?.[1] as RequestInit).body as string).dureeMinutes).toBeNull();
    });
  });

  it("rouvre avec un motif", async () => {
    const appels = serveur(ARRETE);
    const utilisateur = await ouvrir();

    await utilisateur.click(await screen.findByRole("button", { name: t.arret.rouvrir }));
    await utilisateur.selectOptions(
      screen.getByLabelText(t.confirmation.motif),
      t.arret.dialogueRouvrir.motifs[0] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    await waitFor(() => {
      const [envoi] = gestes(appels, "DELETE");
      expect(envoi).toBeTruthy();
      expect(JSON.parse((envoi?.[1] as RequestInit).body as string)).toEqual({
        reason: t.arret.dialogueRouvrir.motifs[0],
      });
    });
  });

  // L'écran qui dirait « arrêté » sur la foi de son propre clic mentirait le
  // jour où le serveur a refusé. Il relit.
  it("relit l'état après le geste", async () => {
    const appels = serveur(ARRETE);
    const utilisateur = await ouvrir();
    await screen.findByText(t.arret.etats.arrete);
    const lecturesAvant = gestes(appels, "GET").length
      + appels.mock.calls.filter(([u, i]) =>
        String(u).includes("/admin/maintenance") && !(i as RequestInit)?.method).length;

    await utilisateur.click(screen.getByRole("button", { name: t.arret.rouvrir }));
    await utilisateur.selectOptions(
      screen.getByLabelText(t.confirmation.motif),
      t.arret.dialogueRouvrir.motifs[0] as string,
    );
    await utilisateur.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    await waitFor(() => {
      const apres = appels.mock.calls.filter(([u, i]) =>
        String(u).includes("/admin/maintenance")
        && ((i as RequestInit)?.method === undefined || (i as RequestInit)?.method === "GET")).length;
      expect(apres).toBeGreaterThan(lecturesAvant);
    });
  });
});

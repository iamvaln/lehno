import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";

const t = messages("fr");

// Les formes viennent des schémas du contrat, pas d'une invention : un jeu
// d'essai qui ne passerait pas la validation ferait échouer l'écran ici comme
// en production, mais pour une raison qui n'est pas celle qu'on teste.
const ETAT = {
  alertes: [
    {
      id: "a1", cause: "paiement_bloque", libelle: "Trois paiements bloqués",
      ton: "danger", section: "credits", notifieA: "2026-08-25T09:00:00.000Z",
    },
  ],
  indicateurs: [
    {
      id: "i1", libelle: "Comptes actifs", valeur: "1 248",
      variation: { texte: "+4 %", sens: "hausse" }, section: "comptes",
    },
  ],
  aTraiter: [
    { id: "f1", element: "Suppressions en cours", section: "suppressions", etat: "en attente", depuis: "2 jours" },
  ],
};

const reponse = (statut: number, corps?: unknown): Response =>
  new Response(corps === undefined ? null : JSON.stringify(corps), {
    status: statut,
    headers: corps === undefined ? {} : { "content-type": "application/json" },
  });

function serveur(reponses: Response[] | (() => Promise<Response>)) {
  const appels = vi.fn();
  if (typeof reponses === "function") appels.mockImplementation(reponses);
  else {
    for (const r of reponses) appels.mockResolvedValueOnce(r);
    appels.mockResolvedValue(reponse(200, ETAT));
  }
  vi.stubGlobal("fetch", appels);
  return appels;
}

function ouvrir() {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role: "admin" });
  return render(<App />);
}

describe("le tableau de bord sur ses vraies données", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("lit l'état du système auprès du serveur", async () => {
    const appels = serveur([reponse(200, ETAT)]);
    ouvrir();

    expect(await screen.findByText("Trois paiements bloqués")).toBeInTheDocument();
    expect(screen.getByText("1 248")).toBeInTheDocument();
    const [url] = appels.mock.calls[0] as [string];
    expect(url).toContain("/admin/dashboard");
  });

  // Un écran vide dit « tout va bien ». Un écran qui n'a pas pu charger dit
  // autre chose, et c'est cette différence qui compte : sans elle, une panne
  // ressemble à une matinée calme.
  it("un échec de chargement se voit, il ne se confond pas avec un système au calme", async () => {
    serveur([reponse(500, { code: "internal_error", message: "boom" })]);
    ouvrir();

    expect(await screen.findByText(t.echecs.chargement)).toBeInTheDocument();
    expect(screen.queryByText(t.tableau.alertesVide.titre)).not.toBeInTheDocument();
  });

  it("le message d'échec est celui du dictionnaire, jamais celui du serveur", async () => {
    serveur([reponse(500, { code: "internal_error", message: "Prisma P2021 relation missing" })]);
    ouvrir();

    await screen.findByText(t.echecs.chargement);
    expect(screen.queryByText(/Prisma/)).not.toBeInTheDocument();
  });

  it("réessayer relance l'appel", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    const appels = serveur([
      reponse(500, { code: "internal_error", message: "boom" }),
      reponse(200, ETAT),
    ]);
    ouvrir();
    await screen.findByText(t.echecs.chargement);

    await utilisateur.click(screen.getByRole("button", { name: t.actions.reessayer }));

    expect(await screen.findByText("Trois paiements bloqués")).toBeInTheDocument();
    expect(appels).toHaveBeenCalledTimes(2);
  });

  it("une alerte mène à sa section", async () => {
    const utilisateur = userEvent.setup({ delay: null });
    serveur([reponse(200, ETAT)]);
    ouvrir();
    await screen.findByText("Trois paiements bloqués");

    await utilisateur.click(screen.getByText("Trois paiements bloqués"));

    // La section ouverte se lit sur aria-current, qui est ce qu'un lecteur
    // d'écran annonce — pas sur un attribut de style.
    const nav = screen.getByRole("navigation");
    expect(within(nav).getByRole("button", { current: "page" }))
      .toHaveTextContent(t.sections.credits);
  });

  // Le temps de chargement n'est pas rien sur une base de production : sans
  // état d'attente, l'écran paraît vide puis se remplit d'un coup, et on croit
  // à un système sans activité.
  it("annonce qu'il charge avant d'avoir répondu", async () => {
    let repondre: (r: Response) => void = () => {};
    serveur(() => new Promise<Response>((tenir) => { repondre = tenir; }));
    ouvrir();

    expect(screen.getByText(t.actions.chargement)).toBeInTheDocument();

    repondre(reponse(200, ETAT));
    await waitFor(() => expect(screen.getByText("1 248")).toBeInTheDocument());
  });
});

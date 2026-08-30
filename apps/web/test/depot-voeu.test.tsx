import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PublicWishForm } from "@lehno/contracts";
import { DepotVoeu } from "../components/surfaces/DepotVoeu.js";
import { messages } from "../messages/index.js";

const t = messages("fr");

/* Les bornes se calculent à partir d'aujourd'hui : un test qui figerait les
   dates finirait par tester le passé, et la branche « avant ouverture »
   deviendrait « après fermeture » sans que rien ne casse. */
function jour(decalage: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + decalage);
  return d.toISOString().slice(0, 10);
}

function formulaire(sur: Partial<PublicWishForm> = {}): PublicWishForm {
  return {
    recipientDisplayName: "Awa",
    occurrenceDate: jour(10),
    windowOpensOn: jour(-2),
    windowClosesOn: jour(5),
    isOpen: true,
    ...sur,
  };
}

function poser(sur: Partial<PublicWishForm> = {}) {
  return render(
    <DepotVoeu
      t={t} langue="fr" jeton="j1"
      joursRestants={10} aujourdhui={jour(0)}
      formulaire={formulaire(sur)}
    />,
  );
}

describe("le dépôt d'un mot", () => {
  let appels: Array<{ corps: Record<string, unknown> }>;

  const brancher = (reponse: { ok: boolean; status?: number }): void => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      appels.push({ corps: JSON.parse(String(init.body)) as Record<string, unknown> });
      return reponse as Response;
    }));
  };

  beforeEach(() => { appels = []; brancher({ ok: true }); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("dit pour qui, sur une ligne, avant le champ", () => {
    poser();
    expect(screen.getByRole("heading", { level: 1, name: /Awa/ })).toBeInTheDocument();
    expect(screen.getByText(/pour l'anniversaire de Awa/)).toBeInTheDocument();
  });

  /* Le champ de message EST la page : une carte qu'on écrit, la signature en
     pied du même bloc. Le libellé reste posé pour les lecteurs d'écran, mais
     l'œil n'a qu'une chose à faire. */
  it("ouvre le billet pendant la fenêtre", () => {
    poser();
    expect(screen.getByRole("textbox", { name: t.voeuxLabelMessage })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: t.voeuxLabelSignature })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.voeuxEnvoyer })).toBeInTheDocument();
  });

  /* Hors fenêtre, le formulaire n'est pas grisé — il n'est pas là. Un champ
     désactivé se lit comme une panne ; une phrase qui dit la date se lit comme
     une règle. */
  it("retire le billet hors fenêtre, et ne le grise pas", () => {
    poser({ isOpen: false, windowOpensOn: jour(3), windowClosesOn: jour(9) });
    expect(screen.queryByRole("button", { name: t.voeuxEnvoyer })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  /* « Ça s'ouvre le 7 » invite à revenir ; « ça s'est refermé le 7 » clôt. Les
     confondre en un « ce n'est pas ouvert » ferait attendre une réouverture
     qui n'aura pas lieu. */
  it("distingue l'attente de la clôture", () => {
    const { unmount } = poser({ isOpen: false, windowOpensOn: jour(3), windowClosesOn: jour(9) });
    expect(screen.getByText(/s'ouvrent le/)).toBeInTheDocument();
    unmount();

    poser({ isOpen: false, windowOpensOn: jour(-9), windowClosesOn: jour(-3) });
    expect(screen.getByText(/se sont refermés le/)).toBeInTheDocument();
  });

  /* La page s'ouvre MÊME hors fenêtre et rend les bornes : une page qui
     refuserait de se charger ne pourrait pas dire quand revenir. */
  it("donne la date de retour quand c'est fermé", () => {
    poser({ isOpen: false, windowOpensOn: jour(3), windowClosesOn: jour(9) });
    expect(screen.getByText(new RegExp(t.voeuxRevenir))).toBeInTheDocument();
  });

  /* Avant le geste, le générique : promettre « ayez votre Mur » à quelqu'un
     qui n'a pas encore écrit, c'est lui parler d'autre chose que de ce qu'il
     est venu faire. */
  it("garde l'invitation générique tant que rien n'est écrit", () => {
    poser();
    expect(screen.getByText(t.acqTitre)).toBeInTheDocument();
    expect(screen.queryByText(t.acqVoeuxTitre)).toBeNull();
  });

  /* Après le geste, l'invitation parle du contexte : quelqu'un qui vient
     d'écrire un mot a compris à quoi sert un Mur. C'est la seule raison pour
     laquelle cette page est un composant client. */
  it("retourne l'invitation une fois le mot parti", async () => {
    poser();
    await userEvent.type(screen.getByRole("textbox", { name: t.voeuxLabelMessage }), "Bon anniversaire !");
    await userEvent.click(screen.getByRole("button", { name: t.voeuxEnvoyer }));

    await waitFor(() => expect(screen.getByText(t.voeuxConfirmeTexte)).toBeInTheDocument());
    expect(screen.getByText(t.acqVoeuxTitre)).toBeInTheDocument();
    expect(screen.queryByText(t.acqTitre)).toBeNull();
    expect(appels[0]?.corps["content"]).toBe("Bon anniversaire !");
  });

  /* La fenêtre peut se refermer entre le chargement et l'envoi. Ce refus n'est
     pas une panne : le dire comme une erreur réseau ferait réessayer
     indéfiniment quelqu'un qui n'a plus rien à réessayer. */
  it("distingue le refus de fenêtre d'une panne", async () => {
    brancher({ ok: false, status: 403 });
    poser();
    await userEvent.type(screen.getByRole("textbox", { name: t.voeuxLabelMessage }), "Trop tard.");
    await userEvent.click(screen.getByRole("button", { name: t.voeuxEnvoyer }));

    await waitFor(() => expect(screen.getByText(t.voeuxFermeErreur)).toBeInTheDocument());
    expect(screen.queryByText(t.voeuxErreur)).toBeNull();
  });
});

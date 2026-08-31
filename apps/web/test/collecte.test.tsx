import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PublicCollectForm, PublicSubmission } from "@lehno/contracts";
import { Collecte } from "../components/surfaces/Collecte.js";
import { messages } from "../messages/index.js";

const t = messages("fr");

function formulaire(sur: Partial<PublicCollectForm> = {}): PublicCollectForm {
  return {
    type: "nominatif",
    ownerDisplayName: "Awa",
    personDisplayName: "Malik",
    birthDate: "1994-05-21",
    ownerWallUsername: null,
    ...sur,
  };
}

describe("la collecte", () => {
  let appels: Array<Record<string, unknown>>;

  const brancher = (reponse: { ok: boolean; status?: number }): void => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      appels.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      return reponse as Response;
    }));
  };

  const poser = (sur: Partial<PublicCollectForm> = {}, deja: PublicSubmission[] = []) =>
    render(
      <Collecte
        t={t} langue="fr" jeton="j1"
        formulaire={formulaire(sur)} devise="XAF" dejaEnvoye={deja}
      />,
    );

  beforeEach(() => { appels = []; brancher({ ok: true }); });
  afterEach(() => { vi.unstubAllGlobals(); });

  /* On salue d'abord la personne — un lien nominatif désigne quelqu'un —, et
     c'est seulement après qu'on dit de qui vient l'invitation. L'inverse,
     c'est une machine qui se présente avant de dire bonjour. */
  it("salue la personne avant de dire qui invite", () => {
    poser();
    expect(screen.getByRole("heading", { level: 1, name: /Malik/ })).toBeInTheDocument();
    expect(screen.getByText("Awa")).toBeInTheDocument();
  });

  /* Un lien nominatif s'adresse à quelqu'un que le propriétaire a déjà nommé :
     il n'y a rien à vérifier, et les redemander ferait douter le répondant
     d'être au bon endroit. */
  it("ne redemande ni le nom ni la relation sur un lien nominatif", () => {
    poser();
    expect(screen.queryByLabelText(t.collecteLabelNom)).toBeNull();
    expect(screen.queryByLabelText(t.collecteLabelRelation)).toBeNull();
  });

  it("pré-remplit la date que le propriétaire connaît déjà", () => {
    poser();
    expect(screen.getByLabelText(t.collecteLabelDate)).toHaveValue("1994-05-21");
  });

  /* Un lien public accepte n'importe qui : le nom et l'adresse sont ce qui
     permet au propriétaire de savoir à qui il parle. */
  it("demande le nom et l'adresse sur un lien ouvert", async () => {
    poser({ type: "public", personDisplayName: null, birthDate: null });
    expect(screen.getByLabelText(t.collecteLabelNom)).toBeInTheDocument();
    expect(screen.getByLabelText(t.collecteLabelRelation)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(t.collecteLabelDate), "1994-05-21");
    const envoyer = screen.getByRole("button", { name: /Awa/ });
    expect(envoyer).toBeDisabled();

    await userEvent.type(screen.getByLabelText(t.collecteLabelNom), "Sarah");
    await userEvent.type(screen.getByLabelText(t.collecteLabelEmail), "sarah@example.com");
    expect(envoyer).toBeEnabled();
  });

  /* Même règle que collectSubmitSchema : une contribution porte au moins une
     date, un souhait ou un mot. Une soumission vide n'apprend rien et encombre
     la file de validation. */
  it("refuse de partir à blanc", async () => {
    poser({ birthDate: null });
    expect(screen.getByRole("button", { name: /Awa/ })).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox", { name: t.collecteLabelSouhaits }), "Un livre");
    expect(screen.getByRole("button", { name: /Awa/ })).toBeEnabled();
  });

  /* Un prix ne part JAMAIS sans sa devise : « 12 000 » ne dit ni des francs
     CFA ni des euros, et le propriétaire lira ce montant. */
  it("attache la devise au prix, et laisse tomber les lignes vides", async () => {
    poser({ birthDate: null });
    await userEvent.type(screen.getByRole("textbox", { name: t.collecteLabelSouhaits }), "Un livre");
    await userEvent.type(screen.getByLabelText(/Prix indicatif/), "12000");
    await userEvent.click(screen.getByRole("button", { name: t.collecteAjouterSouhait }));
    await userEvent.click(screen.getByRole("button", { name: /Awa/ }));

    await waitFor(() => expect(appels).toHaveLength(1));
    expect(appels[0]?.["wishes"]).toEqual([{ label: "Un livre", price: 12000, currency: "XAF" }]);
  });

  /* Le sort de chaque souhait se montre sans le commenter : « écarté » ne
     s'excuse pas et ne se justifie pas. */
  it("montre le sort de ce qui a déjà été envoyé", () => {
    poser({}, [{
      createdAt: "2026-03-07T10:00:00.000Z",
      status: "validated",
      birthDate: null,
      personalNote: null,
      wishes: [
        { label: "Un livre", reviewStatus: "retained" },
        { label: "Un vélo", reviewStatus: "discarded" },
      ],
    }]);
    expect(screen.getByText(t.collecteDejaTitre)).toBeInTheDocument();
    expect(screen.getByText(t.collecteRetenu)).toBeInTheDocument();
    expect(screen.getByText(t.collecteEcarte)).toBeInTheDocument();
  });

  /* Nul si le propriétaire n'a pas publié son Mur : proposer un lien vers une
     page dépubliée apprendrait qu'elle existe. */
  it("ne propose le Mur que s'il est publié", () => {
    const { unmount } = poser();
    expect(screen.queryByRole("link", { name: /mur de Awa/ })).toBeNull();
    unmount();

    poser({ ownerWallUsername: "awa" });
    expect(screen.getByRole("link", { name: /mur de Awa/ }).getAttribute("href")).toBe("/fr/m/awa");
  });

  /* Après le geste, l'exact retournement de ce qu'on vient de faire — et pas
     avant : promettre « tenez la liste de vos proches » à quelqu'un qui n'a pas
     encore répondu, c'est lui parler d'autre chose. */
  it("retourne l'invitation une fois la réponse partie", async () => {
    poser({ birthDate: null });
    expect(screen.getByText(t.acqTitre)).toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox", { name: t.collecteLabelSouhaits }), "Un livre");
    await userEvent.click(screen.getByRole("button", { name: /Awa/ }));

    await waitFor(() => expect(screen.getByText(t.collecteConfirmeTitre)).toBeInTheDocument());
    expect(screen.getByText(t.acqCollecteTitre)).toBeInTheDocument();
    expect(screen.queryByText(t.acqTitre)).toBeNull();
  });

  /* « Ajouter autre chose » remet un formulaire NEUF : renvoyer les mêmes
     souhaits ferait deux fois la même ligne dans la file du propriétaire. */
  it("repart d'un formulaire vide pour ajouter autre chose", async () => {
    poser({ birthDate: null });
    await userEvent.type(screen.getByRole("textbox", { name: t.collecteLabelSouhaits }), "Un livre");
    await userEvent.click(screen.getByRole("button", { name: /Awa/ }));

    await waitFor(() => expect(screen.getByText(t.collecteConfirmeTitre)).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: t.collecteAjouterEncore }));

    expect(screen.getByRole("textbox", { name: t.collecteLabelSouhaits })).toHaveValue("");
  });
});

/* 410, seul statut de ce genre dans tout le contrat : le lien a existé. Le
   visiteur l'a reçu de quelqu'un — un 404 lui ferait croire qu'il a mal recopié
   l'adresse, et « nous n'avons pas pu répondre » l'enverrait réessayer une chose
   qui ne marchera jamais. */
describe("le chargeur des surfaces publiques", () => {
  const forme = { safeParse: (v: unknown) => ({ success: true as const, data: v }) };

  const repondre = async (status: number) => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: status < 400, status, json: async () => ({}),
    } as Response)));
    vi.stubEnv("API_URL", "http://api.test");
    const { chargerSurface } = await import("../lib/surface-publique.js");
    return chargerSurface("/public/collect/x", forme, 0);
  };

  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("distingue le lien retiré du lien inconnu et de la panne", async () => {
    expect((await repondre(410)).etat).toBe("retire");
    expect((await repondre(404)).etat).toBe("inconnu");
    expect((await repondre(502)).etat).toBe("indisponible");
  });
});

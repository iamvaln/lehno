import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PublicWish, SharedWishlist } from "@lehno/contracts";
import { ListePartagee } from "../components/surfaces/ListePartagee.js";
import { messages } from "../messages/index.js";

const t = messages("fr");

type Ouverte = Extract<SharedWishlist, { state: "ok" }>;

function souhait(sur: Partial<PublicWish> = {}): PublicWish {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    label: "Un livre",
    imageUrl: null,
    details: null,
    link: null,
    price: null,
    currency: null,
    isReserved: false,
    isFulfilled: false,
    reservedByMe: false,
    ...sur,
  };
}

function liste(sur: Partial<Ouverte> = {}): Ouverte {
  return {
    state: "ok",
    ownerFirstName: "Awa",
    ownerAvatarUrl: null,
    occasionLabel: "Anniversaire",
    occasionDate: "2026-12-24",
    acceptsReservations: true,
    wishes: [souhait()],
    ...sur,
  };
}

describe("la liste partagée", () => {
  let appels: Array<{ url: string; corps: Record<string, unknown> | null }>;

  const brancher = (reponses: Array<{ ok: boolean; status?: number; charge?: unknown; code?: string }>): void => {
    let rang = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      appels.push({
        url,
        corps: init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null,
      });
      const reponse = reponses[Math.min(rang++, reponses.length - 1)] ?? { ok: true };
      return {
        ok: reponse.ok,
        status: reponse.status ?? (reponse.ok ? 200 : 500),
        json: async () => (reponse.code === undefined ? reponse.charge : { code: reponse.code, message: "" }),
      } as Response;
    }));
  };

  const poser = (sur: Partial<Ouverte> = {}) =>
    render(
      <ListePartagee t={t} langue="fr" jeton="j1" liste={liste(sur)} joursRestants={12} />,
    );

  beforeEach(() => {
    appels = [];
    brancher([{ ok: true }]);
    try { globalThis.localStorage?.clear(); } catch { /* stockage indisponible */ }
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  /* La personne avant les objets : une page qui ouvre sur une grille ressemble
     à un catalogue, et le lien n'était pas un catalogue. */
  it("accueille la personne avant de montrer la liste", () => {
    poser();
    expect(screen.getByText("Awa")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: t.listeTitre })).toBeInTheDocument();
  });

  /* Ce qui n'apparaît JAMAIS : qui a réservé. Un souhait réservé se dit
     réservé, et rien de plus. */
  it("dit qu'un souhait est pris, jamais par qui", () => {
    poser({ wishes: [souhait({ isReserved: true })] });
    expect(screen.getByText(t.souhaitReserve)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.souhaitReserver })).toBeNull();
  });

  /* Le visiteur revenu retrouve les siens, signalés à lui seul. */
  it("marque les siens pour celui qui revient", () => {
    poser({ wishes: [souhait({ isReserved: true, reservedByMe: true })] });
    expect(screen.getByText(t.souhaitMien)).toBeInTheDocument();
    expect(screen.queryByText(t.souhaitReserve)).toBeNull();
  });

  /* Faux quand l'occasion est passée : la liste s'affiche, sans accepter de
     réservation. Le client ne compare pas la date lui-même. */
  it("montre la liste sans le geste quand l'occasion est passée", () => {
    poser({ acceptsReservations: false });
    expect(screen.getByText("Un livre")).toBeInTheDocument();
    expect(screen.getByText(t.listeFermee)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.souhaitReserver })).toBeNull();
  });

  /* L'anonymat se dit UNE FOIS, en pied de liste : répété sur chaque carte, un
     rappel devient du bruit. */
  it("ne rappelle l'anonymat qu'une fois", () => {
    poser({
      wishes: [
        souhait({ id: "11111111-1111-4111-8111-111111111111" }),
        souhait({ id: "22222222-2222-4222-8222-222222222222", label: "Un vélo" }),
        souhait({ id: "33333333-3333-4333-8333-333333333333", label: "Un ballon" }),
      ],
    });
    expect(screen.getAllByText(t.listeAnonymat)).toHaveLength(1);
  });

  /* Le visiteur sans compte laisse une adresse et confirme par code. Tant que
     la réservation n'est pas vérifiée, le souhait demeure disponible pour un
     autre — sans quoi une adresse inventée suffirait à bloquer un cadeau. */
  it("réserve en deux temps : l'adresse, puis le code", async () => {
    brancher([
      { ok: true, charge: { state: "code_sent", reservationId: "r1", expiresAt: "2026-12-24T00:00:00Z" } },
      { ok: true, charge: { reservationId: "r1", wishId: "w1", sessionToken: "jeton-visite" } },
      { ok: true, charge: liste({ wishes: [souhait({ isReserved: true, reservedByMe: true })] }) },
    ]);
    poser();

    await userEvent.click(screen.getByRole("button", { name: t.souhaitReserver }));
    await userEvent.type(screen.getByLabelText(t.souhaitLabelEmail), "sarah@example.com");
    await userEvent.click(screen.getByRole("button", { name: t.souhaitContinuer }));

    await waitFor(() => expect(screen.getByLabelText(t.souhaitLabelCode)).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText(t.souhaitLabelCode), "123456");
    await userEvent.click(screen.getByRole("button", { name: t.souhaitConfirmer }));

    // L'adresse ACCOMPAGNE le code : sans elle, un code à six chiffres se
    // rejouerait contre toutes les demandes en attente sur ce cadeau.
    await waitFor(() => expect(appels[1]?.corps).toEqual({ email: "sarah@example.com", code: "123456" }));
  });

  /* Anonyme par défaut : se faire connaître est une case, pas une question. Le
     nom ne part que si le visiteur l'a cochée — le retenir sans elle serait
     garder une donnée dont on s'est engagé à ne rien faire. */
  it("n'envoie le nom que si le visiteur s'est nommé", async () => {
    brancher([{ ok: true, charge: { state: "code_sent", reservationId: "r1", expiresAt: "z" } }]);
    poser();

    await userEvent.click(screen.getByRole("button", { name: t.souhaitReserver }));
    await userEvent.type(screen.getByLabelText(t.souhaitLabelEmail), "sarah@example.com");
    expect(screen.queryByLabelText(t.souhaitLabelNom)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: t.souhaitContinuer }));

    await waitFor(() => expect(appels).toHaveLength(1));
    expect(appels[0]?.corps).not.toHaveProperty("displayName");
    expect(appels[0]?.corps).not.toHaveProperty("showIdentity");
  });

  /* « Faire ma part » vient APRÈS le geste : quelqu'un qui vient de réserver a
     compris à quoi ça sert. Avant, un bandeau permanent demanderait à un invité
     de penser à lui-même au moment où il pense à quelqu'un d'autre. */
  it("n'invite qu'une fois la réservation faite", async () => {
    brancher([
      { ok: true, charge: { state: "code_sent", reservationId: "r1", expiresAt: "z" } },
      { ok: true, charge: { reservationId: "r1", wishId: "w1", sessionToken: "jeton-visite" } },
      { ok: true, charge: liste() },
    ]);
    poser();
    expect(screen.queryByText(t.listeFaireMaPartTexte)).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: t.souhaitReserver }));
    await userEvent.type(screen.getByLabelText(t.souhaitLabelEmail), "sarah@example.com");
    await userEvent.click(screen.getByRole("button", { name: t.souhaitContinuer }));
    await waitFor(() => expect(screen.getByLabelText(t.souhaitLabelCode)).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText(t.souhaitLabelCode), "123456");
    await userEvent.click(screen.getByRole("button", { name: t.souhaitConfirmer }));

    await waitFor(() => expect(screen.getByText(t.listeFaireMaPartTexte)).toBeInTheDocument());
  });

  /* Pris entre-temps, ce n'est pas une panne : c'est une nouvelle, et elle ne
     se dit pas comme une erreur réseau. */
  it("distingue le souhait pris entre-temps d'une panne", async () => {
    brancher([{ ok: false, status: 409, code: "conflict" }]);
    poser();

    await userEvent.click(screen.getByRole("button", { name: t.souhaitReserver }));
    await userEvent.type(screen.getByLabelText(t.souhaitLabelEmail), "sarah@example.com");
    await userEvent.click(screen.getByRole("button", { name: t.souhaitContinuer }));

    await waitFor(() => expect(screen.getByText(t.souhaitDejaPris)).toBeInTheDocument());
    expect(screen.queryByText(t.souhaitErreur)).toBeNull();
  });

  /* Rien n'est barré : un cadeau pris n'est pas une erreur. Un souhait
     OFFERT s'éteint — c'est une atténuation, pas une rature. */
  it("ne barre jamais ce qui est pris", () => {
    const { container } = poser({
      wishes: [souhait({ isReserved: true }), souhait({ id: "44444444-4444-4444-8444-444444444444", label: "Un vélo", isFulfilled: true })],
    });
    const barres = Array.from(container.querySelectorAll<HTMLElement>("*"))
      .filter((n) => n.style.textDecoration.includes("line-through"));
    expect(barres).toHaveLength(0);
  });

  /* Au-delà de six souhaits, la grille ; en dessous, des cartes larges. Trois
     souhaits dans une grille de vingt paraissent trois fois vides — la
     composition suit la liste, elle ne l'impose pas. */
  it("compose en cartes larges sous le seuil, en grille au-dessus", () => {
    const beaucoup = Array.from({ length: 7 }, (_, i) => souhait({
      id: `5555555${i}-5555-4555-8555-555555555555`, label: `Souhait ${i}`,
    }));

    const { container, unmount } = poser();
    const peu = container.querySelector<HTMLElement>("section > div");
    expect(peu?.style.gridTemplateColumns).toBe("");
    unmount();

    const { container: large } = poser({ wishes: beaucoup });
    expect(large.querySelector<HTMLElement>("section > div")?.style.gridTemplateColumns)
      .toContain("auto-fill");
  });
});

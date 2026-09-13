import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";

const t = messages("fr");
const c = t.clientsApi;

const ID = "11111111-1111-4111-8111-111111111111";

const client = (over: Record<string, unknown> = {}) => ({
  id: ID,
  clientId: "lehno-ios-prod",
  label: "iOS — production",
  clientType: "mobile_ios",
  environment: "prod",
  isActive: true,
  rotatedAt: null,
  createdAt: "2026-09-01T08:00:00.000Z",
  ...over,
});

/* THE REGISTRY, SHAPED AS THE SERVER SHAPES IT — `{ motifs }`, with `fr`, `en`
   and `actif`, and the gestures UNDER THEIR SERVER NAME. The schema is strict:
   a fixture of any other shape does not parse, the reason list comes back empty,
   and every test then exercises the fallback dictionary instead of the registry.
   That is how a screen asking the registry under "tourner" — a name that exists
   only here — stayed green while the cut failed in the panel. */
const REASONS = {
  motifs: [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      code: "access_compromised", fr: "Accès compromis", en: "Access compromised",
      actif: true, gestes: ["api_client_rotate", "api_client_update"],
    },
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      code: "new_contract", fr: "Nouveau contrat", en: "New contract",
      actif: true, gestes: ["api_client_create"],
    },
  ],
};

const answer = (status: number, body?: unknown): Response =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? {} : { "content-type": "application/json" },
  });

function server(routes: Record<string, (url: string, init?: RequestInit) => Response> = {}) {
  const table: Record<string, (url: string, init?: RequestInit) => Response> = {
    "/admin/reasons/all": () => answer(200, REASONS),
    "/admin/api-clients": () => answer(200, { items: [client()] }),
    ...routes,
  };
  /* Longest path wins: the table matches by `includes`, and "/api-clients" is a
     prefix of "/api-clients/{id}/rotate". */
  const paths = Object.keys(table).sort((a, b) => b.length - a.length);
  const calls = vi.fn((url: string, init?: RequestInit) => {
    for (const path of paths) {
      if (url.includes(path)) return Promise.resolve(table[path]!(url, init));
    }
    return Promise.resolve(answer(200, { alertes: [], indicateurs: [], aTraiter: [] }));
  });
  vi.stubGlobal("fetch", calls);
  return calls;
}

async function open(user: ReturnType<typeof userEvent.setup>, role: "admin" | "support" = "admin") {
  localStorage.clear();
  magasinLocal.ecrire({ acces: "acces", rafraichissement: "refresh", role });
  render(<App />);
  const nav = within(screen.getByRole("navigation"));
  await user.click(nav.getByText(t.familles.outils));
  await user.click(nav.getByText(t.sections.clientsApi));
}

describe("the API clients", () => {
  beforeEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

  it("lists the pairs, with their state", async () => {
    const user = userEvent.setup({ delay: null });
    server();
    await open(user);

    expect(await screen.findByText("iOS — production")).toBeInTheDocument();
    expect(screen.getByText("lehno-ios-prod")).toBeInTheDocument();
    /* "NEVER ROTATED" IS SAID OUT LOUD: a key that has not moved since the
       client was opened is information, not an empty cell. */
    expect(screen.getByText(c.jamaisTournee)).toBeInTheDocument();
  });

  /* THE KEY APPEARS ONCE, and the screen SAYS SO — it is the only moment anyone
     can copy it. A panel showing it like ordinary data would lose keys. */
  it("shows the key once, saying it will not come back", async () => {
    const user = userEvent.setup({ delay: null });
    const calls = server({
      "/admin/api-clients": (_u, init) => (init?.method === "POST"
        ? answer(201, { ...client(), cle: "lk_secrete_123" })
        : answer(200, { items: [client()] })),
    });
    await open(user);

    await user.click(await screen.findByRole("button", { name: c.ouvrir }));
    await user.type(screen.getByLabelText(c.champs.libelle), "Android — recette");
    await user.selectOptions(screen.getByLabelText(t.confirmation.motif), "Nouveau contrat");
    await user.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    expect(await screen.findByText("lk_secrete_123")).toBeInTheDocument();
    // The warning is there, and it precedes the secret in the panel.
    expect(screen.getByText(c.cle.unique)).toBeInTheDocument();
    // And the registry CODE went out with the sentence.
    const sent = calls.mock.calls.find(([, i]) => (i as RequestInit)?.method === "POST");
    expect(JSON.parse((sent?.[1] as RequestInit).body as string))
      .toMatchObject({ reasonCode: "new_contract" });
  });

  /* CUTTING OR REOPENING DOES NOT TOUCH THE KEY. Expecting a key from a response
     that carries none would fail the read on a gesture that did go through — and
     the screen would show an error over a successful cut. */
  it("cuts without expecting a key", async () => {
    const user = userEvent.setup({ delay: null });
    const calls = server({
      [`/admin/api-clients/${ID}`]: (_u, init) => (init?.method === "PATCH"
        ? answer(200, client({ isActive: false }))
        : answer(200, { items: [client()] })),
    });
    await open(user);

    const row = (await screen.findByText("iOS — production")).closest("tr") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: t.table.actions }));
    await user.click(await screen.findByRole("menuitem", { name: c.couper }));
    await user.selectOptions(screen.getByLabelText(t.confirmation.motif), "Accès compromis");
    await user.click(screen.getByRole("button", { name: t.confirmation.confirmer }));

    await waitFor(() => {
      const sent = calls.mock.calls.find(([, i]) => (i as RequestInit)?.method === "PATCH");
      expect(sent).toBeDefined();
      expect(JSON.parse((sent?.[1] as RequestInit).body as string))
        .toMatchObject({ isActive: false, reasonCode: "access_compromised" });
    });
    // No key is shown: this gesture produces none.
    expect(screen.queryByText(c.cle.unique)).toBeNull();
  });

  /* Support reads — knowing which client produced a call is part of helping —
     but cuts nothing: that is a lever, not a reading. */
  it("gives support no lever", async () => {
    const user = userEvent.setup({ delay: null });
    server();
    await open(user, "support");

    expect(await screen.findByText("iOS — production")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: c.ouvrir })).toBeNull();
    expect(screen.queryByRole("button", { name: t.table.actions })).toBeNull();
  });
});

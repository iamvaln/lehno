import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "../src/App.js";
import { magasinLocal } from "../src/api/session.js";
import { messages } from "../src/i18n/index.js";

const t = messages("fr");
const v = t.versions;

const ID = "22222222-2222-4222-8222-222222222222";

const version = (over: Record<string, unknown> = {}) => ({
  id: ID,
  platform: "mobile_ios",
  version: "1.4.0",
  buildNumber: 140,
  forcesUpdate: false,
  isRetired: false,
  storeUrl: null,
  notes: null,
  publishedAt: "2026-09-01T08:00:00.000Z",
  comptesVusRecemment: 812,
  ...over,
});

/* THE REGISTRY, SHAPED AS THE SERVER SHAPES IT — `{ motifs }`, with `fr`, `en`
   and `actif`. The schema is strict: a fixture shaped any other way fails to
   parse, the reason list comes back empty, and every test then exercises the
   fallback dictionary instead of the registry. That is how a screen asking the
   registry under the wrong gesture name stayed green. */
const REASONS = {
  motifs: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      code: "warning", fr: "Alerte de sécurité", en: "Security warning",
      actif: true, gestes: ["app_version_update"],
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      code: "new_contract", fr: "Nouvelle publication", en: "New release",
      actif: true, gestes: ["app_version_register"],
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
    "/admin/app-versions": () => answer(200, { items: [version()] }),
    ...routes,
  };
  /* Longest path wins: the table matches by `includes`, and "/app-versions" is
     a prefix of "/app-versions/{id}". */
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
  await user.click(nav.getByText(t.sections.versions));
}

const fill = (template: string, values: Record<string, string | number>): string =>
  Object.entries(values).reduce((a, [k, x]) => a.split(`{${k}}`).join(String(x)), template);

describe("the app version registry", () => {
  beforeEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

  it("lists what is served, with the scale beside it", async () => {
    const user = userEvent.setup({ delay: null });
    server();
    await open(user);

    expect(await screen.findByText("1.4.0")).toBeInTheDocument();
    expect(screen.getByText(v.etats.servie)).toBeInTheDocument();
    // The count is shown, and it is shown as context — beside the state.
    expect(screen.getByText(fill(v.vus, { n: 812 }))).toBeInTheDocument();
  });

  /* THE CONFIRMATION SAYS WHAT THE GESTURE MEANS, and it carries the registry
     CODE with the sentence. Sending only the sentence makes the server refuse a
     gesture whose reasons it knows — the operator confirms, and nothing
     happens. */
  it("says what forcing means, and sends the reason code with it", async () => {
    const user = userEvent.setup({ delay: null });
    const calls = server({
      [`/admin/app-versions/${ID}`]: (_u, init) => (init?.method === "PATCH"
        ? answer(200, version({ forcesUpdate: true }))
        : answer(200, { items: [version()] })),
    });
    await open(user);

    const row = (await screen.findByText("1.4.0")).closest("tr") as HTMLElement;
    await user.click(within(row).getByRole("button", { name: t.table.actions }));
    await user.click(await screen.findByRole("menuitem", { name: v.forcer }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(
      new RegExp(v.dialogueForcer.consequence.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    )).toBeInTheDocument();
    // L'ampleur suit la conséquence, jamais à sa place.
    expect(within(dialog).getByText(new RegExp(String(812)))).toBeInTheDocument();

    await user.selectOptions(within(dialog).getByLabelText(t.confirmation.motif), "Alerte de sécurité");
    await user.click(within(dialog).getByRole("button", { name: t.confirmation.confirmer }));

    await waitFor(() => {
      const sent = calls.mock.calls.find(([, i]) => (i as RequestInit)?.method === "PATCH");
      expect(sent).toBeDefined();
      expect(JSON.parse((sent?.[1] as RequestInit).body as string))
        .toMatchObject({ forcesUpdate: true, reasonCode: "warning" });
    });
  });

  /* A RETIRED VERSION IS NO LONGER SERVED: forcing it would be a gesture with
     no effect, so the row offers none at all. */
  it("offers nothing on a retired version", async () => {
    const user = userEvent.setup({ delay: null });
    server({ "/admin/app-versions": () => answer(200, { items: [version({ isRetired: true })] }) });
    await open(user);

    expect(await screen.findByText(v.etats.declassee)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t.table.actions })).toBeNull();
  });

  // The filter is a server question: the registry grows by one row per release,
  // on three platforms, and filtering here would fetch the whole history to show
  // a third of it.
  it("asks the server for one platform", async () => {
    const user = userEvent.setup({ delay: null });
    const calls = server();
    await open(user);
    await screen.findByText("1.4.0");

    await user.selectOptions(screen.getByLabelText(v.col.plateforme), "mobile_android");

    await waitFor(() => {
      expect(calls.mock.calls.some(([u]) => String(u).includes("platform=mobile_android"))).toBe(true);
    });
  });

  /* Support reads — knowing which build produced a call is part of helping —
     but forcing an update is a lever, not a reading. */
  it("gives support no lever", async () => {
    const user = userEvent.setup({ delay: null });
    server();
    await open(user, "support");

    expect(await screen.findByText("1.4.0")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: v.enregistrer })).toBeNull();
    expect(screen.queryByRole("button", { name: t.table.actions })).toBeNull();
  });
});

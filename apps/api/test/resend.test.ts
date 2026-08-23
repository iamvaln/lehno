import { afterEach, describe, expect, it, vi } from "vitest";
import { ResendAdapter } from "../src/mail/resend.adapter.js";

describe("adaptateur Resend", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("refuse de se construire sans clé ni expéditeur", () => {
    expect(() => new ResendAdapter("", "Lehno <no-reply@lehno.app>")).toThrow();
    expect(() => new ResendAdapter("re_xxx", "")).toThrow();
  });

  it("poste le courrier sur l'API de Resend", async () => {
    const appels: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      appels.push({ url, init });
      return { ok: true, status: 200 } as Response;
    }));

    await new ResendAdapter("re_secret", "Lehno <no-reply@lehno.app>").send({
      to: "awa@example.com", subject: "Sujet", text: "Corps", locale: "fr",
    });

    expect(appels).toHaveLength(1);
    expect(appels[0]!.url).toBe("https://api.resend.com/emails");
    const entetes = appels[0]!.init.headers as Record<string, string>;
    expect(entetes["authorization"]).toBe("Bearer re_secret");
    expect(JSON.parse(String(appels[0]!.init.body))).toEqual({
      from: "Lehno <no-reply@lehno.app>",
      to: ["awa@example.com"],
      subject: "Sujet",
      text: "Corps",
    });
  });

  // Un refus du prestataire doit remonter : c'est ce qui distingue un courrier
  // parti d'un courrier avalé en silence.
  it("lève quand le prestataire refuse", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 422 }) as Response));
    await expect(
      new ResendAdapter("re_secret", "Lehno <no-reply@lehno.app>").send({
        to: "awa@example.com", subject: "Sujet", text: "Corps", locale: "fr",
      }),
    ).rejects.toThrow(/422/);
  });

  // Le destinataire ne doit apparaître dans aucun journal, même en cas
  // d'échec : c'est la règle déjà posée sur l'adaptateur précédent.
  it("ne journalise jamais le destinataire", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 }) as Response));
    const adaptateur = new ResendAdapter("re_secret", "Lehno <no-reply@lehno.app>");
    const journal = vi.spyOn(
      (adaptateur as unknown as { logger: { error: (m: string) => void } }).logger,
      "error",
    );

    await expect(adaptateur.send({
      to: "awa@example.com", subject: "Sujet", text: "Corps secret", locale: "fr",
    })).rejects.toThrow();

    const ecrit = journal.mock.calls.map((c) => String(c[0])).join("\n");
    expect(ecrit).not.toContain("awa@example.com");
    expect(ecrit).not.toContain("Corps secret");
    expect(ecrit).toContain("500");
  });
});

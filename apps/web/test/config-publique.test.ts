import { describe, expect, it, vi, afterEach } from "vitest";
import { chargerConfig, CONFIG_REPLI } from "../lib/config-publique.js";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("configuration publique", () => {
  it("sans adresse d'API configurée, le repli", async () => {
    vi.stubEnv("API_URL", "");
    await expect(chargerConfig(300)).resolves.toEqual(CONFIG_REPLI);
  });

  it("l'API qui répond l'emporte sur le repli", async () => {
    const servi = { signupFreeCredits: 3, creditUnitPrice: 250, currency: "XAF", referralBonusInvited: 2 };
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => servi }));
    await expect(chargerConfig(300)).resolves.toEqual(servi);
  });

  it("une réponse en erreur retombe sur le repli", async () => {
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(chargerConfig(300)).resolves.toEqual(CONFIG_REPLI);
  });

  it("un serveur injoignable retombe sur le repli, sans lever", async () => {
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    await expect(chargerConfig(300)).resolves.toEqual(CONFIG_REPLI);
  });
});

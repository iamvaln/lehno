import { describe, expect, it, vi, afterEach } from "vitest";
import { chargerConfig, CONFIG_REPLI } from "../lib/config-publique.js";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("configuration publique", () => {
  it("sans adresse d'API configurée, le repli", async () => {
    vi.stubEnv("API_URL", "");
    await expect(chargerConfig(300)).resolves.toEqual(CONFIG_REPLI);
  });

  it("l'API qui répond l'emporte sur le repli", async () => {
    const servi = {
      signupFreeCredits: 3, creditUnitPrice: 250, currency: "XAF", referralBonusInvited: 2,
      flags: { "launch.live": true },
    };
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => servi }));
    await expect(chargerConfig(300)).resolves.toEqual(servi);
  });

  // Une API d'une version antérieure répond 200 avec un JSON valide où
  // « flags » n'existe pas encore : c'est le déploiement où l'image du site
  // part avant celle de l'api, et le retour arrière de l'api. La page lit
  // configuration.flags["launch.live"] — sans complétion, l'accès lève un
  // TypeError et la landing entière rend une erreur. Une réponse incomplète
  // serait alors PIRE qu'un serveur éteint, pour lequel le repli existe.
  it("une charge sans « flags » est complétée, jamais rendue telle quelle", async () => {
    const ancienneApi = { signupFreeCredits: 3, creditUnitPrice: 250, currency: "XAF", referralBonusInvited: 2 };
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ancienneApi }));

    const config = await chargerConfig(300);
    expect(config.flags).toEqual({});
    // Et la lecture que fait la page ne lève pas.
    expect(config.flags["launch.live"]).toBeUndefined();
    // Les champs bien servis, eux, l'emportent toujours sur le repli.
    expect(config.creditUnitPrice).toBe(250);
  });

  it("un « flags » nul est traité comme absent", async () => {
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ flags: null }) }));
    const config = await chargerConfig(300);
    expect(config.flags).toEqual({});
    // Les champs absents viennent du repli, pas de nulle part.
    expect(config.currency).toBe(CONFIG_REPLI.currency);
  });

  it("une charge qui n'est pas un objet retombe entièrement sur le repli", async () => {
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => "indisponible" }));
    await expect(chargerConfig(300)).resolves.toEqual(CONFIG_REPLI);
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

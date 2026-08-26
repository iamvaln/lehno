import { describe, expect, it, vi, afterEach } from "vitest";
import { chargerConfig, chargerFeatures, CONFIG_REPLI } from "../lib/config-publique.js";

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

  // Une API d'une version antérieure répond 200 avec un JSON valide où des
  // champs manquent : c'est le déploiement où l'image du site part avant celle
  // de l'api, et le retour arrière de l'api. Les champs absents viennent du
  // repli — une réponse incomplète doit dégrader la page, jamais la casser.
  it("une charge incomplète est complétée depuis le repli", async () => {
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ creditUnitPrice: 250 }),
    }));

    const config = await chargerConfig(300);
    expect(config.creditUnitPrice).toBe(250);
    expect(config.currency).toBe(CONFIG_REPLI.currency);
    expect(config.signupFreeCredits).toBe(CONFIG_REPLI.signupFreeCredits);
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

describe("les fonctionnalités actives", () => {
  const servir = (charge: unknown): void => {
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => charge }));
  };

  it("rend la liste servie par /public/features", async () => {
    servir({ features: ["launch.live", "wall"] });
    await expect(chargerFeatures(300)).resolves.toEqual(["launch.live", "wall"]);
  });

  it("sans adresse d'API, la liste vide", async () => {
    vi.stubEnv("API_URL", "");
    await expect(chargerFeatures(300)).resolves.toEqual([]);
  });

  it("un serveur injoignable rend la liste vide, sans lever", async () => {
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    await expect(chargerFeatures(300)).resolves.toEqual([]);
  });

  // Une api d'une version antérieure n'a pas ce champ. Sans la garde, le
  // filtrage lèverait et la landing entière rendrait une erreur — pire qu'un
  // serveur éteint, cas pour lequel ce repli existe.
  it("une charge sans « features » rend la liste vide, sans lever", async () => {
    servir({ signupFreeCredits: 5 });
    await expect(chargerFeatures(300)).resolves.toEqual([]);
  });

  it("« features » qui n'est pas un tableau est traité comme absent", async () => {
    servir({ features: { "launch.live": true } });
    await expect(chargerFeatures(300)).resolves.toEqual([]);
  });

  // Le contrat annonce des chaînes ; une valeur d'un autre type ne doit pas
  // se retrouver comparée à une clé de drapeau.
  it("écarte les entrées qui ne sont pas des chaînes", async () => {
    servir({ features: ["wall", 42, null, "credits"] });
    await expect(chargerFeatures(300)).resolves.toEqual(["wall", "credits"]);
  });
});

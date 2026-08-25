import { describe, expect, it, vi, afterEach } from "vitest";
import Page from "../app/[locale]/page.js";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

// Le drapeau de lancement se décide à UN endroit : la ligne de page.tsx qui
// lit configuration.flags["launch.live"]. Les tests de la landing, eux,
// reçoivent `avantLancement` en propriété — ils prouvent ce que la page fait
// du booléen, jamais comment elle l'obtient. Sans les cas ci-dessous, la
// bascule pourrait se coincer sur une valeur et toute la suite resterait
// verte : c'est exactement le motif qu'on traque, une protection qui a l'air
// couverte parce que ses voisines le sont.
const servir = (charge: unknown): void => {
  vi.stubEnv("API_URL", "http://api.test");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => charge }));
};

const avantLancementRendu = async (): Promise<boolean> => {
  const element = (await Page({ params: Promise.resolve({ locale: "fr" }) })) as {
    props: { avantLancement: boolean };
  };
  return element.props.avantLancement;
};

const BASE = { signupFreeCredits: 5, creditUnitPrice: 100, currency: "XAF", referralBonusInvited: 0 };

describe("la page décide du pré-lancement", () => {
  it("drapeau allumé : la page n'est plus en pré-lancement", async () => {
    servir({ ...BASE, flags: { "launch.live": true } });
    expect(await avantLancementRendu()).toBe(false);
  });

  it("drapeau éteint : pré-lancement", async () => {
    servir({ ...BASE, flags: { "launch.live": false } });
    expect(await avantLancementRendu()).toBe(true);
  });

  it("clé absente du dictionnaire : pré-lancement", async () => {
    servir({ ...BASE, flags: {} });
    expect(await avantLancementRendu()).toBe(true);
  });

  // Le cas du déploiement en cours : l'api ne connaît pas encore « flags ».
  // La page doit paraître en pré-lancement, pas rendre une erreur.
  it("api d'une version antérieure : pré-lancement, sans lever", async () => {
    servir(BASE);
    expect(await avantLancementRendu()).toBe(true);
  });

  // Un drapeau se lit à l'exécution : deux visites de suite doivent pouvoir
  // rendre deux réponses différentes. Si la valeur était figée au chargement
  // du module — comme l'était NEXT_PUBLIC_LANCEMENT — ce cas échouerait.
  it("la bascule se lit à chaque rendu, pas une fois pour toutes", async () => {
    servir({ ...BASE, flags: { "launch.live": false } });
    expect(await avantLancementRendu()).toBe(true);
    servir({ ...BASE, flags: { "launch.live": true } });
    expect(await avantLancementRendu()).toBe(false);
  });
});

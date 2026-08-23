import { describe, expect, it } from "vitest";
import { nombreDeRelaisDeConfiance } from "../src/common/trust-proxy.js";

// `req.ip` sert à composer les clés de limitation de débit. Derrière un proxy
// inverse, il faut lire l'en-tête X-Forwarded-For pour retrouver le visiteur —
// mais le lire sans le borner laisse n'importe qui écrire sa propre origine, et
// donc s'accorder autant de compteurs qu'il veut.
//
// Express traduit ça par un réglage : combien d'adresses écarter par la droite
// dans la chaîne X-Forwarded-For. Ce nombre vaut exactement le nombre de relais
// qu'on exploite soi-même. Trop bas, tout le monde partage un compteur ; trop
// haut — ou `true` —, l'origine se forge.
describe("relais de confiance", () => {
  it("n'en fait confiance à aucun par défaut", () => {
    expect(nombreDeRelaisDeConfiance(undefined)).toBe(0);
    expect(nombreDeRelaisDeConfiance("")).toBe(0);
  });

  it("accepte un compte de relais explicite", () => {
    expect(nombreDeRelaisDeConfiance("1")).toBe(1);
    expect(nombreDeRelaisDeConfiance("2")).toBe(2);
  });

  // « true » est le réglage qu'on trouve dans la plupart des exemples en
  // ligne : il fait confiance à toute la chaîne, donc au premier maillon, que
  // le client écrit lui-même. C'est précisément ce qu'il ne faut pas.
  it("refuse « true » et tout ce qui ne se compte pas", () => {
    for (const valeur of ["true", "yes", "loopback", "-1", "1.5", "abc"]) {
      expect(() => nombreDeRelaisDeConfiance(valeur), `valeur : ${valeur}`).toThrow(/TRUST_PROXY_HOPS/);
    }
  });

  // Une valeur invraisemblable trahit une erreur de configuration plutôt qu'une
  // architecture : mieux vaut refuser de démarrer que limiter dans le vide.
  it("refuse un nombre de relais invraisemblable", () => {
    expect(() => nombreDeRelaisDeConfiance("10")).toThrow(/TRUST_PROXY_HOPS/);
  });
});

import { describe, expect, it } from "vitest";
import { adresseDeLApi } from "../lib/adresse-api.js";

describe("l'adresse du serveur", () => {
  // Une valeur posée à la main l'emporte sur tout : c'est ainsi qu'on vise un
  // serveur distant, ou une recette, depuis un poste de développement.
  it("prend la valeur explicite quand il y en a une", () => {
    expect(adresseDeLApi("https://api.lehno.app", "192.168.1.103:8081")).toBe("https://api.lehno.app");
  });

  /* Sans elle, l'API tourne sur la machine qui sert le bundle — et c'est
     l'unique moyen de la joindre depuis un appareil.

     « localhost » est le piège : depuis un émulateur Android il désigne
     l'émulateur, depuis un téléphone il désigne le téléphone. Dans les deux cas
     l'appel part et ne trouve rien, l'écran dit « la connexion n'a pas abouti »,
     et on cherche du côté du serveur alors qu'il écoute très bien. */
  it("déduit l'hôte de celui qui sert le bundle", () => {
    expect(adresseDeLApi(undefined, "192.168.1.103:8081")).toBe("http://192.168.1.103:3001");
  });

  it("ne garde que l'hôte, pas le port du serveur de développement", () => {
    expect(adresseDeLApi(undefined, "10.0.2.2:19000")).toBe("http://10.0.2.2:3001");
  });

  /* Dans une application native, `hostUri` n'existe pas — c'est une notion
     d'Expo Go. Ce qui vaut dans les deux cas est l'adresse d'où le bundle a été
     chargé, que React Native expose telle quelle. */
  it("accepte l'adresse complète du bundle", () => {
    expect(adresseDeLApi(undefined, "http://10.0.2.2:8081/index.bundle?platform=android"))
      .toBe("http://10.0.2.2:3001");
    expect(adresseDeLApi(undefined, "http://192.168.1.103:8081/node_modules/expo-router/entry.bundle"))
      .toBe("http://192.168.1.103:3001");
  });

  /* Dans une application empaquetée il n'y a pas de serveur de développement,
     et donc rien à déduire. Retomber sur « localhost » y serait faux à coup
     sûr : mieux vaut échouer à la construction qu'expédier une application qui
     appelle l'appareil lui-même. */
  it("ne rend rien quand il n'y a ni valeur ni serveur de développement", () => {
    expect(adresseDeLApi(undefined, undefined)).toBeNull();
  });

  it("ignore une valeur explicite vide", () => {
    expect(adresseDeLApi("", "192.168.1.103:8081")).toBe("http://192.168.1.103:3001");
  });
});

/* CE QUE LES PROFILS DE BUILD ONT LE DROIT DE PORTER.
 *
 * `api.ts` compose ses appels en `${base}/v1${chemin}`. Une base qui porte
 * déjà « /v1 » donne donc `https://api.lehno.io/v1/v1/auth/otp`, un 404 que
 * l'application traduit par « Introuvable » — un message qui envoie chercher
 * du côté du compte alors que c'est l'adresse qui est fausse.
 *
 * C'est arrivé : les trois profils portaient « /v1 », et l'APK ne pouvait
 * demander aucun code de connexion. Rien ne pouvait l'attraper — les tests
 * n'ouvrent pas eas.json, et le typecheck ne lit pas du JSON.
 */
describe("les profils de build EAS", () => {
  it("ne portent jamais le préfixe de version, que le client ajoute lui-même", async () => {
    const { readFile } = await import("node:fs/promises");
    const brut = await readFile(new URL("../eas.json", import.meta.url), "utf8");
    const eas = JSON.parse(brut) as {
      build: Record<string, { env?: Record<string, string> }>;
    };
    const fautifs = Object.entries(eas.build)
      .map(([nom, p]) => [nom, p.env?.["EXPO_PUBLIC_API_URL"]] as const)
      .filter(([, url]) => url !== undefined && /\/v\d+\/?$/.test(url))
      .map(([nom, url]) => `${nom} → ${url}`);
    expect(fautifs).toEqual([]);
  });

  it("posent une adresse à chaque profil", async () => {
    // Une base absente ferait retomber sur la déduction depuis le serveur de
    // développement, qui n'existe pas dans une application empaquetée : l'appel
    // partirait vers null.
    const { readFile } = await import("node:fs/promises");
    const eas = JSON.parse(
      await readFile(new URL("../eas.json", import.meta.url), "utf8"),
    ) as { build: Record<string, { env?: Record<string, string> }> };
    const sansAdresse = Object.entries(eas.build)
      .filter(([, p]) => !p.env?.["EXPO_PUBLIC_API_URL"])
      .map(([nom]) => nom);
    expect(sansAdresse).toEqual([]);
  });
});

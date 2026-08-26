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

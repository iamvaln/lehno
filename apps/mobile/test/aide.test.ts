import { describe, expect, it } from "vitest";
import {
  cheminDuDocument, DOCUMENTS_INTERNES, documentsHorsApplication, lienDesMentions,
  lienDuMagasin,
} from "../lib/aide.js";

describe("le chemin d'un document légal", () => {
  it("porte la langue demandée", () => {
    expect(cheminDuDocument("cgu", "fr")).toBe("/public/legal/cgu?lang=fr");
    expect(cheminDuDocument("confidentialite", "en")).toBe("/public/legal/confidentialite?lang=en");
  });

  /* Le français est la langue de référence et le défaut du serveur. Une langue
     inconnue y retombe plutôt que de partir telle quelle : le serveur rendrait
     404 sur `lang=de`, et l'écran afficherait une erreur là où il pouvait
     afficher le document. */
  it("retombe sur le français plutôt que d'échouer", () => {
    expect(cheminDuDocument("mentions", "de")).toBe("/public/legal/mentions?lang=fr");
  });
});

describe("les documents lus dans l'application", () => {
  // Ceux qu'on a acceptés en entrant, dans l'ordre où on les cherche.
  it("porte ce qu'on a accepté", () => {
    expect(DOCUMENTS_INTERNES).toEqual(["cgu", "confidentialite"]);
  });

  /* `mentions` se lit SUR LE SITE, et ce test dit pourquoi — sans quoi la
     prochaine personne le prendrait pour un oubli et l'ajouterait ici, créant
     un second endroit où l'éditeur se décrit dont l'un finirait périmé. */
  it("laisse les mentions légales au site", () => {
    expect(documentsHorsApplication()).toEqual(["mentions"]);
  });
});

describe("le lien des mentions légales", () => {
  /* DÉCLARÉ ENTIER, jamais composé : le chemin de cette page est dans SA
     LANGUE — `/fr/mentions-legales` — et n'existe qu'en français ; « /en/… »
     répond 404. Le fabriquer depuis la langue de l'interface enverrait la
     moitié des gens sur une page absente. */
  it("ne rend rien tant que rien n'est déclaré", () => {
    expect(lienDesMentions(undefined)).toBeNull();
    expect(lienDesMentions({})).toBeNull();
  });

  it("rend l'adresse déclarée", () => {
    expect(lienDesMentions({ mentionsUrl: "https://lehno.cm/fr/mentions-legales" }))
      .toBe("https://lehno.cm/fr/mentions-legales");
  });

  it("refuse ce qui n'est pas une adresse sûre", () => {
    expect(lienDesMentions({ mentionsUrl: "lehno.cm/fr/mentions-legales" })).toBeNull();
    expect(lienDesMentions({ mentionsUrl: "  " })).toBeNull();
  });
});

describe("le lien du magasin", () => {
  /* L'URL SE DÉCLARE, elle ne se déduit pas. `com.lehno.app` existe déjà, et
     en composer une adresse Play mènerait à une page absente jusqu'à la mise
     en ligne — personne ne s'en apercevrait avant qu'un utilisateur n'y tombe. */
  it("ne rend rien tant que rien n'est déclaré", () => {
    expect(lienDuMagasin(undefined, "ios")).toBeNull();
    expect(lienDuMagasin(null, "android")).toBeNull();
    expect(lienDuMagasin({}, "ios")).toBeNull();
  });

  it("rend celui de la plateforme, et pas celui de l'autre", () => {
    const extra = { appStoreUrl: "https://apps.apple.com/app/id1", playStoreUrl: "https://play.google.com/x" };
    expect(lienDuMagasin(extra, "ios")).toBe("https://apps.apple.com/app/id1");
    expect(lienDuMagasin(extra, "android")).toBe("https://play.google.com/x");
  });

  it("ne rend que celui qui est renseigné", () => {
    expect(lienDuMagasin({ playStoreUrl: "https://play.google.com/x" }, "ios")).toBeNull();
    expect(lienDuMagasin({ playStoreUrl: "https://play.google.com/x" }, "android"))
      .toBe("https://play.google.com/x");
  });

  /* La configuration s'édite à la main : une valeur à moitié remplie ne doit
     pas ouvrir n'importe quoi. */
  it("refuse ce qui n'est pas une adresse sûre", () => {
    expect(lienDuMagasin({ appStoreUrl: "   " }, "ios")).toBeNull();
    expect(lienDuMagasin({ appStoreUrl: "apps.apple.com/app/id1" }, "ios")).toBeNull();
    expect(lienDuMagasin({ appStoreUrl: "http://apps.apple.com/app/id1" }, "ios")).toBeNull();
    expect(lienDuMagasin({ appStoreUrl: 42 }, "ios")).toBeNull();
  });
});

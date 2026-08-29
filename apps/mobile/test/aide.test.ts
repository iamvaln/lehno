import { describe, expect, it } from "vitest";
import {
  cheminDuDocument, DOCUMENTS_ETIQUETES, documentsSansLibelle, lienDuMagasin,
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

describe("les documents proposés", () => {
  // Dans l'ordre où on les cherche : ce qu'on a accepté, puis les données.
  it("ne propose que ceux qu'on sait nommer", () => {
    expect(DOCUMENTS_ETIQUETES).toEqual(["cgu", "confidentialite"]);
  });

  /* `mentions` est servi et n'a AUCUN libellé — la copie n'en porte que deux,
     écrits pour le pied de l'écran de connexion. L'écrire moi-même serait
     rédiger à la place de qui rédige. Ce test le nomme plutôt que de le laisser
     se perdre : un document légal qu'on ne montre pas ne protège personne, et
     c'est le genre d'oubli qui dure des années. */
  it("nomme celui qui attend un libellé", () => {
    expect(documentsSansLibelle()).toEqual(["mentions"]);
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

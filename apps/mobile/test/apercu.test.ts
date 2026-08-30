import { describe, expect, it } from "vitest";
import type { PublicWall } from "@lehno/contracts";
import { accepteDesVoeux, anniversaireSansAnnee, pageVide } from "../lib/apercu.js";

const mur = (p: Partial<PublicWall> = {}): PublicWall => ({
  username: "valentine", displayName: "Valentine", welcomeMessage: null,
  birthday: null, interests: [], wishLinkToken: null, ...p,
});

describe("l'anniversaire sans son année", () => {
  /* « Le Mur annonce un anniversaire, pas une date de naissance — l'année
     dirait l'âge à tout visiteur. » On ne rend donc jamais l'année. */
  it("rend le jour et le mois, jamais l'année", () => {
    const rendu = anniversaireSansAnnee("03-22", "fr");
    expect(rendu).toContain("22");
    expect(rendu).not.toMatch(/\d{4}/);
  });

  /* Le 29 février existe, et une année NON bissextile le ferait disparaître —
     ou glisser au 1er mars sans que personne le voie. */
  it("garde le 29 février", () => {
    expect(anniversaireSansAnnee("02-29", "fr")).toContain("29");
  });

  /* Une date impossible se replierait en mars sans rien dire : on préfère ne
     rien rendre que rendre une autre date. */
  it("ne replie pas une date impossible", () => {
    expect(anniversaireSansAnnee("02-31", "fr")).toBeNull();
    expect(anniversaireSansAnnee("13-01", "fr")).toBeNull();
  });

  it("refuse ce qui n'est pas au format du contrat", () => {
    expect(anniversaireSansAnnee("1990-03-22", "fr")).toBeNull();
    expect(anniversaireSansAnnee("", "fr")).toBeNull();
  });
});

describe("une page qui ne dit rien de soi", () => {
  /* Ce n'est pas une panne, c'est une information : on s'apprête à partager
     une adresse qui ne montre rien. */
  it("se reconnaît", () => {
    expect(pageVide(mur())).toBe(true);
  });

  it("cesse d'être vide dès qu'un élément paraît", () => {
    expect(pageVide(mur({ welcomeMessage: "Bonjour" }))).toBe(false);
    expect(pageVide(mur({ birthday: "03-22" }))).toBe(false);
    expect(pageVide(mur({ interests: [{ kind: "hobby", value: "jazz" }] }))).toBe(false);
  });
});

describe("le dépôt de vœux", () => {
  /* Le serveur résout les TROIS cas — pas d'occasion, fenêtre fermée, drapeau
     éteint. « Un client n'a aucune règle à connaître, et ne peut donc pas
     proposer un bouton qui mènerait à un 404. » */
  it("se lit sur le jeton, jamais sur une règle refaite", () => {
    expect(accepteDesVoeux(mur({ wishLinkToken: "abc" }))).toBe(true);
    expect(accepteDesVoeux(mur())).toBe(false);
  });
});

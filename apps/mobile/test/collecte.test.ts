import { describe, expect, it } from "vitest";
import { createCollectionLinkSchema, type CollectionLink } from "@lehno/contracts";
import {
  corpsDeCreation, estVivant, lienPublicVivant, lienVivantPour,
} from "../lib/collecte.js";

const uuid = (n: number): string =>
  `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;

const lien = (n: number, p: Partial<CollectionLink> = {}): CollectionLink => ({
  id: uuid(n), type: "nominatif", token: `tok${n}`, personId: uuid(50),
  isActive: true, createdAt: "2026-08-01T00:00:00.000Z", ...p,
});

describe("un lien révoqué ne se rallume pas", () => {
  /* « Le lien est durable : pas d'expiration, seulement une révocation. » Le
     contrat n'offre que la création et la suppression. La copie propose
     « Réactiver un lien » et se contredit deux lignes plus bas — « vous pouvez
     en créer un autre ». C'est la seconde qui dit vrai. */
  it("distingue le vivant du révoqué", () => {
    expect(estVivant(lien(1))).toBe(true);
    expect(estVivant(lien(2, { isActive: false }))).toBe(false);
  });
});

describe("le lien qu'on montre pour une fiche", () => {
  /* Plusieurs révoqués peuvent traîner derrière un proche — créé, révoqué,
     recréé. En montrer plusieurs ferait choisir entre des adresses dont une
     seule répond. */
  it("écarte les révoqués", () => {
    const trouve = lienVivantPour([
      lien(1, { isActive: false }), lien(2),
    ], uuid(50));
    expect(trouve?.id).toBe(uuid(2));
  });

  it("ne rend rien quand aucun ne vit", () => {
    expect(lienVivantPour([lien(1, { isActive: false })], uuid(50))).toBeNull();
  });

  it("ne rend pas le lien d'un autre proche", () => {
    expect(lienVivantPour([lien(1, { personId: uuid(99) })], uuid(50))).toBeNull();
  });

  // Un lien public ne vise personne : il ne peut pas répondre pour une fiche.
  it("ne confond pas un public avec un nominatif", () => {
    expect(lienVivantPour([lien(1, { type: "public", personId: null })], uuid(50)))
      .toBeNull();
  });
});

describe("le lien public du compte", () => {
  it("se trouve parmi les vivants", () => {
    const trouve = lienPublicVivant([
      lien(1), lien(2, { type: "public", personId: null }),
    ]);
    expect(trouve?.id).toBe(uuid(2));
  });

  it("ignore un public révoqué", () => {
    expect(lienPublicVivant([lien(1, { type: "public", personId: null, isActive: false })]))
      .toBeNull();
  });
});

describe("ce qu'on envoie pour en créer un", () => {
  it("porte la fiche sur un nominatif", () => {
    const corps = corpsDeCreation("nominatif", uuid(50));
    expect(corps).toEqual({ type: "nominatif", personId: uuid(50) });
  });

  /* Le contrat refuse les deux autres combinaisons, et il a raison : poser une
     fiche sur un lien public laisserait croire qu'on sait déjà où ranger ce qui
     reviendra — alors que c'est précisément la question que la validation
     posera. */
  it("n'emporte jamais de fiche sur un public", () => {
    expect(corpsDeCreation("public", uuid(50))).toEqual({ type: "public" });
  });

  it("compose des corps que le contrat accepte", () => {
    expect(createCollectionLinkSchema.safeParse(corpsDeCreation("public", null)).success)
      .toBe(true);
    expect(createCollectionLinkSchema.safeParse(corpsDeCreation("nominatif", uuid(50))).success)
      .toBe(true);
  });

  // Un nominatif sans fiche est refusé par le contrat — « un lien nominatif
  // désigne une fiche ». On ne compose donc pas un corps qu'il rejettera.
  it("refuse de composer un nominatif sans fiche", () => {
    expect(() => corpsDeCreation("nominatif", null)).toThrow();
  });
});

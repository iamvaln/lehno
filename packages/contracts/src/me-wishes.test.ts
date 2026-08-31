import { describe, expect, it } from "vitest";
import { createWishSchema, giftSchema, updateWishSchema, wishSchema } from "./me-wishes.js";

const ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

const SOUHAIT = {
  id: ID,
  occurrenceId: "3f2504e0-4f89-11d3-9a0c-0305e82c3302",
  label: "Un cours de céramique",
  link: null,
  imageUrl: null,
  details: null,
  price: null,
  currency: null,
  status: "available" as const,
  origin: "owner" as const,
  isShortlisted: false,
  reservedByName: null,
};

describe("les souhaits", () => {
  it("se lit sans prix", () => {
    expect(wishSchema.parse(SOUHAIT).price).toBeNull();
  });

  // Un prix sans devise ne se lit pas : « 12 000 » ne dit ni des francs CFA ni
  // des euros, et le Mur affiche ce montant à des visiteurs.
  it("exige une devise dès qu'un prix est donné", () => {
    expect(() => createWishSchema.parse({ label: "Un livre", price: 12000 })).toThrow();
    expect(() => createWishSchema.parse({ label: "Un livre", price: 12000, currency: "XAF" })).not.toThrow();
  });

  it("refuse une devise qui n'est pas un code ISO à trois lettres", () => {
    expect(() => createWishSchema.parse({ label: "Un livre", price: 1, currency: "francs" })).toThrow();
  });

  /* `reserved` découle d'une réservation confirmée : le propriétaire ne le pose
     pas. Le lui laisser écrire permettrait de marquer réservé un souhait que
     personne n'a pris — et donc de faire disparaître un cadeau du Mur sans
     qu'aucune réservation ne l'explique. `fulfilled`, lui, est bien sa
     décision. */
  it("ne laisse pas le propriétaire déclarer un souhait réservé", () => {
    expect(() => updateWishSchema.parse({ status: "fulfilled" })).not.toThrow();
    expect(() => updateWishSchema.parse({ status: "available" })).not.toThrow();
    expect(() => updateWishSchema.parse({ status: "reserved" })).toThrow();
  });

  // « Le nom du réservant si ce dernier l'a autorisé. Le reste demeure
  // anonyme. » Nul ne veut dire « personne » ici, mais « pas de nom donné ».
  it("porte le nom du réservant seulement s'il l'a autorisé", () => {
    const reserve = { ...SOUHAIT, status: "reserved" as const, reservedByName: "Mathias" };
    expect(wishSchema.parse(reserve).reservedByName).toBe("Mathias");
    expect(wishSchema.parse({ ...SOUHAIT, status: "reserved" }).reservedByName).toBeNull();
  });

  it("refuse un PATCH vide", () => {
    expect(() => updateWishSchema.parse({})).toThrow();
  });

  /* Le repère personnel n'est PAS une exposition. Le champ s'appelait
     `isPublic` — nom hérité d'`OwnerWish`, où il décide de ce qui paraît sur
     la liste partagée. Un souhait de proche ne se partage pas : le laisser
     nommé « public » le faisait exposer un jour sur la foi de son seul nom. */
  it("porte un repère personnel, jamais une exposition", () => {
    expect(wishSchema.parse({ ...SOUHAIT, isShortlisted: true }).isShortlisted).toBe(true);
    expect(() => wishSchema.parse({ ...SOUHAIT, isPublic: true })).toThrow();
    expect(() => updateWishSchema.parse({ isPublic: true })).toThrow();
  });

  /* La provenance ne s'écrit pas : elle dit ce que vaut le souhait. Accepter
     `origin` du client laisserait un ajout personnel se déclarer `collected`,
     donc se faire passer pour une confidence du proche lui-même. */
  it("ne laisse pas le client déclarer la provenance", () => {
    expect(() => createWishSchema.parse({ label: "Un livre", origin: "collected" })).toThrow();
    expect(() => updateWishSchema.parse({ origin: "collected" })).toThrow();
  });
});

describe("les cadeaux déjà offerts", () => {
  const CADEAU = {
    id: ID,
    personId: "3f2504e0-4f89-11d3-9a0c-0305e82c3303",
    occurrenceId: null,
    label: "Un carnet relié",
    wishlistItemId: null,
    givenOn: "2025-08-24",
    year: 2025,
  };

  // « Sans cette trace, rien n'empêche de proposer en 2027 le cadeau de 2026 » :
  // c'est la mémoire que le produit promet, et la génération d'idées la lit.
  it("se lit avec ou sans occasion connue", () => {
    expect(giftSchema.parse(CADEAU).occurrenceId).toBeNull();
    expect(giftSchema.parse({ ...CADEAU, occurrenceId: ID }).occurrenceId).toBe(ID);
  });

  // La fiche affiche l'historique par année. Une date d'offrande peut manquer —
  // un cadeau ressaisi longtemps après — mais l'année sert de rangement.
  it("porte l'année même sans date d'offrande", () => {
    expect(giftSchema.parse({ ...CADEAU, givenOn: null }).year).toBe(2025);
  });
});

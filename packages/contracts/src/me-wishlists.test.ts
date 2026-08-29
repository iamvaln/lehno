import { describe, expect, it } from "vitest";
import {
  createOwnerWishSchema, createWishlistSchema, myReservationSchema,
  ownerWishSchema, updateOwnerWishSchema, wishlistSchema,
} from "./me-wishlists.js";
import {
  publicWishSchema, reserveWishSchema, sharedWishlistSchema,
  verifyReservationSchema,
} from "./public-wishlists.js";

const ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const ID2 = "3f2504e0-4f89-11d3-9a0c-0305e82c3302";

const SOUHAIT = {
  id: ID,
  wishlistId: ID2,
  label: "Un moulin à café manuel",
  link: null,
  imageUrl: null,
  details: null,
  price: null,
  currency: null,
  status: "available" as const,
  isPublic: true,
  position: null,
  reservedByName: null,
};

describe("mes listes de souhaits", () => {
  it("lit un de mes souhaits", () => {
    expect(ownerWishSchema.parse(SOUHAIT).isPublic).toBe(true);
  });

  /* La devise accompagne le prix : « 12 000 » ne dit ni des francs CFA ni des
     euros, et la liste partagée affiche ce montant à des visiteurs qui doivent
     décider s'ils peuvent l'offrir. */
  it("exige une devise dès qu'un prix est donné", () => {
    expect(() => createOwnerWishSchema.parse({ label: "Un livre", price: 12000 })).toThrow();
    expect(() => createOwnerWishSchema.parse({ label: "Un livre", price: 12000, currency: "XAF" })).not.toThrow();
  });

  /* `reserved` DÉCOULE d'une réservation confirmée. Le laisser écrire au
     propriétaire lui permettrait de déclarer pris un cadeau que personne n'a
     réservé — donc de le retirer de la liste partagée sans qu'aucune
     réservation ne l'explique. `fulfilled` reste sa décision. */
  it("ne laisse pas le propriétaire déclarer un souhait réservé", () => {
    expect(() => updateOwnerWishSchema.parse({ status: "fulfilled" })).not.toThrow();
    expect(() => updateOwnerWishSchema.parse({ status: "available" })).not.toThrow();
    expect(() => updateOwnerWishSchema.parse({ status: "reserved" })).toThrow();
  });

  // Un PATCH vide ne dit rien : le refuser évite une écriture qui n'écrit rien
  // et une réponse qui laisse croire à une correction.
  it("refuse une correction sans aucun champ", () => {
    expect(() => updateOwnerWishSchema.parse({})).toThrow();
  });

  /* `.strict()` partout : un champ inconnu est refusé, jamais ignoré. Sans
     lui, un client qui envoie `status: "reserved"` en croyant le poser
     recevrait un 200 et croirait avoir réussi. */
  it("refuse un champ que le contrat ne connaît pas", () => {
    expect(() => createWishlistSchema.parse({ occurrenceId: ID, titre: "Mon mariage" })).toThrow();
    expect(() => createOwnerWishSchema.parse({ label: "Un livre", origin: "collected" })).toThrow();
  });

  it("lit une liste et ses comptes", () => {
    const liste = wishlistSchema.parse({
      id: ID, occurrenceId: ID2, occurrenceDate: "2026-08-24",
      eventKind: "birthday", eventLabel: null,
      wishCount: 7, reservedCount: 3, isShared: true, isArchived: false,
    });
    expect(liste.reservedCount).toBe(3);
  });

  it("lit une de mes réservations chez les autres", () => {
    const r = myReservationSchema.parse({
      id: ID, wishId: ID2, wishLabel: "Un carnet", wishImageUrl: null,
      price: null, currency: null,
      ownerDisplayName: "Awa", ownerUsername: "awa",
      occurrenceDate: "2026-09-02", showIdentity: true,
      confirmedAt: "2026-08-28T10:00:00.000Z",
    });
    expect(r.showIdentity).toBe(true);
  });
});

describe("la liste partagée", () => {
  /* LA garde du lot, posée jusque dans la forme : rien de ce qu'un visiteur
     reçoit ne peut nommer un réservant. Le nom donné l'a été au PROPRIÉTAIRE,
     pas aux autres visiteurs — et une forme qui accepterait le champ finirait
     par le porter, le jour où quelqu'un étale une ligne de base au lieu de la
     recopier champ par champ. */
  it("n'a aucun champ où loger le nom d'un réservant", () => {
    expect(() => publicWishSchema.parse({
      id: ID, label: "Un moulin", imageUrl: null, details: null, link: null,
      price: null, currency: null,
      isReserved: true, isFulfilled: false, reservedByMe: false,
      reservedByName: "Bila",
    })).toThrow();
  });

  // « Un lien révoqué : le serveur rend un état explicite que la page traduit
  // en message, plutôt qu'une absence sèche » (§7).
  it("porte l'état du lien plutôt qu'une absence", () => {
    const mort = sharedWishlistSchema.parse({ state: "revoked" });
    expect(mort.state).toBe("revoked");
  });

  it("refuse une liste « ok » à qui n'en donne pas le contenu", () => {
    expect(() => sharedWishlistSchema.parse({ state: "ok" })).toThrow();
  });

  /* L'adresse est FACULTATIVE au schéma parce que la règle est conditionnelle
     à la session : l'utilisateur connecté n'en donne pas, son compte l'a déjà
     vérifiée. Le serveur exige la sienne au visiteur sans compte — une règle
     que le schéma ne peut pas porter, faute de savoir qui appelle. */
  it("laisse l'adresse facultative, la session tranchant au serveur", () => {
    expect(() => reserveWishSchema.parse({})).not.toThrow();
    expect(() => reserveWishSchema.parse({ email: "awa@example.com" })).not.toThrow();
  });

  /* Le champ leurre figure AU CONTRAT. L'en retirer ferait refuser la
     soumission par une erreur de validation, ce qui apprendrait au robot que
     le leurre existe — l'inverse exact de ce qu'on cherche. */
  it("accepte le champ leurre plutôt que de le refuser bruyamment", () => {
    expect(() => reserveWishSchema.parse({ email: "a@b.co", website: "" })).not.toThrow();
    expect(() => reserveWishSchema.parse({ email: "a@b.co", website: "http://spam" })).not.toThrow();
  });

  it("exige six chiffres pour un code", () => {
    expect(() => verifyReservationSchema.parse({ email: "a@b.co", code: "12345" })).toThrow();
    expect(() => verifyReservationSchema.parse({ email: "a@b.co", code: "abcdef" })).toThrow();
    expect(() => verifyReservationSchema.parse({ email: "a@b.co", code: "012345" })).not.toThrow();
  });
});

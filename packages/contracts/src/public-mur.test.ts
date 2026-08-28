import { describe, expect, it } from "vitest";
import {
  publicWallSchema, collectSubmitSchema, submitWishSchema,
  publicCollectFormSchema,
} from "./public-mur.js";

describe("le Mur public", () => {
  const MUR = {
    username: "valentine",
    displayName: "Valentine",
    welcomeMessage: null,
    birthday: "03-14",
    interests: [{ kind: "hobby" as const, value: "la randonnée" }],
    wishLinkToken: null,
  };

  /* Garde l'ANNÉE hors du Mur. L'année dirait l'âge à tout visiteur, ce que
     §3.4 ne demande nulle part — elle ne parle que d'une « simple mention » de
     la date. Le jour où quelqu'un « simplifierait » en servant la date de
     naissance entière, ce test tombe. */
  it("n'annonce que le jour et le mois de l'anniversaire", () => {
    expect(publicWallSchema.parse(MUR).birthday).toBe("03-14");
    expect(publicWallSchema.safeParse({ ...MUR, birthday: "1990-03-14" }).success).toBe(false);
  });

  // Garde le cloisonnement de la forme publique : rien de ce qui identifie le
  // compte au-delà de son pseudo ne doit pouvoir s'y glisser. `.strict()` fait
  // le travail, ce test dit pourquoi il est là.
  it("refuse tout champ qui n'a pas été décidé pour le public", () => {
    expect(publicWallSchema.safeParse({ ...MUR, email: "a@b.c" }).success).toBe(false);
    expect(publicWallSchema.safeParse({ ...MUR, userId: "x" }).success).toBe(false);
  });

  // Garde la nature exposable : une taille n'est pas un goût, et le contrat
  // public ne doit pas pouvoir en porter une.
  it("ne peut pas porter une taille de vêtement", () => {
    expect(publicWallSchema.safeParse({
      ...MUR, interests: [{ kind: "clothing_size", value: "M" }],
    }).success).toBe(false);
  });
});

describe("le formulaire de collecte", () => {
  // Garde le fait qu'un lien public ne montre AUCUNE fiche : les deux champs
  // existent, mais nuls. Le contrat doit les accepter nuls, sinon le service
  // n'aurait pas le droit de les taire.
  it("accepte une fiche tue", () => {
    expect(publicCollectFormSchema.safeParse({
      type: "public", ownerDisplayName: "Valentine",
      personDisplayName: null, birthDate: null, ownerWallUsername: null,
    }).success).toBe(true);
  });
});

describe("une contribution", () => {
  /* Garde contre la soumission à blanc. Sans elle, un envoi accidentel — ou un
     robot qui poste un corps vide — remplirait la file de validation de lignes
     qui n'apprennent rien, et le propriétaire trierait à la main. */
  it("porte au moins une date, un souhait ou un mot", () => {
    expect(collectSubmitSchema.safeParse({}).success).toBe(false);
    expect(collectSubmitSchema.safeParse({ wishes: [] }).success).toBe(false);
    expect(collectSubmitSchema.safeParse({ personalNote: "salut" }).success).toBe(true);
  });

  /* Garde les BORNES. Tout ce qui arrive ici vient d'un inconnu : une borne
     oubliée est une colonne texte qu'on remplit de mégaoctets. */
  it("borne ce qu'un inconnu peut écrire", () => {
    expect(collectSubmitSchema.safeParse({ personalNote: "x".repeat(2001) }).success).toBe(false);
    expect(collectSubmitSchema.safeParse({
      wishes: [{ label: "x".repeat(201) }],
    }).success).toBe(false);
    expect(collectSubmitSchema.safeParse({
      birthDate: "1990-03-14", submitterName: "x".repeat(81),
    }).success).toBe(false);
  });

  /* Garde le CHAMP LEURRE au contrat. S'il n'y figurait pas, le `.strict()`
     refuserait la soumission par une erreur de validation — ce qui apprendrait
     au robot que le leurre existe, et qu'il suffit de ne pas le remplir. */
  it("accepte le champ leurre plutôt que de le refuser bruyamment", () => {
    expect(collectSubmitSchema.safeParse({
      personalNote: "salut", website: "", renderedAt: 1_700_000_000_000,
    }).success).toBe(true);
    expect(submitWishSchema.safeParse({
      content: "joyeux anniversaire", website: "", renderedAt: 1_700_000_000_000,
    }).success).toBe(true);
  });

  // Garde l'invariant « un prix porte sa devise » jusque sur le formulaire
  // public : c'est le propriétaire qui lira ce montant, et « 12 000 » ne dit
  // ni des francs CFA ni des euros.
  it("refuse un prix sans devise", () => {
    expect(collectSubmitSchema.safeParse({
      wishes: [{ label: "un livre", price: 12000 }],
    }).success).toBe(false);
    expect(collectSubmitSchema.safeParse({
      wishes: [{ label: "un livre", price: 12000, currency: "XAF" }],
    }).success).toBe(true);
  });
});

describe("un vœu déposé", () => {
  // Garde contre le vœu vide : un message qui ne dit rien n'est pas un vœu, et
  // il occuperait quand même la file de modération.
  it("porte un message", () => {
    expect(submitWishSchema.safeParse({ content: "   " }).success).toBe(false);
    expect(submitWishSchema.safeParse({ content: "bon anniversaire" }).success).toBe(true);
  });

  // L'auteur est facultatif : « nom de l'auteur (ou signature libre) ;
  // facultatif si non connecté » (§3.5). Absent, le vœu arrive anonyme.
  it("peut rester anonyme", () => {
    expect(submitWishSchema.safeParse({ content: "bravo" }).success).toBe(true);
  });
});

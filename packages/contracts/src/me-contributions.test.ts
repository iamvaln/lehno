import { describe, expect, it } from "vitest";
import {
  createCollectionLinkSchema, receivedWishSchema, submissionDecisionSchema,
  submissionSchema,
} from "./me-contributions.js";

const ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const AUTRE = "3f2504e0-4f89-11d3-9a0c-0305e82c3302";

describe("les liens de collecte", () => {
  // Un lien nominatif collecte pour quelqu'un : sans fiche visée, le serveur ne
  // saurait pas où ranger ce qui arrive. C'est la contrainte de la base.
  it("un lien nominatif désigne la fiche qu'il complète", () => {
    expect(() => createCollectionLinkSchema.parse({ type: "nominatif" })).toThrow();
    expect(() => createCollectionLinkSchema.parse({ type: "nominatif", personId: ID })).not.toThrow();
  });

  // Un lien public ne vise personne — il crée la fiche à la validation.
  it("un lien public ne désigne aucune fiche", () => {
    expect(() => createCollectionLinkSchema.parse({ type: "public" })).not.toThrow();
    expect(() => createCollectionLinkSchema.parse({ type: "public", personId: ID })).toThrow();
  });
});

describe("une contribution à valider", () => {
  const CONTRIBUTION = {
    id: ID,
    linkType: "public" as const,
    personId: null,
    submitterName: "Mathias",
    relationHint: "un ami de la fac",
    birthDate: "1990-08-24",
    personalNote: "Il parle souvent de céramique.",
    status: "pending" as const,
    wishes: [
      { id: AUTRE, label: "Un cours de céramique", link: null, price: null, currency: null, reviewStatus: "pending" as const },
    ],
    createdAt: "2026-08-25T03:00:00.000Z",
  };

  it("porte ses souhaits en lignes, chacun avec son sort", () => {
    expect(submissionSchema.parse(CONTRIBUTION).wishes[0]!.reviewStatus).toBe("pending");
  });

  // Un lien public peut créer une fiche à la validation : la contribution
  // n'en vise donc aucune tant qu'elle n'est pas traitée.
  it("ne vise aucune fiche quand elle vient d'un lien public", () => {
    expect(submissionSchema.parse(CONTRIBUTION).personId).toBeNull();
  });
});

describe("la décision sur une contribution", () => {
  // « La décision porte sur l'ensemble : ce qu'on retient de la date, du mot, et
  // le sort de chaque souhait soumis. » Le serveur applique la répartition en
  // une seule transaction — une décision partielle laisserait la fiche à moitié
  // remplie sans que rien ne le signale.
  it("tranche la date, le mot et chaque souhait ensemble", () => {
    expect(() => submissionDecisionSchema.parse({
      keepBirthDate: true,
      keepPersonalNote: false,
      wishes: [{ id: AUTRE, reviewStatus: "retained" }],
    })).not.toThrow();
  });

  // Rejeter la contribution entière est un geste à part : il n'y a alors rien à
  // répartir, et exiger le sort de chaque souhait serait demander de trancher
  // ce qu'on vient d'écarter.
  it("accepte un rejet global sans détail par souhait", () => {
    expect(() => submissionDecisionSchema.parse({ reject: true })).not.toThrow();
  });

  it("refuse un rejet global assorti d'une répartition", () => {
    expect(() => submissionDecisionSchema.parse({
      reject: true, keepBirthDate: true, wishes: [{ id: AUTRE, reviewStatus: "retained" }],
    })).toThrow();
  });

  // « pending » est l'état d'arrivée, pas une décision : le laisser passer
  // permettrait de clore une contribution en laissant un souhait non tranché.
  it("n'accepte comme sort que « retenu » ou « écarté »", () => {
    expect(() => submissionDecisionSchema.parse({
      keepBirthDate: false, keepPersonalNote: false,
      wishes: [{ id: AUTRE, reviewStatus: "pending" }],
    })).toThrow();
  });

  it("refuse deux décisions pour le même souhait", () => {
    expect(() => submissionDecisionSchema.parse({
      keepBirthDate: false, keepPersonalNote: false,
      wishes: [
        { id: AUTRE, reviewStatus: "retained" },
        { id: AUTRE, reviewStatus: "discarded" },
      ],
    })).toThrow();
  });
});

describe("les vœux reçus", () => {
  const VOEU = {
    id: ID,
    occurrenceId: AUTRE,
    authorName: "Rose",
    content: "Très bel anniversaire.",
    status: "pending" as const,
    createdAt: "2026-08-25T03:00:00.000Z",
  };

  it("se lit d'un auteur nommé ou anonyme", () => {
    expect(receivedWishSchema.parse(VOEU).authorName).toBe("Rose");
    expect(receivedWishSchema.parse({ ...VOEU, authorName: null }).authorName).toBeNull();
  });

  /* Le dictionnaire porte `is_public` et `show_author` en les disant inactifs :
     « les vœux reçus restent privés, le Mur n'a pas de livre d'or ». Les exposer
     ici les rendrait vivants — un client les afficherait, puis quelqu'un les
     câblerait. Ils restent hors du contrat tant qu'ils ne servent pas. */
  it("n'expose pas les champs que le dictionnaire dit inactifs", () => {
    expect(() => receivedWishSchema.parse({ ...VOEU, isPublic: true })).toThrow();
    expect(() => receivedWishSchema.parse({ ...VOEU, showAuthor: true })).toThrow();
  });
});

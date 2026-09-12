import { describe, expect, it } from "vitest";
import { startGenerationSchema } from "@lehno/contracts";
import { cleDeDemande } from "../lib/preparation.js";
import {
  LIMITE_DE_LA_NOTE, demandeDIdees, ideesOffertes, noteTient, noteUtile, ouvertureDuCadrage,
} from "../lib/cadrage.js";

const OCCASION = "11111111-1111-4111-8111-111111111111";

describe("l'ouverture du cadrage", () => {
  it("mène à l'occasion visée", () => {
    expect(ouvertureDuCadrage(OCCASION)).toEqual({
      sorte: "cadrer",
      occurrenceId: OCCASION,
      chemin: `/me/occurrences/${OCCASION}`,
    });
  });

  /* LES PARAMÈTRES DE ROUTE NE SONT PAS DE CONFIANCE : un lien profond les
     pose, et `expo-router` les rend tels quels. Sans la garde, la chaîne part
     dans un chemin d'API — et une chaîne vide donne `/me/occurrences/`,
     c'est-à-dire la liste entière au lieu d'une occasion. */
  it("refuse ce qui n'a pas la forme d'un identifiant", () => {
    for (const douteux of ["", "   ", "../../me/credits", "11111111-1111-4111-8111", "null"]) {
      expect(ouvertureDuCadrage(douteux), douteux).toEqual({ sorte: "sans-objet" });
    }
  });

  it("refuse l'absence de paramètre", () => {
    expect(ouvertureDuCadrage(undefined)).toEqual({ sorte: "sans-objet" });
  });
});

describe("la note, qui est facultative", () => {
  /* C'est tout le propos de l'écran : on peut chercher sans rien dire. Un
     champ obligatoire ferait payer une saisie à quelqu'un qui n'a rien à
     ajouter. */
  it("laisse partir une demande nue", () => {
    const demande = demandeDIdees(OCCASION, "");
    expect(demande).not.toBeNull();
    expect(demande).not.toHaveProperty("briefText");
  });

  // Trois espaces sont une note vide : `briefText` porte `.trim()` avant sa
  // borne, et envoyer des blancs poserait une consigne qui ne dit rien.
  it("tient des blancs pour du vide", () => {
    expect(noteUtile("   \n  ")).toBe("");
    expect(demandeDIdees(OCCASION, "  \n ")).not.toHaveProperty("briefText");
  });

  it("transporte la note quand il y en a une", () => {
    expect(demandeDIdees(OCCASION, "  cadeau commun avec Célarine  "))
      .toHaveProperty("briefText", "cadeau commun avec Célarine");
  });

  /* La borne est celle du contrat, pas la nôtre : si `startGenerationSchema`
     bouge, ce test tombe avant que l'écran n'envoie du refusé. */
  it("s'arrête à la borne du contrat", () => {
    const pleine = "a".repeat(LIMITE_DE_LA_NOTE);
    expect(startGenerationSchema.safeParse({
      kind: "gift_ideas", occurrenceId: OCCASION, briefText: pleine,
    }).success).toBe(true);
    expect(startGenerationSchema.safeParse({
      kind: "gift_ideas", occurrenceId: OCCASION, briefText: `${pleine}a`,
    }).success).toBe(false);

    expect(noteTient(pleine)).toBe(true);
    expect(noteTient(`${pleine}a`)).toBe(false);
    expect(demandeDIdees(OCCASION, `${pleine}a`)).toBeNull();
  });
});

describe("la demande d'idées", () => {
  /* Le corps se repasse dans le schéma RÉEL : c'est la seule façon de savoir
     qu'il partira. Un corps formé à la main et jugé à l'œil a déjà été refusé
     en production pour un champ de trop. */
  it("est acceptée telle quelle par le contrat", () => {
    const demande = demandeDIdees(OCCASION, "budget serré");
    expect(startGenerationSchema.safeParse(demande).success).toBe(true);
  });

  /* Les idées visent une OCCASION, jamais un proche — le contrat refuse
     `personId` pour tout ce qui n'est pas un portrait —, et le studio ne
     règle qu'une image. */
  it("ne vise pas un proche et ne règle aucune image", () => {
    const demande = demandeDIdees(OCCASION, "");
    expect(demande).not.toHaveProperty("personId");
    expect(demande).not.toHaveProperty("studioSelection");
    expect(demande?.occurrenceId).toBe(OCCASION);
  });

  /* LA CLÉ QUI EMPÊCHE DE PAYER DEUX FOIS, et elle vient de `preparation.ts` :
     deux appuis maladroits sur « Chercher des idées » doivent être UNE demande.
     La recomposer ici en donnerait une seconde, donc un second débit. */
  it("porte la clé de la préparation, pas une seconde", () => {
    expect(demandeDIdees(OCCASION, "")?.idempotencyKey)
      .toBe(cleDeDemande("gift_ideas", OCCASION));
  });

  /* La note ne change PAS la clé, et c'est délibéré : corriger un mot puis
     réappuyer ne doit pas produire une seconde génération payante. */
  it("garde la même clé quelle que soit la note", () => {
    expect(demandeDIdees(OCCASION, "avec Célarine")?.idempotencyKey)
      .toBe(demandeDIdees(OCCASION, "")?.idempotencyKey);
  });

  it("ne forme rien depuis un identifiant douteux", () => {
    expect(demandeDIdees("pas-un-uuid", "")).toBeNull();
    expect(demandeDIdees(undefined, "")).toBeNull();
  });
});

describe("qui a droit à cet écran", () => {
  it("s'ouvre quand les idées sont allumées", () => {
    expect(ideesOffertes({ nature: "happy" }, ["generation.ideas"])).toBe(true);
  });

  it("reste fermé sans le drapeau", () => {
    expect(ideesOffertes({ nature: "happy" }, ["generation.message"])).toBe(false);
  });

  /* UNE OCCASION SENSIBLE N'A PAS D'IDÉES DE CADEAU, et le cadrage n'est pas
     une porte dérobée vers celles-ci : on l'atteint par lien profond comme
     n'importe quelle route. La règle vient de `pistesOffertes` — une seconde
     version divergerait de celle de la préparation. */
  it("refuse une occasion sensible, drapeau allumé ou non", () => {
    expect(ideesOffertes({ nature: "sensitive" }, ["generation.ideas"])).toBe(false);
    expect(ideesOffertes({ nature: "sensitive" }, [])).toBe(false);
  });
});

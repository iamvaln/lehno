import { describe, expect, it } from "vitest";
import {
  generationSchema, PORTRAIT_ORIENTATIONS, startGenerationSchema,
} from "./me-generation.js";

const CIBLE = "3f2504e0-4f89-11d3-9a0c-0305e82c3303";

describe("le lancement d'une génération", () => {
  it("connaît les douze orientations du studio", () => {
    expect(PORTRAIT_ORIENTATIONS).toHaveLength(12);
    expect(PORTRAIT_ORIENTATIONS).toContain("tribute");
  });

  // « Une seule voie d'image à la fois », dit le dictionnaire. L'écran le tient
  // déjà — choisir « aucune image » retire la famille et le style — mais un
  // client qui enverrait les deux produirait une image que rien ne décrit.
  it("n'accepte qu'une voie d'image à la fois", () => {
    const base = { kind: "portrait" as const, personId: CIBLE, orientation: "relation" as const };
    expect(() => startGenerationSchema.parse({
      ...base, visualKind: "illustration", illustrationFamily: "nature",
    })).not.toThrow();
    expect(() => startGenerationSchema.parse({
      ...base, visualKind: "photo", photoStyle: "silhouette",
    })).not.toThrow();
    expect(() => startGenerationSchema.parse({
      ...base, visualKind: "illustration", illustrationFamily: "nature", photoStyle: "silhouette",
    })).toThrow();
  });

  it("exige la famille quand la voie est l'illustration", () => {
    expect(() => startGenerationSchema.parse({
      kind: "portrait", personId: CIBLE, orientation: "relation", visualKind: "illustration",
    })).toThrow();
  });

  // « aucune image » ne porte ni famille ni style : un réglage sans effet
  // apprend qu'il ne faut pas lire les réglages.
  it("refuse un réglage d'image quand il n'y a pas d'image", () => {
    expect(() => startGenerationSchema.parse({
      kind: "portrait", personId: CIBLE, orientation: "relation",
      visualKind: "none", illustrationFamily: "nature",
    })).toThrow();
  });

  // Un message de vœux vise une occasion, pas une personne : c'est l'année
  // concernée qui l'ancre. Un portrait vise le proche et peut se générer à tout
  // moment, hors de toute échéance.
  it("vise une occasion pour un message, un proche pour un portrait", () => {
    expect(() => startGenerationSchema.parse({
      kind: "wish_message", occurrenceId: CIBLE,
    })).not.toThrow();
    expect(() => startGenerationSchema.parse({
      kind: "wish_message", personId: CIBLE,
    })).toThrow();
  });
});

describe("le suivi d'une génération", () => {
  const EN_COURS = {
    id: CIBLE,
    kind: "portrait" as const,
    status: "running" as const,
    creditsSpent: 1,
    failureReason: null,
    resultId: null,
    createdAt: "2026-08-25T03:00:00.000Z",
  };

  // Le lancement débite et rend aussitôt un identifiant, sans attendre la
  // production : sans un état « en cours » sur le fil, le client ne saurait pas
  // distinguer une génération qui travaille d'une qui a échoué sans raison.
  it("porte un état en cours, que la table action_run ne connaît pas", () => {
    expect(generationSchema.parse(EN_COURS).status).toBe("running");
  });

  // « En cas d'échec, le crédit est rendu au solde et la raison portée par la
  // réponse. » Un échec muet laisserait l'écran d'attente tourner sans fin.
  it("porte la raison d'un échec", () => {
    const echoue = { ...EN_COURS, status: "failed" as const, failureReason: "model_unavailable" };
    expect(generationSchema.parse(echoue).failureReason).toBe("model_unavailable");
  });

  it("ne porte le résultat qu'une fois abouti", () => {
    const abouti = { ...EN_COURS, status: "succeeded" as const, resultId: CIBLE };
    expect(generationSchema.parse(abouti).resultId).toBe(CIBLE);
  });
});

import { describe, expect, it } from "vitest";
import { generationSchema, portraitSchema, startGenerationSchema } from "./me-generation.js";

const CIBLE = "3f2504e0-4f89-11d3-9a0c-0305e82c3303";

describe("le lancement d'une génération", () => {
  // Les réglages du studio ne sont pas un ensemble arrêté : ils viennent du
  // catalogue que le serveur rend (voir me-studio). Le lancement transporte
  // donc la sélection telle quelle — un enum gelé ici obligerait à livrer une
  // version de l'application pour ajouter une ambiance.
  it("transporte la sélection du studio sans la connaître", () => {
    const lance = startGenerationSchema.parse({
      kind: "portrait",
      personId: CIBLE,
      studioSelection: { orientation: "tribute", visual: "photo", photoStyle: "silhouette" },
    });
    expect(lance.studioSelection).toEqual({
      orientation: "tribute", visual: "photo", photoStyle: "silhouette",
    });
  });

  it("accepte un réglage que ce contrat n'a jamais vu", () => {
    expect(() => startGenerationSchema.parse({
      kind: "portrait", personId: CIBLE,
      studioSelection: { ambiance: "encre", format: "story" },
    })).not.toThrow();
  });

  // Un message de vœux vise une occasion, pas une personne : c'est l'année
  // concernée qui l'ancre. Un portrait vise le proche et se génère à tout
  // moment depuis sa fiche, hors de toute échéance.
  it("vise une occasion pour un message, un proche pour un portrait", () => {
    expect(() => startGenerationSchema.parse({ kind: "wish_message", occurrenceId: CIBLE })).not.toThrow();
    expect(() => startGenerationSchema.parse({ kind: "wish_message", personId: CIBLE })).toThrow();
    expect(() => startGenerationSchema.parse({ kind: "portrait", occurrenceId: CIBLE })).toThrow();
  });

  // Le studio n'a de sens que pour un portrait : les idées et le message ne
  // règlent aucune image.
  it("refuse une sélection de studio hors du portrait", () => {
    expect(() => startGenerationSchema.parse({
      kind: "gift_ideas", occurrenceId: CIBLE, studioSelection: { orientation: "relation" },
    })).toThrow();
  });
});

describe("le suivi d'une génération", () => {
  const EN_COURS = {
    id: CIBLE,
    kind: "portrait" as const,
    status: "running" as const,
    // La cible : sans elle, l'écran d'attente n'a ni nom à afficher ni décompte
    // à montrer. Un portrait vise un proche, un message une occasion — l'une
    // des deux est donc toujours nulle.
    personId: CIBLE,
    occurrenceId: null,
    creditsSpent: 1,
    failureReason: null,
    resultId: null,
    createdAt: "2026-08-25T03:00:00.000Z",
  };

  // Le lancement débite et rend aussitôt un identifiant, sans attendre la
  // production : sans état « en cours » sur le fil, le client ne distinguerait
  // pas une génération qui travaille d'une qui a échoué sans le dire.
  it("porte un état en cours, que la table action_run ne connaît pas", () => {
    expect(generationSchema.parse(EN_COURS).status).toBe("running");
  });

  it("porte la raison d'un échec", () => {
    const echoue = { ...EN_COURS, status: "failed" as const, failureReason: "model_unavailable" };
    expect(generationSchema.parse(echoue).failureReason).toBe("model_unavailable");
  });

  /* Une génération qui a ÉCHOUÉ n'a pas de résultat, et c'est précisément là
     que la cible compte : l'écran doit savoir pour qui refaire. */
  it("garde sa cible même sans résultat", () => {
    const echoue = generationSchema.parse({
      ...EN_COURS, status: "failed" as const, failureReason: "model_unavailable",
    });
    expect(echoue.resultId).toBeNull();
    expect(echoue.personId).toBe(CIBLE);
  });

  // L'une des deux est nulle selon la nature. Le client n'a rien à en déduire :
  // il affiche celle qui est là.
  it("vise une occasion pour un message, un proche pour un portrait", () => {
    const message = generationSchema.parse({
      ...EN_COURS, kind: "wish_message" as const, personId: null, occurrenceId: CIBLE,
    });
    expect(message.occurrenceId).toBe(CIBLE);
    expect(message.personId).toBeNull();
  });
  it("ne porte le résultat qu'une fois abouti", () => {
    expect(generationSchema.parse({ ...EN_COURS, status: "succeeded", resultId: CIBLE }).resultId).toBe(CIBLE);
  });
});

describe("le portrait produit", () => {
  const PORTRAIT = {
    id: CIBLE,
    personId: "3f2504e0-4f89-11d3-9a0c-0305e82c3302",
    status: "generated" as const,
    content: "Trois phrases à la première personne.",
    contentShort: null,
    senderNote: "Fait avec soin par Valentine",
    imageUrl: null,
    createdAt: "2026-08-25T03:00:00.000Z",
  };

  // L'application ne compose rien : le portrait est une image, et son assemblage
  // appartient au serveur. L'écran affiche ce que l'API rend.
  it("s'affiche depuis une image, pas depuis des réglages", () => {
    const approuve = portraitSchema.parse({
      ...PORTRAIT, status: "approved", imageUrl: "https://exemple.test/p.png",
    });
    expect(approuve.imageUrl).toBe("https://exemple.test/p.png");
  });

  // L'image est « produite à l'approbation » : avant elle, il n'y en a pas.
  // La rendre nulle plutôt qu'absente oblige l'écran à traiter l'attente.
  it("n'a pas encore d'image avant d'être approuvé", () => {
    expect(portraitSchema.parse(PORTRAIT).imageUrl).toBeNull();
  });

  it("refuse un champ que le serveur ne connaît pas", () => {
    expect(() => portraitSchema.parse({ ...PORTRAIT, ambiance: "encre" })).toThrow();
  });

});

import { describe, expect, it } from "vitest";
import { studioConfigSchema, groupesAtteignables, valideSelection } from "./me-studio.js";

/* Le catalogue tel que le serveur le rendrait aujourd'hui. Les identifiants
   sont ceux des explorations en cours — ils n'ont pas à être justes ici :
   c'est précisément ce que ce contrat cesse de figer. */
const CATALOGUE = {
  groups: [
    {
      id: "orientation",
      label: "Ce que le portrait dit",
      defaultChoiceId: "relation",
      choices: [
        { id: "relation", label: "La relation", description: null, warning: null, revealsGroup: null },
        {
          id: "tribute", label: "Hommage", description: null,
          warning: "Le ton change : palette froide, aucune illustration vive.",
          revealsGroup: null,
        },
      ],
    },
    {
      id: "visual",
      label: "L'image",
      defaultChoiceId: "illustration",
      choices: [
        { id: "illustration", label: "Une illustration", description: null, warning: null, revealsGroup: "family" },
        { id: "photo", label: "Une photo", description: null, warning: null, revealsGroup: "photoStyle" },
        { id: "none", label: "Aucune image", description: null, warning: null, revealsGroup: null },
      ],
    },
    {
      id: "family",
      label: "La famille",
      defaultChoiceId: "nature",
      choices: [{ id: "nature", label: "Nature", description: null, warning: null, revealsGroup: null }],
    },
    {
      id: "photoStyle",
      label: "Le style",
      defaultChoiceId: "silhouette",
      choices: [{ id: "silhouette", label: "Silhouette", description: null, warning: null, revealsGroup: null }],
    },
  ],
  rootGroupIds: ["orientation", "visual"],
};

describe("le catalogue du studio", () => {
  it("se lit tel que le serveur le rend", () => {
    expect(studioConfigSchema.parse(CATALOGUE).groups).toHaveLength(4);
  });

  // Un défaut qui ne désigne rien laisse l'écran sans sélection initiale, et la
  // faute vient du back-office, pas du client : elle doit se voir au parsage.
  it("refuse un défaut qui ne désigne aucun choix de son groupe", () => {
    const casse = structuredClone(CATALOGUE);
    casse.groups[0]!.defaultChoiceId = "inexistant";
    expect(() => studioConfigSchema.parse(casse)).toThrow();
  });

  // Un choix qui révèle un groupe absent rendrait un écran sans suite : on
  // choisit « une photo » et rien n'apparaît.
  it("refuse un choix qui révèle un groupe absent", () => {
    const casse = structuredClone(CATALOGUE);
    casse.groups[1]!.choices[0]!.revealsGroup = "fantome";
    expect(() => studioConfigSchema.parse(casse)).toThrow();
  });

  it("refuse deux groupes de même identifiant", () => {
    const casse = structuredClone(CATALOGUE);
    casse.groups.push(structuredClone(casse.groups[0]!));
    expect(() => studioConfigSchema.parse(casse)).toThrow();
  });
});

describe("ce que la sélection fait apparaître", () => {
  const config = studioConfigSchema.parse(CATALOGUE);

  // La règle « une illustration porte sa famille » ne vit plus dans le code :
  // elle se déduit du catalogue. Ajouter une voie d'image et ses options ne
  // demande donc plus de livrer une version de l'application.
  it("suit ce qu'un choix révèle", () => {
    expect(groupesAtteignables(config, { orientation: "relation", visual: "illustration" }))
      .toEqual(["orientation", "visual", "family"]);
    expect(groupesAtteignables(config, { orientation: "relation", visual: "photo" }))
      .toEqual(["orientation", "visual", "photoStyle"]);
  });

  it("n'ouvre rien de plus quand il n'y a pas d'image", () => {
    expect(groupesAtteignables(config, { orientation: "relation", visual: "none" }))
      .toEqual(["orientation", "visual"]);
  });
});

describe("la validation d'une sélection", () => {
  const config = studioConfigSchema.parse(CATALOGUE);

  it("accepte une sélection complète", () => {
    expect(valideSelection(config, { orientation: "relation", visual: "illustration", family: "nature" }))
      .toEqual([]);
  });

  it("signale un groupe atteignable laissé sans réponse", () => {
    expect(valideSelection(config, { orientation: "relation", visual: "illustration" }))
      .toEqual([{ groupId: "family", raison: "manquant" }]);
  });

  // Un réglage sans effet apprend qu'il ne faut pas lire les réglages : choisir
  // « aucune image » et transmettre quand même une famille produirait une image
  // que rien ne décrit.
  it("signale une réponse à un groupe que rien n'a ouvert", () => {
    expect(valideSelection(config, { orientation: "relation", visual: "none", family: "nature" }))
      .toEqual([{ groupId: "family", raison: "hors-portee" }]);
  });

  it("signale un choix que le catalogue ne connaît pas", () => {
    expect(valideSelection(config, { orientation: "inconnu", visual: "none" }))
      .toEqual([{ groupId: "orientation", raison: "choix-inconnu" }]);
  });
});

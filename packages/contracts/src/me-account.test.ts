import { describe, expect, it } from "vitest";
import {
  confirmDeletionSchema, createFeedbackSchema, createSupportRequestSchema,
  deletionAcceptedSchema, deviceSchema, registerDeviceSchema,
} from "./me-account.js";

const CONFIRMATION = {
  username: "awa",
  code: "428913",
};

describe("confirmer une suppression — deux preuves, pas une", () => {
  it("accepte le pseudo et le code, sans motif", () => {
    expect(confirmDeletionSchema.parse(CONFIRMATION)).toEqual(CONFIRMATION);
  });

  it("accepte un motif choisi accompagné d'un texte libre", () => {
    const avecMotif = { ...CONFIRMATION, reason: "too_expensive" as const, reasonDetails: "au-delà de mon budget" };
    expect(confirmDeletionSchema.parse(avecMotif)).toEqual(avecMotif);
  });

  /* Le piège gardé : la maquette §3.24 dit que la raison du départ se passe
     « d'un geste ». Un schéma qui l'exigerait transformerait un départ en
     interrogatoire, et le champ se remplirait de « autre » — donc de rien. */
  it("n'exige jamais de motif : partir sans dire pourquoi reste possible", () => {
    expect(() => confirmDeletionSchema.parse(CONFIRMATION)).not.toThrow();
  });

  /* Le piège gardé : un code à cinq chiffres, ou avec une lettre, ne doit pas
     atteindre le service pour y être comparé. La forme se refuse ici. */
  it("refuse un code qui n'a pas six chiffres", () => {
    expect(() => confirmDeletionSchema.parse({ ...CONFIRMATION, code: "42891" })).toThrow();
    expect(() => confirmDeletionSchema.parse({ ...CONFIRMATION, code: "42891a" })).toThrow();
  });

  /* Le piège gardé : c'est le geste le plus destructeur du produit. Un champ
     inattendu — « force », « skipGrace », « confirm » — doit faire échouer la
     requête, jamais passer inaperçu (spec technique §9.5). */
  it("refuse tout champ que le contrat ne connaît pas", () => {
    expect(() => confirmDeletionSchema.parse({ ...CONFIRMATION, immediate: true })).toThrow();
  });

  it("refuse un identifiant de méthode de remboursement qui n'est pas un UUID", () => {
    expect(() => confirmDeletionSchema.parse({ ...CONFIRMATION, refundPaymentMethodId: "ma-carte" })).toThrow();
  });
});

describe("ce que la confirmation rend", () => {
  const ACCEPTEE = {
    requestedAt: "2026-08-28T09:00:00.000Z",
    erasesAt: "2026-09-27T09:00:00.000Z",
    supportEmail: "hello@lehno.app",
    refundRequested: false,
  };

  it("porte l'échéance d'effacement et l'adresse de l'assistance", () => {
    expect(deletionAcceptedSchema.parse(ACCEPTEE)).toEqual(ACCEPTEE);
  });

  /* Le piège gardé : sans l'adresse à contacter, la réversibilité promise par
     §3.24 n'aurait aucun chemin. Le champ est requis pour que l'écran ne
     puisse pas l'oublier. */
  it("refuse une réponse sans adresse d'assistance", () => {
    const sansAdresse: Record<string, unknown> = { ...ACCEPTEE };
    delete sansAdresse["supportEmail"];
    expect(() => deletionAcceptedSchema.parse(sansAdresse)).toThrow();
  });
});

describe("appareils", () => {
  const APPAREIL = {
    id: "3f2504e0-4f89-11d3-9a0c-0305e82c3303",
    platform: "ios" as const,
    appVersion: "1.4.2",
    lastSeenAt: "2026-08-28T09:00:00.000Z",
    createdAt: "2026-01-04T09:00:00.000Z",
  };

  it("rend un appareil par son identifiant et sa plateforme", () => {
    expect(deviceSchema.parse(APPAREIL)).toEqual(APPAREIL);
  });

  /* Le piège gardé, et c'est le plus important de ce fichier : le jeton de
     notification est une CAPACITÉ D'ENVOI — qui l'obtient fait sonner le
     téléphone. `.strict()` fait échouer le parsage plutôt que de le laisser
     traverser jusqu'à un journal ou un rapport d'erreur. */
  it("refuse un jeton de notification glissé dans la sortie", () => {
    expect(() => deviceSchema.parse({ ...APPAREIL, pushToken: "jeton-de-notification-de-test" })).toThrow();
  });

  it("accepte un enregistrement sans version d'application", () => {
    const entree = { pushToken: "jeton-de-notification-de-test", platform: "android" as const };
    expect(registerDeviceSchema.parse(entree)).toEqual(entree);
  });

  it("refuse un jeton trop court pour être un vrai jeton", () => {
    expect(() => registerDeviceSchema.parse({ pushToken: "abc", platform: "ios" })).toThrow();
  });
});

describe("aide et avis", () => {
  it("accepte un message d'assistance sans sujet", () => {
    expect(createSupportRequestSchema.parse({ body: "l'application ne se lance plus" }).subject).toBeUndefined();
  });

  it("refuse un message d'assistance vide", () => {
    expect(() => createSupportRequestSchema.parse({ body: "   " })).toThrow();
  });

  it("accepte un avis fait d'une note seule, ou d'un texte seul", () => {
    expect(() => createFeedbackSchema.parse({ rating: 4 })).not.toThrow();
    expect(() => createFeedbackSchema.parse({ body: "très pratique" })).not.toThrow();
  });

  /* Le piège gardé : un client qui envoie un formulaire non rempli créerait
     une ligne vide par tapotement. « Rien dit » n'est pas un avis. */
  it("refuse un avis qui ne dit rien du tout", () => {
    expect(() => createFeedbackSchema.parse({})).toThrow();
    expect(() => createFeedbackSchema.parse({ appVersion: "1.4.2" })).toThrow();
  });

  it("refuse une note hors de l'échelle", () => {
    expect(() => createFeedbackSchema.parse({ rating: 0 })).toThrow();
    expect(() => createFeedbackSchema.parse({ rating: 6 })).toThrow();
  });
});

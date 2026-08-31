import { describe, expect, it } from "vitest";
import {
  submissionDecisionSchema, type Submission, type SubmittedWish,
} from "@lehno/contracts";
import {
  aTrancher, corpsDeDecision, corpsDeRejet, demandeOuRanger, pretAEnvoyer,
  toutEstTranche, type SaisieDuSas,
} from "../lib/sas.js";

const uuid = (n: number): string =>
  `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;

const souhait = (n: number): SubmittedWish => ({
  id: uuid(n), label: `souhait ${n}`, link: null, price: null, currency: null,
  reviewStatus: "pending",
});

const contribution = (p: Partial<Submission> = {}): Submission => ({
  id: uuid(1), linkType: "nominatif", personId: uuid(9), submitterName: "Ana",
  relationHint: null, birthDate: "1990-03-04", personalNote: "aime le jazz",
  status: "pending", wishes: [souhait(2), souhait(3)],
  createdAt: "2026-08-01T00:00:00.000Z", ...p,
});

const saisie = (p: Partial<SaisieDuSas> = {}): SaisieDuSas => ({
  garderLaDate: true, garderLeMot: true,
  sorts: { [uuid(2)]: "retained", [uuid(3)]: "discarded" }, fiche: null, ...p,
});

describe("ce que le sas montre", () => {
  /* Une contribution déjà tranchée n'a plus rien à y faire : l'y laisser ferait
     une file qui ne se vide jamais, et qu'on cesse d'ouvrir. */
  it("ne garde que ce qui attend", () => {
    expect(aTrancher([
      contribution({ id: uuid(1) }),
      contribution({ id: uuid(2), status: "validated" }),
      contribution({ id: uuid(3), status: "rejected" }),
    ]).map((c) => c.id)).toEqual([uuid(1)]);
  });
});

describe("où ranger la contribution", () => {
  /* Un lien PUBLIC ne vise personne : à la validation, le propriétaire dit où
     elle atterrit. Un lien NOMINATIF porte déjà sa fiche, et « l'accepter là
     laisserait détourner une contribution vers la fiche d'un autre ». */
  it("ne pose la question que sur un lien public", () => {
    expect(demandeOuRanger(contribution({ linkType: "public" }))).toBe(true);
    expect(demandeOuRanger(contribution({ linkType: "nominatif" }))).toBe(false);
  });

  it("n'envoie jamais de fiche sur un lien nominatif", () => {
    const corps = corpsDeDecision(contribution(), saisie({ fiche: uuid(42) }));
    expect(corps).not.toHaveProperty("personId");
  });

  it("porte la fiche choisie sur un lien public", () => {
    const corps = corpsDeDecision(
      contribution({ linkType: "public", personId: null }), saisie({ fiche: uuid(42) }),
    );
    expect(corps.personId).toBe(uuid(42));
  });

  /* Nulle veut dire « une fiche neuve », ce qui est un CHOIX — « le cas
     courant, quelqu'un qu'on ne connaissait pas encore ». Le champ s'omet
     alors, et le serveur compose la fiche depuis le nom du répondant. */
  it("omet la fiche quand on en veut une neuve", () => {
    const corps = corpsDeDecision(
      contribution({ linkType: "public", personId: null }), saisie({ fiche: null }),
    );
    expect(corps).not.toHaveProperty("personId");
  });
});

describe("trancher chaque souhait", () => {
  /* « `pending` est l'état d'arrivée, pas une décision : le laisser passer
     permettrait de clore une contribution en laissant un souhait non tranché »
     — il resterait en suspens sans que rien ne le rappelle. */
  it("exige un sort pour chacun", () => {
    expect(toutEstTranche([souhait(2), souhait(3)], { [uuid(2)]: "retained" })).toBe(false);
    expect(toutEstTranche([souhait(2)], { [uuid(2)]: "discarded" })).toBe(true);
  });

  it("accepte une contribution sans aucun souhait", () => {
    expect(toutEstTranche([], {})).toBe(true);
  });

  it("n'autorise l'envoi que tout tranché", () => {
    expect(pretAEnvoyer(contribution(), saisie())).toBe(true);
    expect(pretAEnvoyer(contribution(), saisie({ sorts: {} }))).toBe(false);
  });
});

describe("le corps de la décision", () => {
  it("compose un corps que le contrat accepte", () => {
    expect(submissionDecisionSchema.safeParse(corpsDeDecision(contribution(), saisie())).success)
      .toBe(true);
  });

  it("porte le sort de chaque souhait", () => {
    const corps = corpsDeDecision(contribution(), saisie());
    expect(corps.wishes).toEqual([
      { id: uuid(2), reviewStatus: "retained" },
      { id: uuid(3), reviewStatus: "discarded" },
    ]);
  });

  /* Refuser la date ET le mot est un geste légitime : le contrat l'accepte tant
     qu'un élément au moins est porté, et les souhaits en sont. */
  it("accepte qu'on refuse la date et le mot", () => {
    const corps = corpsDeDecision(
      contribution(), saisie({ garderLaDate: false, garderLeMot: false }),
    );
    expect(submissionDecisionSchema.safeParse(corps).success).toBe(true);
    expect(corps.keepBirthDate).toBe(false);
  });

  /* LE REJET GLOBAL NE RÉPARTIT RIEN : « demander le sort de chaque souhait
     reviendrait à faire trancher ce qu'on vient d'écarter ». Le contrat refuse
     un rejet accompagné d'une répartition — ce test tient qu'on ne l'y joigne
     jamais. */
  it("rejette sans rien répartir", () => {
    const corps = corpsDeRejet();
    expect(corps).toEqual({ reject: true });
    expect(submissionDecisionSchema.safeParse(corps).success).toBe(true);
  });

  it("refuserait un rejet accompagné d'une répartition", () => {
    expect(submissionDecisionSchema.safeParse({ reject: true, keepBirthDate: true }).success)
      .toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { createEventSchema, AGE_MAXIMAL_ANNEES } from "./me-events.js";
import { createPersonSchema } from "./me.js";

const PROCHE = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const jour = new Date().toISOString().slice(0, 10);
const decalerAnnees = (n: number): string => `${Number(jour.slice(0, 4)) + n}${jour.slice(4)}`;
const decalerJours = (n: number): string =>
  new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

// Les bornes de la naissance se vérifient sur le PROCHE : elles dépendent de
// deux champs, et un contrôle sur la seule date ne verrait pas le second.
const naissance = (date: string, anneeConnue = true): boolean =>
  createPersonSchema.safeParse({
    displayName: "Valery", birthDate: date, birthYearKnown: anneeConnue,
  }).success;

/* Deux dates, deux règles opposées, et c'est le fond du modèle.
 *
 * La NAISSANCE appartient au proche : elle est nécessairement passée, et
 * bornée à cent ans. L'ÉVÉNEMENT dit quand la chose sera : il est
 * nécessairement à venir. Un anniversaire n'échappe pas à la règle — sa date
 * d'ancrage est la PROCHAINE échéance, pas la naissance.
 *
 * Confondre les deux était l'ancien modèle : la naissance vivait sur
 * l'événement, et « date de référence » signifiait tantôt le passé, tantôt le
 * futur, selon le type. */
describe("la naissance appartient au proche", () => {
  it("accepte une naissance passée", () => {
    expect(naissance("1990-03-14")).toBe(true);
  });

  it("accepte aujourd'hui — un nouveau-né", () => {
    expect(naissance(jour)).toBe(true);
  });

  // On ne naît pas demain. Sans cette borne, une faute de frappe sur l'année
  // donnerait un proche à naître, et un âge négatif sur sa fiche.
  it("refuse une naissance dans le futur", () => {
    expect(naissance(decalerJours(1))).toBe(false);
  });

  // Au-delà de cent ans, c'est une faute de frappe — un 1825 pour 1925 — et
  // l'accepter ferait paraître un proche de deux siècles.
  it(`refuse une naissance de plus de ${AGE_MAXIMAL_ANNEES} ans`, () => {
    expect(naissance(decalerAnnees(-AGE_MAXIMAL_ANNEES - 1))).toBe(false);
  });

  it("accepte tout juste cent ans", () => {
    expect(naissance(decalerAnnees(-AGE_MAXIMAL_ANNEES))).toBe(true);
  });

  // Elle se saisit avec le PROCHE, pas avec un événement : c'est un fait de
  // son identité, au même titre que sa ville.
  it("se donne à la création d'un proche", () => {
    const r = createPersonSchema.safeParse({
      displayName: "Valery", birthDate: "1990-03-14", birthYearKnown: true,
    });
    expect(r.success).toBe(true);
  });

  // Le jour et le mois sans l'année : on suit l'anniversaire sans pouvoir
  // annoncer d'âge. C'est la NAISSANCE dont l'année manque — l'anniversaire,
  // lui, a toujours celle qui vient.
  it("accepte une naissance dont l'année n'est pas connue", () => {
    const r = createPersonSchema.safeParse({
      displayName: "Valery", birthDate: "1900-03-14", birthYearKnown: false,
    });
    expect(r.success).toBe(true);
  });

  it("refuse une naissance hors bornes sur un proche", () => {
    const r = createPersonSchema.safeParse({
      displayName: "Valery", birthDate: decalerJours(1),
    });
    expect(r.success).toBe(false);
  });
});

describe("un événement dit quand la chose sera", () => {
  it("accepte une date à venir", () => {
    const r = createEventSchema.safeParse({
      personId: PROCHE, kind: "other", label: "Mariage de Sarah",
      referenceDate: decalerJours(30),
    });
    expect(r.success).toBe(true);
  });

  it("accepte aujourd'hui", () => {
    const r = createEventSchema.safeParse({
      personId: PROCHE, kind: "other", label: "Soutenance", referenceDate: jour,
    });
    expect(r.success).toBe(true);
  });

  // Le créer dans le passé n'ouvrirait aucune échéance utile, et la fiche
  // annoncerait une préparation pour une date révolue.
  it("refuse une date passée", () => {
    const r = createEventSchema.safeParse({
      personId: PROCHE, kind: "other", label: "Mariage de Sarah",
      referenceDate: decalerJours(-1),
    });
    expect(r.success).toBe(false);
  });

  // LA règle du nouveau modèle : un anniversaire n'est pas une exception. Sa
  // date d'ancrage est la PROCHAINE échéance, calculée depuis la naissance du
  // proche — jamais la naissance elle-même. Y glisser une date de naissance
  // était l'ancien modèle, et c'est ce que ce cas interdit.
  it("un anniversaire ne porte pas la date de naissance", () => {
    const r = createEventSchema.safeParse({
      personId: PROCHE, kind: "birthday", referenceDate: "1990-03-14",
    });
    expect(r.success, "une date de naissance n'est pas une date d'événement").toBe(false);
  });

  it("un anniversaire porte sa prochaine échéance", () => {
    const r = createEventSchema.safeParse({
      personId: PROCHE, kind: "birthday", referenceDate: decalerJours(45),
    });
    expect(r.success).toBe(true);
  });

  // La règle du libellé demeure : elle vivait dans un .refine() qu'on a
  // déplacé, et une règle perdue au passage ne se verrait qu'au premier
  // événement libre sans nom.
  it("un événement libre porte toujours son libellé", () => {
    const r = createEventSchema.safeParse({
      personId: PROCHE, kind: "other", referenceDate: decalerJours(30),
    });
    expect(r.success).toBe(false);
  });

  // Plusieurs règles pour un même événement : « un mois puis trois mois après
  // une date » (maquette §3.6).
  it("accepte plusieurs règles de récurrence", () => {
    const r = createEventSchema.safeParse({
      personId: PROCHE, kind: "other", label: "Suivi", referenceDate: decalerJours(10),
      schedules: [
        { type: "offset", offsetUnit: "month", offsetAmount: 1, leadTimeDays: 3 },
        { type: "offset", offsetUnit: "month", offsetAmount: 3 },
      ],
    });
    expect(r.success).toBe(true);
  });
});

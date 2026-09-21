import { describe, expect, it } from "vitest";
import { createEventSchema, dateCivileSchema, AGE_MAXIMAL_ANNEES } from "./me-events.js";
import { createPersonSchema } from "./me.js";

const PROCHE = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const jour = new Date().toISOString().slice(0, 10);
const decalerAnnees = (n: number): string => `${Number(jour.slice(0, 4)) + n}${jour.slice(4)}`;
const decalerJours = (n: number): string =>
  new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

// Les bornes de la naissance se vérifient sur le PROCHE : elles dépendent de
// deux champs, et un contrôle sur la seule date ne verrait pas le second.
const naissance = (date: string, anneeConnue = true): boolean =>
  createPersonSchema.safeParse({ gender: "female",
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
    const r = createPersonSchema.safeParse({ gender: "female",
      displayName: "Valery", birthDate: "1990-03-14", birthYearKnown: true,
    });
    expect(r.success).toBe(true);
  });

  // Le jour et le mois sans l'année : on suit l'anniversaire sans pouvoir
  // annoncer d'âge. C'est la NAISSANCE dont l'année manque — l'anniversaire,
  // lui, a toujours celle qui vient.
  it("accepte une naissance dont l'année n'est pas connue", () => {
    const r = createPersonSchema.safeParse({ gender: "female",
      displayName: "Valery", birthDate: "1900-03-14", birthYearKnown: false,
    });
    expect(r.success).toBe(true);
  });

  it("refuse une naissance hors bornes sur un proche", () => {
    const r = createPersonSchema.safeParse({ gender: "female",
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

/* LE 31 FÉVRIER FRANCHISSAIT LE CONTRAT.
 *
 * `dateCivileSchema` ne vérifiait qu'une FORME — quatre chiffres, deux, deux —
 * et « 1990-02-31 » la satisfait aussi bien que « 2025-13-45 ». Deux écrans du
 * client offraient les trente-et-un jours quel que soit le mois.
 *
 * Ce qui suivait était pire qu'un refus : l'API convertit par
 * `new Date("1990-02-31T00:00:00Z")`, qui ne lève pas — il DÉBORDE sur le
 * 3 mars. La fiche gardait donc une date que personne n'avait saisie, et rien
 * nulle part ne disait qu'elle avait changé. Les mois et les jours hors
 * bornes, eux, donnaient une date invalide, donc une erreur de base de données
 * incompréhensible pour la personne.
 */
describe("une date civile existe au calendrier", () => {
  const civile = (valeur: string): boolean => dateCivileSchema.safeParse(valeur).success;

  it("refuse un 31 février", () => {
    expect(civile("1990-02-31")).toBe(false);
  });

  it("refuse un jour qui déborde de son mois", () => {
    expect(civile("2025-04-31"), "avril compte trente jours").toBe(false);
    expect(civile("2025-00-10"), "il n'y a pas de mois zéro").toBe(false);
    expect(civile("2025-13-45")).toBe(false);
    expect(civile("2025-01-00"), "aucun mois ne commence au zéro").toBe(false);
    expect(civile("2025-01-32")).toBe(false);
  });

  /* Le piège gardé : refuser le 29 février tout court. Il existe une année sur
     quatre, et quelqu'un est né ce jour-là. */
  it("accepte le 29 février d'une année bissextile", () => {
    expect(civile("2024-02-29")).toBe(true);
  });

  it("refuse le 29 février d'une année ordinaire", () => {
    expect(civile("1990-02-29")).toBe(false);
  });

  /* Le piège gardé, et c'est celui qu'une garde écrite à la main rate : la
     règle séculaire. 1900 est divisible par quatre et n'est PAS bissextile ;
     2000 l'est, parce que divisible par quatre cents. */
  it("suit la règle séculaire, pas seulement la division par quatre", () => {
    expect(civile("1900-02-29"), "1900 n'est pas bissextile").toBe(false);
    expect(civile("2000-02-29"), "2000 l'est, divisible par quatre cents").toBe(true);
  });

  it("laisse passer les dates ordinaires", () => {
    expect(civile("1990-03-14")).toBe(true);
    expect(civile("2025-12-31")).toBe(true);
    expect(civile("2025-02-28")).toBe(true);
  });

  // La garde ne remplace pas la forme : elle s'ajoute.
  it("refuse toujours ce qui n'a pas la forme d'une date civile", () => {
    expect(civile("14/03/1990")).toBe(false);
    expect(civile("1990-3-14")).toBe(false);
    expect(civile("1990-03-14T00:00:00Z")).toBe(false);
  });

  // Le chemin réel du client : la naissance d'un proche.
  it("refuse un 31 février posé sur un proche", () => {
    expect(naissance("1990-02-31")).toBe(false);
  });

  /* Le piège gardé, et il se serait vu tard : l'ANNÉE DE SUPPORT d'une
     naissance dont on ignore l'année (2000, voir mobile/lib/naissance.ts) est
     bissextile EXPRÈS. Une garde de calendrier qui la refuserait fermerait la
     saisie à tous ceux qui sont nés un 29 février. */
  it("accepte le 29 février d'une naissance dont l'année n'est pas connue", () => {
    expect(naissance("2000-02-29", false)).toBe(true);
  });

  // Et le chemin de l'événement, qui raffine la même date.
  it("refuse un 31 février posé sur un événement", () => {
    const r = createEventSchema.safeParse({
      personId: PROCHE, kind: "other", label: "Mariage de Sarah",
      referenceDate: `${Number(jour.slice(0, 4)) + 1}-02-31`,
    });
    expect(r.success).toBe(false);
  });

  /* Le piège gardé : une garde trop zélée qui refuserait une date légitime.
     Le 29 février prochain est une date d'événement parfaitement valable. */
  it("accepte un 29 février à venir sur un événement", () => {
    const annee = Number(jour.slice(0, 4));
    const bissextile = [annee, annee + 1, annee + 2, annee + 3, annee + 4]
      .find((a) => `${a}-02-29` > jour && (a % 4 === 0 && (a % 100 !== 0 || a % 400 === 0)))!;
    const r = createEventSchema.safeParse({
      personId: PROCHE, kind: "other", label: "Bal du 29",
      referenceDate: `${bissextile}-02-29`,
    });
    expect(r.success, `${bissextile}-02-29 refusé`).toBe(true);
  });
});

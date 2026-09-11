// apps/mobile/test/soi.test.ts
import { describe, expect, it } from "vitest";
import type { Person } from "@lehno/contracts";
import { ficheAChange, ficheAEnvoyer, sansSoi, soiDabord } from "../lib/soi.js";

const NAISSANCE_VIDE = { jour: null, mois: null, annee: null, anneeConnue: true };

const saisie = (p: Partial<Parameters<typeof ficheAEnvoyer>[0]> = {}) => ({
  nom: "Valentine", nomDUsage: "", genre: "female" as const,
  naissance: NAISSANCE_VIDE, ...p,
});

describe("ce qu'on envoie pour poser sa fiche", () => {
  /* LE GENRE EST EXIGÉ PAR LE CONTRAT, et il vient du compte. Sans lui, on ne
     poste pas : un refus du serveur ferait découvrir la règle après coup, sur
     un écran qui n'a rien demandé de neuf. */
  it("ne compose rien sans genre", () => {
    expect(ficheAEnvoyer(saisie({ genre: null }))).toBeNull();
  });

  it("ne compose rien sans nom", () => {
    expect(ficheAEnvoyer(saisie({ nom: "   " }))).toBeNull();
  });

  it("porte le nom et le genre", () => {
    expect(ficheAEnvoyer(saisie())).toEqual({
      displayName: "Valentine", gender: "female",
    });
  });

  /* LA LANGUE NE PART PAS. `language` dit dans quelle langue on écrit à votre
     sujet ; aucun écran ne le règle. L'envoyer recopierait `uiLanguage`
     par-dessus la fiche au premier enregistrement venu — une bascule de langue
     faite des semaines plus tôt, dans Réglages, rattraperait ainsi la fiche à
     l'occasion d'un geste qui ne la concerne pas. */
  it("n'envoie pas la langue", () => {
    expect(ficheAEnvoyer(saisie())).not.toHaveProperty("language");
  });

  /* UN NOM D'USAGE VIDE NE S'ENVOIE PAS. Le serveur ne pose que les clés
     reçues : l'omettre garde donc ce qu'il a, et ne l'efface pas. C'est assumé,
     et c'est déjà ce que fait la fiche d'un proche. */
  it("n'envoie pas un nom d'usage vide", () => {
    expect(ficheAEnvoyer(saisie({ nomDUsage: "  " })))
      .toEqual({ displayName: "Valentine", gender: "female" });
    expect(ficheAEnvoyer(saisie({ nomDUsage: "Vava" })))
      .toEqual({ displayName: "Valentine", callingName: "Vava", gender: "female" });
  });

  /* La naissance passe par `naissanceAEnvoyer`, qui décide seule de ce qui
     tient — un 29 février doit exister, et l'année peut être inconnue. */
  it("porte la naissance quand elle tient", () => {
    expect(ficheAEnvoyer(saisie({
      naissance: { jour: 15, mois: 6, annee: 1994, anneeConnue: true },
    }))).toEqual({
      displayName: "Valentine", gender: "female",
      birthDate: "1994-06-15", birthYearKnown: true,
    });
  });

  it("n'envoie pas une naissance incomplète", () => {
    expect(ficheAEnvoyer(saisie({
      naissance: { jour: 15, mois: null, annee: null, anneeConnue: true },
    }))).toEqual({ displayName: "Valentine", gender: "female" });
  });
});

const personne = (n: string, isSelf = false): Person => ({
  id: n, displayName: n, callingName: null, avatarUrl: null, isSelf,
  relation: null, gender: null, relationHint: null, birthDate: null,
  birthYearKnown: true, city: null, country: null, register: null,
  language: null, preferredChannel: null, createdAt: "2026-01-01T00:00:00.000Z",
  notesCount: 0, nextOccurrence: null,
});

/* CE QUI ALLUME LE BOUTON QUAND SEULE LA FICHE A BOUGÉ.
 *
 * `peutEnregistrer` ne voit que le compte ; la naissance et le nom d'usage
 * vivent sur la fiche. Sans `ficheAChange`, poser sa date de naissance —
 * le seul geste neuf de cet écran — laissait le bouton éteint, et il fallait
 * modifier son nom au passage pour pouvoir enregistrer. */
describe("ce qui a changé sur la fiche", () => {
  const fiche = (p: Partial<Person> = {}): Person => ({
    ...personne("moi", true), displayName: "Valentine", gender: "female", ...p,
  });

  it("voit une fiche à créer quand il n'y en a pas", () => {
    expect(ficheAChange(saisie(), null)).toBe(true);
  });

  /* Rien à composer, rien à écrire : sans genre la fiche ne part pas, et un
     bouton allumé promettrait un envoi qui n'aura pas lieu. */
  it("ne voit rien à faire quand rien ne peut partir", () => {
    expect(ficheAChange(saisie({ genre: null }), null)).toBe(false);
  });

  it("ne voit rien à faire sur une fiche identique", () => {
    expect(ficheAChange(saisie(), fiche())).toBe(false);
  });

  /* LE CAS QUI BLOQUAIT. Le profil est intact, seule la naissance vient d'être
     posée : c'est exactement ce qu'on vient faire sur cet écran. */
  it("voit une naissance qui vient d'être posée", () => {
    expect(ficheAChange(
      saisie({ naissance: { jour: 15, mois: 6, annee: 1994, anneeConnue: true } }),
      fiche(),
    )).toBe(true);
  });

  it("voit un nom d'usage qui diffère", () => {
    expect(ficheAChange(saisie({ nomDUsage: "Vava" }), fiche())).toBe(true);
    expect(ficheAChange(saisie({ nomDUsage: "Vava" }), fiche({ callingName: "Vava" })))
      .toBe(false);
  });
});

/* `/me/persons` REND LA FICHE DE SOI PARMI LES AUTRES — vérifié au serveur le
   11 septembre. Les écrans qui disent « mes proches » doivent donc l'écarter,
   faute de quoi on se retrouve dans son propre carnet : on n'est pas un proche
   de soi-même. */
describe("qui est un proche", () => {
  it("écarte la fiche de soi", () => {
    expect(sansSoi([personne("Awa"), personne("moi", true)]).map((p) => p.id))
      .toEqual(["Awa"]);
  });

  it("ne change rien quand la fiche n'existe pas", () => {
    expect(sansSoi([personne("Awa")]).map((p) => p.id)).toEqual(["Awa"]);
  });

  /* Là où l'on choisit une PERSONNE — poser une date, écrire une note — soi
     reste offert, et en tête : c'est la fiche qu'on cherche le plus souvent
     quand elle vient d'exister, et la chercher au milieu du carnet serait
     absurde. */
  it("met la fiche de soi en tête là où elle a sa place", () => {
    expect(soiDabord([personne("Awa"), personne("moi", true)]).map((p) => p.id))
      .toEqual(["moi", "Awa"]);
  });

  it("laisse l'ordre reçu quand il n'y a pas de fiche", () => {
    expect(soiDabord([personne("Awa"), personne("Bah")]).map((p) => p.id))
      .toEqual(["Awa", "Bah"]);
  });
});

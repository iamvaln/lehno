import { describe, expect, it } from "vitest";
import { LANGUES, messages, type Langue } from "../src/i18n/index.js";
import { fr } from "../src/i18n/fr.js";
import { en } from "../src/i18n/en.js";

// Une table de messages ne se relit pas à l'œil : deux cent cinquante libellés
// dans deux langues, c'est exactement le genre d'endroit où une clé se perd et
// où un point d'exclamation se glisse. Ce fichier tient les règles de
// specs/ton-et-ecriture-lehno.md que la machine peut tenir.

// `null` est une feuille comme une autre : une unité absente — « comptes par
// appareil » n'en a pas — se dit null, et pas par une chaîne vide qu'on
// finirait par afficher.
type Noeud = string | null | readonly Noeud[] | { readonly [cle: string]: Noeud };

/** Tous les chemins de feuilles, tableaux compris — `comptes.suspendre.motifs.0`. */
function chemins(noeud: Noeud, prefixe = ""): string[] {
  if (noeud === null || typeof noeud === "string") return [prefixe];
  if (Array.isArray(noeud)) {
    return noeud.flatMap((item, i) => chemins(item as Noeud, `${prefixe}.${i}`));
  }
  return Object.entries(noeud as Record<string, Noeud>).flatMap(([cle, valeur]) =>
    chemins(valeur, prefixe ? `${prefixe}.${cle}` : cle),
  );
}

/** Les feuilles, appariées à leur chemin. */
function feuilles(noeud: Noeud, prefixe = ""): [string, string][] {
  // Une feuille nulle n'a pas de texte à vérifier : c'est une absence voulue,
  // pas une phrase oubliée. Le test de parité des clés, lui, la voit bien.
  if (noeud === null) return [];
  if (typeof noeud === "string") return [[prefixe, noeud]];
  if (Array.isArray(noeud)) {
    return noeud.flatMap((item, i) => feuilles(item as Noeud, `${prefixe}.${i}`));
  }
  return Object.entries(noeud as Record<string, Noeud>).flatMap(([cle, valeur]) =>
    feuilles(valeur, prefixe ? `${prefixe}.${cle}` : cle),
  );
}

const cheminsFr = chemins(fr).sort();
const cheminsEn = chemins(en).sort();
const feuillesFr = feuilles(fr);
const feuillesEn = feuilles(en);
const toutes = [...feuillesFr, ...feuillesEn];

const TROU = /\{[a-zA-Z]+\}/g;
// Toute la famille des pictogrammes, émoji compris : §5 n'en admet aucun dans
// l'interface. Ce que l'utilisateur écrit lui-même n'est pas ici.
const PICTOGRAMME = /\p{Extended_Pictographic}/u;

// §4.1, §4.4, §4.5 : les formules que le brief nomme et écarte. Le contrôle est
// insensible à la casse — « Bravo » et « bravo » sont la même faute.
const INTERDITS = [
  "attention",
  "bravo",
  "parfait",
  "oups",
  "oops",
  "une erreur est survenue",
  "an error occurred",
  "something went wrong",
  "dernière chance",
  "last chance",
];

describe("les deux tables sont la même table", () => {
  it("les mêmes clés, à toute profondeur", () => {
    expect(cheminsEn).toEqual(cheminsFr);
  });

  it("les listes de motifs ont la même longueur des deux côtés", () => {
    expect(fr.comptes.suspendre.motifs).toHaveLength(en.comptes.suspendre.motifs.length);
    expect(fr.suppressions.dialogueEffacer.motifs).toHaveLength(
      en.suppressions.dialogueEffacer.motifs.length,
    );
  });

  it("les gabarits portent les mêmes trous dans les deux langues", () => {
    const trous = (valeur: string) => (valeur.match(TROU) ?? []).sort();
    const parChemin = new Map(feuillesEn);
    const ecarts = feuillesFr
      .map(([chemin, valeurFr]) => ({
        chemin,
        fr: trous(valeurFr),
        en: trous(parChemin.get(chemin) ?? ""),
      }))
      .filter(({ fr: a, en: b }) => a.join("|") !== b.join("|"));
    expect(ecarts).toEqual([]);
  });

  it("`messages` rend la table de chaque langue", () => {
    expect(messages("fr")).toBe(fr);
    expect(messages("en")).toBe(en);
    expect(LANGUES.every((langue: Langue) => messages(langue).langue === langue)).toBe(true);
  });
});

describe("aucune feuille n'est vide", () => {
  it("pas une seule chaîne blanche", () => {
    const vides = toutes.filter(([, valeur]) => valeur.trim().length === 0).map(([c]) => c);
    expect(vides).toEqual([]);
  });
});

describe("le ton, dans les deux langues", () => {
  // §5 et §6 : aucun point d'exclamation. En anglais c'est le premier glissement
  // vers le casual, en français c'est l'injonction que le produit refuse.
  it("aucun point d'exclamation", () => {
    const fautes = toutes.filter(([, valeur]) => valeur.includes("!")).map(([c]) => c);
    expect(fautes).toEqual([]);
  });

  it("aucun émoji", () => {
    const fautes = toutes.filter(([, valeur]) => PICTOGRAMME.test(valeur)).map(([c]) => c);
    expect(fautes).toEqual([]);
  });

  it("aucune des formules que le brief écarte", () => {
    const fautes = toutes
      .filter(([, valeur]) => INTERDITS.some((mot) => valeur.toLowerCase().includes(mot)))
      .map(([c]) => c);
    expect(fautes).toEqual([]);
  });
});

describe("l'anglais est en sentence case", () => {
  // §6 : `Mark as sent`, jamais `Mark As Sent`. Le contrôle ne regarde que les
  // mots qui commencent par une lettre — « CSV — spreadsheet » et « 6-digit
  // code » ne sont pas des fautes de casse.
  it("aucun libellé dont chaque mot porte une majuscule", () => {
    const fautes = feuillesEn
      .filter(([, valeur]) => {
        const mots = valeur.split(/\s+/).filter((mot) => /^\p{L}/u.test(mot));
        return mots.length >= 2 && mots.every((mot) => /^\p{Lu}/u.test(mot));
      })
      .map(([c]) => c);
    expect(fautes).toEqual([]);
  });
});

describe("ce que le back-office doit couvrir", () => {
  // Les familles de la spécification révisée (ux-admin §5, brief-maj-admin §1).
  // Elles rangent par ce que l'administrateur vient faire — et « Économie »
  // porte les leviers qui engagent le service, ce qui la rend fermable d'un
  // bloc au support.
  it("les quatre familles de navigation, dans l'ordre de la spécification", () => {
    expect(Object.keys(fr.familles)).toEqual([
      "exploitation", "economie", "supervision", "outils",
    ]);
    expect(fr.familles.economie).toBe("Économie");
    expect(en.familles.economie).toBe("Economy");
  });

  // Les quatorze sections numérotées, plus « Mon profil » et les quatre files
  // du « à traiter » qui ne figurent pas au menu mais restent atteignables
  // depuis le tableau de bord.
  it("les sections numérotées de la spécification ont toutes leur libellé", () => {
    for (const section of [
      "tableau", "comptes", "credits", "moderation",
      "parametres", "fonctionnalites", "modeles", "studio", "offres",
      "metriques", "audit", "connexions", "liens",
    ] as const) {
      expect(fr.sections[section], `fr.sections.${section}`).toMatch(/\S/);
      expect(en.sections[section], `en.sections.${section}`).toMatch(/\S/);
    }
  });

  it("les quatre états d'un compte, dits comme ils sont", () => {
    expect(fr.etats.suspendu).toBe("Suspendu");
    expect(en.etats.suspendu).toBe("Suspended");
    expect(fr.etats.attente).toBe("En attente");
    expect(fr.etats.grace).toBe("Délai de grâce");
  });

  it("la confirmation à motif ajoute « Autre — préciser »", () => {
    expect(fr.confirmation.autre).toBe("Autre — préciser");
    expect(fr.confirmation.confirmer).toBe("Confirmer");
    expect(fr.confirmation.annuler).toBe("Annuler");
    expect(fr.comptes.suspendre.consequence.length).toBeGreaterThan(0);
    expect(fr.comptes.suspendre.motifs.length).toBeGreaterThanOrEqual(3);
  });

  // §4.5 : une excuse a trois temps, et « on » est indispensable. Une erreur
  // sans sujet — « une erreur est survenue » — est écartée par INTERDITS ; ici,
  // on vérifie que le sujet est bien là.
  it("chaque échec dit « on », et « we » en anglais", () => {
    for (const [chemin, valeur] of feuilles(fr.echecs, "echecs")) {
      expect(valeur, chemin).toMatch(/\bOn\b/);
    }
    for (const [chemin, valeur] of feuilles(en.echecs, "echecs")) {
      expect(valeur, chemin).toMatch(/\bWe\b/);
    }
    expect(fr.connexion.echec).toMatch(/\bOn\b/);
    expect(en.connexion.echec).toMatch(/\bWe\b/);
  });

  // §4.7 : un état vide annonce ce qui est possible. Les tournures que le brief
  // nomme — « Aucun proche enregistré », « Cette liste est vide » — n'ont pas
  // leur place, et un état vide qui n'ouvre sur rien n'en est pas un.
  it("chaque état vide porte un titre et une suite", () => {
    const vides = feuillesFr.filter(([chemin]) => /(^|\.)vide\.titre$/.test(chemin));
    expect(vides.length).toBeGreaterThanOrEqual(8);
    for (const [chemin] of vides) {
      const texte = new Map(feuillesFr).get(chemin.replace(/titre$/, "texte"));
      expect(texte, chemin).toBeTruthy();
    }
    expect(fr.tableau.vide.titre).toBe("Rien à traiter");
    expect(fr.suppressions.vide.titre).toBe("Rien en attente d'effacement");
  });

  it("la barre haute, le tableau et la connexion ont leurs libellés", () => {
    for (const cle of ["recherche", "theme", "langue", "profil", "acces", "deconnexion"] as const) {
      expect(fr.barre[cle], cle).toBeTruthy();
    }
    for (const cle of ["toutSelectionner", "selectionner", "actions", "precedent", "suivant"] as const) {
      expect(fr.table[cle], cle).toBeTruthy();
    }
    expect(fr.table.vide.titre).toBeTruthy();
    expect(fr.connexion.envoyer).toBeTruthy();
    expect(fr.connexion.code).toBeTruthy();
  });

  // La pagination se parcourt au curseur : ni total, ni numéro de page.
  it("la pagination ne promet aucun total", () => {
    expect(Object.keys(fr.table)).not.toContain("resume");
    expect(Object.keys(fr.table)).not.toContain("page");
  });
});

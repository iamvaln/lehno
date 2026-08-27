import { describe, expect, it } from "vitest";
import { createPersonSchema } from "@lehno/contracts";
import {
  ANNEE_DE_SUPPORT, bornerLeJour, dateDeNaissance, joursDuMois, refuseLaNaissance,
} from "../lib/naissance.js";

describe("l'année qu'on ne connaît pas", () => {
  /* Le contrat garde une date COMPLÈTE et laisse `birthYearKnown` porter
     l'ignorance. Il faut donc une année de support — et le choix n'est pas
     indifférent. */
  it("compose une date complète malgré l'année manquante", () => {
    expect(dateDeNaissance({ jour: 24, mois: 8, annee: null }))
      .toBe(`${ANNEE_DE_SUPPORT}-08-24`);
  });

  /* ELLE DOIT ÊTRE BISSEXTILE. Une année de support ordinaire rendrait le
     29 février impossible à saisir, et personne né ce jour-là ne pourrait
     entrer sa date. C'est le genre de choix qu'on ne refait pas deux ans plus
     tard en se demandant pourquoi. */
  it("laisse le 29 février saisissable", () => {
    expect(joursDuMois(2, null)).toBe(29);
    expect(dateDeNaissance({ jour: 29, mois: 2, annee: null })).toBe(`${ANNEE_DE_SUPPORT}-02-29`);
  });

  it("écrit le mois et le jour sur deux chiffres", () => {
    expect(dateDeNaissance({ jour: 3, mois: 1, annee: 1990 })).toBe("1990-01-03");
  });
});

describe("le jour se borne, il ne disparaît pas", () => {
  /* Quelqu'un qui a posé le 31 puis choisit février doit se retrouver au 28 —
     pas devant un champ vide à remplir à nouveau, ni devant une date que le
     serveur refusera. */
  it("ramène le 31 au dernier jour du mois choisi", () => {
    expect(bornerLeJour(31, 2, 1990)).toBe(28);
    expect(bornerLeJour(31, 4, 1990)).toBe(30);
  });

  it("laisse le jour tranquille quand il tient", () => {
    expect(bornerLeJour(15, 2, 1990)).toBe(15);
    expect(bornerLeJour(31, 1, 1990)).toBe(31);
  });

  // Une année bissextile ouvre le 29, une année ordinaire le ferme.
  it("suit les années bissextiles", () => {
    expect(bornerLeJour(29, 2, 2024)).toBe(29);
    expect(bornerLeJour(29, 2, 2023)).toBe(28);
  });
});

describe("ce que le serveur refusera, dit avant l'envoi", () => {
  const AUJOURDHUI = "2026-08-28";

  it("refuse une naissance à venir", () => {
    expect(refuseLaNaissance({ jour: 1, mois: 9, annee: 2026 }, AUJOURDHUI)).toBe("futur");
    expect(refuseLaNaissance({ jour: 28, mois: 8, annee: 2026 }, AUJOURDHUI)).toBeNull();
  });

  /* Cent ans en arrière au plus. Une date plus ancienne est une faute de
     frappe — un 1825 pour 1925 — et l'accepter ferait paraître un proche de
     deux siècles sur une fiche, avec un âge que personne ne relira. */
  it("refuse au-delà de cent ans", () => {
    expect(refuseLaNaissance({ jour: 27, mois: 8, annee: 1926 }, AUJOURDHUI)).toBe("trop_ancienne");
    expect(refuseLaNaissance({ jour: 28, mois: 8, annee: 1926 }, AUJOURDHUI)).toBeNull();
  });

  /* ANNÉE INCONNUE : AUCUNE BORNE. Seuls le jour et le mois comptent, et
     l'année de support n'a pas à passer un examen qui n'a pas de sens pour
     elle. Sans cette exception, une naissance sans année serait refusée pour
     une année qu'on n'a pas saisie. */
  it("n'examine pas une année qu'on ne connaît pas", () => {
    expect(refuseLaNaissance({ jour: 1, mois: 9, annee: null }, AUJOURDHUI)).toBeNull();
    expect(refuseLaNaissance({ jour: 29, mois: 2, annee: null }, AUJOURDHUI)).toBeNull();
  });
});

describe("ce qu'on envoie passe le contrat", () => {
  /* Les corps composés sont repassés dans le schéma réel. Sans ça, le test ne
     prouverait que notre cohérence avec nous-mêmes — et c'est le serveur qui
     tranche. */
  it("une naissance connue est acceptée", () => {
    const r = createPersonSchema.safeParse({
      displayName: "Awa",
      birthDate: dateDeNaissance({ jour: 24, mois: 8, annee: 1990 }),
      birthYearKnown: true,
    });
    expect(r.success).toBe(true);
  });

  /* Une année de support passe SEULEMENT si `birthYearKnown` est faux : le
     contrat borne la naissance à cent ans, et l'an 2000 y échappe uniquement
     parce qu'on a déclaré ignorer l'année. C'est ce couplage qu'il faut tenir —
     envoyer la date sans le booléen ferait refuser tout le monde. */
  it("l'année de support n'est valide que déclarée inconnue", () => {
    const corps = {
      displayName: "Awa",
      birthDate: dateDeNaissance({ jour: 24, mois: 8, annee: null }),
    };
    expect(createPersonSchema.safeParse({ ...corps, birthYearKnown: false }).success).toBe(true);
  });

  // Le contrat refuse ce que nous refusons : les deux bornes disent la même
  // chose, et ce test rougirait si l'une des deux bougeait sans l'autre.
  it("refuse la même chose que nous", () => {
    const futur = createPersonSchema.safeParse({
      displayName: "Awa", birthDate: "2099-01-01", birthYearKnown: true,
    });
    expect(futur.success).toBe(false);
  });
});

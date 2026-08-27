import { describe, expect, it } from "vitest";
import { DELAI_DE_GRACE, doitRecharger, etatDeRepli } from "../lib/drapeaux.js";
import { estActive, SOCLE } from "@lehno/contracts";

describe("quand recharger la liste", () => {
  // Le premier appel n'a rien à comparer : il part toujours.
  it("charge au premier appel", () => {
    expect(doitRecharger(null, 1_000_000)).toBe(true);
  });

  /* Un délai de grâce, parce que le retour au premier plan est fréquent —
     on ouvre l'application, on répond à un message, on revient. Rappeler le
     serveur à chaque fois le harcèlerait sans rien apprendre de neuf. */
  it("se tait dans le délai de grâce", () => {
    const t = 1_000_000;
    expect(doitRecharger(t, t + DELAI_DE_GRACE - 1)).toBe(false);
  });

  // Passé le délai, on redemande : une fonctionnalité éteinte en
  // administration doit finir par atteindre un téléphone resté ouvert.
  it("redemande passé le délai", () => {
    const t = 1_000_000;
    expect(doitRecharger(t, t + DELAI_DE_GRACE)).toBe(true);
  });

  // L'horloge d'un téléphone peut reculer — changement de fuseau, correction
  // réseau. Un écart négatif ne doit pas figer la liste pour toujours.
  it("ne se fige pas si l'horloge recule", () => {
    expect(doitRecharger(2_000_000, 1_000_000)).toBe(true);
  });
});

describe("le repli quand l'appel échoue", () => {
  /* « Si l'appel des drapeaux échoue au démarrage, l'application s'ouvre sur le
     SOCLE plutôt que vide. » Une application qui s'ouvre sur ses proches et ses
     dates vaut mieux qu'une coquille — et mieux qu'une application qui montre
     tout, ce qui mènerait à des écrans que le serveur refuse. */
  it("laisse le socle debout", () => {
    for (const capacite of SOCLE) {
      expect(estActive(etatDeRepli(), capacite), capacite).toBe(true);
    }
  });

  it("n'allume rien d'autre", () => {
    for (const capacite of ["wall", "wishlist.own", "credits", "portrait"]) {
      expect(estActive(etatDeRepli(), capacite), capacite).toBe(false);
    }
  });
});

describe("le trou reste habitable", () => {
  /* En développement les quinze drapeaux sont ouverts ; un déploiement neuf
     les crée ÉTEINTS. C'est donc l'état vide qu'il faut éprouver, pas celui où
     tout marche — sans quoi la première mise en production serait la première
     fois qu'on voit le produit sans ses fonctionnalités. */
  it("le socle répond toujours oui, liste vide comprise", () => {
    for (const capacite of SOCLE) {
      expect(estActive([], capacite), capacite).toBe(true);
    }
  });

  // Le repli du premier démarrage EST la liste vide : tant qu'on n'a rien lu,
  // seul le socle se montre. Rien ne s'affiche sur une supposition.
  it("part de rien plutôt que de supposer", () => {
    expect(etatDeRepli()).toEqual([]);
  });

  /* Absent et inconnu se confondent, à dessein : une version installée ignore
     une clé créée après elle, et doit se comporter comme si elle était
     éteinte. C'est ce qui permet de livrer un drapeau neuf sans attendre que
     tout le parc se mette à jour. */
  it("traite une clé inconnue comme éteinte", () => {
    expect(estActive([], "events.other")).toBe(false);
    expect(estActive([], "topup.provider")).toBe(false);
    expect(estActive(["credits"], "topup.manual")).toBe(false);
  });

  /* Les deux canaux de rechargement dépendent de `credits`. Si les crédits
     s'éteignent, les deux disparaissent de la liste résolue — le serveur l'a
     déjà fait, le client n'a RIEN à en déduire. Ce test tient l'absence de
     déduction : `topup.manual` ne s'allume pas parce que `credits` est là. */
  it("ne déduit aucune dépendance", () => {
    expect(estActive(["credits"], "topup.provider")).toBe(false);
    expect(estActive(["credits", "topup.manual"], "topup.manual")).toBe(true);
  });
});

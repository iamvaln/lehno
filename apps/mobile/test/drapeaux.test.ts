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

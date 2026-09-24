import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* UNE VOIE FERMÉE SE DIT — §15B et §17 du relevé des essais.
 *
 * Deux écrans, le même défaut : quand aucun canal de paiement n'est ouvert,
 * ils se taisaient. Vu à l'appareil : « Recharger » ne montre qu'un solde nu,
 * « Payment » affiche « No method saved » avec une promesse — « un moyen
 * s'enregistrera à votre premier achat » — qui ne peut pas se tenir sans voie
 * d'achat. Les deux se lisent comme une panne.
 *
 * `react-native` est typé en Flow et un test qui monterait l'écran ne
 * compilerait pas — ces gardes lisent donc la SOURCE, comme
 * `carte-echeance.test.ts` et `marquer-envoye.test.ts`.
 */
const recharge = readFileSync(new URL("../app/recharge.tsx", import.meta.url), "utf8");
const paiement = readFileSync(
  new URL("../app/(app)/reglages/paiement.tsx", import.meta.url), "utf8",
);

describe("la recharge sans voie d'achat", () => {
  it("dit un état plutôt que de ne montrer qu'un solde nu", () => {
    expect(recharge).toContain("t.rechargeIndisponibleTitre");
    expect(recharge).toContain("t.rechargeIndisponibleTexte");
  });

  it("garde le solde visible, il reste du socle", () => {
    const bloc = recharge.slice(recharge.indexOf("t.rechargeIndisponibleTexte"));
    expect(bloc.slice(0, 400)).toContain("CreditIndicator");
  });
});

describe("les méthodes de paiement sans voie d'achat", () => {
  it("ne promet plus un premier achat qui ne peut pas aboutir", () => {
    expect(paiement).toContain(
      "proposables.length > 0 ? t.paiementAucuneTexte : t.paiementAucuneFermeeTexte",
    );
  });

  /* Le second silence : une liste déjà remplie qui ne peut plus s'agrandir.
     L'EmptyState ci-dessus ne le couvre pas — elle ne paraît que sur une liste
     vide, et c'est précisément le cas qui en sortait muet. */
  it("dit pourquoi on ne peut pas ajouter une méthode de plus", () => {
    expect(paiement).toContain("t.paiementAjoutFerme");
    expect(paiement).toContain("lu && methodes.length > 0 ?");
  });
});

/* LA FERMETURE DE COMPTE QUAND LE CODE NE VIENT PAS — §20D.
 *
 * Pas une voie fermée, mais le même manque : rien ne disait à quelle boîte le
 * code était parti, ni où écrire s'il n'arrivait vraiment pas — alors que le
 * contrat porte déjà `supportEmail` pour exactement cette raison, affiché
 * ailleurs sur l'écran (le remboursement, au temps 2) mais jamais ici.
 */
const fermeture = readFileSync(
  new URL("../app/(app)/reglages/fermeture.tsx", import.meta.url), "utf8",
);

describe("la fermeture de compte, au troisième temps", () => {
  it("dit à quelle boîte le code est parti", () => {
    expect(fermeture).toContain("t.supprCodeEnvoyeA(adresseMasquee(emailDuCompte))");
  });

  it("offre une porte vers l'assistance déjà connue du contrat", () => {
    expect(fermeture).toContain("t.supprCodeIntrouvable(apercu.supportEmail)");
  });
});

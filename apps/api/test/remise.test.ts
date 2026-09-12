import { describe, expect, it } from "vitest";
import { remiseDe } from "../src/payments/remise.js";

/**
 * La remise d'un palier était SAISIE À LA MAIN, et rien ne la rattachait aux
 * montants qu'elle résume : un palier pouvait annoncer 20 % quand son rapport
 * prix/crédits en valait cinq, sans qu'aucun test ne tombe — il n'y avait rien
 * à comparer.
 *
 * Il y a maintenant quelque chose à comparer, et ça se teste seul, sans base ni
 * serveur.
 */
describe("la remise d'un palier", () => {
  /* LE CAS DE LA SPÉCIFICATION, celui qui a fait décider le calcul : 10 crédits
     à 1700 quand l'unité en vaut 189. Le plein tarif serait 1890, on en paie
     1700, soit 190 de moins — 10,05 %. */
  it("déduit la remise des montants qu'elle résume", () => {
    expect(remiseDe(189, 1700, 10)).toBe(10);
  });

  /* Un palier au plein tarif n'a rien à annoncer, et surtout pas « −0 % » : le
     contrat dit que la ligne ne doit alors pas exister. `null` et non zéro —
     un zéro rendu comme un nombre ferait afficher une étiquette vide sur tous
     les petits paliers. */
  it("ne rend rien plutôt que zéro au plein tarif", () => {
    expect(remiseDe(100, 1000, 10)).toBeNull();
  });

  /* LA GARDE QUI COMPTE. Baisser `credit_unit_price` sans revoir les paliers
     rend certains paliers PLUS CHERS que le plein tarif — c'est exactement le
     genre de réglage qu'on fait un vendredi soir. Une « remise de −12 % »
     affichée au client serait pire que rien. */
  it("se tait quand le palier coûte plus cher que le plein tarif", () => {
    expect(remiseDe(100, 1200, 10)).toBeNull();
  });

  /* Arrondi VERS LE BAS : c'est une annonce commerciale, mieux vaut promettre
     un peu moins que ce qu'on donne. 9,6 % s'annonce 9, pas 10. */
  it("arrondit vers le bas plutôt que d'annoncer plus que ce qu'on donne", () => {
    // 10 × 100 = 1000 de plein tarif, payé 904 → 9,6 %.
    expect(remiseDe(100, 904, 10)).toBe(9);
  });

  // Sous le point de pourcentage, il n'y a pas d'offre à afficher.
  it("ne rend rien sous le point de pourcentage", () => {
    // 1000 de plein tarif, payé 995 → 0,5 %.
    expect(remiseDe(100, 995, 10)).toBeNull();
  });

  /* Les entrées viennent d'une colonne `Decimal` et d'un `system_parameter` en
     TEXTE LIBRE. Un paramètre effacé, remis à zéro ou mal saisi donnerait `NaN`
     ou une division par zéro, et le pourcentage traverserait toute la chaîne
     jusqu'à l'écran. « Pas de remise » est toujours une réponse défendable ; un
     `NaN` affiché ne l'est jamais. */
  it("rend null plutôt que NaN sur un paramètre absurde", () => {
    expect(remiseDe(Number.NaN, 1700, 10)).toBeNull();
    expect(remiseDe(0, 1700, 10)).toBeNull();
    expect(remiseDe(-100, 1700, 10)).toBeNull();
    expect(remiseDe(189, Number.NaN, 10)).toBeNull();
    expect(remiseDe(189, 1700, 0)).toBeNull();
    expect(remiseDe(189, -1, 10)).toBeNull();
  });

  /* Un palier gratuit est une remise de 100 %, pas une absence de remise. Le
     cas n'existe pas au catalogue, et c'est pour ça qu'il faut le fermer
     maintenant : le jour où quelqu'un pose un palier offert, la borne haute ne
     doit pas déborder. */
  it("borne à cent pour cent sans déborder", () => {
    expect(remiseDe(100, 0, 10)).toBe(100);
  });
});

import { describe, expect, it } from "vitest";
import { fraisDe, type Bareme } from "../src/payments/frais.js";

/**
 * Le barème décide de ce qu'un client verse et de ce qu'on attend sur le
 * compte. C'est le morceau qui changera le plus souvent, et celui dont une
 * erreur ne se voit pas : un montant attendu faux fait constater un écart qui
 * n'existe pas, ou en cache un qui existe.
 *
 * Il se teste donc seul, sans base ni serveur.
 */
const canal = (over: Partial<Bareme> = {}): Bareme => ({
  feePercent: 0, feeFixed: 0, feeMin: null, feeMax: null, feeBorneBy: "payer", ...over,
});

describe("le calcul des frais", () => {
  // « Sur le mobile money, le client paie les frais » — tranché le 25/08/2026.
  // Le montant attendu sur le compte est donc le prix du palier, et tout manque
  // constaté est un vrai écart, pas le fonctionnement de l'opérateur.
  it("payeur : un palier à 1 000 fait verser 1 020, et il en arrive 1 000", () => {
    const r = fraisDe(canal({ feePercent: 2 }), 1000);

    expect(r).toEqual({ frais: 20, aVerser: 1020, attenduSurLeCompte: 1000 });
  });

  // La carte se comporte à l'inverse : le prestataire prélève sa part sur ce
  // qu'il reverse. Coder la règle du mobile money en dur rendrait la carte
  // inexprimable, et le montant attendu serait faux sans que rien ne le
  // signale.
  it("bénéficiaire : le client est débité de 1 000, le service en reçoit 980", () => {
    const r = fraisDe(canal({ feePercent: 2, feeBorneBy: "payee" }), 1000);

    expect(r).toEqual({ frais: 20, aVerser: 1000, attenduSurLeCompte: 980 });
  });

  it("un canal sans frais ne fabrique rien", () => {
    const r = fraisDe(canal(), 1000);

    expect(r).toEqual({ frais: 0, aVerser: 1000, attenduSurLeCompte: 1000 });
  });

  // Certains opérateurs prennent les deux.
  it("part fixe et part proportionnelle se cumulent", () => {
    const r = fraisDe(canal({ feePercent: 1, feeFixed: 50 }), 1000);

    expect(r.frais).toBe(60);
  });

  it("le plancher relève des frais trop bas", () => {
    const r = fraisDe(canal({ feePercent: 1, feeMin: 100 }), 1000);

    expect(r.frais).toBe(100);
  });

  it("le plafond retient des frais trop hauts", () => {
    const r = fraisDe(canal({ feePercent: 10, feeMax: 500 }), 10_000);

    expect(r.frais).toBe(500);
  });

  it("plancher et plafond s'appliquent ensemble sans se contredire", () => {
    const bareme = canal({ feePercent: 5, feeMin: 100, feeMax: 300 });

    expect(fraisDe(bareme, 1000).frais).toBe(100);
    expect(fraisDe(bareme, 4000).frais).toBe(200);
    expect(fraisDe(bareme, 10_000).frais).toBe(300);
  });

  // Un barème incohérent — plafond sous plancher — n'arrive pas par la base,
  // qui le refuse. Il peut arriver autrement, et la fonction doit trancher
  // plutôt que rendre n'importe quoi. Le plafond gagne : c'est une limite dure,
  // et mieux vaut annoncer des frais trop bas qu'un montant que le client
  // refusera de verser.
  it("sur un barème incohérent, le plafond l'emporte sur le plancher", () => {
    const r = fraisDe(canal({ feePercent: 1, feeMin: 100, feeMax: 50 }), 1000);

    expect(r.frais).toBe(50);
  });

  // Le mobile money ne connaît pas la fraction de franc. Arrondir au centime
  // ferait annoncer un montant que le client ne peut pas composer sur son
  // téléphone, et l'écart constaté serait alors une erreur d'arrondi qu'on
  // prendrait pour un manque.
  it("les frais s'arrondissent au franc supérieur", () => {
    const r = fraisDe(canal({ feePercent: 1.5 }), 1001);

    expect(r.frais).toBe(16);
    expect(Number.isInteger(r.aVerser)).toBe(true);
  });

  // Un montant nul n'est pas un achat. On ne veut ni frais fixes prélevés sur
  // rien, ni division qui parte en vrille.
  it("un montant nul ne produit aucun frais", () => {
    const r = fraisDe(canal({ feePercent: 2, feeFixed: 50 }), 0);

    expect(r).toEqual({ frais: 0, aVerser: 0, attenduSurLeCompte: 0 });
  });

  // Le cas qui compte pour la comptabilité : ce qui est attendu ne descend
  // jamais sous zéro, même si le barème dépasse le montant.
  it("des frais qui dépassent le montant ne rendent pas l'attendu négatif", () => {
    const r = fraisDe(canal({ feeFixed: 2000, feeBorneBy: "payee" }), 1000);

    expect(r.attenduSurLeCompte).toBe(0);
  });

  it("un montant négatif est refusé plutôt que calculé", () => {
    expect(() => fraisDe(canal(), -1)).toThrow();
  });
});

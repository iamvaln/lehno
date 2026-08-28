import { describe, expect, it } from "vitest";
import {
  DELAI_METHODE_DEFAUT_JOURS, creditsRemboursables, methodeEligibleAuRemboursement,
  montantDuRemboursement, soldeTotal,
} from "../src/payments/remboursement.js";

/* Les clauses de remboursement des CGU §6, éprouvées sans base ni horloge.
 *
 * Ces règles portent une promesse PUBLIQUE. Elles méritent des cas qui
 * s'exécutent en millisecondes et se relisent à côté du texte des conditions,
 * plutôt qu'un chemin HTTP qu'on n'ouvre qu'une fois par campagne de tests.
 */

const JOUR = 24 * 60 * 60_000;
const MAINTENANT = new Date("2026-08-28T12:00:00.000Z");
const ilYA = (jours: number): Date => new Date(MAINTENANT.getTime() - jours * JOUR);

describe("l'éligibilité d'une méthode de paiement (CGU §6)", () => {
  /* Le piège gardé : renvoyer de l'argent vers un numéro qu'on n'a jamais vu
     fonctionner. Une faute de frappe dans un numéro mobile money l'envoie chez
     quelqu'un d'autre, sans retour possible. */
  it("refuse une méthode ancienne qui n'a jamais servi à payer", () => {
    expect(methodeEligibleAuRemboursement(
      { createdAt: ilYA(200), firstSuccessfulPaymentAt: null }, MAINTENANT,
    )).toBe(false);
  });

  /* Le piège gardé : enregistrer une méthode, payer un crédit avec, et
     demander aussitôt le remboursement du solde entier ailleurs. Le délai est
     ce qui l'empêche ; sans lui, le service devient un guichet de change. */
  it("refuse une méthode qui a déjà servi mais vient d'être enregistrée", () => {
    expect(methodeEligibleAuRemboursement(
      { createdAt: ilYA(1), firstSuccessfulPaymentAt: ilYA(1) }, MAINTENANT,
    )).toBe(false);
  });

  it("accepte une méthode ancienne qui a déjà servi", () => {
    expect(methodeEligibleAuRemboursement(
      { createdAt: ilYA(30), firstSuccessfulPaymentAt: ilYA(20) }, MAINTENANT,
    )).toBe(true);
  });

  /* Le piège gardé : « PLUS DE deux semaines » se lit strictement. À quatorze
     jours pile la condition n'est pas encore remplie — un `>=` serait une
     lecture généreuse d'un texte qui protège une sortie d'argent. Le cas est
     DÉTERMINISTE parce que l'instant est un paramètre : sans ça, il faudrait
     attendre deux semaines ou accepter un test qui ne mord qu'une fois sur
     deux. */
  it("tranche la limite exacte des deux semaines du bon côté", () => {
    const paye = ilYA(20);
    const pile = new Date(MAINTENANT.getTime() - DELAI_METHODE_DEFAUT_JOURS * JOUR);
    expect(methodeEligibleAuRemboursement({ createdAt: pile, firstSuccessfulPaymentAt: paye }, MAINTENANT)).toBe(false);

    const uneMillisecondeDePlus = new Date(pile.getTime() - 1);
    expect(methodeEligibleAuRemboursement({ createdAt: uneMillisecondeDePlus, firstSuccessfulPaymentAt: paye }, MAINTENANT)).toBe(true);
  });

  it("suit le délai réglé en back-office plutôt que la valeur par défaut", () => {
    const methode = { createdAt: ilYA(20), firstSuccessfulPaymentAt: ilYA(20) };
    expect(methodeEligibleAuRemboursement(methode, MAINTENANT, 30)).toBe(false);
    expect(methodeEligibleAuRemboursement(methode, MAINTENANT, 7)).toBe(true);
  });
});

describe("la part remboursable du solde (CGU §6)", () => {
  /* Le piège gardé, et c'est le principal de ce fichier : rembourser des
     crédits OFFERTS. Les CGU disent en toutes lettres qu'ils ne donnent pas
     lieu à remboursement — ils n'ont pas été payés. */
  it("ne rembourse rien sur un compte qui n'a reçu que des cadeaux", () => {
    const mouvements = [
      { source: "signup_grant", amount: 5 },
      { source: "referral_bonus", amount: 3 },
      { source: "promo_code", amount: 10 },
    ];
    expect(soldeTotal(mouvements)).toBe(18);
    expect(creditsRemboursables(mouvements)).toBe(0);
  });

  it("rembourse ce qui a été acheté par l'application", () => {
    expect(creditsRemboursables([
      { source: "signup_grant", amount: 5 },
      { source: "purchase", amount: 100 },
    ])).toBe(100);
  });

  /* Le piège gardé : exclure `manual_topup` rendrait la promesse fausse pour
     précisément les clients qu'on a servis à la main. Les CGU parlent des
     « crédits que vous avez achetés », pas du chemin qu'a pris l'argent. */
  it("rembourse aussi un virement vérifié à la main : le client a payé", () => {
    expect(creditsRemboursables([{ source: "manual_topup", amount: 40 }])).toBe(40);
  });

  /* Le piège gardé : la convention de consommation. Quelqu'un qui a reçu cinq
     crédits de bienvenue, en a acheté cent et en a dépensé cinq doit se voir
     rembourser CENT — pas quatre-vingt-quinze. Les dépenses puisent d'abord
     dans les crédits offerts. */
  it("répute les dépenses avoir consommé les crédits offerts en premier", () => {
    const mouvements = [
      { source: "signup_grant", amount: 5 },
      { source: "purchase", amount: 100 },
      { source: "consumption", amount: -5 },
    ];
    expect(soldeTotal(mouvements)).toBe(100);
    expect(creditsRemboursables(mouvements)).toBe(100);
  });

  /* Le piège gardé : un gros achat entièrement dépensé ouvrirait un droit à
     remboursement sur un solde vide si l'on ne plafonnait pas par le solde. */
  it("ne rend jamais plus de crédits que le compte n'en porte", () => {
    const mouvements = [
      { source: "purchase", amount: 100 },
      { source: "consumption", amount: -90 },
    ];
    expect(creditsRemboursables(mouvements)).toBe(10);
  });

  /* Le piège gardé : rembourser deux fois le même solde. Le mouvement
     `refund` est négatif et doit retrancher de la part achetée, pas seulement
     du solde. */
  it("ne rembourse pas deux fois ce qui l'a déjà été", () => {
    expect(creditsRemboursables([
      { source: "purchase", amount: 100 },
      { source: "refund", amount: -100 },
    ])).toBe(0);
  });

  it("ne descend jamais sous zéro", () => {
    expect(creditsRemboursables([{ source: "consumption", amount: -5 }])).toBe(0);
  });
});

describe("le montant annoncé avant confirmation (§3.24)", () => {
  it("rapporte l'argent versé aux crédits obtenus", () => {
    expect(montantDuRemboursement(50, [{ amount: 10_000, credits: 100, currency: "XAF" }]))
      .toEqual({ amount: 5000, currency: "XAF" });
  });

  /* Le piège gardé : rembourser au tarif du JOUR. Les CGU §6 promettent
     qu'« un achat déjà effectué garde ses conditions » — au tarif courant,
     celui qui a acheté pendant une promotion perdrait, et celui qui a acheté
     avant une hausse gagnerait. Le prix se retrouve dans SES achats. */
  it("moyenne les achats de la personne, promotions comprises", () => {
    // Cent crédits payés 10 000, puis cent crédits payés 5 000 en promotion :
    // le crédit lui a coûté 75 en moyenne, pas 100.
    const paiements = [
      { amount: 10_000, credits: 100, currency: "XAF" },
      { amount: 5_000, credits: 100, currency: "XAF" },
    ];
    expect(montantDuRemboursement(200, paiements)).toEqual({ amount: 15_000, currency: "XAF" });
  });

  /* Le piège gardé : annoncer « 3 400 » sans dire de quelle monnaie, ou
     convertir à un taux qu'on n'affiche pas. §3.24 prévoit ce chemin —
     l'écran l'explique et oriente vers l'assistance. */
  it("ne répond rien quand les achats couvrent plusieurs devises", () => {
    expect(montantDuRemboursement(50, [
      { amount: 10_000, credits: 100, currency: "XAF" },
      { amount: 20, credits: 100, currency: "EUR" },
    ])).toBeNull();
  });

  it("ne répond rien sans achat retrouvé, ni pour un solde acheté nul", () => {
    expect(montantDuRemboursement(50, [])).toBeNull();
    expect(montantDuRemboursement(0, [{ amount: 10_000, credits: 100, currency: "XAF" }])).toBeNull();
  });
});

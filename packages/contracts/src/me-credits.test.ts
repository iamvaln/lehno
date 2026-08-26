import { describe, expect, it } from "vitest";
import {
  creditBalanceSchema, paymentMethodSchema, registerPaymentMethodSchema,
  startPaymentSchema,
} from "./me-credits.js";

const ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

describe("les méthodes de paiement", () => {
  const MOBILE = {
    id: ID,
    kind: "mobile_money" as const,
    brand: "MTN MoMo",
    last4: "4417",
    expiresAt: null,
    lastUsedAt: "2026-08-01T10:00:00.000Z",
    refundEligible: true,
  };

  it("s'affiche par son opérateur et ses quatre derniers chiffres", () => {
    expect(paymentMethodSchema.parse(MOBILE).brand).toBe("MTN MoMo");
  });

  /* Le numéro mobile money est chiffré au repos, déchiffré pour la seule
     communication avec le prestataire, et « masqué partout à l'affichage ». Un
     contrat qui l'accepterait en lecture ouvrirait la porte à ce qu'il traverse
     — puis atterrisse dans un journal de bord ou un rapport d'erreur. */
  it("ne laisse jamais remonter le numéro complet", () => {
    expect(() => paymentMethodSchema.parse({ ...MOBILE, msisdn: "+237655554417" })).toThrow();
    expect(() => paymentMethodSchema.parse({ ...MOBILE, providerRef: "tok_123" })).toThrow();
  });

  // Un compte mobile money s'identifie par son numéro ; une carte par la
  // référence opaque que le prestataire rend. L'un n'a pas l'autre.
  it("un compte mobile money s'enregistre par son numéro", () => {
    expect(() => registerPaymentMethodSchema.parse({
      kind: "mobile_money", msisdn: "+237655554417",
    })).not.toThrow();
    expect(() => registerPaymentMethodSchema.parse({ kind: "mobile_money" })).toThrow();
  });

  it("une carte s'enregistre par sa référence, jamais par un numéro", () => {
    expect(() => registerPaymentMethodSchema.parse({ kind: "card", providerRef: "tok_123" })).not.toThrow();
    expect(() => registerPaymentMethodSchema.parse({
      kind: "card", providerRef: "tok_123", msisdn: "+237655554417",
    })).toThrow();
  });
});

describe("le lancement d'un achat", () => {
  // « Soit l'identifiant d'une méthode enregistrée, soit les éléments d'une
  // nouvelle à enregistrer au passage — le cas du premier achat. Sans
  // indication, le serveur retient la méthode utilisée le plus récemment. »
  it("accepte une méthode connue, une méthode neuve, ou rien", () => {
    expect(() => startPaymentSchema.parse({ credits: 10 })).not.toThrow();
    expect(() => startPaymentSchema.parse({ credits: 10, paymentMethodId: ID })).not.toThrow();
    expect(() => startPaymentSchema.parse({
      credits: 10, newPaymentMethod: { kind: "mobile_money", msisdn: "+237655554417" },
    })).not.toThrow();
  });

  // Les deux à la fois ne veulent rien dire : le serveur devrait deviner
  // laquelle débiter, et il débiterait peut-être la mauvaise.
  it("refuse une méthode connue et une méthode neuve ensemble", () => {
    expect(() => startPaymentSchema.parse({
      credits: 10, paymentMethodId: ID,
      newPaymentMethod: { kind: "mobile_money", msisdn: "+237655554417" },
    })).toThrow();
  });

  it("refuse un achat de zéro crédit", () => {
    expect(() => startPaymentSchema.parse({ credits: 0 })).toThrow();
  });
});

describe("le solde", () => {
  /* Chaque mouvement porte sa source. Le schéma est strict : sans ce champ, la
     réponse du serveur ferait échouer le parsage — et l'écran des crédits
     resterait vide sans dire pourquoi. */
  it("exige la source de chaque mouvement", () => {
    expect(() => creditBalanceSchema.parse({
      balance: 5,
      transactions: [{ id: ID, type: "grant", amount: 5, reason: null, createdAt: "2026-08-26T00:00:00.000Z" }],
    })).toThrow();
  });

  // « Solde = somme des mouvements. Aucune colonne de solde stockée. » Le
  // rendre calculé côté serveur est une chose ; ce qui compte ici est que le
  // client ne le recalcule pas, sous peine de deux vérités qui divergent.
  it("se lit tel que le serveur le calcule", () => {
    const solde = creditBalanceSchema.parse({
      balance: 4,
      transactions: [
        { id: ID, type: "grant", amount: 5, source: "signup_grant", reason: "inscription", createdAt: "2026-08-01T10:00:00.000Z" },
        { id: "3f2504e0-4f89-11d3-9a0c-0305e82c3302", type: "consumption", amount: -1, source: "consumption", reason: null, createdAt: "2026-08-02T10:00:00.000Z" },
      ],
    });
    expect(solde.balance).toBe(4);
  });

  // Un mouvement est signé : + au crédit, − au débit. Un débit noté positif
  // gonflerait le solde au lieu de le réduire.
  it("accepte un mouvement négatif", () => {
    const solde = creditBalanceSchema.parse({
      balance: 0,
      transactions: [{ id: ID, type: "consumption", amount: -1, source: "consumption", reason: null, createdAt: "2026-08-02T10:00:00.000Z" }],
    });
    expect(solde.transactions[0]!.amount).toBe(-1);
  });

  // Un solde négatif signifierait qu'une action payante s'est lancée sans
  // provision : c'est un défaut du serveur, pas un état à afficher.
  it("refuse un solde négatif", () => {
    expect(() => creditBalanceSchema.parse({ balance: -1, transactions: [] })).toThrow();
  });
});

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
    brand: null,
    operator: "MTN",
    last4: "4417",
    expiresAt: null,
    lastUsedAt: "2026-08-01T10:00:00.000Z",
    refundEligible: true,
  };

  /* L'OPÉRATEUR SE LIT SUR `operator`, plus sur `brand`. Depuis que le canal le
     porte, `brand` est refusé à l'enregistrement d'un mobile money et reste
     donc nul : un écran qui l'afficherait ne montrerait que quatre chiffres
     sans dire de qui — et c'est ce qu'on relit pour reconnaître son numéro.

     C'est aussi la clef par laquelle le serveur reconnaît « le numéro de cette
     personne chez cet opérateur » : elle n'en a qu'UN, et enregistrer chez le
     même opérateur REMPLACE. Sans elle servie, le client montrerait « Ajouter »
     là où le geste efface. */
  it("s'affiche par son opérateur et ses quatre derniers chiffres", () => {
    const lu = paymentMethodSchema.parse(MOBILE);
    expect(lu.operator).toBe("MTN");
    expect(lu.last4).toBe("4417");
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
  /* Le numéro ET le canal : l'opérateur ne se tape pas, il se choisit. Sans le
     canal, « MTN » et « MTN MoMo » feraient deux méthodes pour un opérateur, et
     la règle « un seul numéro par opérateur » ne verrait rien. */
  it("un compte mobile money s'enregistre par son numéro et son canal", () => {
    const CANAL = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
    expect(() => registerPaymentMethodSchema.parse({
      kind: "mobile_money", msisdn: "+237655554417", channelId: CANAL,
    })).not.toThrow();
    expect(() => registerPaymentMethodSchema.parse({ kind: "mobile_money" })).toThrow();
    // Sans canal, l'opérateur serait inconnu — donc la règle inapplicable.
    expect(() => registerPaymentMethodSchema.parse({
      kind: "mobile_money", msisdn: "+237655554417",
    })).toThrow();
    // Et l'opérateur ne se saisit pas à côté : il vient du canal, une seule fois.
    expect(() => registerPaymentMethodSchema.parse({
      kind: "mobile_money", msisdn: "+237655554417", channelId: CANAL, brand: "MTN MoMo",
    })).toThrow();
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
      credits: 10, newPaymentMethod: { kind: "mobile_money", msisdn: "+237655554417", channelId: ID },
    })).not.toThrow();
  });

  // Les deux à la fois ne veulent rien dire : le serveur devrait deviner
  // laquelle débiter, et il débiterait peut-être la mauvaise.
  it("refuse une méthode connue et une méthode neuve ensemble", () => {
    expect(() => startPaymentSchema.parse({
      credits: 10, paymentMethodId: ID,
      newPaymentMethod: { kind: "mobile_money", msisdn: "+237655554417", channelId: ID },
    })).toThrow();
  });

  it("refuse un achat de zéro crédit", () => {
    expect(() => startPaymentSchema.parse({ credits: 0 })).toThrow();
  });
});

describe("le solde", () => {
  // « Solde = somme des mouvements. Aucune colonne de solde stockée. » Le
  // rendre calculé côté serveur est une chose ; ce qui compte ici est que le
  // client ne le recalcule pas, sous peine de deux vérités qui divergent.
  it("se lit tel que le serveur le calcule", () => {
    const solde = creditBalanceSchema.parse({
      balance: 4,
      transactions: [
        { id: ID, type: "grant", reason: "signup", amount: 5, createdAt: "2026-08-01T10:00:00.000Z" },
        { id: "3f2504e0-4f89-11d3-9a0c-0305e82c3302", type: "consumption", reason: "usage", amount: -1, createdAt: "2026-08-02T10:00:00.000Z" },
      ],
    });
    expect(solde.balance).toBe(4);
  });

  // Un mouvement est signé : + au crédit, − au débit. Un débit noté positif
  // gonflerait le solde au lieu de le réduire.
  it("accepte un mouvement négatif", () => {
    const solde = creditBalanceSchema.parse({
      balance: 0,
      transactions: [{ id: ID, type: "consumption", reason: "usage", amount: -1, createdAt: "2026-08-02T10:00:00.000Z" }],
    });
    expect(solde.transactions[0]!.amount).toBe(-1);
  });

  // Un solde négatif signifierait qu'une action payante s'est lancée sans
  // provision : c'est un défaut du serveur, pas un état à afficher.
  it("refuse un solde négatif", () => {
    expect(() => creditBalanceSchema.parse({ balance: -1, transactions: [] })).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { confirmDeletionSchema, type DeletionPreview } from "@lehno/contracts";
import {
  cequiPart, codeComplet, corpsDeFermeture, etatDuRemboursement, impactVide,
  MOTIFS_OFFERTS, motifsSansLibelle, peutFermer, pseudoRecevable,
  type SaisieDeFermeture,
} from "../lib/fermeture.js";

const LANCEMENT = ["collect", "referral", "topup.manual", "generation.message"];

const apercu = (refundable: number, methodes: number): DeletionPreview => ({
  impact: { persons: 4, notes: 47, events: 6, wishes: 0, generatedMessages: 3 },
  refund: {
    balance: refundable + 3,
    refundable,
    currency: refundable > 0 ? "XAF" : null,
    amount: refundable > 0 ? refundable * 100 : null,
    // Le délai des CGU §6, rendu par le serveur : l'écran annonce l'échéance
    // d'une méthode trop récente au lieu d'un refus sans date.
    refundMethodMinAgeDays: 14,
    eligibleMethods: Array.from({ length: methodes }, (_, i) => ({
      id: `${String(i + 1).padStart(8, "0")}-0000-4000-8000-000000000000`,
      kind: "mobile_money" as const,
      brand: "MTN",
      last4: null,
      expiresAt: null,
      lastUsedAt: null,
      refundEligible: true,
    })),
  },
  gracePeriodDays: 30,
  supportEmail: "bonjour@lehno.cm",
});

const saisie = (p: Partial<SaisieDeFermeture> = {}): SaisieDeFermeture => ({
  pseudo: "valentine", code: "123456", motif: null, precision: "", methode: null, ...p,
});

describe("ce qui part", () => {
  /* Le socle est toujours là ; le reste suit son drapeau. Annoncer la
     disparition des wishlists à quelqu'un qui n'en a jamais eu alourdit un
     écran déjà lourd, et fait douter du reste de la liste. */
  it("au lancement, le socle et les liens de collecte", () => {
    expect(cequiPart(LANCEMENT)).toEqual(["socle", "liens"]);
  });

  it("n'annonce que le socle quand tout est éteint", () => {
    expect(cequiPart([])).toEqual(["socle"]);
  });

  it("ajoute le Mur et les wishlists quand ils sont ouverts", () => {
    expect(cequiPart(["wall", "wishlist.own"])).toEqual(["socle", "wishlists", "mur"]);
  });

  /* Compter « 0 proche, 0 note » ne fait pas peser le geste, ça le rend
     absurde — l'écran passe alors à ce qui compte, le solde et les preuves. */
  it("reconnaît un compte qui n'a rien à perdre", () => {
    expect(impactVide({ persons: 0, notes: 0, events: 0, wishes: 0, generatedMessages: 0 }))
      .toBe(true);
    expect(impactVide({ persons: 0, notes: 1, events: 0, wishes: 0, generatedMessages: 0 }))
      .toBe(false);
  });
});

describe("ce que le solde peut devenir", () => {
  /* SEULS LES CRÉDITS ACHETÉS SE REMBOURSENT. `balance` porte aussi les
     offerts — bienvenue, parrainage, promo — que les CGU §6 ne rendent pas.
     Lire `balance` ici promettrait le solde entier, sur de l'argent. */
  it("ne regarde que la part achetée", () => {
    // Trois crédits offerts au solde, rien d'acheté : rien à rendre.
    expect(etatDuRemboursement(apercu(0, 1))).toBe("rien");
  });

  it("propose le remboursement quand une méthode convient", () => {
    expect(etatDuRemboursement(apercu(5, 1))).toBe("possible");
  });

  /* Pas une erreur, mais l'état que §3.24 décrit : « l'écran l'explique et
     oriente vers l'assistance ». Le client ne refait AUCUN calcul
     d'éligibilité — le délai est réglable en back-office. */
  it("nomme le cas « à rendre, mais aucune méthode »", () => {
    expect(etatDuRemboursement(apercu(5, 0))).toBe("sans_methode");
  });
});

describe("les deux preuves", () => {
  it("exige les six chiffres", () => {
    expect(codeComplet("123456")).toBe(true);
    expect(codeComplet("12345")).toBe(false);
    expect(codeComplet("12345a")).toBe(false);
    expect(codeComplet("")).toBe(false);
  });

  /* Le pseudo se compare EXACTEMENT : c'est une confirmation, pas une
     identification — le serveur sait déjà qui appelle. Accepter une casse
     différente affaiblirait l'arrêt qu'on cherche à provoquer. */
  it("compare le pseudo au caractère près", () => {
    expect(peutFermer("valentine", "valentine", "123456")).toBe(true);
    expect(peutFermer("Valentine", "valentine", "123456")).toBe(false);
    expect(peutFermer("valentin", "valentine", "123456")).toBe(false);
  });

  // Les espaces autour ne sont pas une faute de frappe qu'on punit.
  it("tolère les espaces autour", () => {
    expect(peutFermer("  valentine  ", "valentine", " 123456 ")).toBe(true);
  });

  /* L'UN SANS L'AUTRE NE VAUT RIEN. Le pseudo seul est affiché à l'écran d'à
     côté ; le code seul ne dit pas qu'on a compris ce qu'on efface. */
  it("refuse une seule des deux preuves", () => {
    expect(peutFermer("valentine", "valentine", "12345")).toBe(false);
    expect(peutFermer("", "valentine", "123456")).toBe(false);
  });

  it("dit qu'un pseudo est irrecevable avant même de le comparer", () => {
    expect(pseudoRecevable("va")).toBe(false);
    expect(pseudoRecevable("valentine")).toBe(true);
  });
});

describe("le corps de la confirmation", () => {
  it("compose un corps que le contrat accepte", () => {
    expect(confirmDeletionSchema.safeParse(corpsDeFermeture(saisie())).success).toBe(true);
  });

  /* LES FACULTATIFS SONT OMIS, jamais envoyés vides : le schéma est `strict()`
     et refuse une chaîne vide là où il attend au moins un caractère. Un motif
     non choisi n'est pas « autre » — c'est une question sans réponse, et le
     silence se transmet en se taisant. */
  it("omet ce qu'on n'a pas rempli", () => {
    const corps = corpsDeFermeture(saisie());
    expect(corps).not.toHaveProperty("reason");
    expect(corps).not.toHaveProperty("reasonDetails");
    expect(corps).not.toHaveProperty("refundPaymentMethodId");
  });

  it("omet une précision qui n'est que des espaces", () => {
    expect(corpsDeFermeture(saisie({ precision: "   " }))).not.toHaveProperty("reasonDetails");
  });

  /* Le champ libre accompagne N'IMPORTE QUEL motif, pas seulement « autre » :
     « quelqu'un qui coche *trop cher* a parfois une phrase à ajouter, et la lui
     refuser reviendrait à ne pas vouloir l'entendre ». */
  it("porte la précision même sur un motif nommé", () => {
    const corps = corpsDeFermeture(saisie({ motif: "too_expensive", precision: "vraiment" }));
    expect(corps.reason).toBe("too_expensive");
    expect(corps.reasonDetails).toBe("vraiment");
  });
});

describe("les motifs de départ", () => {
  /* LE CONTRAT EN PORTE SEPT, LA COPIE EN LIBELLE QUATRE — et l'un des quatre,
     « Ça ne m'a pas servi », ne correspond proprement à aucun : il tient à la
     fois de `no_longer_useful`, `too_complicated` et `missing_feature`. Le
     ranger de force enverrait une raison FAUSSE dans une donnée qui sert à
     décider du produit, et personne ne le verrait jamais. */
  it("n'offre que les correspondances sûres", () => {
    expect(MOTIFS_OFFERTS.map((m) => m.motif))
      .toEqual(["no_longer_useful", "too_expensive", "temporary_break"]);
  });

  /* Ce que personne ne sait dire, rendu visible plutôt que perdu dans un
     commentaire. Ce test changera quand la copie rattrapera le contrat — et
     c'est exactement le moment où on veut le relire. */
  it("nomme ce qui attend un libellé", () => {
    expect(motifsSansLibelle())
      .toEqual(["privacy_concern", "too_complicated", "missing_feature", "other"]);
  });

  // Chaque motif offert doit pointer sur un libellé qui existe.
  it("pointe dans la liste des libellés, sans trou", () => {
    for (const { indice } of MOTIFS_OFFERTS) {
      expect(indice).toBeGreaterThanOrEqual(0);
      expect(indice).toBeLessThan(4);
    }
  });
});

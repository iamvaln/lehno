import { describe, expect, it } from "vitest";
import { paymentChannelSchema, paymentMethodSchema } from "@lehno/contracts";
import {
  consequenceDuRetrait, corpsDEnregistrement, enregistrementComplet, estExpiree,
  methodeParDefaut, operateursProposables,
} from "../lib/paiement.js";

/* On repasse par les schémas plutôt que d'écrire des objets à la main : un
   agencement inventé ici tiendrait pendant que le vrai tomberait. */
const methode = (p: Record<string, unknown>) => paymentMethodSchema.parse({
  id: "11111111-1111-4111-8111-111111111111",
  kind: "mobile_money", brand: "MTN MoMo", last4: "4417",
  expiresAt: null, lastUsedAt: null, refundEligible: false, ...p,
});
const canal = (p: Record<string, unknown>) => paymentChannelSchema.parse({
  id: "22222222-2222-4222-8222-222222222222",
  kind: "mobile_money", operator: "MTN", country: "CM", label: "MTN MoMo CM",
  feeBorneBy: "payer", currency: "XAF", ...p,
});

const ID = (n: number) => `1111111${n}-1111-4111-8111-111111111111`;

describe("les opérateurs qu'on propose", () => {
  /* La liste vient des CANAUX, donc de ce que la plateforme sait débiter. Une
     constante écrite ici vieillirait en silence : un opérateur ajouté en
     back-office n'apparaîtrait jamais, un opérateur retiré resterait proposé. */
  it("prend les opérateurs des canaux servis", () => {
    expect(operateursProposables([
      canal({ operator: "MTN" }),
      canal({ operator: "Orange" }),
    ])).toEqual(["MTN", "Orange"]);
  });

  /* Deux canaux du même opérateur — c'est le cas dès qu'un automatique et un
     manuel coexistent — ne font qu'UNE entrée : le choix porte sur qui, pas sur
     par où. Deux « MTN » identiques feraient hésiter sur une différence qui
     n'existe pas à l'affichage. */
  it("ne propose pas deux fois le même opérateur", () => {
    expect(operateursProposables([
      canal({ operator: "MTN", label: "MTN auto" }),
      canal({ operator: " mtn ", label: "MTN manuel" }),
    ])).toEqual(["MTN"]);
  });

  /* Un canal de carte n'ouvre PAS un opérateur mobile money : le proposer
     ferait enregistrer un compte mobile money chez un réseau qui n'en a pas. */
  it("écarte les canaux d'une autre sorte", () => {
    expect(operateursProposables([canal({ kind: "card", operator: "Visa" })])).toEqual([]);
  });
});

describe("la méthode par défaut", () => {
  /* Le défaut est une CONSÉQUENCE de l'usage — « la plus récente » —, pas un
     réglage. La maquette pose un interrupteur « En faire ma méthode par
     défaut » que le contrat n'a pas ; l'envoyer ferait échouer
     l'enregistrement, `registerPaymentMethodSchema` étant strict. */
  it("est la plus récemment employée", () => {
    expect(methodeParDefaut([
      methode({ id: ID(1), lastUsedAt: "2026-01-02T10:00:00.000Z" }),
      methode({ id: ID(2), lastUsedAt: "2026-03-04T10:00:00.000Z" }),
    ])).toBe(ID(2));
  });

  /* Aucune n'a servi : AUCUN repère. Coiffer la première inventerait un défaut
     que l'achat ne suivrait pas — le serveur n'aurait rien à retenir non plus. */
  it("n'en désigne aucune quand rien n'a servi", () => {
    expect(methodeParDefaut([methode({}), methode({ id: ID(2) })])).toBeNull();
    expect(methodeParDefaut([])).toBeNull();
  });
});

describe("l'expiration", () => {
  /* Une carte vaut jusqu'à la FIN de son mois. Comparer au jour près la
     barrerait pendant les semaines où elle fonctionne encore, et quelqu'un la
     retirerait pour rien. */
  it("laisse valide le mois de l'échéance", () => {
    const carte = methode({ kind: "card", expiresAt: "2026-08-31", last4: "4242" });
    expect(estExpiree(carte, "2026-08-01")).toBe(false);
    expect(estExpiree(carte, "2026-09-01")).toBe(true);
  });

  /* Nul ne veut pas dire « inconnu », il veut dire « sans objet » : un compte
     mobile money n'expire pas. Le barrer le rendrait irrécupérable à l'œil. */
  it("ne barre jamais un compte mobile money", () => {
    expect(estExpiree(methode({ expiresAt: null }), "2099-01-01")).toBe(false);
  });
});

describe("ce que le retrait coûte", () => {
  /* LA RAISON D'ÊTRE DE L'AVERTISSEMENT. La ligne est supprimée, pas
     désactivée : réenregistrer le même numéro repart d'une ancienneté nulle, le
     délai recommence, et il faut en plus qu'un paiement passe. */
  it("nomme le cas où plus rien ne peut recevoir un remboursement", () => {
    const liste = [
      methode({ id: ID(1), refundEligible: true }),
      methode({ id: ID(2), refundEligible: false }),
    ];
    expect(consequenceDuRetrait(liste, ID(1))).toBe("la-derniere");
  });

  it("distingue le cas où d'autres tiennent encore la promesse", () => {
    const liste = [
      methode({ id: ID(1), refundEligible: true }),
      methode({ id: ID(2), refundEligible: true }),
    ];
    expect(consequenceDuRetrait(liste, ID(1))).toBe("il-en-reste");
  });

  /* On ne perd pas ce qu'on n'avait pas : avertir ici apprendrait à passer
     outre l'avertissement, et il ne serait plus lu le jour où il compte. */
  it("se tait quand la méthode n'était pas remboursable", () => {
    expect(consequenceDuRetrait([methode({ id: ID(1) })], ID(1))).toBe("rien");
  });

  /* On lit `refundEligible`, jamais l'ancienneté — « le délai est réglable en
     back-office, et deux versions du parc appliqueraient deux règles ». Une
     méthode jamais employée mais déclarée éligible par le serveur reste
     éligible ici. */
  it("suit le verdict du serveur, sans le recalculer", () => {
    const liste = [methode({ id: ID(1), lastUsedAt: null, refundEligible: true })];
    expect(consequenceDuRetrait(liste, ID(1))).toBe("la-derniere");
  });
});

describe("enregistrer un compte mobile money", () => {
  it("compose un corps que le contrat accepte", () => {
    expect(corpsDEnregistrement(" 655554417 ", " MTN MoMo ")).toEqual({
      kind: "mobile_money", msisdn: "655554417", brand: "MTN MoMo",
    });
  });

  /* Une marque vide ferait une marque nommée « rien » plutôt qu'une marque
     absente — et la liste montrerait quatre chiffres sans dire de qui. */
  it("ne joint pas une marque vide", () => {
    expect(corpsDEnregistrement("655554417", "  ")).toEqual({
      kind: "mobile_money", msisdn: "655554417",
    });
  });

  /* JAMAIS de `providerRef` sur un mobile money : le schéma le refuse
     nommément, et le joindre ferait échouer l'enregistrement. */
  it("n'invente pas de référence prestataire", () => {
    expect(corpsDEnregistrement("655554417", "MTN")).not.toHaveProperty("providerRef");
  });

  /* La borne vient du contrat — six caractères. Plus strict refuserait un
     numéro que le serveur aurait accepté, sans que personne puisse le savoir. */
  it("exige le numéro et l'opérateur", () => {
    expect(enregistrementComplet("65555", "MTN")).toBe(false);
    expect(enregistrementComplet("655554417", null)).toBe(false);
    expect(enregistrementComplet("655554417", "   ")).toBe(false);
    expect(enregistrementComplet("655554417", "MTN")).toBe(true);
  });
});

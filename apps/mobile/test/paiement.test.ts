import { describe, expect, it } from "vitest";
import { paymentChannelSchema, paymentMethodSchema } from "@lehno/contracts";
import {
  canauxProposables, consequenceDuRetrait, corpsDEnregistrement,
  enregistrementComplet, estExpiree, methodeParDefaut, methodeRemplacee,
} from "../lib/paiement.js";

/* On repasse par les schémas plutôt que d'écrire des objets à la main : un
   agencement inventé ici tiendrait pendant que le vrai tomberait. */
const methode = (p: Record<string, unknown>) => paymentMethodSchema.parse({
  id: "11111111-1111-4111-8111-111111111111",
  kind: "mobile_money", brand: null, operator: "MTN", last4: "4417",
  expiresAt: null, lastUsedAt: null, refundEligible: false, ...p,
});
const canal = (p: Record<string, unknown>) => paymentChannelSchema.parse({
  id: "22222222-2222-4222-8222-222222222222",
  kind: "mobile_money", operator: "MTN", country: "CM", label: "MTN MoMo CM",
  feeBorneBy: "payer", currency: "XAF", ...p,
});

const ID = (n: number) => `1111111${n}-1111-4111-8111-111111111111`;

const ID_CANAL = (n: number) => `2222222${n}-2222-4222-8222-222222222222`;

describe("les canaux qu'on propose", () => {
  /* Un canal de carte n'ouvre PAS un compte mobile money : le proposer ferait
     enregistrer un numéro chez un réseau qui n'en a pas — et le schéma le
     refuse, « une carte ne passe pas par un canal d'opérateur ». */
  it("écarte les canaux d'une autre sorte", () => {
    expect(canauxProposables([canal({ kind: "card", operator: "Visa" })])).toEqual([]);
  });

  /* DEUX CANAUX DU MÊME OPÉRATEUR RESTENT DEUX. Ils ne portent pas le même
     barème, `label` les distingue, et en fondre un dans l'autre choisirait à la
     place de quelqu'un ce qu'il paiera en plus. C'est la correction du contrat
     qui l'impose : on désigne un canal, plus un nom d'opérateur. */
  it("garde les deux canaux d'un même opérateur", () => {
    const deux = [
      canal({ id: ID_CANAL(1), operator: "MTN", label: "MTN auto" }),
      canal({ id: ID_CANAL(2), operator: "MTN", label: "MTN manuel" }),
    ];
    expect(canauxProposables(deux).map((c) => c.label)).toEqual(["MTN auto", "MTN manuel"]);
  });
});

describe("ce que l'enregistrement va faire", () => {
  /* « Un seul numéro par opérateur, et changer de numéro est le geste ordinaire
     — pas ajouter. » Le serveur supprime l'ancienne ligne : le bouton ne peut
     pas dire « Ajouter », il effacerait un numéro sans le dire. */
  it("nomme le numéro que le geste va remplacer", () => {
    const existante = methode({ id: ID(1), operator: "MTN", last4: "4417" });
    expect(methodeRemplacee([existante], canal({ operator: " mtn " }))?.last4).toBe("4417");
  });

  it("ne remplace rien chez un opérateur où l'on n'a pas de numéro", () => {
    const existante = methode({ id: ID(1), operator: "MTN" });
    expect(methodeRemplacee([existante], canal({ operator: "Orange" }))).toBeNull();
  });

  /* On lit `operator`, JAMAIS `brand` : celui-ci est nul sur un mobile money
     depuis que le canal porte l'opérateur, et s'en servir ferait annoncer
     « rien à remplacer » à chaque fois — c'est-à-dire effacer en silence. */
  it("ne se fie pas à la marque, qui est nulle ici", () => {
    const sansMarque = methode({ id: ID(1), brand: null, operator: "MTN" });
    expect(methodeRemplacee([sansMarque], canal({ operator: "MTN" }))).not.toBeNull();
  });
});

describe("la méthode par défaut", () => {
  /* Le défaut est une CONSÉQUENCE de l'usage — « la plus récente » —, pas un
     réglage. La maquette pose un interrupteur « En faire ma méthode par
     défaut » que le contrat n'a pas ; l'envoyer ferait échouer
     l'enregistrement, `registerPaymentMethodSchema` étant strict.

     ET IL NE DOIT PAS Y EN AVOIR : deux façons de décider du défaut — l'usage
     et un choix explicite — finiraient par se contredire, et personne ne
     saurait laquelle l'achat va suivre. */
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
  it("désigne le canal, et ne compose rien d'autre", () => {
    expect(corpsDEnregistrement(" 655554417 ", ID_CANAL(1))).toEqual({
      kind: "mobile_money", msisdn: "655554417", channelId: ID_CANAL(1),
    });
  });

  /* NI marque NI référence prestataire : le schéma les refuse tous les deux
     nommément — « l'opérateur vient du canal, il ne se saisit pas ». Les
     joindre ferait échouer l'enregistrement, pas dériver l'affichage. */
  it("ne joint ni marque ni référence prestataire", () => {
    const corps = corpsDEnregistrement("655554417", ID_CANAL(1));
    expect(corps).not.toHaveProperty("brand");
    expect(corps).not.toHaveProperty("providerRef");
  });

  /* La borne vient du contrat — six caractères. Plus strict refuserait un
     numéro que le serveur aurait accepté, sans que personne puisse le savoir. */
  it("exige le numéro et le canal", () => {
    expect(enregistrementComplet("65555", ID_CANAL(1))).toBe(false);
    expect(enregistrementComplet("655554417", null)).toBe(false);
    expect(enregistrementComplet("655554417", ID_CANAL(1))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import {
  paymentPreviewInputSchema,
  type CreditBundle, type PaymentChannel, type PaymentDetail, type PaymentPreview,
} from "@lehno/contracts";
import {
  apercuDemandable, corpsDApercu, etapeDeLaRecharge, iconeDuMoyen, montantEnClair,
  natureDeLAttente, paiementASuivre, paiementDuLien, paliersOrdonnes,
  palierParDefaut, recapDuPaiement, reductionDuPalier, rienNAEtePreleve, suivreEncore,
  SUIVI_ESSAIS_MAX,
} from "../lib/recharge.js";

const uuid = (n: number): string =>
  `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;

const palier = (
  n: number, credits: number, montant: number, position: number, bonus: number | null,
): CreditBundle => ({
  id: uuid(n), amount: montant, currency: "XAF", credits, bonusPercent: bonus, position,
});

const paiement = (n: number, forme: Partial<PaymentDetail> = {}): PaymentDetail => ({
  id: uuid(n),
  status: "pending",
  mode: "semi_manual",
  amount: 1000,
  currency: "XAF",
  credits: 12,
  fee: 20,
  expectedOnAccount: 1000,
  failureReason: null,
  collectionAccount: null,
  createdAt: "2026-09-01T10:00:00.000Z",
  ...forme,
});

const apercu = (forme: Partial<PaymentPreview> = {}): PaymentPreview => ({
  amount: 1000, fee: 20, amountToSend: 1020, expectedOnAccount: 1000,
  currency: "XAF", credits: 12, bonusPercent: 20, ...forme,
});

const canal = (kind: PaymentChannel["kind"]): PaymentChannel => ({
  id: uuid(300), kind, operator: "MTN", country: "CM", label: "MTN Cameroun",
  feeBorneBy: "payer", currency: "XAF",
});

describe("où l'on en est du parcours", () => {
  it("sans rien, on choisit", () => {
    expect(etapeDeLaRecharge(null, null)).toBe("choix");
  });

  it("un aperçu demandé pose le récapitulatif", () => {
    expect(etapeDeLaRecharge(null, apercu())).toBe("recap");
  });

  it("un paiement en attente prime sur l'aperçu qui l'a précédé", () => {
    expect(etapeDeLaRecharge(paiement(1), apercu())).toBe("attente");
  });

  it("abouti, échoué, expiré", () => {
    expect(etapeDeLaRecharge(paiement(1, { status: "succeeded" }), null)).toBe("abouti");
    expect(etapeDeLaRecharge(paiement(1, { status: "failed" }), null)).toBe("echec");
    expect(etapeDeLaRecharge(paiement(1, { status: "expired" }), null)).toBe("echec");
  });

  /* UN PAIEMENT REMBOURSÉ NE TIENT DANS AUCUNE DES DEUX ISSUES : il a abouti
     puis été défait. « Crédits ajoutés » annoncerait des crédits repartis,
     « Rien n'a été prélevé » nierait un prélèvement qui a eu lieu. */
  it("un remboursement ne s'annonce ni comme une réussite ni comme un échec", () => {
    expect(etapeDeLaRecharge(paiement(1, { status: "refunded" }), null)).toBe("choix");
  });
});

describe("les paliers", () => {
  it("suivent la position réglée en administration, pas l'ordre d'arrivée", () => {
    const desordre = [palier(2, 30, 2200, 3, 27), palier(1, 5, 500, 1, null), palier(3, 12, 1000, 2, 20)];
    expect(paliersOrdonnes(desordre).map((p) => p.credits)).toEqual([5, 12, 30]);
  });

  it("ne trient pas la liste reçue sur place", () => {
    const donnee = [palier(2, 30, 2200, 3, 27), palier(1, 5, 500, 1, null)];
    paliersOrdonnes(donnee);
    expect(donnee[0]!.credits).toBe(30);
  });

  /* La maquette désigne celui du milieu — le premier qui porte une remise sur
     sa grille. « Le deuxième » désignerait n'importe quoi le jour où
     l'administration en pose cinq. */
  it("présentent d'avance le premier qui porte une remise", () => {
    // À 100 le crédit : 500 pour 5 = plein tarif ; 1000 pour 12 = 17 % de moins.
    const grille = [palier(1, 5, 500, 1, null), palier(2, 12, 1000, 2, 20), palier(3, 30, 2200, 3, 37)];
    expect(palierParDefaut(grille, 100)).toBe(uuid(2));
  });

  it("à défaut de remise, le premier", () => {
    const grille = [palier(3, 30, 3000, 3, null), palier(1, 5, 500, 1, null)];
    expect(palierParDefaut(grille, 100)).toBe(uuid(1));
  });

  /* LE CALCUL GOUVERNE, PAS LA DÉCLARATION. Le premier palier ANNONCE 20 %
     et se vend au plein tarif ; le second n'annonce rien et coûte 17 % de
     moins. Présélectionner celui qui se déclare en remise mettrait en avant
     le palier qui n'en offre aucune — et l'écran, lui, afficherait la remise
     sur l'autre. */
  it("suivent le calcul, pas le pourcentage déclaré", () => {
    const grille = [palier(1, 5, 500, 1, 20), palier(2, 12, 1000, 2, null)];
    expect(palierParDefaut(grille, 100)).toBe(uuid(2));
  });

  /* Sans prix unitaire, aucune remise n'est calculable : on ne présélectionne
     pas au hasard, on prend le premier. */
  it("à prix unitaire inconnu, le premier", () => {
    const grille = [palier(1, 5, 500, 1, null), palier(2, 12, 1000, 2, 20)];
    expect(palierParDefaut(grille, 0)).toBe(uuid(1));
  });

  it("aucun palier n'invente aucun montant", () => {
    expect(palierParDefaut([], 100)).toBeNull();
  });
});

describe("le récapitulatif", () => {
  /* LE CAS QUI JUSTIFIE TOUT LE RESTE. Sur la carte, c'est le bénéficiaire qui
     supporte les frais : le client tape le prix du palier, et il en arrive
     moins. `montant + frais` afficherait 1020 là où l'opérateur demande 1000. */
  it("prend le total servi, jamais montant + frais", () => {
    const paye = recapDuPaiement(apercu({ amount: 1000, fee: 20, amountToSend: 1000, expectedOnAccount: 980 }), 100);
    expect(paye.total).toBe(1000);
    expect(paye.total).not.toBe(paye.montant + (paye.frais ?? 0));
  });

  it("porte le total du barème où le client supporte les frais", () => {
    expect(recapDuPaiement(apercu(), 100).total).toBe(1020);
  });

  it("tait des frais nuls plutôt que d'afficher zéro", () => {
    expect(recapDuPaiement(apercu({ fee: 0 }), 100).frais).toBeNull();
  });

  /* LA REMISE NE VIENT PLUS DE `bonusPercent`, et ce test le prouve : l'aperçu
     l'annonce à 40 %, mais 12 crédits à 100 l'un font 1200 de plein tarif pour
     1000 payés, soit 17 %. C'est le calcul qui gagne, jamais la déclaration —
     sans quoi le récapitulatif contredirait la liste des paliers dont il vient,
     juste avant de payer. */
  it("déduit la remise des montants, sans écouter bonusPercent", () => {
    const paye = recapDuPaiement(apercu({ amount: 1000, credits: 12, bonusPercent: 40 }), 100);
    expect(paye.bonus).toBe(17);
  });

  it("tait une remise absente plutôt que d'écrire zéro", () => {
    // 5 crédits à 100 payés 500 : le plein tarif, donc rien à annoncer.
    expect(recapDuPaiement(apercu({ amount: 500, credits: 5 }), 100).bonus).toBeNull();
  });

  it("rend les crédits et la devise servis", () => {
    const paye = recapDuPaiement(apercu({ credits: 30, currency: "EUR" }), 100);
    expect(paye.credits).toBe(30);
    expect(paye.devise).toBe("EUR");
  });
});

describe("un montant se lit", () => {
  it("sans décimale quand il n'y en a pas", () => {
    expect(montantEnClair(2200, "XAF")).toBe("2200 XAF");
  });

  /* Un barème à part fixe rend 1020,5 : l'arrondir ferait taper le mauvais
     montant chez l'opérateur. */
  it("avec ses décimales quand il y en a", () => {
    expect(montantEnClair(1020.5, "XAF")).toBe("1020.50 XAF");
  });

  it("sert la devise du contrat, jamais un symbole deviné", () => {
    expect(montantEnClair(9, "EUR")).toBe("9 EUR");
  });
});

describe("ce qu'on demande à l'aperçu", () => {
  it("ne part qu'avec un palier et un moyen", () => {
    expect(apercuDemandable(null, uuid(1))).toBe(false);
    expect(apercuDemandable(uuid(1), null)).toBe(false);
    expect(apercuDemandable(uuid(1), uuid(2))).toBe(true);
  });

  it("valide le corps plutôt que de laisser le serveur rendre un 400", () => {
    expect(corpsDApercu(uuid(1), uuid(2))).toEqual(
      paymentPreviewInputSchema.parse({ bundleId: uuid(1), channelId: uuid(2) }),
    );
    expect(() => corpsDApercu("pas-un-identifiant", uuid(2))).toThrow();
  });
});

describe("ce que l'attente raconte", () => {
  /* Le MODE du paiement, jamais le drapeau du jour : un drapeau bascule en
     back-office pendant qu'un versement dort en attente, et l'écran annoncerait
     alors une notification qui ne viendra jamais. */
  it("une demande poussée s'attend sur le téléphone", () => {
    expect(natureDeLAttente("provider")).toBe("poussee");
  });

  it("un versement déclaré attend un humain", () => {
    expect(natureDeLAttente("semi_manual")).toBe("verification");
    expect(natureDeLAttente("manual")).toBe("verification");
  });
});

describe("« rien n'a été prélevé »", () => {
  it("se dit d'une demande poussée qui a échoué", () => {
    expect(rienNAEtePreleve(paiement(1, { mode: "provider", status: "failed" }))).toBe(true);
  });

  /* L'ARGENT EST PARTI AVANT LA DÉCLARATION. Un refus dit que l'administration
     n'a pas retrouvé la transaction, pas qu'on a gardé son argent : le
     prétendre apprendrait à ne pas réclamer. */
  it("ne se dit jamais d'un versement déclaré", () => {
    expect(rienNAEtePreleve(paiement(1, { mode: "semi_manual", status: "failed" }))).toBe(false);
    expect(rienNAEtePreleve(paiement(1, { mode: "manual", status: "failed" }))).toBe(false);
  });
});

describe("le suivi s'arrête", () => {
  it("suit tant que le paiement est en attente", () => {
    expect(suivreEncore("pending", 0)).toBe(true);
  });

  it("s'arrête dès que l'issue est connue", () => {
    expect(suivreEncore("succeeded", 0)).toBe(false);
    expect(suivreEncore("failed", 0)).toBe(false);
    expect(suivreEncore("expired", 0)).toBe(false);
  });

  /* Une vérification humaine se compte en heures ; interroger le serveur sans
     fin viderait la batterie sur un écran qui vient de dire qu'on peut le
     fermer. */
  it("s'arrête au bout de la fenêtre annoncée par la copie", () => {
    expect(suivreEncore("pending", SUIVI_ESSAIS_MAX - 1)).toBe(true);
    expect(suivreEncore("pending", SUIVI_ESSAIS_MAX)).toBe(false);
  });
});

describe("ce qu'on reprend en rouvrant l'écran", () => {
  it("le versement déclaré et non constaté, pour ne pas le redéclarer", () => {
    const liste = [paiement(1, { status: "succeeded" }), paiement(2)];
    expect(paiementASuivre(liste)?.id).toBe(uuid(2));
  });

  it("le plus récent quand il y en a plusieurs", () => {
    const liste = [
      paiement(1, { createdAt: "2026-08-01T10:00:00.000Z" }),
      paiement(2, { createdAt: "2026-09-01T10:00:00.000Z" }),
    ];
    expect(paiementASuivre(liste)?.id).toBe(uuid(2));
  });

  /* « Crédits ajoutés » accueillerait la personne à chaque ouverture, pour un
     achat d'il y a trois semaines — et l'écran ne servirait plus à recharger. */
  it("ni une réussite ni un échec déjà lus", () => {
    expect(paiementASuivre([paiement(1, { status: "succeeded" })])).toBeNull();
    expect(paiementASuivre([paiement(1, { status: "failed" })])).toBeNull();
  });

  it("rien du tout quand il n'y a rien", () => {
    expect(paiementASuivre([])).toBeNull();
  });
});

describe("un identifiant posé par un lien profond", () => {
  const liste = [paiement(1, { status: "succeeded" })];

  it("ouvre le paiement quand c'est bien l'un des siens", () => {
    expect(paiementDuLien(uuid(1), liste)?.id).toBe(uuid(1));
  });

  /* On ne le porte PAS jusqu'à `/me/payments/{id}` : le serveur refuserait par
     un 404 que l'écran afficherait comme une panne, en rouge, sur un compte
     parfaitement sain. */
  it("est ignoré quand il n'appartient pas à la liste servie", () => {
    expect(paiementDuLien(uuid(99), liste)).toBeNull();
  });

  it("est ignoré quand ce n'est même pas une chaîne", () => {
    expect(paiementDuLien([uuid(1)], liste)).toBeNull();
    expect(paiementDuLien(undefined, liste)).toBeNull();
    expect(paiementDuLien({ id: uuid(1) }, liste)).toBeNull();
    expect(paiementDuLien("", liste)).toBeNull();
  });
});

describe("l'icône du moyen", () => {
  it("suit la nature du canal", () => {
    expect(iconeDuMoyen(canal("mobile_money"))).toBe("smartphone");
    expect(iconeDuMoyen(canal("card"))).toBe("credit-card");
  });
});

/* LA RÉDUCTION SE DÉDUIT DES MONTANTS SERVIS — c'est le point de toute cette
   série. `bonusPercent` existe au contrat et en base (`bonus_percent`, un
   entier saisi à la main) sans que RIEN ne le rattache aux chiffres qu'il
   résume : un palier peut annoncer 20 % quand son rapport prix/crédits en vaut
   cinq, et aucun test ne tombe. Un nombre déduit ne peut pas se désaccorder de
   ses opérandes.

   Les deux moitiés sont déjà servies : `creditUnitPrice` par `/public/config`,
   réglé en administration, et `amount`/`credits` par `/me/credit-bundles`. */
describe("la réduction d'un palier", () => {
  it("se déduit du plein tarif", () => {
    // 12 crédits à 100 l'un = 1200 ; payés 1000, soit 200 de moins.
    expect(reductionDuPalier({ amount: 1000, credits: 12 }, 100)).toBe(17);
    expect(reductionDuPalier({ amount: 2200, credits: 30 }, 100)).toBe(27);
  });

  /* Ce sont les chiffres de la maquette, qui les portait EN DUR — 17 et 27.
     Le calcul les retrouve, ce qui prouve que la planche était cohérente ; il
     les retrouvera aussi le jour où l'administration changera les prix, ce que
     la maquette, elle, ne pouvait pas. */
  it("suit le prix unitaire quand l'administration le change", () => {
    expect(reductionDuPalier({ amount: 1000, credits: 12 }, 200)).toBe(58);
  });

  it("se tait au plein tarif plutôt que d'écrire zéro", () => {
    expect(reductionDuPalier({ amount: 500, credits: 5 }, 100)).toBeNull();
  });

  /* L'administration peut poser un palier PLUS CHER que le plein tarif. On se
     tait : « −(−8) % » ne se lit pas, et l'écran n'a pas à nommer une
     majoration qu'aucune copie ne prévoit. */
  it("se tait sur un palier plus cher que le plein tarif", () => {
    expect(reductionDuPalier({ amount: 540, credits: 5 }, 100)).toBeNull();
  });

  it("se tait sans prix unitaire, plutôt que de comparer à un tarif imaginaire", () => {
    expect(reductionDuPalier({ amount: 1000, credits: 12 }, 0)).toBeNull();
  });

  // Une économie réelle mais minuscule s'arrondit à zéro : on ne l'annonce pas.
  it("se tait quand l'arrondi ramène à zéro", () => {
    expect(reductionDuPalier({ amount: 1198, credits: 12 }, 100)).toBeNull();
  });
});

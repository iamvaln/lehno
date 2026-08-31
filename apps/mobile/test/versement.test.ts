import { describe, expect, it } from "vitest";
import {
  declarePaymentSchema,
  type CollectionAccount, type CreditTransaction, type PaymentChannel,
} from "@lehno/contracts";
import {
  canalPourLeCompte, comptePourVerser, corpsDeDeclaration, declarationComplete,
  moisDesMouvements, montreLeMouvement, mouvementsRecents, offreTout,
  parcoursDeRecharge,
} from "../lib/versement.js";

const uuid = (n: number): string =>
  `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`;

const LANCEMENT = ["collect", "referral", "topup.manual", "generation.message"];

const compte = (n: number, operator: string): CollectionAccount => ({
  id: uuid(n), label: "Ana Kay", operator, number: "+237 6 91 00 00 00",
});

const canal = (n: number, operator: string): PaymentChannel => ({
  id: uuid(100 + n), kind: "mobile_money", operator, country: "CM",
  label: operator + " Cameroun", feeBorneBy: "payer", currency: "XAF",
});

const mouvement = (n: number, montant: number, quand: string): CreditTransaction => ({
  id: uuid(200 + n), type: montant > 0 ? "grant" : "consumption",
  amount: montant, reason: montant > 0 ? "signup" : "usage", createdAt: quand,
});

describe("quel parcours l'écran propose", () => {
  it("au lancement, le versement manuel", () => {
    expect(parcoursDeRecharge(LANCEMENT)).toBe("manuel");
  });

  it("l'automatique prime quand il est ouvert", () => {
    expect(parcoursDeRecharge(["topup.provider", "topup.manual"])).toBe("operateur");
  });

  it("aucun des deux ferme la recharge", () => {
    expect(parcoursDeRecharge([])).toBe("aucun");
  });

  /* LA MAQUETTE LIT `credits`, ET CE DRAPEAU N'EXISTE PAS : le registre
     l'interdit nommément — « les actions payantes consomment du crédit,
     toujours ». Le lire rendrait toujours faux, et le mode « générations
     gratuites » qu'elle dessine ne serait atteignable par personne. */
  it("ne se laisse pas fermer par un drapeau imaginaire", () => {
    expect(parcoursDeRecharge(["topup.manual"])).toBe("manuel");
  });
});

describe("sur quel compte verser", () => {
  /* Le serveur ordonne par `position` : le premier est celui que
     l'administration met en avant. Proposer une liste ferait porter un
     arbitrage qui ne regarde pas l'utilisateur. */
  it("prend celui que le serveur met en tête", () => {
    expect(comptePourVerser([compte(1, "MTN"), compte(2, "Orange")])?.operator).toBe("MTN");
  });

  /* Aucun compte n'est pas une erreur d'affichage, c'est l'impossibilité de
     verser : l'écran doit se taire plutôt que montrer un formulaire vers
     nulle part. */
  it("rend nul quand aucun compte n'est servi", () => {
    expect(comptePourVerser([])).toBeNull();
  });
});

describe("le canal qui porte le barème", () => {
  /* `declarePaymentSchema` exige un `channelId` — le barème des frais en
     dépend — et la maquette ne pose jamais la question. On rattache donc par
     l'opérateur, seul lien commun. */
  it("se déduit de l'opérateur du compte", () => {
    const trouve = canalPourLeCompte([canal(1, "MTN"), canal(2, "Orange")], compte(1, "MTN"));
    expect(trouve?.operator).toBe("MTN");
  });

  it("ignore la casse et les espaces", () => {
    expect(canalPourLeCompte([canal(1, " mtn ")], compte(1, "MTN"))).not.toBeNull();
  });

  /* DEUX CANAUX DU MÊME OPÉRATEUR rendent la déduction ambiguë — et c'est
     exactement ce qui arrive quand ils se dédoublent en automatique et manuel.
     Mieux vaut ne pas offrir la déclaration que l'envoyer sur un barème pris
     au hasard : c'est lui qui décide de ce que la personne verse en plus. */
  it("se tait plutôt que de choisir entre deux barèmes", () => {
    expect(canalPourLeCompte([canal(1, "MTN"), canal(2, "MTN")], compte(1, "MTN"))).toBeNull();
  });

  it("se tait quand aucun canal ne correspond", () => {
    expect(canalPourLeCompte([canal(1, "Orange")], compte(1, "MTN"))).toBeNull();
  });
});

describe("ce qui autorise la déclaration", () => {
  /* LES BORNES VIENNENT DU CONTRAT, pas de la maquette. Elle demande plus de
     cinq caractères pour les deux ; le contrat en veut six pour le numéro et
     QUATRE pour la référence. Être plus strict que le serveur refuserait une
     référence qu'il aurait acceptée, sans que personne sache pourquoi. */
  it("suit les bornes du contrat, pas celles du dessin", () => {
    expect(declarationComplete("612345", "A472")).toBe(true);
    expect(declarationComplete("61234", "A472")).toBe(false);
    expect(declarationComplete("612345", "A47")).toBe(false);
  });

  it("ne compte pas les espaces autour", () => {
    expect(declarationComplete("  612345  ", "  A472  ")).toBe(true);
    expect(declarationComplete("   ", "A472")).toBe(false);
  });

  it("compose un corps que le contrat accepte", () => {
    const corps = corpsDeDeclaration({
      palier: uuid(1), canal: uuid(2), compte: uuid(3),
      depuis: " +237 6 91 00 00 00 ", reference: " MP240829.1432.A47219 ",
    });
    expect(declarePaymentSchema.safeParse(corps).success).toBe(true);
    expect(corps.providerRef).toBe("MP240829.1432.A47219");
  });
});

describe("l'aperçu des mouvements", () => {
  const cinq = [
    mouvement(1, 5, "2026-01-01T00:00:00.000Z"),
    mouvement(2, -1, "2026-02-01T00:00:00.000Z"),
    mouvement(3, 12, "2026-03-01T00:00:00.000Z"),
    mouvement(4, -2, "2026-04-01T00:00:00.000Z"),
    mouvement(5, 3, "2026-05-01T00:00:00.000Z"),
  ];

  // Trois, parce que c'est ce qu'on vient vérifier après un versement.
  it("montre les trois plus récents", () => {
    expect(mouvementsRecents(cinq).map((m) => m.amount)).toEqual([3, -2, 12]);
  });

  it("ne modifie pas la liste reçue", () => {
    mouvementsRecents(cinq);
    expect(cinq[0]?.amount).toBe(5);
  });

  /* Un lien qui mène à la même liste apprend à ne pas le suivre. */
  it("n'offre « Tout voir » que s'il y a plus à voir", () => {
    expect(offreTout(cinq)).toBe(true);
    expect(offreTout(cinq.slice(0, 3))).toBe(false);
    expect(offreTout([])).toBe(false);
  });
});

describe("la mise en forme d'un mouvement", () => {
  /* LE SIGNE PORTE LE SENS, pas la couleur seule : « + 12 » et « − 2 » se
     lisent en noir et blanc, et quelqu'un qui ne distingue pas le vert lit la
     même chose que les autres. */
  it("porte le signe dans le texte", () => {
    expect(montreLeMouvement(12)).toBe("+ 12");
    expect(montreLeMouvement(-2)).toBe("− 2");
  });

  // Le montant est déjà signé au contrat : on le met en forme, on ne le
  // recalcule pas — un débit noté positif gonflerait le solde.
  it("emploie le vrai signe moins, pas un trait d'union", () => {
    expect(montreLeMouvement(-2)).toContain("−");
    expect(montreLeMouvement(-2)).not.toContain("-");
  });
});

describe("le regroupement par mois", () => {
  const suite = [
    mouvement(1, 3, "2026-05-20T00:00:00.000Z"),
    mouvement(2, -1, "2026-05-02T00:00:00.000Z"),
    mouvement(3, 12, "2026-04-28T00:00:00.000Z"),
  ];

  it("coupe aux changements de mois", () => {
    expect(moisDesMouvements(suite).map((g) => [g.mois, g.items.length]))
      .toEqual([["2026-05", 2], ["2026-04", 1]]);
  });

  /* La liste arrive déjà rangée du plus récent au plus ancien. Un second tri
     ici ferait deux vérités sur ce qu'est « récent » — et celle qui reste en
     arrière finirait par contredire l'écran d'à côté. */
  it("suit l'ordre reçu, sans retrier", () => {
    const desordre = [suite[2]!, suite[0]!, suite[1]!];
    expect(moisDesMouvements(desordre).map((g) => g.mois))
      .toEqual(["2026-04", "2026-05"]);
  });

  it("ne rend aucun groupe sur une liste vide", () => {
    expect(moisDesMouvements([])).toEqual([]);
  });
});

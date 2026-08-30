import { describe, expect, it } from "vitest";
import {
  adminRoleSchema, motifSchema, pageDeSchema, dashboardSchema,
  compteLigneSchema, compteDetailSchema, parametresSchema,
  demandeSuppressionSchema, interventionSchema, profilAdminSchema,
  metriquesSchema, cohorteSchema, conversionSchema, actionPayanteSchema,
  statsTransactionsSchema, aboutissementSchema,
} from "./admin.js";
import { z } from "zod";

describe("les rôles", () => {
  it("n'admet que support et admin", () => {
    expect(adminRoleSchema.safeParse("support").success).toBe(true);
    expect(adminRoleSchema.safeParse("admin").success).toBe(true);
    expect(adminRoleSchema.safeParse("superadmin").success).toBe(false);
  });
});

// « Sans motif, l'appel échoue côté serveur : c'est ce qui garantit que le
// journal d'audit dit quelque chose. » (spec technique §7)
describe("le motif obligatoire", () => {
  it("refuse un motif vide ou fait d'espaces", () => {
    expect(motifSchema.safeParse("").success).toBe(false);
    expect(motifSchema.safeParse("   ").success).toBe(false);
  });

  it("refuse un motif trop court pour dire quoi que ce soit", () => {
    expect(motifSchema.safeParse("ok").success).toBe(false);
  });

  it("accepte un motif qui informe", () => {
    expect(motifSchema.safeParse("Demande du titulaire par courriel").success).toBe(true);
  });
});

// « Les listes se parcourent par curseur. La réponse rend les éléments et le
// curseur suivant, vide lorsqu'on a tout lu. » (spec technique §3)
describe("la pagination par curseur", () => {
  const page = pageDeSchema(z.object({ id: z.string() }));

  it("rend les éléments et le curseur suivant", () => {
    expect(page.safeParse({ items: [{ id: "a" }], nextCursor: "abc" }).success).toBe(true);
  });

  it("admet un curseur nul — on a tout lu", () => {
    expect(page.safeParse({ items: [], nextCursor: null }).success).toBe(true);
  });

  it("n'a pas de total : une API à curseur n'en connaît pas", () => {
    const avecTotal = page.safeParse({ items: [], nextCursor: null, total: 42 });
    expect(avecTotal.success).toBe(false);
  });
});

describe("le tableau de bord", () => {
  it("ne rend jamais plus de trois alertes", () => {
    const quatre = {
      alertes: Array.from({ length: 4 }, (_, i) => ({
        id: `a${i}`, cause: "echec_modele", libelle: "x", ton: "danger", section: "alertes",
      })),
      indicateurs: [], aTraiter: [],
    };
    expect(dashboardSchema.safeParse(quatre).success).toBe(false);
  });
});

describe("le cloisonnement en administration", () => {
  it("le détail d'un compte n'expose ni fiches ni notes", () => {
    const champs = Object.keys(compteDetailSchema.shape);
    for (const interdit of ["fiches", "notes", "souhaits", "proches"])
      expect(champs).not.toContain(interdit);
  });

  it("il n'en donne que les volumétries", () => {
    expect(Object.keys(compteDetailSchema.shape)).toContain("volumetrie");
  });
});

describe("les autres formes", () => {
  it("une ligne de compte, une demande de suppression, une intervention, un profil, des paramètres", () => {
    for (const schema of [compteLigneSchema, demandeSuppressionSchema, interventionSchema, profilAdminSchema, parametresSchema])
      expect(typeof schema.safeParse).toBe("function");
  });
});

// ——— Métriques (ux-admin §5.11) ———————————————————————————————————

/** Une réponse complète et cohérente, dont chaque test ne change qu'un champ. */
const metriques = {
  periode: "30j",
  retention: {
    cohortes: [{ mois: "2026-07", inscrits: 100, actifsA7j: 40, actifsA30j: 25 }],
  },
  conversion: {
    comptes: 100, acheteurs: 12, delaiMedianJours: 3.5,
    parPalier: [{ credits: 1000, achats: 7 }],
  },
  consommation: { credits: 4200, mouvements: 310 },
  actions: [{ code: "message", lancements: 40, reussies: 36, echouees: 3, enAttente: 1 }],
  manques: ["usage_par_fonctionnalite"],
};

describe("les métriques", () => {
  it("accepte une réponse complète", () => {
    expect(metriquesSchema.safeParse(metriques).success).toBe(true);
  });

  it("n'admet que les périodes proposées par l'écran", () => {
    expect(metriquesSchema.safeParse({ ...metriques, periode: "1j" }).success).toBe(false);
  });

  // Une cohorte dont plus de gens reviennent qu'il n'en est entré n'est pas un
  // chiffre surprenant, c'est une requête fausse. Le contrat le refuse pour que
  // l'erreur tombe à la frontière, et non trois écrans plus loin sous forme
  // d'une barre qui dépasse son cadre.
  it("refuse une cohorte où les revenants dépassent les entrants", () => {
    const impossible = { mois: "2026-07", inscrits: 10, actifsA7j: 11, actifsA30j: 2 };
    expect(cohorteSchema.safeParse(impossible).success).toBe(false);
  });

  it("refuse aussi le dépassement à trente jours", () => {
    const impossible = { mois: "2026-07", inscrits: 10, actifsA7j: 4, actifsA30j: 11 };
    expect(cohorteSchema.safeParse(impossible).success).toBe(false);
  });

  it("refuse plus d'acheteurs que de comptes", () => {
    const impossible = { ...metriques.conversion, comptes: 10, acheteurs: 11 };
    expect(conversionSchema.safeParse(impossible).success).toBe(false);
  });

  // Personne n'a encore acheté, et « 0 jour » dirait que tout le monde achète
  // le jour même. Les deux valeurs existent et ne disent pas la même chose.
  it("distingue « aucun acheteur » de « le jour même »", () => {
    const aucun = { ...metriques.conversion, acheteurs: 0, delaiMedianJours: null, parPalier: [] };
    const leJourMeme = { ...metriques.conversion, delaiMedianJours: 0 };
    expect(conversionSchema.safeParse(aucun).success).toBe(true);
    expect(conversionSchema.safeParse(leJourMeme).success).toBe(true);
  });

  // Les manques sont une liste fermée. Un identifiant libre laisserait le
  // serveur annoncer un trou que l'écran ne sait pas nommer, et la page
  // rendrait un rang vide sans que rien ne le signale.
  it("n'admet pas un manque que l'écran ne sait pas nommer", () => {
    expect(metriquesSchema.safeParse({ ...metriques, manques: ["autre_chose"] }).success).toBe(false);
  });

  it("admet qu'il n'en reste aucun — le jour où tout se mesure", () => {
    expect(metriquesSchema.safeParse({ ...metriques, manques: [] }).success).toBe(true);
  });

  it("refuse un champ de trop", () => {
    expect(metriquesSchema.safeParse({ ...metriques, total: 3 }).success).toBe(false);
  });
});

describe("les paliers d'une conversion", () => {
  it("se désignent par leur nombre de crédits, pas par une phrase", () => {
    const enMots = { ...metriques.conversion, parPalier: [{ palier: "1 000 crédits", achats: 7 }] };
    expect(conversionSchema.safeParse(enMots).success).toBe(false);
  });
});

/* ——— Les exécutions des actions payantes ——————————————————————
 *
 * §5.11 demande « les exécutions des actions payantes et LEUR ISSUE ». La
 * section le déclarait non mesurable ; `ActionRun` existe désormais, avec son
 * statut et son code d'échec. */
describe("les actions payantes", () => {
  const action = { code: "message", lancements: 40, reussies: 36, echouees: 3, enAttente: 1 };

  it("accepte une ligne complète", () => {
    expect(actionPayanteSchema.safeParse(action).success).toBe(true);
  });

  /* Les trois issues doivent redonner le total. Un lancement qui n'est ni
     réussi, ni échoué, ni en attente n'existe pas — l'enum n'en a que trois —,
     et un écart signale une requête qui compte deux fois ou en oublie une.
     Refusé à la frontière : à l'écran, « 41 lancements · 36 réussies » avec une
     colonne manquante se lit comme un taux d'échec faux et crédible. */
  it("refuse un total qui ne se retrouve pas dans les issues", () => {
    expect(actionPayanteSchema.safeParse({ ...action, lancements: 41 }).success).toBe(false);
  });

  it("admet une action jamais lancée", () => {
    const jamais = { code: "portrait", lancements: 0, reussies: 0, echouees: 0, enAttente: 0 };
    expect(actionPayanteSchema.safeParse(jamais).success).toBe(true);
  });

  // « issue_des_actions » n'est plus un manque : la source existe.
  it("ne compte plus l'issue des actions parmi les manques", () => {
    expect(metriquesSchema.safeParse({ ...metriques, manques: ["issue_des_actions"] }).success).toBe(false);
  });
});

// ——— Statistiques des transactions ————————————————————————————

const stats = {
  periode: "30j", sens: "tous", mode: "tous",
  tentatives: 120, aboutis: 108, encaisse: 108000, frais: 4200, median: 1000,
  jours: [{ jour: "2026-08-29", encaisse: 4000, echoue: 500 }],
  parMoyen: [{ cle: "mobile_money", tentatives: 100, aboutis: 92 }],
  parPays: [{ cle: "CM", tentatives: 100, aboutis: 92 }],
};

describe("les statistiques des transactions", () => {
  it("accepte une réponse complète", () => {
    expect(statsTransactionsSchema.safeParse(stats).success).toBe(true);
  });

  /* Plus d'aboutis que de tentatives n'est pas un chiffre surprenant, c'est une
     requête fausse — et à l'écran, elle se lirait comme un taux de réussite
     supérieur à cent pour cent, ce qu'on prendrait pour un défaut d'affichage. */
  it("refuse plus d'aboutis que de tentatives", () => {
    expect(statsTransactionsSchema.safeParse({ ...stats, aboutis: 121 }).success).toBe(false);
    expect(aboutissementSchema.safeParse({ cle: "CM", tentatives: 10, aboutis: 11 }).success).toBe(false);
  });

  /* Nul et zéro ne disent pas la même chose : « aucun paiement n'a abouti » et
     « le paiement médian vaut zéro franc » sont deux nouvelles opposées. */
  it("distingue un panier médian inconnu d'un panier nul", () => {
    expect(statsTransactionsSchema.safeParse({ ...stats, median: null }).success).toBe(true);
    expect(statsTransactionsSchema.safeParse({ ...stats, median: 0 }).success).toBe(true);
  });

  it("n'admet que les trois périodes du graphe", () => {
    expect(statsTransactionsSchema.safeParse({ ...stats, periode: "12m" }).success).toBe(false);
  });

  it("refuse un champ de trop", () => {
    expect(statsTransactionsSchema.safeParse({ ...stats, solde: 3 }).success).toBe(false);
  });

  /* Encaissé et échoué ne s'additionnent pas : ce sont deux mesures du même
     jour, pas les parts d'un total. Un jour porte donc les deux. */
  it("garde les deux montants d'un jour séparés", () => {
    const fondu = { ...stats, jours: [{ jour: "2026-08-29", encaisse: 4500 }] };
    expect(statsTransactionsSchema.safeParse(fondu).success).toBe(false);
  });
});

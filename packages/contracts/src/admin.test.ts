import { describe, expect, it } from "vitest";
import {
  adminRoleSchema, motifSchema, pageDeSchema, dashboardSchema,
  compteLigneSchema, compteDetailSchema, parametresSchema,
  demandeSuppressionSchema, interventionSchema, profilAdminSchema,
  metriquesSchema, cohorteSchema, conversionSchema,
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

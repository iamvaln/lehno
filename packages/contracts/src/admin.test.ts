import { describe, expect, it } from "vitest";
import {
  adminRoleSchema, motifSchema, pageDeSchema, dashboardSchema,
  compteLigneSchema, compteDetailSchema, parametresSchema,
  demandeSuppressionSchema, interventionSchema, profilAdminSchema,
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

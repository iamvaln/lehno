import { describe, expect, it } from "vitest";
import {
  dashboardSchema, compteDetailSchema, parametresSchema, profilAdminSchema,
  pageDeSchema, compteLigneSchema, demandeSuppressionSchema, interventionSchema,
} from "@lehno/contracts";
import {
  dashboard, comptes, compteDetail, parametres, profil, suppressions, interventions,
} from "../src/fixtures/index.js";

// Une fixture qui ne se valide pas contre son contrat est un écran qui mentira
// le jour du câblage. Le test est ce qui rend le remplacement de source sûr.
describe("les fixtures tiennent leurs contrats", () => {
  it("le tableau de bord", () => {
    expect(dashboardSchema.safeParse(dashboard).success).toBe(true);
  });

  it("la liste des comptes, paginée par curseur", () => {
    expect(pageDeSchema(compteLigneSchema).safeParse(comptes).success).toBe(true);
  });

  it("le détail d'un compte", () => {
    expect(compteDetailSchema.safeParse(compteDetail).success).toBe(true);
  });

  it("les demandes de suppression", () => {
    expect(pageDeSchema(demandeSuppressionSchema).safeParse(suppressions).success).toBe(true);
  });

  it("les interventions", () => {
    expect(pageDeSchema(interventionSchema).safeParse(interventions).success).toBe(true);
  });

  it("les configurations", () => {
    expect(parametresSchema.safeParse(parametres).success).toBe(true);
  });

  it("le compte connecté", () => {
    expect(profilAdminSchema.safeParse(profil).success).toBe(true);
  });
});

describe("le ton du back-office", () => {
  const textes = JSON.stringify([dashboard, comptes, suppressions, interventions, parametres]);

  it("n'emploie ni point d'exclamation ni émoji", () => {
    expect(textes).not.toMatch(/!/);
    expect(textes).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("alerte sur des faits, pas sur l'urgence", () => {
    for (const mot of ["Attention", "Urgent", "Vite", "Dernière chance"])
      expect(textes).not.toContain(mot);
  });
});

import { describe, expect, it } from "vitest";
import { arretSchema, leverSchema, maintenanceStatusSchema } from "./maintenance.js";

describe("l'état d'un arrêt", () => {
  it("admet une heure de retour absente", () => {
    const sansHeure = { maintenance: true, retryAfterSeconds: 900, until: null };
    expect(maintenanceStatusSchema.safeParse(sansHeure).success).toBe(true);
  });
});

const MOTIF = "Migration de la base de production";

describe("déclencher un arrêt", () => {
  it("prend une durée en minutes", () => {
    expect(arretSchema.safeParse({ dureeMinutes: 120, reason: MOTIF }).success).toBe(true);
  });

  // « On ne la connaît pas toujours » : l'écran d'attente dit alors qu'une mise
  // à jour est en cours, sans promettre d'heure.
  it("admet qu'on ne sache pas combien de temps", () => {
    expect(arretSchema.safeParse({ dureeMinutes: null, reason: MOTIF }).success).toBe(true);
  });

  // Une durée nulle ou négative n'est pas un arrêt court, c'est une heure de
  // retour déjà passée — l'écran annoncerait un retour pour tout à l'heure.
  it("refuse une durée nulle ou négative", () => {
    expect(arretSchema.safeParse({ dureeMinutes: 0, reason: MOTIF }).success).toBe(false);
    expect(arretSchema.safeParse({ dureeMinutes: -30, reason: MOTIF }).success).toBe(false);
  });

  // Au-delà d'une journée, ce n'est plus une intervention, c'est une fermeture.
  it("refuse au-delà d'une journée", () => {
    expect(arretSchema.safeParse({ dureeMinutes: 1440, reason: MOTIF }).success).toBe(true);
    expect(arretSchema.safeParse({ dureeMinutes: 1441, reason: MOTIF }).success).toBe(false);
  });

  it("refuse un champ de trop", () => {
    expect(arretSchema.safeParse({ dureeMinutes: 60, reason: MOTIF, until: "2026-08-27" }).success).toBe(false);
  });
});

// Couper le service pour tout le monde est une action sensible : §6 exige un
// motif, et le journal d'audit ne dirait rien sans lui.
describe("le motif", () => {
  it("est exigé pour déclencher", () => {
    expect(arretSchema.safeParse({ dureeMinutes: 60 }).success).toBe(false);
  });

  it("est exigé pour lever", () => {
    expect(leverSchema.safeParse({}).success).toBe(false);
    expect(leverSchema.safeParse({ reason: MOTIF }).success).toBe(true);
  });

  it("refuse une formule trop courte pour informer", () => {
    expect(arretSchema.safeParse({ dureeMinutes: 60, reason: "ok" }).success).toBe(false);
  });
});

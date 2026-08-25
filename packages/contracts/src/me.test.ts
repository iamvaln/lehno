import { describe, expect, it } from "vitest";
import { createPersonSchema, updatePersonSchema, PERSON_REGISTERS } from "./me.js";

describe("contrats des proches", () => {
  it("exige un nom d'usage non vide", () => {
    expect(createPersonSchema.safeParse({ displayName: "" }).success).toBe(false);
    expect(createPersonSchema.safeParse({ displayName: "Awa" }).success).toBe(true);
  });

  // Le registre gouverne le ton des messages produits : trois valeurs, pas une
  // chaîne libre (voir dictionnaire, enum person_register).
  it("n'accepte que les trois registres du dictionnaire", () => {
    expect(PERSON_REGISTERS).toEqual(["familier", "amical", "formel"]);
    expect(createPersonSchema.safeParse({ displayName: "Awa", register: "copain" }).success).toBe(false);
    expect(createPersonSchema.safeParse({ displayName: "Awa", register: "amical" }).success).toBe(true);
  });

  // .strict() : un champ inattendu fait échouer, il ne se laisse pas ignorer.
  it("refuse un champ inconnu", () => {
    expect(createPersonSchema.safeParse({ displayName: "Awa", isSelf: true }).success).toBe(false);
  });

  // La mise à jour n'a pas de champ obligatoire, mais elle en exige au moins un :
  // un PATCH vide est une requête qui ne veut rien dire.
  it("exige au moins un champ à la mise à jour", () => {
    expect(updatePersonSchema.safeParse({}).success).toBe(false);
    expect(updatePersonSchema.safeParse({ register: "formel" }).success).toBe(true);
  });
});

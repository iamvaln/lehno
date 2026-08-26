import { describe, expect, it } from "vitest";
import { usernameSchema } from "./profile.js";
import { registerSchema } from "./auth.js";

const BASE = {
  registrationToken: "un-jeton", deviceId: "un-appareil",
};

// LE point de ce fichier : les deux chemins qui acceptent un pseudo doivent
// accepter EXACTEMENT les mêmes. Ils portaient deux règles recopiées, qui ont
// divergé — l'inscription acceptait « Valentine.N », la correction de profil
// le refusait. Un compte pouvait donc naître avec un pseudo qu'il ne pouvait
// plus jamais modifier sans le changer.
describe("le pseudo, une seule règle pour deux chemins", () => {
  const cas: [string, boolean][] = [
    ["valentine", true],
    ["Valentine", true],
    ["valentine.n", true],
    ["valentine-n", true],
    ["valentine_n", true],
    ["v4l3nt1n3", true],
    ["abc", true],
    // Commence par un séparateur : l'adresse du Mur débuterait par un point.
    [".valentine", false],
    ["-valentine", false],
    ["_valentine", false],
    // Trop court, trop long.
    ["ab", false],
    ["a".repeat(31), false],
    // Ce qui n'entre pas dans une URL sans être échappé.
    ["valentine n", false],
    ["valentine/n", false],
    ["valentine@n", false],
    ["valentine#n", false],
    ["valentiné", false],
  ];

  it.each(cas)("« %s » : les deux chemins s'accordent", (pseudo, accepte) => {
    const parProfil = usernameSchema.safeParse(pseudo).success;
    const parInscription = registerSchema.safeParse({ ...BASE, username: pseudo }).success;

    expect(parProfil, `le profil devrait ${accepte ? "accepter" : "refuser"} « ${pseudo} »`)
      .toBe(accepte);
    expect(parInscription, `l'inscription devrait ${accepte ? "accepter" : "refuser"} « ${pseudo} »`)
      .toBe(accepte);
  });
});

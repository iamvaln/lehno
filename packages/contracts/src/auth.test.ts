import { describe, expect, it } from "vitest";
import {
  registerSchema, sessionSchema, verifyOtpResultSchema, verifyOtpSchema,
} from "./auth.js";

const JETON = "eyJhbGciOiJIUzI1NiJ9.abc.def";

describe("la vérification du code", () => {
  /* Elle a deux issues, et c'est le cœur du parcours d'entrée : une adresse
     déjà connue ouvre une session ; une adresse nouvelle rend un jeton
     d'inscription, qui ne sert qu'à créer le compte. Les confondre ferait
     ranger un jeton d'inscription comme s'il ouvrait l'application. */
  it("ouvre une session pour un compte connu", () => {
    const r = verifyOtpResultSchema.parse({
      outcome: "session", accessToken: JETON, refreshToken: JETON,
      expiresIn: 900, isNewAccount: false,
    });
    expect(r.outcome).toBe("session");
  });

  it("rend un jeton d'inscription pour une adresse nouvelle", () => {
    const r = verifyOtpResultSchema.parse({
      outcome: "registration", registrationToken: JETON, expiresIn: 600,
      email: "awa@exemple.fr", deviceLimitReached: false,
    });
    expect(r.outcome).toBe("registration");
  });

  /* « Le plafond de comptes est atteint sur cet appareil » arrive AVEC le jeton
     d'inscription, pas à sa place : l'écran doit pouvoir le dire avant que la
     personne choisisse un pseudo pour rien. */
  it("annonce le plafond d'appareil dès la vérification", () => {
    const r = verifyOtpResultSchema.parse({
      outcome: "registration", registrationToken: JETON, expiresIn: 600,
      email: "awa@exemple.fr", deviceLimitReached: true,
    });
    expect(r.outcome === "registration" && r.deviceLimitReached).toBe(true);
  });

  // Une issue sans son discriminant ne se range dans aucune branche.
  it("refuse une réponse sans issue nommée", () => {
    expect(() => verifyOtpResultSchema.parse({
      accessToken: JETON, refreshToken: JETON, expiresIn: 900, isNewAccount: false,
    })).toThrow();
  });

  // Les deux branches ne se mélangent pas : un jeton de session sur une issue
  // d'inscription voudrait dire qu'on est connecté et pas connecté à la fois.
  it("ne mélange pas les deux issues", () => {
    expect(() => verifyOtpResultSchema.parse({
      outcome: "registration", registrationToken: JETON, expiresIn: 600,
      email: "awa@exemple.fr", deviceLimitReached: false, accessToken: JETON,
    })).toThrow();
  });
});

describe("l'inscription", () => {
  const VALIDE = {
    registrationToken: JETON,
    username: "awa_diop",
    deviceId: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  };

  it("exige le jeton d'inscription, le pseudo et l'appareil", () => {
    expect(() => registerSchema.parse(VALIDE)).not.toThrow();
    for (const manquant of ["registrationToken", "username", "deviceId"] as const) {
      const partiel = { ...VALIDE };
      delete partiel[manquant];
      expect(() => registerSchema.parse(partiel), manquant).toThrow();
    }
  });

  // Le code de parrainage se saisit au même écran, et reste facultatif.
  it("accepte un code de parrainage, sans l'exiger", () => {
    expect(() => registerSchema.parse({ ...VALIDE, referralCode: "AWA-2K4" })).not.toThrow();
  });

  /* Le motif retenu est celui du serveur, qui accepte majuscules, points et
     tirets. Le champ du pseudo doit s'y conformer : nettoyer plus large que le
     serveur détruirait un pseudo que le serveur aurait pris. */
  it("accepte les pseudos que le serveur accepte", () => {
    for (const pseudo of ["Awa.Diop", "awa-diop", "Valentine", "a1_b"]) {
      expect(() => registerSchema.parse({ ...VALIDE, username: pseudo }), pseudo).not.toThrow();
    }
  });

  it("refuse ce qui ne commence pas par une lettre ou un chiffre", () => {
    for (const pseudo of [".awa", "-awa", "_awa", "aw"]) {
      expect(() => registerSchema.parse({ ...VALIDE, username: pseudo }), pseudo).toThrow();
    }
  });
});

describe("la session", () => {
  // Ce que l'inscription rend en plus : les crédits offerts, que l'écran de
  // bienvenue annonce. Les écrire en dur le ferait mentir dès qu'ils changent.
  it("porte les crédits d'inscription quand elle vient de naître", () => {
    const r = sessionSchema.parse({
      outcome: "session", accessToken: JETON, refreshToken: JETON,
      expiresIn: 900, isNewAccount: true, signupCredits: 5,
    });
    expect(r.signupCredits).toBe(5);
  });

  it("s'en passe pour une session ordinaire", () => {
    expect(() => sessionSchema.parse({
      outcome: "session", accessToken: JETON, refreshToken: JETON,
      expiresIn: 900, isNewAccount: false,
    })).not.toThrow();
  });

  // `verifyOtpSchema` n'a pas bougé, mais le test le tient : c'est la porte
  // d'entrée, et un champ qui s'y perdrait ne se verrait qu'à l'usage.
  it("la demande de vérification garde ses quatre champs", () => {
    expect(() => verifyOtpSchema.parse({
      email: "awa@exemple.fr", code: "419283",
      deviceId: "abc", referralCode: "AWA-2K4",
    })).not.toThrow();
    expect(() => verifyOtpSchema.parse({ email: "awa@exemple.fr", code: "41928" })).toThrow();
  });
});

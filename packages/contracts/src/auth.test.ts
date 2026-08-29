import { describe, expect, it } from "vitest";
import { registerSchema, registeredSchema, verifyOtpSchema, verifyOutcomeSchema } from "./auth.js";

const JETON = "eyJhbGciOiJIUzI1NiJ9.abc.def";
const APPAREIL = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

describe("les deux issues de la vérification", () => {
  /* C'est le cœur du parcours d'entrée : une adresse déjà connue ouvre une
     session ; une adresse nouvelle rend un jeton d'inscription, qui ne sert
     qu'à créer le compte. Les confondre ferait ranger un jeton d'inscription
     comme s'il ouvrait l'application. */
  it("ouvre une session pour un compte connu", () => {
    const r = verifyOutcomeSchema.parse({
      outcome: "session", accessToken: JETON, refreshToken: JETON,
      expiresIn: 900, isNewAccount: false,
    });
    expect(r.outcome).toBe("session");
  });

  it("rend un jeton d'inscription pour une adresse nouvelle", () => {
    const r = verifyOutcomeSchema.parse({
      outcome: "registration", registrationToken: JETON, expiresIn: 600,
      email: "awa@exemple.fr", deviceLimitReached: false,
    });
    expect(r.outcome).toBe("registration");
  });

  // Une issue sans son discriminant ne se range dans aucune branche — et le
  // client ne saurait pas s'il tient une session ou une invitation.
  it("refuse une réponse sans issue nommée", () => {
    expect(() => verifyOutcomeSchema.parse({
      accessToken: JETON, refreshToken: JETON, expiresIn: 900, isNewAccount: false,
    })).toThrow();
  });

  // Les deux branches ne se mélangent pas : un jeton de session sur une issue
  // d'inscription voudrait dire connecté et pas connecté à la fois.
  it("ne mélange pas les deux issues", () => {
    expect(() => verifyOutcomeSchema.parse({
      outcome: "registration", registrationToken: JETON, expiresIn: 600,
      email: "awa@exemple.fr", deviceLimitReached: false, accessToken: JETON,
    })).toThrow();
  });

  it("garde ses quatre champs de demande", () => {
    expect(() => verifyOtpSchema.parse({
      email: "awa@exemple.fr", code: "419283", deviceId: APPAREIL, referralCode: "AWA-2K4",
    })).not.toThrow();
    expect(() => verifyOtpSchema.parse({ email: "awa@exemple.fr", code: "41928" })).toThrow();
  });
});

describe("l'inscription", () => {
  const VALIDE = { registrationToken: JETON, username: "awa_diop", deviceId: APPAREIL };

  it("exige le jeton, le pseudo et l'appareil", () => {
    expect(() => registerSchema.parse(VALIDE)).not.toThrow();
    for (const manquant of ["registrationToken", "username", "deviceId"] as const) {
      const partiel = { ...VALIDE };
      delete partiel[manquant];
      expect(() => registerSchema.parse(partiel), manquant).toThrow();
    }
  });

  it("accepte un code de parrainage, sans l'exiger", () => {
    expect(() => registerSchema.parse({ ...VALIDE, referralCode: "AWA-2K4" })).not.toThrow();
  });
});

describe("ce que l'écran de bienvenue reçoit", () => {
  const NEE = {
    outcome: "session" as const, accessToken: JETON, refreshToken: JETON,
    expiresIn: 900, isNewAccount: true as const, signupCredits: 5,
    /* La liste d'attente : un TROISIÈME geste, distinct des deux autres. NUL
       quand la personne n'attendait pas — jamais zéro : un zéro se lirait comme
       un bonus qui n'a rien donné, là où il n'y a pas eu de geste du tout. */
    waitlistBonus: null,
  };

  /* Le DÉTAIL, pas un total : cadeau de bienvenue et bonus de parrainage sont
     deux gestes distincts, et l'un des deux se mérite. Les confondre dans un
     solde unique effacerait la raison d'inviter quelqu'un. */
  it("porte les crédits d'inscription", () => {
    expect(registeredSchema.parse({ ...NEE, referral: null }).signupCredits).toBe(5);
  });

  it("distingue le bonus de parrainage du cadeau de bienvenue", () => {
    const r = registeredSchema.parse({
      ...NEE,
      referral: { outcome: "credited", inviterUsername: "awa_diop", bonusCredits: 5 },
    });
    expect(r.referral?.bonusCredits).toBe(5);
    expect(r.signupCredits).toBe(5);
  });

  /* Un code inconnu, ou un code à soi, ne casse pas l'inscription : il se
     signale. L'écran peut alors le dire sans que le compte soit perdu — et
     c'est ce qui distingue une maladresse d'un échec. */
  it("signale un code sans issue plutôt que d'échouer", () => {
    for (const issue of ["unknown", "self"] as const) {
      const r = registeredSchema.parse({
        ...NEE, referral: { outcome: issue, inviterUsername: null, bonusCredits: 0 },
      });
      expect(r.referral?.outcome, issue).toBe(issue);
    }
  });

  // Une inscription crée toujours un compte : `isNewAccount` ne peut pas être
  // faux ici, et le type l'interdit plutôt que de le laisser passer.
  it("ne se confond pas avec une session ordinaire", () => {
    expect(() => registeredSchema.parse({ ...NEE, isNewAccount: false, referral: null })).toThrow();
  });
});

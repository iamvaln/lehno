import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { TokenService } from "../src/auth/token.service.js";

const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";
const tokens = new TokenService({} as never, SECRET);

// Les deux familles de jetons sont signées de la MÊME clé. Rien ne les
// distingue qu'une marque explicite — et sans elle, un jeton d'inscription
// ouvrirait une session.
describe("un jeton d'inscription n'est pas une session", () => {
  it("verifyAccess refuse un jeton d'inscription", () => {
    const { registrationToken } = tokens.issueRegistration("awa@example.com");
    expect(() => tokens.verifyAccess(registrationToken)).toThrow();
  });

  // LA faille que ce test garde. verifyAccess lisait `payload.sub` sans
  // vérifier son existence : un jeton signé de la clé mais dépourvu de sujet
  // rendait `{ userId: undefined }`, le garde posait req.userId = undefined,
  // et les requêtes cloisonnées partaient sur une portée vide. La signature
  // dit « ce jeton vient de nous », jamais « ce jeton ouvre une session ».
  it("verifyAccess refuse un jeton signé mais sans sujet", () => {
    const sansSujet = jwt.sign({ quelquechose: "vrai" }, SECRET, { algorithm: "HS256" });
    expect(() => tokens.verifyAccess(sansSujet)).toThrow();
  });

  it("verifyAccess refuse un sujet vide", () => {
    const sujetVide = jwt.sign({ sub: "" }, SECRET, { algorithm: "HS256" });
    expect(() => tokens.verifyAccess(sujetVide)).toThrow();
  });

  // La séparation vaut dans les DEUX sens : un jeton d'accès ne doit pas
  // pouvoir créer un compte.
  it("verifyRegistration refuse un jeton d'accès", () => {
    const acces = jwt.sign({ sub: "un-compte" }, SECRET, { algorithm: "HS256" });
    expect(() => tokens.verifyRegistration(acces)).toThrow();
  });

  it("verifyRegistration rend l'adresse vérifiée", () => {
    const { registrationToken } = tokens.issueRegistration("awa@example.com");
    expect(tokens.verifyRegistration(registrationToken).email).toBe("awa@example.com");
  });

  // Signé d'une AUTRE clé : refusé des deux côtés. Évident, mais c'est la
  // garantie de base sur laquelle tout le reste repose.
  it("refuse un jeton signé d'une autre clé", () => {
    const etranger = jwt.sign({ purpose: "registration", email: "x@y.z" }, "une-autre-cle", {
      algorithm: "HS256",
    });
    expect(() => tokens.verifyRegistration(etranger)).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { estDifferable, messageDuBandeau, suivantes, type Action } from "../lib/file.js";

describe("ce qui peut se différer", () => {
  it("différe les écritures ordinaires", () => {
    expect(estDifferable("/me/persons", "POST")).toBe(true);
    expect(estDifferable("/me/persons/abc/notes", "POST")).toBe(true);
    expect(estDifferable("/me/persons/abc", "PATCH")).toBe(true);
    expect(estDifferable("/me/occurrences/abc", "DELETE")).toBe(true);
  });

  /* L'ARGENT, JAMAIS. Rejouer un versement des heures plus tard, sans personne
     devant l'écran, engage une somme que personne ne revoit partir — et le
     réseau peut revenir la nuit, l'application en poche. */
  it("ne différe jamais ce qui touche à l'argent", () => {
    expect(estDifferable("/me/payments", "POST")).toBe(false);
    expect(estDifferable("/me/payment-methods", "POST")).toBe(false);
    expect(estDifferable("/me/payment-methods/abc", "DELETE")).toBe(false);
  });

  /* L'IRRÉVERSIBLE non plus : quelqu'un qui a changé d'avis dans le tunnel
     verrait son compte partir au retour du réseau. */
  it("ne différe pas la fermeture d'un compte", () => {
    expect(estDifferable("/me/account", "DELETE")).toBe(false);
    expect(estDifferable("/me/account/deletion-code", "POST")).toBe(false);
  });

  /* La session doit aboutir localement tout de suite : différer la révocation
     vaut mieux que retenir quelqu'un sur un compte qu'il veut quitter. */
  it("ne différe pas la session", () => {
    expect(estDifferable("/auth/session", "DELETE")).toBe(false);
  });

  /* Une LECTURE n'a rien à rejouer : elle se refera d'elle-même au retour, et
     la mettre en file rejouerait une question dont personne n'attend plus la
     réponse. */
  it("ne différe pas une lecture", () => {
    expect(estDifferable("/me/persons", "GET")).toBe(false);
  });

  /* `/me/accounts` n'est pas `/me/account` : sans l'ancrage, une route voisine
     hériterait d'un refus qui ne la concerne pas — et se perdrait en silence. */
  it("ne confond pas un chemin voisin", () => {
    expect(estDifferable("/me/accountability", "POST")).toBe(true);
  });
});

describe("l'ordre et l'arrêt", () => {
  const a = (id: string): Action =>
    ({ id, chemin: "/me/persons", methode: "POST", corps: "{}", poseeLe: "2026-08-30T12:00:00.000Z" });

  it("retire la tête quand elle est passée", () => {
    expect(suivantes([a("1"), a("2")], "reussie").map((x) => x.id)).toEqual(["2"]);
  });

  /* L'ÉCHEC ARRÊTE, IL NE SAUTE PAS. Une note adressée à une fiche dont la
     création vient d'échouer n'atterrirait nulle part, et la suivante non plus :
     on aurait une file qui se vide en perdant la moitié, sans que rien ne le
     dise. Mieux vaut une file bloquée qu'on voit. */
  it("ne saute jamais celle qui a échoué", () => {
    expect(suivantes([a("1"), a("2")], "arrete").map((x) => x.id)).toEqual(["1", "2"]);
  });
});

describe("ce que la bannière dit", () => {
  const simple = "Hors connexion. Vos notes et vos dates restent consultables.";
  const avecFile = (n: number) => `Hors connexion. ${n} actions repartiront.`;

  /* Le message de la file REMPLACE l'autre : deux phrases empilées sur un
     bandeau ne se lisent pas, et celle qui compte est celle qui parle de ce
     qu'on vient de faire. */
  it("parle de la file dès qu'il y a quelque chose dedans", () => {
    expect(messageDuBandeau(3, simple, avecFile)).toBe("Hors connexion. 3 actions repartiront.");
  });

  it("rassure sur la lecture quand rien n'attend", () => {
    expect(messageDuBandeau(0, simple, avecFile)).toBe(simple);
  });
});

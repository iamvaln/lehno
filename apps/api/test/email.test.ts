import { describe, expect, it } from "vitest";
import { canonicalEmail, isDisposableEmail, assertUsableEmail } from "../src/common/email.js";
import { AppError } from "../src/common/errors.js";

// Aucune surface de l'application n'accepte une adresse jetable, et aucune ne
// laisse une même boîte se démultiplier par sous-adressage. Ces deux règles
// vivent ici, en un seul endroit, pour ne pas dériver d'un point d'entrée à
// l'autre.
describe("adresse électronique — forme canonique", () => {
  it("met en minuscules", () => {
    expect(canonicalEmail("Awa@Example.COM")).toBe("awa@example.com");
  });

  // RFC 5233 : ce qui suit le « + » est une étiquette de tri, pas une boîte
  // différente. C'est le moyen le plus courant de se démultiplier.
  it("ignore l'étiquette qui suit le plus", () => {
    expect(canonicalEmail("awa+1@example.com")).toBe("awa@example.com");
    expect(canonicalEmail("awa+lehno+test@example.com")).toBe("awa@example.com");
  });

  // Gmail ignore les points de la partie locale ; les autres fournisseurs,
  // non. Appliquer la règle partout fusionnerait des boîtes réellement
  // distinctes.
  it("ignore les points chez Gmail seulement", () => {
    expect(canonicalEmail("a.w.a@gmail.com")).toBe("awa@gmail.com");
    expect(canonicalEmail("a.w.a@googlemail.com")).toBe("awa@gmail.com");
    expect(canonicalEmail("a.w.a@example.com")).toBe("a.w.a@example.com");
  });

  it("laisse intacte une adresse déjà canonique", () => {
    expect(canonicalEmail("awa@example.com")).toBe("awa@example.com");
  });

  // Un « + » dans le domaine n'existe pas, mais une entrée malformée ne doit
  // pas produire une clé qui écraserait celle d'un autre.
  it("ne touche pas au domaine", () => {
    expect(canonicalEmail("awa@ex+ample.com")).toBe("awa@ex+ample.com");
  });
});

describe("adresse électronique — jetables", () => {
  it("refuse les fournisseurs jetables connus", () => {
    expect(isDisposableEmail("awa@mailinator.com")).toBe(true);
    expect(isDisposableEmail("awa@yopmail.com")).toBe(true);
  });

  it("accepte les fournisseurs ordinaires", () => {
    expect(isDisposableEmail("awa@gmail.com")).toBe(false);
    expect(isDisposableEmail("awa@example.com")).toBe(false);
  });

  // Le contournement le plus simple : changer la casse du domaine.
  it("ne se contourne pas par la casse", () => {
    expect(isDisposableEmail("awa@MAILINATOR.com")).toBe(true);
  });

  // Ni par une étiquette de sous-adressage, qui ne change pas le domaine.
  it("ne se contourne pas par le sous-adressage", () => {
    expect(isDisposableEmail("awa+contournement@mailinator.com")).toBe(true);
  });
});

describe("adresse électronique — la garde", () => {
  it("laisse passer une adresse utilisable", () => {
    expect(() => assertUsableEmail("awa@example.com")).not.toThrow();
  });

  it("refuse une jetable, avec un code qui dit pourquoi", () => {
    expect(() => assertUsableEmail("awa@mailinator.com")).toThrow(AppError);
    try {
      assertUsableEmail("awa@mailinator.com");
      expect.unreachable("aurait dû lever");
    } catch (erreur) {
      expect((erreur as AppError).code).toBe("email_disposable");
    }
  });
});

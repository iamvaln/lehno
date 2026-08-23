import { describe, expect, it } from "vitest";
import { otpEmail } from "../src/mail/templates.js";

describe("gabarits d'e-mail", () => {
  it("compose le code dans la langue du destinataire", () => {
    const fr = otpEmail({ code: "123456", locale: "fr" });
    const en = otpEmail({ code: "123456", locale: "en" });
    expect(fr.subject).toBe("Votre code Lehno");
    expect(en.subject).toBe("Your Lehno code");
    expect(fr.text).toContain("123456");
    expect(en.text).toContain("123456");
  });

  // Le gabarit est fixe et les valeurs s'y injectent : jamais de texte assemblé
  // à la volée, sinon la relecture d'une langue ne garantit rien sur l'autre.
  it("annonce la durée de vie du code", () => {
    expect(otpEmail({ code: "123456", locale: "fr" }).text).toContain("10 minutes");
  });
});

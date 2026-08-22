import { describe, expect, it } from "vitest";
import { ERROR_CODES, errorEnvelopeSchema } from "./index.js";

describe("codes d'erreur", () => {
  it("sont uniques", () => {
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
  });

  it("sont en minuscules avec des tirets bas", () => {
    for (const code of ERROR_CODES) expect(code).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it("l'enveloppe accepte un code connu et refuse l'inconnu", () => {
    expect(errorEnvelopeSchema.safeParse({ code: "otp_invalid", message: "bad code" }).success).toBe(true);
    expect(errorEnvelopeSchema.safeParse({ code: "pas_un_code", message: "x" }).success).toBe(false);
  });

  it("l'enveloppe refuse un champ inattendu", () => {
    const r = errorEnvelopeSchema.safeParse({ code: "otp_invalid", message: "x", oops: 1 });
    expect(r.success).toBe(false);
  });
});

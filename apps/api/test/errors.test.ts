import { describe, expect, it } from "vitest";
import { AppError, statusForCode } from "../src/common/errors.js";
import { errorEnvelopeSchema } from "@lehno/contracts";

describe("erreurs", () => {
  it("l'enveloppe rendue est conforme au contrat", () => {
    const e = new AppError("otp_expired", "otp expired");
    expect(errorEnvelopeSchema.safeParse(e.toEnvelope()).success).toBe(true);
  });

  it("chaque code porte le statut que la spécification lui donne", () => {
    expect(statusForCode("validation_failed")).toBe(400);
    expect(statusForCode("unauthorized")).toBe(401);
    expect(statusForCode("forbidden")).toBe(403);
    expect(statusForCode("not_found")).toBe(404);
    expect(statusForCode("conflict")).toBe(409);
    expect(statusForCode("otp_expired")).toBe(422);
    expect(statusForCode("rate_limited")).toBe(429);
    expect(statusForCode("internal_error")).toBe(500);
  });

  it("le message reste destiné au journal, jamais à l'écran", () => {
    const e = new AppError("username_taken", "username already in use");
    expect(e.toEnvelope().message).toBe("username already in use");
    expect(e.toEnvelope().code).toBe("username_taken");
  });
});

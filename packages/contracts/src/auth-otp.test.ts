import { describe, expect, it } from "vitest";
import { requestOtpResultSchema } from "./auth.js";

describe("la demande de code", () => {
  /* Le délai de renvoi vient du limiteur du serveur. Une constante côté client
     finit par le contredire — et l'écran promet alors un renvoi que le serveur
     refuse, ce qui se lit comme un défaut de l'application. */
  it("porte le délai avant un nouveau code", () => {
    expect(requestOtpResultSchema.parse({ sent: true, retryAfterSeconds: 5 }).retryAfterSeconds).toBe(5);
  });

  it("l'exige : sans lui, l'écran devrait l'inventer", () => {
    expect(() => requestOtpResultSchema.parse({ sent: true })).toThrow();
  });

  // « Rend toujours sent: true, adresse connue ou non » — dire le contraire
  // apprendrait qui a un compte.
  it("ne rend jamais autre chose que « envoyé »", () => {
    expect(() => requestOtpResultSchema.parse({ sent: false, retryAfterSeconds: 5 })).toThrow();
  });
});

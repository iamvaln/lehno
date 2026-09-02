import { describe, expect, it } from "vitest";
import { requestOtpResultSchema } from "./auth.js";

describe("la demande de code", () => {
  /* Le délai de renvoi vient du limiteur du serveur. Une constante côté client
     finit par le contredire — et l'écran promet alors un renvoi que le serveur
     refuse, ce qui se lit comme un défaut de l'application. */
  const REPONSE = { sent: true, retryAfterSeconds: 5, expiresAt: "2026-08-31T04:10:00.000Z" };

  it("porte le délai avant un nouveau code", () => {
    expect(requestOtpResultSchema.parse(REPONSE).retryAfterSeconds).toBe(5);
  });

  it("l'exige : sans lui, l'écran devrait l'inventer", () => {
    expect(() => requestOtpResultSchema.parse({ sent: true })).toThrow();
  });

  /* LA VALIDITÉ DU CODE, et ce n'est PAS le délai de renvoi. L'écran tenait une
     constante de dix minutes en face de celle du serveur : deux vérités qui
     s'accordaient et que rien n'obligeait à s'accorder. Le serveur calculait
     déjà cette date et la jetait avant de sortir. */
  it("porte l'échéance du code, distincte du délai de renvoi", () => {
    const lu = requestOtpResultSchema.parse(REPONSE);
    expect(lu.expiresAt).toBe("2026-08-31T04:10:00.000Z");
    expect(lu.expiresAt).not.toBe(String(lu.retryAfterSeconds));
  });

  /* UNE DATE, PAS UNE DURÉE. Une durée se décompte depuis l'instant où l'écran
     s'affiche, ce qui mesure l'âge de l'ÉCRAN et non celui du CODE : revenir en
     arrière puis repartir faisait repartir le minuteur de dix minutes sur un
     code déjà mort — « expiré » au-dessus d'un décompte qui tournait encore. */
  it("l'exige aussi : sans elle, l'écran décompte son propre montage", () => {
    expect(() => requestOtpResultSchema.parse({ sent: true, retryAfterSeconds: 5 })).toThrow();
  });

  // « Rend toujours sent: true, adresse connue ou non » — dire le contraire
  // apprendrait qui a un compte.
  it("ne rend jamais autre chose que « envoyé »", () => {
    expect(() => requestOtpResultSchema.parse({ sent: false, retryAfterSeconds: 5 })).toThrow();
  });
});

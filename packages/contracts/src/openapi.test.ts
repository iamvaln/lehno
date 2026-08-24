import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { construireOpenApi } from "./openapi.js";

describe("contrat publié", () => {
  it("porte les métadonnées du service", () => {
    const d = construireOpenApi() as { openapi: string; info: { title: string }; servers: unknown[] };
    expect(d.openapi).toMatch(/^3\./);
    expect(d.info.title).toBe("Lehno");
    expect(d.servers).not.toHaveLength(0);
  });

  // Le contrat décrit ce que le serveur sert vraiment : les chemins publics
  // existent déjà, ils doivent y être.
  it("décrit les chemins déjà servis", () => {
    const chemins = Object.keys((construireOpenApi() as { paths: object }).paths);
    expect(chemins).toContain("/public/waitlist");
    expect(chemins).toContain("/public/contact");
  });

  // Tous les contrôleurs de apps/api/src sont câblés dans AppModule
  // aujourd'hui : /public/*, /auth/* et /me/profile. Un contrat qui en tait
  // un ment autant qu'un contrat périmé — voir apps/api/src/app.module.ts.
  it("décrit tous les chemins câblés dans AppModule, pas seulement l'exemple du plan", () => {
    const chemins = Object.keys((construireOpenApi() as { paths: object }).paths);
    expect(chemins).toEqual(
      expect.arrayContaining([
        "/public/waitlist",
        "/public/contact",
        "/public/config",
        "/public/legal/{document}",
        "/auth/otp",
        "/auth/otp/verify",
        "/auth/federated",
        "/auth/refresh",
        "/auth/session",
        "/me/profile",
        "/me/profile/username-available",
      ]),
    );
  });

  // LE test qui compte. Un fichier engendré que rien ne vérifie pourrit : il
  // décrit alors une API qui n'existe plus, et un client s'y fie.
  it("le fichier versionné n'est pas périmé", () => {
    const surDisque = readFileSync(
      join(import.meta.dirname, "..", "..", "..", "docs", "api", "openapi.json"),
      "utf-8",
    );
    expect(
      JSON.parse(surDisque),
      "docs/api/openapi.json est périmé — relancer `pnpm --filter @lehno/contracts openapi`",
    ).toEqual(construireOpenApi());
  });
});

import { describe, expect, it } from "vitest";
import { sessionSummarySchema, sessionsListSchema, externalIdentitySchema, identitiesListSchema } from "./me-security.js";

const SESSION = {
  id: "3f2504e0-4f89-11d3-9a0c-0305e82c3303",
  createdAt: "2026-06-01T10:00:00.000Z",
  lastActiveAt: "2026-08-20T08:30:00.000Z",
  userAgent: "Chrome — macOS",
};

describe("connexions récentes — une session, pas un jeton", () => {
  it("accepte une lignée avec son ouverture et sa dernière activité", () => {
    expect(sessionSummarySchema.parse(SESSION)).toEqual(SESSION);
  });

  it("accepte un appareil qui n'a jamais déclaré son user-agent", () => {
    expect(sessionSummarySchema.parse({ ...SESSION, userAgent: null }).userAgent).toBeNull();
  });

  // Le piège que ce contrat existe pour fermer : une adresse IP, brute ou
  // sous forme de « lieu », n'a rien à faire ici tant qu'aucun service de
  // géolocalisation ne la traduit honnêtement. `.strict()` refuse tout champ
  // que le schéma ne connaît pas — y compris "ip" ou "location".
  it("refuse une adresse ou un lieu glissés dans la session", () => {
    expect(() => sessionSummarySchema.parse({ ...SESSION, ip: "102.244.18.7" })).toThrow();
    expect(() => sessionSummarySchema.parse({ ...SESSION, location: "Douala, CM" })).toThrow();
  });

  it("refuse un identifiant de lignée qui n'est pas un UUID", () => {
    expect(() => sessionSummarySchema.parse({ ...SESSION, id: "pas-un-uuid" })).toThrow();
  });

  it("l'enveloppe porte la liste des sessions", () => {
    const rendu = sessionsListSchema.parse({ sessions: [SESSION] });
    expect(rendu.sessions).toHaveLength(1);
  });
});

const IDENTITE = {
  provider: "google" as const,
  linkedAt: "2025-01-10T09:00:00.000Z",
  lastUsedAt: "2026-08-20T08:30:00.000Z",
};

describe("moyens de connexion externes", () => {
  it("accepte une identité Google ou Apple, avec son rattachement et son dernier usage", () => {
    expect(externalIdentitySchema.parse(IDENTITE)).toEqual(IDENTITE);
    expect(externalIdentitySchema.parse({ ...IDENTITE, provider: "apple" }).provider).toBe("apple");
  });

  it("accepte une identité jamais réutilisée depuis son rattachement", () => {
    expect(externalIdentitySchema.parse({ ...IDENTITE, lastUsedAt: null }).lastUsedAt).toBeNull();
  });

  it("refuse un fournisseur hors des deux connus", () => {
    expect(() => externalIdentitySchema.parse({ ...IDENTITE, provider: "facebook" })).toThrow();
  });

  it("l'enveloppe porte la liste des identités", () => {
    const rendu = identitiesListSchema.parse({ identities: [IDENTITE] });
    expect(rendu.identities).toHaveLength(1);
  });
});

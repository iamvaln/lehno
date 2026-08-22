import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { FederatedService, type IdentityVerifier } from "../src/auth/federated.service.js";
import { TokenService } from "../src/auth/token.service.js";

const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";

// Le vérificateur réel appelle le fournisseur ; ici on décide de sa réponse.
const verifier = (r: { providerUserId: string; email: string | null; emailVerified: boolean }): IdentityVerifier =>
  ({ verify: async () => r });

describe("identités externes", () => {
  let db: TestDb;
  let userId: string;
  const build = (v: IdentityVerifier) =>
    new FederatedService(db.prisma as never, new TokenService(db.prisma as never, SECRET),
      { google: v, apple: v });

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa", referralCode: "AWA1", emailVerified: true },
    });
    userId = u.id;
  });

  it("rattache au compte existant quand l'adresse vérifiée correspond", async () => {
    const svc = build(verifier({ providerUserId: "g-1", email: "awa@example.com", emailVerified: true }));
    const s = await svc.signIn({ provider: "google", idToken: "x" });
    expect(s.isNewAccount).toBe(false);
    expect(await db.prisma.user.count()).toBe(1);
    expect(await db.prisma.federatedIdentity.count()).toBe(1);
  });

  it("reconnaît par l'identifiant du fournisseur même si l'adresse a changé", async () => {
    await db.prisma.federatedIdentity.create({
      data: { userId, provider: "apple", providerUserId: "a-1" },
    });
    const svc = build(verifier({ providerUserId: "a-1", email: "relais@privaterelay.example", emailVerified: true }));
    const s = await svc.signIn({ provider: "apple", idToken: "x" });
    expect(s.isNewAccount).toBe(false);
    expect(await db.prisma.user.count()).toBe(1);
  });

  it("refuse de rattacher sur une adresse non vérifiée", async () => {
    const svc = build(verifier({ providerUserId: "g-9", email: "awa@example.com", emailVerified: false }));
    await expect(svc.signIn({ provider: "google", idToken: "x" }))
      .rejects.toMatchObject({ code: "federated_token_invalid" });
  });

  it("crée un compte quand rien ne correspond", async () => {
    const svc = build(verifier({ providerUserId: "g-2", email: "karim@example.com", emailVerified: true }));
    const s = await svc.signIn({ provider: "google", idToken: "x", deviceId: "dev-1" });
    expect(s.isNewAccount).toBe(true);
    expect(await db.prisma.user.count()).toBe(2);
  });
});

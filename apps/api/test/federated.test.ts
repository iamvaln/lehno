import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { FederatedService, type IdentityVerifier } from "../src/auth/federated.service.js";
import { SignupService } from "../src/onboarding/signup.service.js";
import { LegalService } from "../src/public/legal.controller.js";
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
      { google: v, apple: v },
      new SignupService(db.prisma as never, new LegalService()));

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
    expect(s.outcome).toBe("session");
    if (s.outcome !== "session") throw new Error("session attendue");
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
    expect(s.outcome).toBe("session");
    if (s.outcome !== "session") throw new Error("session attendue");
    expect(s.isNewAccount).toBe(false);
    expect(await db.prisma.user.count()).toBe(1);
  });

  it("refuse de rattacher sur une adresse non vérifiée", async () => {
    const svc = build(verifier({ providerUserId: "g-9", email: "awa@example.com", emailVerified: false }));
    await expect(svc.signIn({ provider: "google", idToken: "x" }))
      .rejects.toMatchObject({ code: "federated_token_invalid" });
  });

  // La première connexion fédérée NE CRÉE PAS DE COMPTE non plus. La §3.1 veut
  // le choix du pseudo « à la première connexion, QUELLE QUE SOIT LA VOIE
  // empruntée » : si Google créait le compte tout de suite, le parcours
  // divergerait selon la porte, et le code de parrainage — saisi à l'écran du
  // pseudo — n'aurait nulle part où aller.
  it("une adresse inconnue invite à s'inscrire, sans rien écrire", async () => {
    const svc = build(verifier({ providerUserId: "g-2", email: "karim@example.com", emailVerified: true }));
    const s = await svc.signIn({ provider: "google", idToken: "x", deviceId: "dev-1" });
    expect(s.outcome).toBe("registration");
    // Le compte existant du montage reste seul : aucun second n'est né.
    expect(await db.prisma.user.count()).toBe(1);
  });

  // Revue tour 1, point 3 : la branche qui reconnaît une identité déjà liée
  // rendait des jetons sans jamais regarder le statut du compte. C'est le
  // chemin le plus emprunté (celui de la reconnexion) : un compte suspendu
  // devait continuer de s'y connecter indéfiniment avant ce correctif.
  it("un compte suspendu ne reçoit jamais de jetons, même par une identité déjà liée", async () => {
    await db.prisma.federatedIdentity.create({
      data: { userId, provider: "google", providerUserId: "g-1" },
    });
    await db.prisma.user.update({ where: { id: userId }, data: { status: "suspended" } });
    const svc = build(verifier({ providerUserId: "g-1", email: "awa@example.com", emailVerified: true }));
    await expect(svc.signIn({ provider: "google", idToken: "x" }))
      .rejects.toMatchObject({ code: "account_suspended" });
  });

  it("un compte en cours de suppression ne reçoit jamais de jetons, même par une identité déjà liée", async () => {
    await db.prisma.federatedIdentity.create({
      data: { userId, provider: "google", providerUserId: "g-1" },
    });
    await db.prisma.user.update({ where: { id: userId }, data: { status: "pending_deletion" } });
    const svc = build(verifier({ providerUserId: "g-1", email: "awa@example.com", emailVerified: true }));
    await expect(svc.signIn({ provider: "google", idToken: "x" }))
      .rejects.toMatchObject({ code: "account_pending_deletion" });
  });

  // Revue tour 1, point 4 : ni succès ni échec ne laissaient de trace sur
  // cette voie, contrairement au code à usage unique (six branches tracées).
  it("une connexion réussie laisse une trace de succès", async () => {
    const svc = build(verifier({ providerUserId: "g-3", email: "karim@example.com", emailVerified: true }));
    await svc.signIn({ provider: "google", idToken: "x", deviceId: "dev-2" });
    const traces = await db.prisma.loginActivity.findMany({ where: { result: "success" } });
    expect(traces).toHaveLength(1);
    expect(traces[0]!.attemptedEmail).toBe("karim@example.com");
  });

  it("un jeton rejeté par le fournisseur laisse une trace d'échec", async () => {
    const rejetant: IdentityVerifier = { verify: async () => { throw new Error("invalid token"); } };
    const svc = build(rejetant);
    await expect(svc.signIn({ provider: "google", idToken: "x" }))
      .rejects.toMatchObject({ code: "federated_token_invalid" });
    const traces = await db.prisma.loginActivity.findMany({ where: { result: "failure" } });
    expect(traces).toHaveLength(1);
  });

  // Revue tour 1, point 6 : @@unique([userId, provider]) n'était gardé par
  // rien — le P2002 qu'il déclenche remontait tel quel en 500 au lieu du
  // federated_already_linked prévu par le contrat pour ce cas précis.
  it("une seconde identité du même fournisseur pour le même compte est refusée proprement", async () => {
    await db.prisma.federatedIdentity.create({
      data: { userId, provider: "google", providerUserId: "g-existing" },
    });
    const svc = build(verifier({ providerUserId: "g-new", email: "awa@example.com", emailVerified: true }));
    await expect(svc.signIn({ provider: "google", idToken: "x" }))
      .rejects.toMatchObject({ code: "federated_already_linked" });
    expect(await db.prisma.federatedIdentity.count()).toBe(1);
  });
});

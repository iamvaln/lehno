import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { FederatedService, type IdentityVerifier } from "../src/auth/federated.service.js";
import { SignupService } from "../src/onboarding/signup.service.js";
import { LegalService } from "../src/public/legal.controller.js";
import { TokenService } from "../src/auth/token.service.js";
import { mesureDeTest } from "./mesure.js";

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
      new SignupService(db.prisma as never, new LegalService()),
      mesureDeTest(db.prisma).service);

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa", referralCode: "AWA1", emailVerified: true },
    });
    userId = u.id;
  });

  // La voie, et non « externe » : c'est la distinction entre Google et Apple
  // qui permet de voir qu'un seul des deux est en cause lors d'un incident.
  // Une trace qui dirait seulement « pas par code » ne servirait à rien.
  it("une entrée par Google note sa voie et son adresse", async () => {
    const svc = build(verifier({ providerUserId: "g-7", email: "awa@example.com", emailVerified: true }));

    await svc.signIn({ provider: "google", idToken: "x", ip: "102.244.18.7" });

    const trace = await db.prisma.loginActivity.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
    expect(trace.method).toBe("google");
    expect(trace.ip).toBe("102.244.18.7");
  });

  it("une entrée par Apple note la sienne, pas celle de Google", async () => {
    const svc = build(verifier({ providerUserId: "a-7", email: "karim@example.com", emailVerified: true }));

    await svc.signIn({ provider: "apple", idToken: "x" });

    const trace = await db.prisma.loginActivity.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
    expect(trace.method).toBe("apple");
  });

  // Un jeton refusé est précisément ce qu'on veut pouvoir compter par voie.
  it("un refus note aussi la voie", async () => {
    const svc = build({ verify: () => { throw new Error("jeton invalide"); } } as never);

    await svc.signIn({ provider: "google", idToken: "x" }).catch(() => {});

    const trace = await db.prisma.loginActivity.findFirstOrThrow({ where: { result: "failure" } });
    expect(trace.method).toBe("google");
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

  /* Un compte en cours de suppression OUVRE une session par cette voie aussi.
   *
   * La refuser ici laisserait sans recours quiconque s'est inscrit par Google
   * ou Apple : le délai de grâce ne protégerait alors que de notre lenteur, et
   * seul un administrateur pourrait rétablir le compte.
   *
   * La session ouverte n'ouvre qu'une porte — la garde le tient, éprouvé dans
   * `compte-annulation`. Et l'échéance voyage avec, sans quoi l'écran
   * afficherait son accueil habituel dont tout échouerait en 403. */
  it("un compte en cours de suppression ouvre une session, qui dit jusqu'à quand", async () => {
    await db.prisma.federatedIdentity.create({
      data: { userId, provider: "google", providerUserId: "g-1" },
    });
    await db.prisma.user.update({
      where: { id: userId },
      data: { status: "pending_deletion", deletionRequestedAt: new Date() },
    });
    const svc = build(verifier({ providerUserId: "g-1", email: "awa@example.com", emailVerified: true }));
    const issue = await svc.signIn({ provider: "google", idToken: "x" });

    expect(issue.outcome).toBe("session");
    expect((issue as { deletionPendingUntil: string | null }).deletionPendingUntil).toBeTruthy();
  });

  // Un compte SUSPENDU, lui, n'a rien à faire dans l'application : la liste des
  // états admis ne le porte pas, et un état ajouté demain arrivera dehors.
  it("un compte suspendu ne reçoit jamais de jetons", async () => {
    await db.prisma.federatedIdentity.create({
      data: { userId, provider: "google", providerUserId: "g-1" },
    });
    await db.prisma.user.update({ where: { id: userId }, data: { status: "suspended" } });
    const svc = build(verifier({ providerUserId: "g-1", email: "awa@example.com", emailVerified: true }));
    await expect(svc.signIn({ provider: "google", idToken: "x" }))
      .rejects.toMatchObject({ code: "account_suspended" });
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

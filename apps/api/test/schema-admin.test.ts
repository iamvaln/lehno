import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";

describe("schéma — administration", () => {
  let db: TestDb;
  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  beforeEach(async () => { await resetDatabase(db.prisma); });
  afterAll(async () => { await db.close(); });

  const admin = (over: Record<string, unknown> = {}) => ({
    email: "sam@lehno.app", displayName: "Sam", ...over,
  });

  it("l'adresse d'un admin est unique sans égard à la casse", async () => {
    await db.prisma.admin.create({ data: admin() });
    await expect(
      db.prisma.admin.create({ data: admin({ email: "SAM@LEHNO.APP" }) }),
    ).rejects.toThrow();
  });

  it("le rôle vaut support par défaut", async () => {
    const cree = await db.prisma.admin.create({ data: admin() });
    expect(cree.role).toBe("support");
    expect(cree.isActive).toBe(true);
  });

  // « Sans motif, la requête échoue » (spec technique §7). La règle vit dans la
  // base, pas dans le service : une écriture par un autre chemin — une reprise
  // manuelle, un script de migration — ne doit pas pouvoir laisser un geste
  // d'administration sans sa raison.
  it("une action d'administration sans motif est refusée par la base", async () => {
    const sam = await db.prisma.admin.create({ data: admin() });
    await expect(
      db.prisma.auditLog.create({
        data: { actorType: "admin", actorId: sam.id, action: "credit_adjust" },
      }),
    ).rejects.toThrow();
  });

  it("la même action avec son motif est acceptée", async () => {
    const sam = await db.prisma.admin.create({ data: admin() });
    const entree = await db.prisma.auditLog.create({
      data: {
        actorType: "admin", actorId: sam.id, action: "credit_adjust",
        reason: "Génération échouée de notre fait, crédit rendu",
      },
    });
    expect(entree.reason).toContain("crédit rendu");
  });

  // Le journal couvre aussi les gestes d'un utilisateur sur ses propres données
  // (dictionnaire : actor_type = admin | user). Ceux-là n'ont pas de motif à
  // fournir : personne ne se justifie d'agir chez soi.
  it("une action d'utilisateur n'exige pas de motif", async () => {
    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa", referralCode: "AWA1" },
    });
    const entree = await db.prisma.auditLog.create({
      data: { actorType: "user", actorId: u.id, action: "data_delete" },
    });
    expect(entree.reason).toBeNull();
  });

  it("supprimer un admin efface ses codes et ses sessions", async () => {
    const sam = await db.prisma.admin.create({ data: admin() });
    await db.prisma.adminOtpCode.create({
      data: {
        adminId: sam.id, targetEmail: "sam@lehno.app", codeHash: "h",
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await db.prisma.adminRefreshToken.create({
      data: {
        adminId: sam.id, familyId: crypto.randomUUID(), tokenHash: "t",
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await db.prisma.admin.delete({ where: { id: sam.id } });

    expect(await db.prisma.adminOtpCode.count()).toBe(0);
    expect(await db.prisma.adminRefreshToken.count()).toBe(0);
  });

  // La frontière posée par le propriétaire : deux systèmes de comptes, aucune
  // table partagée. Une frontière qu'aucun test ne garde finit par se franchir.
  it("aucune table d'administration ne référence un utilisateur", async () => {
    const liens = await db.prisma.$queryRawUnsafe<{ table: string; cible: string }[]>(`
      SELECT c.conrelid::regclass::text AS table, c.confrelid::regclass::text AS cible
      FROM pg_constraint c
      WHERE c.contype = 'f'
        AND c.conrelid::regclass::text IN ('admin_otp_code', 'admin_refresh_token', 'admin')
    `);
    expect(liens.length).toBeGreaterThan(0);
    for (const lien of liens) expect(lien.cible).not.toBe("\"user\"");
    for (const lien of liens) expect(lien.cible).not.toBe("user");
  });
});

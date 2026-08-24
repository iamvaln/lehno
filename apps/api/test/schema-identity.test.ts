import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";

describe("schéma — identité", () => {
  let db: TestDb;
  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  beforeEach(async () => { await resetDatabase(db.prisma); });
  afterAll(async () => { await db.close(); });

  const user = (over: Record<string, unknown> = {}) => ({
    email: "awa@example.com", username: "awa", referralCode: "AWA123", ...over,
  });

  it("l'adresse est unique sans égard à la casse", async () => {
    await db.prisma.user.create({ data: user() });
    await expect(
      db.prisma.user.create({ data: user({ email: "AWA@EXAMPLE.COM", username: "awa2", referralCode: "AWA124" }) }),
    ).rejects.toThrow();
  });

  it("le pseudo est unique sans égard à la casse", async () => {
    await db.prisma.user.create({ data: user() });
    await expect(
      db.prisma.user.create({ data: user({ email: "b@example.com", username: "AWA", referralCode: "B1" }) }),
    ).rejects.toThrow();
  });

  it("le thème vaut « system » par défaut et la langue « fr »", async () => {
    const u = await db.prisma.user.create({ data: user() });
    expect(u.theme).toBe("system");
    expect(u.uiLanguage).toBe("fr");
    expect(u.sendHour).toBe(9);
  });

  it("une identité externe ne pointe que vers un compte", async () => {
    const a = await db.prisma.user.create({ data: user() });
    const b = await db.prisma.user.create({ data: user({ email: "b@example.com", username: "b", referralCode: "B1" }) });
    const identity = { provider: "google" as const, providerUserId: "g-1" };
    await db.prisma.federatedIdentity.create({ data: { ...identity, userId: a.id } });
    await expect(
      db.prisma.federatedIdentity.create({ data: { ...identity, userId: b.id } }),
    ).rejects.toThrow();
  });

  it("supprimer un compte emporte ses jetons de rafraîchissement", async () => {
    const u = await db.prisma.user.create({ data: user() });
    await db.prisma.refreshToken.create({
      data: { userId: u.id, familyId: crypto.randomUUID(), tokenHash: "x".repeat(64),
              expiresAt: new Date(Date.now() + 86_400_000) },
    });
    await db.prisma.user.delete({ where: { id: u.id } });
    expect(await db.prisma.refreshToken.count()).toBe(0);
  });

  it("la liste d'attente refuse deux fois la même adresse", async () => {
    await db.prisma.waitlistSignup.create({
      data: { email: "x@example.com", emailCanonical: "x@example.com", locale: "fr" },
    });
    await expect(
      db.prisma.waitlistSignup.create({
        data: { email: "X@EXAMPLE.COM", emailCanonical: "x@example.com", locale: "en" },
      }),
    ).rejects.toThrow();
  });

  // La contrainte sur la forme canonique se tient toute seule : deux adresses
  // littéralement différentes, mais désignant la même boîte, sont refusées par
  // la base — pas seulement par le service qui la précède.
  it("la liste d'attente refuse deux adresses qui désignent la même boîte", async () => {
    await db.prisma.waitlistSignup.create({
      data: { email: "x+un@example.com", emailCanonical: "x@example.com", locale: "fr" },
    });
    await expect(
      db.prisma.waitlistSignup.create({
        data: { email: "x+deux@example.com", emailCanonical: "x@example.com", locale: "fr" },
      }),
    ).rejects.toThrow();
  });

  it("supprimer un compte laisse survivre sa trace d'inscription par appareil, sans identité", async () => {
    const u = await db.prisma.user.create({ data: user() });
    await db.prisma.deviceSignup.create({ data: { deviceId: "device-1", userId: u.id } });

    await db.prisma.user.delete({ where: { id: u.id } });

    const signups = await db.prisma.deviceSignup.findMany({ where: { deviceId: "device-1" } });
    expect(signups).toHaveLength(1);
    expect(signups[0]?.userId).toBeNull();
  });

  // GARDE-FOU — `prisma migrate dev --create-only` ne connaît ni `citext` ni
  // `inet` : à chaque nouvelle migration, il compare l'état réel de la base
  // (où ces types ont été posés à la main) à ce que dit schema.prisma (qui ne
  // peut PAS les exprimer), et il en conclut — à tort — qu'il faut "corriger"
  // une dérive. Le SQL généré propose alors de repasser email/username/etc.
  // en `text` et de supprimer les colonnes `ip`. Ça s'est déjà produit deux
  // fois pendant la tâche 6 ; les tâches 7, 8 et 17 ajoutent chacune une
  // migration et retomberont dessus. Voir prisma/README.md.
  //
  // Si ces lignes fautives ne sont pas retirées du SQL généré avant de
  // l'appliquer, l'unicité insensible à la casse de l'adresse et du pseudo
  // disparaît EN SILENCE : deux comptes "awa@…" et "AWA@…" redeviennent
  // possibles. Les tests plus haut dans ce fichier ne le détecteraient pas
  // à coup sûr après coup, parce qu'ils testent un comportement observable
  // à un instant donné, pas le type de colonne qui le garantit dans le
  // temps. Ce test-ci épingle le type lui-même : s'il devient rouge, la
  // cause n'est presque certainement PAS une régression applicative mais
  // une migration qui a défait du SQL écrit à la main — c'est ce qu'il faut
  // vérifier en premier, pas chercher ailleurs.
  it("les types citext et inet posés à la main survivent aux migrations", async () => {
    const columnType = async (table: string, column: string): Promise<string | undefined> => {
      const rows = await db.prisma.$queryRaw<{ udt_name: string }[]>`
        select udt_name from information_schema.columns
        where table_schema = 'public' and table_name = ${table} and column_name = ${column}
      `;
      return rows[0]?.udt_name;
    };

    const citextColumns: [string, string][] = [
      ["user", "email"],
      ["user", "username"],
      ["otp_code", "target_email"],
      ["federated_identity", "email_at_link"],
      ["login_activity", "attempted_email"],
      ["waitlist_signup", "email"],
    ];
    for (const [table, column] of citextColumns) {
      expect(await columnType(table, column), `${table}.${column} devrait être citext`).toBe("citext");
    }

    const inetColumns: [string, string][] = [
      ["device_signup", "ip"],
      ["login_activity", "ip"],
      ["refresh_token", "ip"],
    ];
    for (const [table, column] of inetColumns) {
      expect(await columnType(table, column), `${table}.${column} devrait être inet`).toBe("inet");
    }
  });
});

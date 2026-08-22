import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withDatabase, type TestDb } from "./db.js";

describe("harnais de base", () => {
  let db: TestDb;
  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });

  it("lève une base et y applique les migrations", async () => {
    const rows = await db.prisma.$queryRaw<{ table_name: string }[]>`
      select table_name from information_schema.tables where table_schema = 'public'
    `;
    expect(rows.length).toBeGreaterThan(0);
  });

  it("l'extension citext est présente", async () => {
    const rows = await db.prisma.$queryRaw<{ extname: string }[]>`
      select extname from pg_extension where extname = 'citext'
    `;
    expect(rows).toHaveLength(1);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetDatabase, withDatabase, type TestDb } from "./db.js";

let db: TestDb;
beforeAll(async () => { db = await withDatabase(); }, 120_000);
afterAll(async () => { await db.close(); });

describe("harnais de base", () => {
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

describe("resetDatabase", () => {
  // Deux tables SQL brutes, hors schéma Prisma : le schéma ne porte encore
  // aucune table métier. La clé étrangère est le cas qui fait échouer un
  // truncate mal formé (sans "cascade", ou dans le mauvais ordre).
  beforeAll(async () => {
    await db.prisma.$executeRawUnsafe(`
      create table reset_test_parent (
        id serial primary key,
        name text not null
      )
    `);
    await db.prisma.$executeRawUnsafe(`
      create table reset_test_child (
        id serial primary key,
        parent_id integer not null references reset_test_parent(id),
        label text not null
      )
    `);
  });

  afterAll(async () => {
    await db.prisma.$executeRawUnsafe(`drop table if exists reset_test_child`);
    await db.prisma.$executeRawUnsafe(`drop table if exists reset_test_parent`);
  });

  it("vide les tables, y compris à travers une clé étrangère", async () => {
    await db.prisma.$executeRawUnsafe(`insert into reset_test_parent (name) values ('a'), ('b')`);
    await db.prisma.$executeRawUnsafe(`insert into reset_test_child (parent_id, label) values (1, 'x'), (2, 'y')`);

    await resetDatabase(db.prisma);

    const parents = await db.prisma.$queryRaw<{ id: number }[]>`select id from reset_test_parent`;
    const children = await db.prisma.$queryRaw<{ id: number }[]>`select id from reset_test_child`;
    expect(parents).toHaveLength(0);
    expect(children).toHaveLength(0);
  });

  it("ne lève pas quand la base est déjà vide", async () => {
    await expect(resetDatabase(db.prisma)).resolves.not.toThrow();
  });
});

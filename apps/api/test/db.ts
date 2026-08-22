import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";

export type TestDb = { prisma: PrismaClient; url: string; close: () => Promise<void> };

export async function withDatabase(): Promise<TestDb> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer("postgres:16-alpine").start();
  try {
    const url = container.getConnectionUri();
    // migrate deploy plutôt que db push : on veut tester les migrations réelles,
    // y compris le SQL écrit à la main que Prisma n'exprime pas.
    execFileSync("pnpm", ["prisma", "migrate", "deploy"], {
      env: { ...process.env, DATABASE_URL: url },
      stdio: "inherit",
    });
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    return {
      prisma,
      url,
      close: async () => { await prisma.$disconnect(); await container.stop(); },
    };
  } catch (error) {
    // Le conteneur ne doit pas survivre à un échec de migration : sans ça,
    // chaque erreur de SQL écrit à la main en laisse un derrière elle.
    await container.stop();
    throw error;
  }
}

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    select tablename from pg_tables
    where schemaname = 'public' and tablename not like '_prisma%'
  `;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`truncate table ${list} restart identity cascade`);
}

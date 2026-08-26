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

// Décision d'architecture (tâche 7, ratifiée) : `resetDatabase` vide
// l'ÉTAT DE TEST entre deux cas, mais préserve les DONNÉES DE RÉFÉRENCE —
// celles qu'une migration amorce une fois pour toutes et que l'utilisateur
// n'édite jamais. `category` (les sept catégories fixes du système) en est
// la première : elle n'est semée qu'à `withDatabase()`, jamais rejouée
// ensuite, donc la vider la rendrait indisponible dès le premier
// `resetDatabase()` d'un fichier — pas seulement dans ce fichier-ci, mais
// dans tous les tests à venir des onze tâches qui partagent ce harnais.
//
// Toute future table amorcée par une migration (un autre référentiel fixe,
// une table de configuration système) doit rejoindre cet ensemble au
// moment où elle est introduite. Sans quoi le premier test qui en dépend
// échouera de façon incompréhensible — comme celui-ci avant que la table
// n'y soit ajoutée.
//
// `system_parameter` (tâche 8) suit la même règle : amorcée une fois pour
// toutes par la migration `notifications`, jamais rejouée ensuite — la
// vider la rendrait indisponible dès le premier `resetDatabase()`.
// `credit_bundle` de même : les cinq paliers de départ sont semés par la
// migration des paiements et jamais rejoués. Les vider laisserait
// l'application sans rien à proposer à l'achat, et un test qui ajuste un
// palier déciderait du point de départ du suivant.
const REFERENCE_TABLES = new Set(["category", "system_parameter", "credit_bundle"]);

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    select tablename from pg_tables
    where schemaname = 'public' and tablename not like '_prisma%'
  `;
  const toTruncate = tables.filter((t) => !REFERENCE_TABLES.has(t.tablename));
  if (toTruncate.length === 0) return;
  const list = toTruncate.map((t) => `"public"."${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`truncate table ${list} restart identity cascade`);
}

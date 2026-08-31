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
/* `audit_reason` et ses portées rejoignent l'ensemble : elles sont semées une
   fois par la migration du module, avec les libellés du kit, et jamais
   rejouées. Les vider laisserait chaque geste d'administration sans motif à
   proposer — et le premier test qui en dépend échouerait de façon
   incompréhensible.

   Leurs tables d'HISTORIQUE les suivent, et pour une raison propre : un index
   unique partiel garantit une seule version ouverte par ligne. Vider
   l'historique en gardant les entités laisserait des lignes de configuration
   sans version en vigueur — un état que la base n'accepte de nulle part
   ailleurs, et qu'on n'a aucune raison de fabriquer dans les tests. */
const REFERENCE_TABLES = new Set([
  "category", "system_parameter", "credit_bundle",
  "audit_reason", "audit_reason_scope",
  "audit_reason_history", "audit_reason_scope_history",
]);

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

/**
 * Écrit une configuration en posant le motif que le déclencheur d'historisation
 * exige.
 *
 * Les fixtures en ont besoin depuis que les tables de configuration sont
 * historisées : sans motif, la base REFUSE l'écriture. On ne pose pas de motif
 * par défaut sur la connexion de test — ce serait masquer, dans les tests
 * mêmes, l'oubli qu'on veut voir tomber en production.
 */
export async function avecMotif<T>(
  prisma: PrismaClient,
  motif: string,
  ecriture: (tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) => Promise<T>,
  code?: string,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`select set_config('app.reason', ${motif}, true),
                              set_config('app.reason_code', ${code ?? ""}, true)`;
    return ecriture(tx);
  });
}

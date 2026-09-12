import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";

/* LE CONTENEUR DE LA COURSE, LEVÉ UNE SEULE FOIS.
 *
 * Chaque fichier d'épreuve levait le sien et y rejouait les migrations. Avec
 * 105 fichiers appelants et 66 migrations, cela faisait SIX MILLE NEUF CENT
 * TRENTE exécutions de migration par course : une heure de montage pour
 * quelques minutes d'assertions. Sur une machine à 8 Go dont la VM Docker prend
 * 4,1, le `beforeAll` frôlait son délai de 120 s, et deux fichiers tombaient au
 * hasard à chaque course sans qu'aucun code ne soit en cause. Un rouge qu'on
 * relance sans lire est l'habitude qui fait passer un vrai défaut pour un
 * caprice.
 *
 * POURQUOI ICI ET PAS DANS `db.ts` : une variable de module n'y survivrait pas.
 * Vitest ISOLE les modules par fichier — même avec `singleFork`, chaque fichier
 * repart d'un registre neuf, et le singleton se reconstruisait donc à chaque
 * fois. Éprouvé : quatre fichiers, quatre applications de migrations. Le
 * `globalSetup`, lui, tourne dans le processus principal, avant que le worker
 * n'existe, et une fois par course.
 *
 * L'URI passe par l'ENVIRONNEMENT plutôt que par `provide`/`inject` : les
 * workers sont engendrés APRÈS ce montage et en héritent, et cela laisse
 * `withDatabase()` utilisable telle quelle par les 105 fichiers, sans toucher
 * un seul d'entre eux.
 */
export const VARIABLE = "LEHNO_TEST_PG_URI";
export const MODELE = "modele";

/** L'URI du conteneur, réécrite pour viser une autre base que celle par défaut. */
export function urlDe(uri: string, base: string): string {
  const u = new URL(uri);
  u.pathname = `/${base}`;
  return u.toString();
}

let conteneur: StartedPostgreSqlContainer | null = null;

export async function setup(): Promise<void> {
  conteneur = await new PostgreSqlContainer("postgres:16-alpine").start();
  const uri = conteneur.getConnectionUri();
  try {
    /* Le modèle a SA base à lui, et ce n'est pas cosmétique : une base qui sert
       de modèle ne doit avoir AUCUNE connexion ouverte au moment du clonage, et
       celle par défaut en garde — c'est par elle qu'on lance les clonages. */
    const administration = new PrismaClient({ datasources: { db: { url: uri } } });
    await administration.$executeRawUnsafe(`create database "${MODELE}"`);
    await administration.$disconnect();

    // migrate deploy plutôt que db push : on veut éprouver les migrations
    // réelles, y compris le SQL écrit à la main que Prisma n'exprime pas.
    execFileSync("pnpm", ["prisma", "migrate", "deploy"], {
      env: { ...process.env, DATABASE_URL: urlDe(uri, MODELE) },
      stdio: "inherit",
    });
  } catch (echec) {
    // Le conteneur ne doit pas survivre à un échec de migration : sans ça,
    // chaque erreur de SQL écrit à la main en laisse un derrière elle.
    await conteneur.stop();
    conteneur = null;
    throw echec;
  }
  process.env[VARIABLE] = uri;
}

export async function teardown(): Promise<void> {
  await conteneur?.stop();
  conteneur = null;
}

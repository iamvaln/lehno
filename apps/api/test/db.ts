import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { MODELE, VARIABLE, urlDe } from "./socle.js";

export type TestDb = { prisma: PrismaClient; url: string; close: () => Promise<void> };

/* UNE BASE NEUVE PAR FICHIER — CLONÉE, PLUS RECONSTRUITE.
 *
 * Le conteneur et les migrations appartiennent maintenant au `globalSetup`
 * (`socle.ts`), qui dit pourquoi. Il ne reste ici que le clonage.
 *
 * CE QUI NE CHANGE PAS : chaque fichier reçoit toujours une base VIERGE, données
 * de référence comprises. L'isolation entre fichiers n'est pas assouplie — c'est
 * elle qui empêche qu'un fichier basculant un drapeau empoisonne le suivant, et
 * `resetDatabase` ne la donnerait pas, puisqu'il PRÉSERVE délibérément les
 * tables de référence.
 *
 * CE QUI CHANGE : `CREATE DATABASE … TEMPLATE` copie les fichiers du modèle.
 * Postgres ne rejoue aucune migration — des millisecondes au lieu d'une
 * vingtaine de secondes.
 */
export async function withDatabase(): Promise<TestDb> {
  const uri = process.env[VARIABLE];
  /* Sans socle, on ne se débrouille pas en silence : un fichier lancé hors de
     la configuration lèverait son propre conteneur, et la course redeviendrait
     lente sans que personne ne s'en aperçoive. Mieux vaut dire ce qui manque. */
  if (uri === undefined) {
    throw new Error(
      `${VARIABLE} absente : le socle des épreuves n'a pas tourné. `
      + "Lancez par `pnpm test` — `globalSetup` y lève le conteneur une fois pour toute la course.",
    );
  }

  /* UN NOM TIRÉ AU SORT, ET NON UN COMPTEUR. Vitest isole les modules par
     fichier : un compteur de module repartirait de zéro à chaque fichier, et
     deux fichiers se disputeraient le même nom de base. */
  const base = `t_${randomBytes(8).toString("hex")}`;

  /* On passe par la base par défaut pour créer le clone : `CREATE DATABASE …
     TEMPLATE` exige qu'AUCUNE session ne soit connectée au modèle, et s'y
     connecter pour lancer la copie serait précisément la session qui l'empêche. */
  const administration = new PrismaClient({ datasources: { db: { url: urlDe(uri, "postgres") } } });
  try {
    await administration.$executeRawUnsafe(`create database "${base}" template "${MODELE}"`);
  } finally {
    await administration.$disconnect();
  }

  const url = urlDe(uri, base);
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  return {
    prisma,
    url,
    /* La base clonée s'efface : le conteneur vit toute la course, et cent bases
       s'y accumuleraient. `with (force)` coupe les connexions qu'une application
       Nest mal refermée laisserait derrière elle — sans lui, un seul fichier
       distrait ferait échouer tous les ménages suivants. */
    close: async () => {
      await prisma.$disconnect();
      const menage = new PrismaClient({ datasources: { db: { url: urlDe(uri, "postgres") } } });
      try {
        await menage.$executeRawUnsafe(`drop database if exists "${base}" with (force)`);
      } finally {
        await menage.$disconnect();
      }
    },
  };
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

/* L'ÉTREINTE, ET POURQUOI ON RÉESSAIE.
 *
 * Le nettoyage suppose être SEUL sur la base, et il ne l'est pas : plusieurs
 * fichiers d'épreuve démarrent une vraie application Nest, qui ouvre sa propre
 * réserve de connexions vers la même base. Les deux prennent alors les mêmes
 * verrous DANS UN ORDRE DIFFÉRENT — le `truncate` veut un verrou exclusif sur
 * chaque table, une requête en vol tient un verrou partagé sur une autre — et
 * PostgreSQL tue l'un des deux au hasard : « deadlock detected », code 40P01.
 *
 * C'est arrivé une fois sur 1 632 épreuves, sur `person.test.ts`, qui passe
 * seul. Un rouge aléatoire à cet endroit coûte plus que sa rareté ne le dit :
 * `pnpm test` garde la porte avant chaque déploiement, et un échec qu'on
 * relance sans lire est exactement l'habitude qui fait passer un vrai défaut
 * pour un caprice.
 *
 * ON RÉESSAIE PLUTÔT QUE D'ATTENDRE LE SILENCE. Une étreinte se défait d'elle-
 * même dès que la requête concurrente se termine ; vingt millisecondes plus
 * tard, le verrou est libre. Le `lock_timeout` borne l'attente pour que le
 * refus arrive vite au lieu de retenir la suite.
 *
 * ET RIEN D'AUTRE N'EST RATTRAPÉ : seuls `40P01` et `55P03` — l'étreinte et le
 * verrou non obtenu — sont repris. Une table manquante, une migration oubliée,
 * une base absente remontent telles quelles. Un `catch` large ferait de ce
 * garde-fou un tapis. */
const ETREINTES = ["40P01", "55P03"];
const TENTATIVES = 3;

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    select tablename from pg_tables
    where schemaname = 'public' and tablename not like '_prisma%'
  `;
  const toTruncate = tables.filter((t) => !REFERENCE_TABLES.has(t.tablename));
  if (toTruncate.length === 0) return;
  const list = toTruncate.map((t) => `"public"."${t.tablename}"`).join(", ");

  for (let essai = 1; essai <= TENTATIVES; essai += 1) {
    try {
      /* Posé sur la MÊME connexion que le `truncate`, dans la même transaction :
         `set local` ne vaut que le temps de celle-ci, et ne laisse donc pas un
         réglage traîner sur une connexion que la réserve recyclera. */
      await prisma.$transaction([
        prisma.$executeRawUnsafe("set local lock_timeout = '2s'"),
        prisma.$executeRawUnsafe(`truncate table ${list} restart identity cascade`),
      ]);
      return;
    } catch (echec: unknown) {
      const code = (echec as { meta?: { code?: string }; code?: string })?.meta?.code
        ?? (echec as { code?: string })?.code;
      if (essai === TENTATIVES || !ETREINTES.includes(String(code))) throw echec;
      await new Promise((fini) => setTimeout(fini, 20 * essai));
    }
  }
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

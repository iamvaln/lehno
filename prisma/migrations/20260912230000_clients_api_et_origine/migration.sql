-- SAVOIR QUI NOUS APPELLE, ET AVEC QUELLE VERSION.
--
-- Quand un incident arrive, la première question est toujours la même : qui
-- appelait, depuis quelle application, dans quelle version. On ne pouvait y
-- répondre pour AUCUNE requête — `login_activity` note les connexions,
-- `audit_log` les gestes d'administration, et entre les deux les appels
-- ordinaires ne laissaient aucune trace de leur origine.
--
-- Voir `specs/plan-tracabilite-des-clients-2026-09-12.md`.

-- ─── LE CLIENT ENREGISTRÉ ────────────────────────────────────────────────────
--
-- SIX, et pas un par build : trois plateformes × deux environnements. La version
-- n'entre pas dans l'identité, elle voyage dans `x-app-version`. Une paire par
-- build permettrait de couper une version précise, mais demanderait d'en créer
-- une à chaque publication.
--
-- LA CLÉ EST STOCKÉE HACHÉE et ne se relit jamais : une clé perdue se remplace.
-- Et elle n'est pas une frontière de sécurité — une clé livrée dans un binaire
-- s'extrait. Ce qu'elle apporte est de se RÉVOQUER sans changer l'identifiant,
-- donc sans casser la comparaison des chiffres dans le temps.
CREATE TYPE "api_client_type" AS ENUM ('mobile_ios', 'mobile_android', 'web');
CREATE TYPE "api_client_env"  AS ENUM ('dev', 'staging', 'prod');

CREATE TABLE "api_client" (
    "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id"   VARCHAR(64) NOT NULL,
    "label"       VARCHAR(100) NOT NULL,
    "client_type" "api_client_type" NOT NULL,
    "environment" "api_client_env" NOT NULL,
    "key_hash"    VARCHAR(64) NOT NULL,
    "is_active"   BOOLEAN NOT NULL DEFAULT true,
    "rotated_at"  TIMESTAMPTZ,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "api_client_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_client_client_id_key" ON "api_client"("client_id");
CREATE INDEX "api_client_is_active_idx" ON "api_client"("is_active");

-- ─── L'ORIGINE, SUR TOUT CE QUI EST HISTORISÉ ────────────────────────────────
--
-- La règle : une ligne qu'on relira un jour pour comprendre ce qui s'est passé
-- DIT D'OÙ ELLE VIENT. `login_activity` montrait déjà la forme avec son `ip` et
-- son `user_agent` ; il lui manquait de quelle application et dans quelle
-- version.
--
-- NULLABLES POUR DE BON, pas le temps d'une migration : les lignes d'avant ce
-- jour n'ont pas cette information, et rien ne peut l'inventer. Leur poser une
-- valeur courante serait pire qu'un trou — ce serait une donnée fausse, et une
-- lecture la compterait.
--
-- `os_name` ET `os_version` SÉPARÉS, jamais la chaîne composée : `x-app-os`
-- arrive en `ios:17.4` et se découpe une fois, au bord. Une lecture qui
-- oublierait de découper compterait `ios:17.4` et `ios:17.5` comme deux
-- systèmes différents.
ALTER TABLE "login_activity"
  ADD COLUMN "client_id"   VARCHAR(64),
  ADD COLUMN "client_type" VARCHAR(20),
  ADD COLUMN "app_version" VARCHAR(20),
  ADD COLUMN "os_name"     VARCHAR(20),
  ADD COLUMN "os_version"  VARCHAR(20);
ALTER TABLE "audit_log"
  ADD COLUMN "client_id"   VARCHAR(64),
  ADD COLUMN "client_type" VARCHAR(20),
  ADD COLUMN "app_version" VARCHAR(20),
  ADD COLUMN "os_name"     VARCHAR(20),
  ADD COLUMN "os_version"  VARCHAR(20);
ALTER TABLE "ai_usage"
  ADD COLUMN "client_id"   VARCHAR(64),
  ADD COLUMN "client_type" VARCHAR(20),
  ADD COLUMN "app_version" VARCHAR(20),
  ADD COLUMN "os_name"     VARCHAR(20),
  ADD COLUMN "os_version"  VARCHAR(20);
ALTER TABLE "action_run"
  ADD COLUMN "client_id"   VARCHAR(64),
  ADD COLUMN "client_type" VARCHAR(20),
  ADD COLUMN "app_version" VARCHAR(20),
  ADD COLUMN "os_name"     VARCHAR(20),
  ADD COLUMN "os_version"  VARCHAR(20);
ALTER TABLE "credit_transaction"
  ADD COLUMN "client_id"   VARCHAR(64),
  ADD COLUMN "client_type" VARCHAR(20),
  ADD COLUMN "app_version" VARCHAR(20),
  ADD COLUMN "os_name"     VARCHAR(20),
  ADD COLUMN "os_version"  VARCHAR(20);
ALTER TABLE "payment"
  ADD COLUMN "client_id"   VARCHAR(64),
  ADD COLUMN "client_type" VARCHAR(20),
  ADD COLUMN "app_version" VARCHAR(20),
  ADD COLUMN "os_name"     VARCHAR(20),
  ADD COLUMN "os_version"  VARCHAR(20);

-- ─── ET L'IP SUR LES DEUX TABLES DE TRANSACTION ──────────────────────────────
--
-- ÉCART ASSUMÉ à la doctrine du dépôt : `auth.controller.ts` écrit que l'IP
-- « ne sert qu'à composer la clé du limiteur : elle n'est ni journalisée ni
-- renvoyée ».
--
-- Une transaction n'est pas une requête ordinaire : ELLE SE CONTESTE. En mode
-- semi-manuel, quelqu'un déclare avoir payé, un administrateur décide, et des
-- crédits changent de main. Le jour où deux récits s'opposent, l'origine de la
-- déclaration est souvent la seule chose qui tranche — et elle ne se
-- reconstitue pas après coup. `login_activity` fait déjà ça pour les connexions,
-- avec le même raisonnement.
--
-- `audit_log` NE LA PORTE PAS, et c'est tranché : un geste d'administration
-- porte déjà son auteur et son motif obligatoire, donc le « qui » n'y est jamais
-- en doute. L'IP n'y ajouterait aucune preuve — elle ajouterait de la
-- surveillance du personnel. Et `login_activity` note déjà l'IP quand
-- l'administrateur ouvre sa session.
--
-- `INET` comme sur `login_activity`, jamais `VARCHAR` : le type dit ce que c'est,
-- et Postgres refuse alors ce qui n'est pas une adresse.
ALTER TABLE "credit_transaction" ADD COLUMN "ip" INET;
ALTER TABLE "payment"            ADD COLUMN "ip" INET;

-- Le Studio du portrait : la configuration, ses profils de simulation, ses essais.
--
-- Écrite à la main. `prisma migrate diff` propose ici, en plus de ces tables,
-- une DÉRIVE PRÉEXISTANTE de `develop` — des `citext` relus en `text`, des
-- `updated_at` dont le défaut disparaît, des clés étrangères recréées à
-- l'identique. Rien de tout cela n'appartient à ce chantier : l'embarquer
-- ferait porter à cette migration des changements que son message n'annonce
-- pas, et le jour où l'un d'eux casse, personne ne le chercherait ici.

-- CreateEnum
CREATE TYPE "studio_config_state" AS ENUM ('draft', 'published', 'superseded');

-- CreateTable
CREATE TABLE "studio_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "version" INTEGER,
    "state" "studio_config_state" NOT NULL DEFAULT 'draft',
    "settings" JSONB NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "published_at" TIMESTAMPTZ,
    "published_by_admin_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_profile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "label" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "is_sensitive" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studio_trial" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "studio_config_id" UUID NOT NULL,
    "studio_profile_id" UUID,
    "admin_id" UUID,
    "provider" VARCHAR(40) NOT NULL,
    "model_key" VARCHAR(80) NOT NULL,
    "status" "ai_usage_status" NOT NULL,
    "output" JSONB,
    "cost" DECIMAL(12,6),
    "error_code" VARCHAR(80),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studio_trial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "studio_config_state_created_at_idx" ON "studio_config"("state", "created_at");

-- CreateIndex
CREATE INDEX "studio_config_fingerprint_idx" ON "studio_config"("fingerprint");

-- CreateIndex
CREATE INDEX "studio_trial_studio_config_id_idx" ON "studio_trial"("studio_config_id");

-- CreateIndex
CREATE INDEX "studio_trial_status_created_at_idx" ON "studio_trial"("status", "created_at");

-- CreateIndex
CREATE INDEX "studio_trial_created_at_idx" ON "studio_trial"("created_at");

-- Les trois unicités que Prisma ne sait pas exprimer : elles sont PARTIELLES.
--
-- « Exactement une publiée » et « au plus un brouillon » sont les deux
-- invariants du brief fonctionnel §2. Les laisser au code applicatif seul
-- suffirait tant qu'un seul processus écrit ; deux publications simultanées
-- laisseraient deux lignes `published`, et `/me/studio/options` en servirait
-- une au hasard — un défaut qu'on ne saurait pas reproduire. La base tranche,
-- la seconde transaction tombe.
--
-- CreateIndex
CREATE UNIQUE INDEX "studio_config_une_seule_publiee" ON "studio_config"("state") WHERE "state" = 'published';

-- CreateIndex
CREATE UNIQUE INDEX "studio_config_un_seul_brouillon" ON "studio_config"("state") WHERE "state" = 'draft';

-- Le numéro de version ne désigne qu'un seul contenu. Partielle parce qu'une
-- ligne jamais publiée n'en porte pas : sans le `WHERE`, toutes les lignes
-- `NULL`… passeraient (Postgres l'accepte), mais l'index porterait sur des
-- dizaines de brouillons pour rien.
-- CreateIndex
CREATE UNIQUE INDEX "studio_config_version_unique" ON "studio_config"("version") WHERE "version" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "studio_config" ADD CONSTRAINT "studio_config_published_by_admin_id_fkey" FOREIGN KEY ("published_by_admin_id") REFERENCES "admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_trial" ADD CONSTRAINT "studio_trial_studio_config_id_fkey" FOREIGN KEY ("studio_config_id") REFERENCES "studio_config"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_trial" ADD CONSTRAINT "studio_trial_studio_profile_id_fkey" FOREIGN KEY ("studio_profile_id") REFERENCES "studio_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studio_trial" ADD CONSTRAINT "studio_trial_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

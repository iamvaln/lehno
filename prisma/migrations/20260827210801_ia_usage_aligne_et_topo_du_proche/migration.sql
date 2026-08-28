-- CreateEnum
CREATE TYPE "ai_origin" AS ENUM ('user_action', 'scheduled_job', 'retry', 'studio_trial');

-- CreateEnum
CREATE TYPE "action_run_status" AS ENUM ('success', 'failure');

-- CreateEnum
CREATE TYPE "attribute_kind" AS ENUM ('color', 'animal', 'food', 'drink', 'clothing_size', 'shoe_size', 'fragrance', 'style', 'hobby', 'occupation', 'avoid');

-- CreateTable
CREATE TABLE "premium_action" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(40) NOT NULL,
    "label" TEXT NOT NULL,
    "credit_cost" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "premium_action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_run" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "premium_action_id" UUID NOT NULL,
    "event_occurrence_id" UUID,
    "prompt_template_id" UUID,
    "credits_spent" INTEGER NOT NULL,
    "status" "action_run_status" NOT NULL,
    "internal_cost" DECIMAL(12,6),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_attribute" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "person_id" UUID NOT NULL,
    "kind" "attribute_kind" NOT NULL,
    "value" TEXT NOT NULL,
    "note_id" UUID,
    "observed_at" DATE NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "person_attribute_pkey" PRIMARY KEY ("id")
);

-- AlterTable : le genre de celui qui SIGNE, pour l'accord grammatical.
ALTER TABLE "user" ADD COLUMN "gender" "person_gender" DEFAULT 'unspecified';

-- AlterTable : ai_usage aligné sur le dictionnaire.
--
-- DROP puis ADD plutôt que RENAME : la table est VIDE, aucune ligne n'a jamais
-- été écrite. Un renommage n'aurait rien préservé de plus, et aurait coûté
-- quatre instructions séparées.
DROP INDEX "ai_usage_task_created_at_idx";

ALTER TABLE "ai_usage" DROP COLUMN "cost_estimate",
DROP COLUMN "input_tokens",
DROP COLUMN "output_tokens",
DROP COLUMN "task",
ADD COLUMN     "action_run_id" UUID,
ADD COLUMN     "correlation_id" VARCHAR(64),
ADD COLUMN     "cost" DECIMAL(12,6),
ADD COLUMN     "origin" "ai_origin" NOT NULL DEFAULT 'user_action',
ADD COLUMN     "purpose" "ai_task" NOT NULL,
ADD COLUMN     "tokens_in" INTEGER,
ADD COLUMN     "tokens_out" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "premium_action_code_key" ON "premium_action"("code");

-- CreateIndex
CREATE INDEX "action_run_user_id_created_at_idx" ON "action_run"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "action_run_created_at_idx" ON "action_run"("created_at");

-- CreateIndex
CREATE INDEX "person_attribute_person_id_idx" ON "person_attribute"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "person_attribute_person_id_kind_key" ON "person_attribute"("person_id", "kind");

-- CreateIndex
CREATE INDEX "ai_usage_purpose_created_at_idx" ON "ai_usage"("purpose", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_origin_created_at_idx" ON "ai_usage"("origin", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_action_run_id_idx" ON "ai_usage"("action_run_id");

-- AddForeignKey
ALTER TABLE "action_run" ADD CONSTRAINT "action_run_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_run" ADD CONSTRAINT "action_run_premium_action_id_fkey" FOREIGN KEY ("premium_action_id") REFERENCES "premium_action"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_run" ADD CONSTRAINT "action_run_event_occurrence_id_fkey" FOREIGN KEY ("event_occurrence_id") REFERENCES "event_occurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_run" ADD CONSTRAINT "action_run_prompt_template_id_fkey" FOREIGN KEY ("prompt_template_id") REFERENCES "prompt_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_action_run_id_fkey" FOREIGN KEY ("action_run_id") REFERENCES "action_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_attribute" ADD CONSTRAINT "person_attribute_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_attribute" ADD CONSTRAINT "person_attribute_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "note"("id") ON DELETE SET NULL ON UPDATE CASCADE;

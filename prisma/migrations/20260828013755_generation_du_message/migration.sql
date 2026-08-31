-- AlterEnum : l'attente.
--
-- Le dictionnaire n'en prévoit que deux, `success` et `failure`. Il décrit une
-- exécution TERMINÉE ; la §5.4 décrit un parcours — « le lancement débite le
-- crédit et rend aussitôt un identifiant, sans attendre la production ». Sans
-- état d'attente, il n'y a rien à rendre au lancement ni rien à interroger.
--
-- Isolé dans SA PROPRE instruction, avant tout ce qui l'emploie : Postgres
-- refuse d'employer une valeur d'énumération ajoutée dans la même transaction.
ALTER TYPE "action_run_status" ADD VALUE 'pending';

-- CreateEnum
CREATE TYPE "generated_message_status" AS ENUM ('generated', 'edited', 'sent');

-- AlterTable
ALTER TABLE "action_run" ADD COLUMN     "failure_code" VARCHAR(40),
ADD COLUMN     "orientation" VARCHAR(40);

-- CreateTable
CREATE TABLE "generated_message" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "action_run_id" UUID NOT NULL,
    "event_occurrence_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "short_content" TEXT,
    "status" "generated_message_status" NOT NULL DEFAULT 'generated',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "generated_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "generated_message_action_run_id_key" ON "generated_message"("action_run_id");

-- CreateIndex
CREATE INDEX "generated_message_user_id_created_at_idx" ON "generated_message"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "generated_message_event_occurrence_id_idx" ON "generated_message"("event_occurrence_id");

-- AddForeignKey
ALTER TABLE "generated_message" ADD CONSTRAINT "generated_message_action_run_id_fkey" FOREIGN KEY ("action_run_id") REFERENCES "action_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_message" ADD CONSTRAINT "generated_message_event_occurrence_id_fkey" FOREIGN KEY ("event_occurrence_id") REFERENCES "event_occurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_message" ADD CONSTRAINT "generated_message_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

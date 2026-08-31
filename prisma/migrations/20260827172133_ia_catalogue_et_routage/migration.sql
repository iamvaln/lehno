-- CreateEnum
CREATE TYPE "ai_capability" AS ENUM ('text', 'image');

-- CreateEnum
CREATE TYPE "ai_task" AS ENUM ('note_classification', 'sensitive_detection', 'message', 'gift_ideas', 'illustration', 'photo_style');

-- CreateEnum
CREATE TYPE "ai_usage_status" AS ENUM ('success', 'error', 'timeout', 'refused');

-- DropIndex
DROP INDEX "ai_model_enabled_priority_idx";

-- AlterTable
ALTER TABLE "ai_model" DROP COLUMN "priority",
ADD COLUMN     "capability" "ai_capability" NOT NULL DEFAULT 'text',
ADD COLUMN     "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "outage_reason" VARCHAR(200),
ADD COLUMN     "outage_until" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "ai_task_route" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task" "ai_task" NOT NULL,
    "model_id" UUID NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "ai_task_route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "task" "ai_task" NOT NULL,
    "model_id" UUID,
    "provider" VARCHAR(40) NOT NULL,
    "model_key" VARCHAR(80) NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" "ai_usage_status" NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "cost_estimate" DECIMAL(12,6),
    "latency_ms" INTEGER,
    "error_code" VARCHAR(80),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_task_route_task_rank_idx" ON "ai_task_route"("task", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "ai_task_route_task_rank_key" ON "ai_task_route"("task", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "ai_task_route_task_model_id_key" ON "ai_task_route"("task", "model_id");

-- CreateIndex
CREATE INDEX "ai_usage_created_at_idx" ON "ai_usage"("created_at");

-- CreateIndex
CREATE INDEX "ai_usage_task_created_at_idx" ON "ai_usage"("task", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_model_id_created_at_idx" ON "ai_usage"("model_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_user_id_created_at_idx" ON "ai_usage"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_model_enabled_capability_idx" ON "ai_model"("enabled", "capability");

-- AddForeignKey
ALTER TABLE "ai_task_route" ADD CONSTRAINT "ai_task_route_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "ai_model"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

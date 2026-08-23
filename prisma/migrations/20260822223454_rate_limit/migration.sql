-- CreateTable
CREATE TABLE "rate_limit_hit" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(160) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_hit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_limit_hit_key_created_at_idx" ON "rate_limit_hit"("key", "created_at");

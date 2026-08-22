-- Colonnes citext/inet posées à la main, écartées du SQL généré : voir
-- prisma/README.md. Prisma recalcule cette migration en comparant l'état
-- rejoué des migrations (citext/inet) au schéma déclaré (text, faute de
-- support), et propose à tort de défaire ces colonnes. Retiré avant
-- application, comme pour chaque migration précédente.

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('event_reminder', 'event_day_of', 'digest', 'contribution_received', 'wish_received', 'enrichment_nudge_global', 'enrichment_nudge_person', 'generation_ready', 'payment_succeeded', 'payment_failed', 'credits_received', 'login_code', 'security', 'account');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('email', 'push', 'in_app');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'read', 'failed');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('ios', 'android');

-- CreateEnum
CREATE TYPE "ParamValueType" AS ENUM ('number', 'money', 'duration', 'boolean', 'string');

-- CreateEnum
CREATE TYPE "SupportRequestStatus" AS ENUM ('open', 'answered', 'closed');

-- CreateEnum
CREATE TYPE "DataExportStatus" AS ENUM ('pending', 'ready', 'failed', 'expired');

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "event_occurrence_id" UUID,
    "person_id" UUID,
    "channel" "NotificationChannel" NOT NULL,
    "title_key" VARCHAR(64) NOT NULL,
    "body_params" JSONB,
    "target_route" TEXT,
    "dedupe_key" TEXT,
    "scheduled_for" TIMESTAMPTZ,
    "sent_at" TIMESTAMPTZ,
    "read_at" TIMESTAMPTZ,
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preference" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "push_token" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "app_version" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_parameter" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(64) NOT NULL,
    "value" TEXT NOT NULL,
    "value_type" "ParamValueType" NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "system_parameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_request" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "app_version" VARCHAR(20),
    "platform" "DevicePlatform",
    "status" "SupportRequestStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "rating" SMALLINT,
    "body" TEXT,
    "app_version" VARCHAR(20),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_export_request" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "status" "DataExportStatus" NOT NULL DEFAULT 'pending',
    "file_url" TEXT,
    "expires_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_export_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_dedupe_key_key" ON "notification"("dedupe_key");

-- CreateIndex
CREATE INDEX "notification_user_id_read_at_idx" ON "notification"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "notification_status_scheduled_for_idx" ON "notification"("status", "scheduled_for");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preference_user_id_type_key" ON "notification_preference"("user_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "device_user_id_push_token_key" ON "device"("user_id", "push_token");

-- CreateIndex
CREATE UNIQUE INDEX "system_parameter_key_key" ON "system_parameter"("key");

-- CreateIndex
CREATE INDEX "support_request_user_id_idx" ON "support_request"("user_id");

-- CreateIndex
CREATE INDEX "feedback_user_id_idx" ON "feedback"("user_id");

-- CreateIndex
CREATE INDEX "data_export_request_user_id_idx" ON "data_export_request"("user_id");

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_event_occurrence_id_fkey" FOREIGN KEY ("event_occurrence_id") REFERENCES "event_occurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device" ADD CONSTRAINT "device_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_request" ADD CONSTRAINT "support_request_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_export_request" ADD CONSTRAINT "data_export_request_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed : paramètres du socle. Vivent en base et non dans le code : l'admin
-- les change sans redéploiement, et /public/config les sert à la landing.
insert into "system_parameter" ("id", "key", "value", "value_type", "description", "updated_at") values
  (gen_random_uuid(), 'reminder_lead_days_default', '7',  'number', 'Délai d''anticipation par défaut, en jours', now()),
  (gen_random_uuid(), 'wish_window_lead_days',      '7',  'number', 'Ouverture de la fenêtre de vœux avant la date', now()),
  (gen_random_uuid(), 'wish_window_trail_days',     '30', 'number', 'Fermeture de la fenêtre de vœux après la date', now()),
  (gen_random_uuid(), 'max_accounts_per_device',    '3',  'number', 'Plafond de comptes créés depuis un même appareil', now()),
  (gen_random_uuid(), 'account_grace_period_days',  '30', 'number', 'Délai de grâce avant effacement définitif', now()),
  (gen_random_uuid(), 'signup_free_credits',        '5',  'number', 'Crédits offerts à l''inscription', now()),
  (gen_random_uuid(), 'credit_unit_price',          '100','money',  'Prix unitaire du crédit', now());

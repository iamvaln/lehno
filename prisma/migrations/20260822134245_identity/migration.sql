-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'pending_deletion', 'deleted');

-- CreateEnum
CREATE TYPE "UiTheme" AS ENUM ('system', 'light', 'dark');

-- CreateEnum
CREATE TYPE "DigestFrequency" AS ENUM ('monthly', 'weekly', 'never');

-- CreateEnum
CREATE TYPE "OtpReason" AS ENUM ('email_verification', 'login');

-- CreateEnum
CREATE TYPE "IdentityProvider" AS ENUM ('google', 'apple');

-- CreateEnum
CREATE TYPE "LoginResult" AS ENUM ('success', 'failure');

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT NOT NULL,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "referral_code" VARCHAR(16) NOT NULL,
    "referred_by" UUID,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "deletion_requested_at" TIMESTAMPTZ,
    "deletion_reason" TEXT,
    "ui_language" VARCHAR(10) NOT NULL DEFAULT 'fr',
    "theme" "UiTheme" NOT NULL DEFAULT 'system',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "send_hour" SMALLINT NOT NULL DEFAULT 9,
    "digest_frequency" "DigestFrequency" NOT NULL DEFAULT 'monthly',
    "reminder_lead_days" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_code" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "target_email" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "reason" "OtpReason" NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "consumed_at" TIMESTAMPTZ,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "federated_identity" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" "IdentityProvider" NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "email_at_link" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ,

    CONSTRAINT "federated_identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "parent_id" UUID,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "consumed_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_signup" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_id" VARCHAR(128) NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_signup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_activity" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "attempted_email" TEXT,
    "result" "LoginResult" NOT NULL,
    "user_agent" TEXT,
    "geo_approx" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waitlist_signup" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "locale" VARCHAR(10),
    "source" VARCHAR(64),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_signup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_referral_code_key" ON "user"("referral_code");

-- CreateIndex
CREATE INDEX "otp_code_target_email_reason_idx" ON "otp_code"("target_email", "reason");

-- CreateIndex
CREATE UNIQUE INDEX "federated_identity_provider_provider_user_id_key" ON "federated_identity"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "federated_identity_user_id_provider_key" ON "federated_identity"("user_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_token_hash_key" ON "refresh_token"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_token_user_id_revoked_at_idx" ON "refresh_token"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "refresh_token_family_id_idx" ON "refresh_token"("family_id");

-- CreateIndex
CREATE INDEX "device_signup_device_id_idx" ON "device_signup"("device_id");

-- CreateIndex
CREATE INDEX "login_activity_user_id_created_at_idx" ON "login_activity"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_signup_email_key" ON "waitlist_signup"("email");

-- AddForeignKey
ALTER TABLE "otp_code" ADD CONSTRAINT "otp_code_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "federated_identity" ADD CONSTRAINT "federated_identity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_signup" ADD CONSTRAINT "device_signup_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unicité insensible à la casse des adresses et des pseudos
alter table "user"            alter column "email"           type citext;
alter table "user"            alter column "username"        type citext;
alter table "otp_code"        alter column "target_email"    type citext;
alter table "federated_identity" alter column "email_at_link" type citext;
alter table "login_activity"  alter column "attempted_email" type citext;
alter table "waitlist_signup" alter column "email"           type citext;

-- Adresses IP : conservées pour investigation, jamais lues par le client Prisma
alter table "device_signup"   add column "ip" inet;
alter table "login_activity"  add column "ip" inet;
alter table "refresh_token"   add column "ip" inet;

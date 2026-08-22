-- CreateEnum
CREATE TYPE "PersonRegister" AS ENUM ('familier', 'amical', 'formel');

-- CreateEnum
CREATE TYPE "EventKind" AS ENUM ('birthday', 'other');

-- CreateEnum
CREATE TYPE "EventNature" AS ENUM ('happy', 'sensitive');

-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('recurrent', 'offset');

-- CreateEnum
CREATE TYPE "ScheduleUnit" AS ENUM ('day', 'week', 'month', 'quarter', 'year');

-- CreateEnum
CREATE TYPE "OffsetUnit" AS ENUM ('day', 'month');

-- CreateEnum
CREATE TYPE "OccurrenceStatus" AS ENUM ('upcoming', 'collecting', 'closed');

-- CreateEnum
CREATE TYPE "ContentOrigin" AS ENUM ('owner', 'collected');

-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('ponctuelle', 'durable');

-- CreateEnum
CREATE TYPE "AssignmentSource" AS ENUM ('auto', 'user');

-- CreateEnum
CREATE TYPE "WishlistStatus" AS ENUM ('available', 'reserved', 'fulfilled');

-- CreateEnum
CREATE TYPE "WishlistOrigin" AS ENUM ('collected', 'accepted_idea', 'owner');

-- CreateTable
CREATE TABLE "person" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "is_self" BOOLEAN NOT NULL DEFAULT false,
    "register" "PersonRegister",
    "language" VARCHAR(10),
    "relation_hint" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "person_id" UUID NOT NULL,
    "author_user_id" UUID,
    "label" TEXT,
    "kind" "EventKind" NOT NULL DEFAULT 'other',
    "event_nature" "EventNature" NOT NULL DEFAULT 'happy',
    "reference_date" DATE NOT NULL,
    "year_known" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID NOT NULL,
    "type" "ScheduleType" NOT NULL,
    "unit" "ScheduleUnit",
    "interval" INTEGER,
    "offset_unit" "OffsetUnit",
    "offset_amount" INTEGER,
    "lead_time_days" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_occurrence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "occurrence_date" DATE NOT NULL,
    "occurrence_year" INTEGER,
    "status" "OccurrenceStatus" NOT NULL DEFAULT 'upcoming',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_occurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "person_id" UUID NOT NULL,
    "author_user_id" UUID,
    "event_id" UUID,
    "event_occurrence_id" UUID,
    "content" TEXT NOT NULL,
    "origin" "ContentOrigin" NOT NULL DEFAULT 'owner',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(40) NOT NULL,
    "kind" "CategoryKind" NOT NULL,
    "is_constraint" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_category" (
    "note_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "assigned_by" "AssignmentSource" NOT NULL DEFAULT 'auto',

    CONSTRAINT "note_category_pkey" PRIMARY KEY ("note_id","category_id")
);

-- CreateTable
CREATE TABLE "wishlist_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_occurrence_id" UUID NOT NULL,
    "author_user_id" UUID,
    "label" TEXT NOT NULL,
    "image_url" TEXT,
    "details" TEXT,
    "link" TEXT,
    "price" DECIMAL(12,2),
    "currency" VARCHAR(3),
    "status" "WishlistStatus" NOT NULL DEFAULT 'available',
    "origin" "WishlistOrigin" NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wishlist_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "person_user_id_idx" ON "person"("user_id");

-- CreateIndex
CREATE INDEX "event_person_id_idx" ON "event"("person_id");

-- CreateIndex
CREATE INDEX "schedule_event_id_idx" ON "schedule"("event_id");

-- CreateIndex
CREATE INDEX "event_occurrence_user_id_occurrence_date_idx" ON "event_occurrence"("user_id", "occurrence_date");

-- CreateIndex
CREATE UNIQUE INDEX "event_occurrence_event_id_occurrence_date_key" ON "event_occurrence"("event_id", "occurrence_date");

-- CreateIndex
CREATE INDEX "note_person_id_created_at_idx" ON "note"("person_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "category_code_key" ON "category"("code");

-- CreateIndex
CREATE INDEX "wishlist_item_event_occurrence_id_idx" ON "wishlist_item"("event_occurrence_id");

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule" ADD CONSTRAINT "schedule_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_occurrence" ADD CONSTRAINT "event_occurrence_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note" ADD CONSTRAINT "note_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note" ADD CONSTRAINT "note_event_occurrence_id_fkey" FOREIGN KEY ("event_occurrence_id") REFERENCES "event_occurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_category" ADD CONSTRAINT "note_category_note_id_fkey" FOREIGN KEY ("note_id") REFERENCES "note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_category" ADD CONSTRAINT "note_category_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_item" ADD CONSTRAINT "wishlist_item_event_occurrence_id_fkey" FOREIGN KEY ("event_occurrence_id") REFERENCES "event_occurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Une seule fiche de soi par compte. Un index unique ordinaire l'interdirait
-- pour toutes les fiches ; le partiel ne contraint que celles marquées.
create unique index "person_one_self_per_user"
  on "person" ("user_id") where "is_self";

-- Cohérence d'un schedule : récurrent ⇒ unité + intervalle, offset ⇒ unité + quantité
alter table "schedule" add constraint "schedule_shape" check (
  (type = 'recurrent' and unit is not null and interval is not null and interval >= 1)
  or
  (type = 'offset' and offset_unit is not null and offset_amount is not null)
);

-- Le socle des catégories, fixé par le système et non éditable par l'utilisateur
insert into "category" ("id", "code", "kind", "is_constraint") values
  (gen_random_uuid(), 'gift_ideas',     'ponctuelle', false),
  (gen_random_uuid(), 'message_ideas',  'ponctuelle', false),
  (gen_random_uuid(), 'facts',          'ponctuelle', false),
  (gen_random_uuid(), 'encouragements', 'ponctuelle', false),
  (gen_random_uuid(), 'challenges',     'ponctuelle', false),
  (gen_random_uuid(), 'interests',      'durable',    false),
  (gen_random_uuid(), 'dislikes_nogo',  'durable',    true);

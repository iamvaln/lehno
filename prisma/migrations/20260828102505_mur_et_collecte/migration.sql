-- Le Mur et la collecte : la boucle d'acquisition.
--
-- Écrite À LA MAIN plutôt que rendue par `migrate diff`. Le diff porte une
-- dérive préexistante sur develop — des citext ramenés à text, des DEFAULT
-- d'updated_at retirés, une douzaine de clés étrangères détruites puis
-- recréées à l'identique. Rien de cela n'appartient à ce chantier, et
-- l'embarquer ferait passer pour un effet du Mur une correction que personne
-- n'a décidée ici.

-- CreateEnum
CREATE TYPE "collection_link_type" AS ENUM ('nominatif', 'public');

-- CreateEnum
CREATE TYPE "submission_status" AS ENUM ('pending', 'validated', 'rejected');

-- CreateEnum
CREATE TYPE "submitted_wish_review" AS ENUM ('pending', 'retained', 'discarded');

-- CreateEnum
CREATE TYPE "received_wish_status" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
-- FAUX par défaut : rien ne s'expose sans opt-in. Un attribut est extrait
-- d'une note, écrite pour soi — le défaut ne peut pas être l'exposition.
ALTER TABLE "person_attribute" ADD COLUMN "is_public" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "wall" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "show_birthday_date" BOOLEAN NOT NULL DEFAULT true,
    "welcome_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_link" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "collection_link_type" NOT NULL,
    "token" VARCHAR(32) NOT NULL,
    "person_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wish_collection_link" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_occurrence_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" VARCHAR(32) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wish_collection_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "collection_link_id" UUID NOT NULL,
    "submitter_name" TEXT,
    "submitter_email" TEXT,
    "submitter_username" TEXT,
    "relation_hint" TEXT,
    "birth_date" DATE,
    "personal_note" TEXT,
    "status" "submission_status" NOT NULL DEFAULT 'pending',
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submitted_wish" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "submission_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "link" TEXT,
    "price" DECIMAL(12,2),
    "currency" VARCHAR(3),
    "review_status" "submitted_wish_review" NOT NULL DEFAULT 'pending',
    "wishlist_item_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submitted_wish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "received_wish" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_occurrence_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "wish_collection_link_id" UUID,
    "author_user_id" UUID,
    "author_name" TEXT,
    "content" TEXT NOT NULL,
    "status" "received_wish_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "received_wish_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wall_user_id_key" ON "wall"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "collection_link_token_key" ON "collection_link"("token");

-- CreateIndex
CREATE INDEX "collection_link_user_id_idx" ON "collection_link"("user_id");

-- CreateIndex
CREATE INDEX "collection_link_person_id_idx" ON "collection_link"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "wish_collection_link_token_key" ON "wish_collection_link"("token");

-- CreateIndex
CREATE INDEX "wish_collection_link_user_id_idx" ON "wish_collection_link"("user_id");

-- CreateIndex
-- Un seul lien de vœux par occasion : deux jetons vivants pour la même année
-- feraient deux adresses à partager, dont une oubliée et jamais révoquée.
CREATE UNIQUE INDEX "wish_collection_link_event_occurrence_id_key" ON "wish_collection_link"("event_occurrence_id");

-- CreateIndex
CREATE INDEX "submission_user_id_status_idx" ON "submission"("user_id", "status");

-- CreateIndex
CREATE INDEX "submission_collection_link_id_idx" ON "submission"("collection_link_id");

-- CreateIndex
CREATE INDEX "submitted_wish_submission_id_idx" ON "submitted_wish"("submission_id");

-- CreateIndex
CREATE INDEX "received_wish_user_id_status_idx" ON "received_wish"("user_id", "status");

-- CreateIndex
CREATE INDEX "received_wish_event_occurrence_id_idx" ON "received_wish"("event_occurrence_id");

-- AddForeignKey
ALTER TABLE "wall" ADD CONSTRAINT "wall_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_link" ADD CONSTRAINT "collection_link_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_link" ADD CONSTRAINT "collection_link_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wish_collection_link" ADD CONSTRAINT "wish_collection_link_event_occurrence_id_fkey" FOREIGN KEY ("event_occurrence_id") REFERENCES "event_occurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wish_collection_link" ADD CONSTRAINT "wish_collection_link_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission" ADD CONSTRAINT "submission_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission" ADD CONSTRAINT "submission_collection_link_id_fkey" FOREIGN KEY ("collection_link_id") REFERENCES "collection_link"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submitted_wish" ADD CONSTRAINT "submitted_wish_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- SET NULL et non CASCADE : effacer le souhait rangé dans la fiche ne doit pas
-- effacer la trace de ce que le répondant avait envoyé — c'est elle qu'il relit
-- à la réouverture de son lien.
ALTER TABLE "submitted_wish" ADD CONSTRAINT "submitted_wish_wishlist_item_id_fkey" FOREIGN KEY ("wishlist_item_id") REFERENCES "wishlist_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "received_wish" ADD CONSTRAINT "received_wish_event_occurrence_id_fkey" FOREIGN KEY ("event_occurrence_id") REFERENCES "event_occurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "received_wish" ADD CONSTRAINT "received_wish_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- SET NULL : révoquer le lien d'arrivée ne doit pas effacer les vœux déjà reçus.
ALTER TABLE "received_wish" ADD CONSTRAINT "received_wish_wish_collection_link_id_fkey" FOREIGN KEY ("wish_collection_link_id") REFERENCES "wish_collection_link"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "received_wish" ADD CONSTRAINT "received_wish_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

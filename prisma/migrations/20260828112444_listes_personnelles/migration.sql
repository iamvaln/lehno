-- Les listes de souhaits personnelles : ma liste, son partage, et la
-- réservation d'un souhait par un visiteur (drapeaux `wishlist.own` et
-- `reservation`).
--
-- Écrite à la main plutôt qu'engendrée : `prisma migrate diff` rapporte sur
-- `develop` une dérive antérieure (clés étrangères des paiements, du
-- parrainage, des crédits) qui n'appartient pas à ce lot. L'embarquer ici la
-- ferait passer sous un message qui ne l'annonce pas.

-- CreateEnum
CREATE TYPE "reservation_status" AS ENUM ('pending', 'confirmed', 'cancelled', 'expired');

-- AlterEnum
-- Le propriétaire est prévenu de chaque réservation confirmée : c'est ce qui
-- rend la liste vivante après le partage.
ALTER TYPE "NotificationType" ADD VALUE 'wish_reserved';

-- CreateTable
CREATE TABLE "wishlist" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_occurrence_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist_share_link" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "wishlist_id" UUID NOT NULL,
    "token" VARCHAR(32) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_share_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_wish" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event_occurrence_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "link" TEXT,
    "image_url" TEXT,
    "details" TEXT,
    "price" DECIMAL(12,2),
    "currency" VARCHAR(3),
    "status" "WishlistStatus" NOT NULL DEFAULT 'available',
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "position" SMALLINT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "owner_wish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wish_reservation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_wish_id" UUID NOT NULL,
    "user_id" UUID,
    "email" CITEXT NOT NULL,
    "display_name" VARCHAR(80),
    "show_identity" BOOLEAN NOT NULL DEFAULT false,
    "status" "reservation_status" NOT NULL DEFAULT 'pending',
    "code_hash" TEXT,
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "session_token_hash" VARCHAR(64),
    "confirmed_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wish_reservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_event_occurrence_id_key" ON "wishlist"("event_occurrence_id");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_share_link_token_key" ON "wishlist_share_link"("token");

-- CreateIndex
CREATE INDEX "wishlist_share_link_wishlist_id_idx" ON "wishlist_share_link"("wishlist_id");

-- CreateIndex
CREATE INDEX "owner_wish_event_occurrence_id_idx" ON "owner_wish"("event_occurrence_id");

-- CreateIndex
CREATE UNIQUE INDEX "wish_reservation_session_token_hash_key" ON "wish_reservation"("session_token_hash");

-- CreateIndex
CREATE INDEX "wish_reservation_owner_wish_id_idx" ON "wish_reservation"("owner_wish_id");

-- CreateIndex
CREATE INDEX "wish_reservation_user_id_idx" ON "wish_reservation"("user_id");

-- CreateIndex
CREATE INDEX "wish_reservation_email_idx" ON "wish_reservation"("email");

-- CreateIndex
--
-- L'INVARIANT DU LOT, et il n'a pas d'équivalent dans le schéma Prisma, qui ne
-- sait pas exprimer un index unique partiel. Il est donc écrit ici, et c'est la
-- BASE qui garantit qu'un souhait n'est réservé qu'une fois : une vérification
-- préalable en code ne le pourrait pas — deux visiteurs qui confirment en même
-- temps liraient tous deux « disponible » avant que l'un n'écrive.
--
-- Il ne porte que `confirmed`, jamais `pending`. Inclure `pending` laisserait
-- la première demande occuper le souhait, donc une adresse inventée suffirait à
-- bloquer un cadeau : plusieurs demandes en attente coexistent, la première
-- confirmée l'emporte, les autres deviennent caduques.
CREATE UNIQUE INDEX "wish_reservation_confirmee_unique"
    ON "wish_reservation"("owner_wish_id")
    WHERE "status" = 'confirmed';

-- AddForeignKey
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_event_occurrence_id_fkey" FOREIGN KEY ("event_occurrence_id") REFERENCES "event_occurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_share_link" ADD CONSTRAINT "wishlist_share_link_wishlist_id_fkey" FOREIGN KEY ("wishlist_id") REFERENCES "wishlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_wish" ADD CONSTRAINT "owner_wish_event_occurrence_id_fkey" FOREIGN KEY ("event_occurrence_id") REFERENCES "event_occurrence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wish_reservation" ADD CONSTRAINT "wish_reservation_owner_wish_id_fkey" FOREIGN KEY ("owner_wish_id") REFERENCES "owner_wish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wish_reservation" ADD CONSTRAINT "wish_reservation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

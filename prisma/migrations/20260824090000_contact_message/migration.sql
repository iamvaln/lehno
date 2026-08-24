-- Le formulaire de contact. Contrairement à waitlist_signup, cette table
-- n'a pas d'unicité sur l'adresse : deux messages légitimes peuvent venir de
-- la même personne. La colonne "subject" ne porte jamais un texte libre —
-- une des six clés de CONTACT_SUBJECTS (packages/contracts/src/public.ts),
-- validée côté serveur avant l'écriture.
CREATE TABLE "contact_message" (
    "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "name"       TEXT NOT NULL,
    "email"      TEXT NOT NULL,
    "subject"    VARCHAR(32) NOT NULL,
    "message"    TEXT NOT NULL,
    "locale"     VARCHAR(10),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "contact_message_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "contact_message_created_at_idx" ON "contact_message"("created_at");

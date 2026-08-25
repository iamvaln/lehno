-- Écrite à la main plutôt qu'engendrée par `prisma migrate dev` : le schéma
-- porte des types (citext sur waitlist_signup.email) que le diff de Prisma ne
-- connaît pas, et une commande `dev` proposerait de les rétrograder. Voir
-- prisma/migrations/20260823160000_waitlist_email_canonical/migration.sql.
--
-- La table ne porte que l'état d'un drapeau. Le reste (quels drapeaux
-- existent, leur description, leur lisibilité publique) est un fait de code,
-- porté par packages/contracts/src/flags.ts — pas une donnée à dupliquer ici.
CREATE TABLE "feature_flag" (
  "key"        VARCHAR(64) PRIMARY KEY,
  "enabled"    BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

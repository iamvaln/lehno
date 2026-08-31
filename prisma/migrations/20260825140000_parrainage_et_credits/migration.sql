-- Le parrainage, les crédits, et la trace d'acceptation des conditions.
--
-- Écrite à la main plutôt qu'engendrée par `prisma migrate dev` : le schéma
-- porte des types que le diff de Prisma ne connaît pas — citext sur
-- waitlist_signup.email —, et une commande `dev` proposerait de les
-- rétrograder sans que rien ne le signale. Voir
-- prisma/migrations/20260823160000_waitlist_email_canonical/migration.sql.

-- ── L'acceptation des conditions ────────────────────────────────────────────
-- Nullable : les comptes créés avant cette migration n'ont rien accepté
-- d'explicitement tracé, et prétendre le contraire serait faux.
--
-- La VERSION est la moitié utile. Un horodatage seul ne dit pas quel texte a
-- été accepté ; le jour où les conditions changent, il faudrait remonter
-- l'historique du dossier légal pour le reconstituer.
ALTER TABLE "user"
  ADD COLUMN "accepted_terms_at" timestamptz,
  ADD COLUMN "accepted_terms_version" varchar(32);

-- ── Le parrainage ───────────────────────────────────────────────────────────
CREATE TYPE "referral_status" AS ENUM ('invited', 'registered', 'credited');

CREATE TABLE "referral" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "referrer_id"     uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  -- UNIQUE, et c'est l'anti-double-crédit : un filleul ne peut être crédité
  -- qu'une fois, quelle que soit la voie par laquelle il est arrivé. La règle
  -- vit dans le schéma plutôt que dans du code qu'on oublie de relire.
  "invited_user_id" uuid UNIQUE REFERENCES "user"("id") ON DELETE SET NULL,
  "code_used"       varchar(16) NOT NULL,
  "status"          "referral_status" NOT NULL DEFAULT 'invited',
  "created_at"      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "referral_referrer_id_idx" ON "referral" ("referrer_id");

-- ── Les crédits ─────────────────────────────────────────────────────────────
CREATE TYPE "credit_txn_type" AS ENUM ('grant', 'purchase', 'consumption', 'adjustment');

-- Le solde d'un compte est la SOMME de ses mouvements. Aucune colonne de solde
-- n'est stockée, donc aucune ne peut se désynchroniser du registre qui fait
-- foi — c'est le seul moyen de garantir qu'un solde affiché correspond à
-- l'histoire qui l'a produit.
--
-- `action_run_id` et `promo_code_id` du dictionnaire ne figurent pas ici :
-- leurs tables n'existent pas encore, et une colonne sans sa contrainte serait
-- une demi-vérité. Elles arriveront avec ce qu'elles référencent.
CREATE TABLE "credit_transaction" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"     uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "type"        "credit_txn_type" NOT NULL,
  "amount"      integer NOT NULL,
  "referral_id" uuid REFERENCES "referral"("id") ON DELETE SET NULL,
  "reason"      text,
  "created_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "credit_transaction_user_id_created_at_idx"
  ON "credit_transaction" ("user_id", "created_at");

-- Les montants des octrois viennent de system_parameter, jamais du code.
-- `updated_at` est explicite : le @updatedAt de Prisma s'applique côté
-- application, pas côté PostgreSQL, et la colonne est NOT NULL sans défaut.
INSERT INTO "system_parameter" ("key", "value", "value_type", "description", "updated_at")
VALUES
  ('referral_bonus_referrer', '5', 'number', 'Crédits offerts au parrain quand un filleul s''inscrit', now()),
  ('referral_bonus_invited',  '5', 'number', 'Crédits offerts au filleul qui arrive par un code de parrainage', now())
ON CONFLICT ("key") DO NOTHING;

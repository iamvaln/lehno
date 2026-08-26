-- Le socle du paiement.
--
-- Un seul registre : les voies manuelles sont des « payment » ordinaires,
-- distinguées par leur mode. Une table parallèle obligerait à tenir deux
-- historiques et deux chemins d'octroi, et une recharge manuelle
-- n'apparaîtrait pas dans l'historique des paiements du client.

CREATE TYPE "payment_method_kind"   AS ENUM ('mobile_money', 'card');
CREATE TYPE "payment_mode"          AS ENUM ('provider', 'semi_manual', 'manual');
CREATE TYPE "payment_status"        AS ENUM ('pending', 'succeeded', 'failed', 'expired', 'refunded');
CREATE TYPE "payment_direction"     AS ENUM ('charge', 'refund');
CREATE TYPE "fee_bearer"            AS ENUM ('payer', 'payee');
CREATE TYPE "status_change_origin"  AS ENUM ('user', 'webhook', 'polling', 'admin', 'system');

CREATE TABLE "credit_bundle" (
    "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
    "amount"        DECIMAL(12,2) NOT NULL,
    "currency"      VARCHAR(3) NOT NULL DEFAULT 'XAF',
    "credits"       INTEGER NOT NULL,
    "bonus_percent" SMALLINT,
    "position"      SMALLINT NOT NULL,
    "is_active"     BOOLEAN NOT NULL DEFAULT true,
    "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "credit_bundle_pkey" PRIMARY KEY ("id"),
    -- Un palier à zéro crédit, ou à prix nul, serait une offre que personne ne
    -- peut avoir voulue.
    CONSTRAINT "credit_bundle_montant_positif" CHECK ("amount" > 0),
    CONSTRAINT "credit_bundle_credits_positifs" CHECK ("credits" > 0)
);

CREATE TABLE "payment_channel" (
    "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
    "kind"         "payment_method_kind" NOT NULL,
    "operator"     VARCHAR(40) NOT NULL,
    "country"      VARCHAR(2) NOT NULL,
    "label"        VARCHAR(80) NOT NULL,
    "fee_percent"  DECIMAL(5,2) NOT NULL DEFAULT 0,
    "fee_fixed"    DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fee_min"      DECIMAL(12,2),
    "fee_max"      DECIMAL(12,2),
    "fee_borne_by" "fee_bearer" NOT NULL DEFAULT 'payer',
    "currency"     VARCHAR(3) NOT NULL DEFAULT 'XAF',
    "is_active"    BOOLEAN NOT NULL DEFAULT true,
    "position"     SMALLINT,
    "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_channel_pkey" PRIMARY KEY ("id"),
    -- Un plafond sous son plancher rendrait les frais indéterminés.
    CONSTRAINT "payment_channel_bornes_coherentes"
        CHECK ("fee_min" IS NULL OR "fee_max" IS NULL OR "fee_max" >= "fee_min")
);

-- Un opérateur n'a qu'un barème par pays : deux lignes concurrentes rendraient
-- l'aperçu indéterminé, et personne ne saurait laquelle a servi.
CREATE UNIQUE INDEX "payment_channel_operator_country_kind_key"
    ON "payment_channel"("operator", "country", "kind");

CREATE TABLE "collection_account" (
    "id"                 UUID NOT NULL DEFAULT gen_random_uuid(),
    "label"              VARCHAR(80) NOT NULL,
    "operator"           VARCHAR(40) NOT NULL,
    "number"             VARCHAR(32) NOT NULL,
    "is_visible_in_app"  BOOLEAN NOT NULL DEFAULT false,
    "is_active"          BOOLEAN NOT NULL DEFAULT true,
    "position"           SMALLINT,
    "created_at"         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "collection_account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_method" (
    "id"                           UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id"                      UUID NOT NULL,
    "provider_ref"                 TEXT,
    "msisdn"                       TEXT,
    "kind"                         "payment_method_kind" NOT NULL,
    "brand"                        VARCHAR(40),
    "last4"                        VARCHAR(4),
    "expires_at"                   DATE,
    "last_used_at"                 TIMESTAMPTZ,
    "first_successful_payment_at"  TIMESTAMPTZ,
    "created_at"                   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_method_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_method_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
);
CREATE INDEX "payment_method_user_id_last_used_at_idx"
    ON "payment_method"("user_id", "last_used_at");

CREATE TABLE "payment" (
    "id"                    UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id"               UUID NOT NULL,
    "payment_method_id"     UUID,
    "mode"                  "payment_mode" NOT NULL DEFAULT 'provider',
    "credit_bundle_id"      UUID,
    "collection_account_id" UUID,
    "payer_msisdn"          VARCHAR(32),
    "proof_key"             TEXT,
    "provider_ref"          TEXT,
    "payment_channel_id"    UUID,
    "fee_amount"            DECIMAL(12,2),
    "expected_amount"       DECIMAL(12,2),
    "received_amount"       DECIMAL(12,2),
    "direction"             "payment_direction" NOT NULL DEFAULT 'charge',
    "amount"                DECIMAL(12,2) NOT NULL,
    "currency"              VARCHAR(3) NOT NULL,
    "credits"               INTEGER NOT NULL,
    "status"                "payment_status" NOT NULL DEFAULT 'pending',
    "failure_reason"        TEXT,
    "created_at"            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE,
    CONSTRAINT "payment_payment_method_id_fkey"
        FOREIGN KEY ("payment_method_id") REFERENCES "payment_method"("id") ON DELETE SET NULL,
    CONSTRAINT "payment_credit_bundle_id_fkey"
        FOREIGN KEY ("credit_bundle_id") REFERENCES "credit_bundle"("id") ON DELETE SET NULL,
    -- RESTRICT, pas SET NULL : effacer le compte qui a reçu l'argent rendrait
    -- ce paiement inexplicable. Un compte se désactive, il ne se supprime pas.
    CONSTRAINT "payment_collection_account_id_fkey"
        FOREIGN KEY ("collection_account_id") REFERENCES "collection_account"("id") ON DELETE RESTRICT,
    CONSTRAINT "payment_payment_channel_id_fkey"
        FOREIGN KEY ("payment_channel_id") REFERENCES "payment_channel"("id") ON DELETE RESTRICT,
    -- Les montants ne sont jamais négatifs : un remboursement est une DIRECTION,
    -- pas un signe. Les confondre ferait un total faux dès la première somme.
    CONSTRAINT "payment_montants_positifs" CHECK (
        "amount" >= 0
        AND ("fee_amount" IS NULL OR "fee_amount" >= 0)
        AND ("expected_amount" IS NULL OR "expected_amount" >= 0)
        AND ("received_amount" IS NULL OR "received_amount" >= 0)
    ),
    -- Sur les voies manuelles, l'argent arrive forcément quelque part. Sans ce
    -- compte, on ne saurait pas où aller vérifier la réception — et c'est elle,
    -- pas le reçu, qui fait foi.
    CONSTRAINT "payment_voie_manuelle_a_un_compte" CHECK (
        "mode" = 'provider' OR "collection_account_id" IS NOT NULL
    )
);

-- L'unicité porte sur les valeurs PRÉSENTES.
--
-- Attention à la raison : ce n'est PAS pour permettre plusieurs nuls. Postgres
-- traite deux nuls comme distincts dans un index unique, et un index total en
-- admettrait autant qu'on veut — vérifié plutôt que supposé. Le dictionnaire
-- avance cette justification ; elle est fausse.
--
-- La vraie raison est la taille et l'intention. La référence est nulle tant
-- qu'elle n'est pas connue — chez le prestataire elle arrive avec la
-- notification, sur les voies manuelles l'administrateur la consigne à la
-- confirmation — et n'indexer que les valeurs présentes dit exactement ce
-- qu'on garantit : deux paiements ne partagent jamais une référence connue.
CREATE UNIQUE INDEX "payment_provider_ref_key"
    ON "payment"("provider_ref") WHERE "provider_ref" IS NOT NULL;

CREATE INDEX "payment_user_id_created_at_idx" ON "payment"("user_id", "created_at");
CREATE INDEX "payment_status_created_at_idx"  ON "payment"("status", "created_at");

CREATE TABLE "payment_status_history" (
    "id"                   UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id"           UUID NOT NULL,
    "status"               "payment_status" NOT NULL,
    "started_at"           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at"             TIMESTAMPTZ,
    "changed_by_user_id"   UUID,
    "changed_by_admin_id"  UUID,
    "origin"               "status_change_origin" NOT NULL,
    "reason"               TEXT,
    "provider_payload_ref" TEXT,
    "created_at"           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_status_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_status_history_payment_id_fkey"
        FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE CASCADE,
    CONSTRAINT "payment_status_history_changed_by_user_id_fkey"
        FOREIGN KEY ("changed_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL,
    CONSTRAINT "payment_status_history_changed_by_admin_id_fkey"
        FOREIGN KEY ("changed_by_admin_id") REFERENCES "admin"("id") ON DELETE SET NULL,
    -- « Motif obligatoire lorsque origin = 'admin' » (dictionnaire). La base
    -- refuse l'écriture plutôt qu'un service : c'est ce qui rend le registre
    -- lisible le jour d'un litige, quel que soit le chemin qui l'a écrit.
    CONSTRAINT "payment_status_history_motif_obligatoire" CHECK (
        "origin" <> 'admin' OR ("reason" IS NOT NULL AND length(btrim("reason")) >= 6)
    ),
    -- Un état qui se termine avant d'avoir commencé n'existe pas.
    CONSTRAINT "payment_status_history_intervalle_coherent" CHECK (
        "ended_at" IS NULL OR "ended_at" >= "started_at"
    )
);

CREATE INDEX "payment_status_history_payment_id_started_at_idx"
    ON "payment_status_history"("payment_id", "started_at");

-- Une seule ligne OUVERTE par paiement. Sans cette contrainte, deux
-- changements concurrents laisseraient deux états courants, et la durée de
-- chacun deviendrait indéterminée.
CREATE UNIQUE INDEX "payment_status_history_un_seul_etat_ouvert"
    ON "payment_status_history"("payment_id") WHERE "ended_at" IS NULL;

-- Le lien qui porte l'unicité de l'octroi.
ALTER TABLE "credit_transaction" ADD COLUMN "payment_id" UUID;
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE SET NULL;

-- « Les crédits sont octroyés une seule fois, quelle que soit la voie qui a
-- constaté le succès. » La garantie tient à cet index, pas à une vérification
-- en service : deux confirmations concurrentes liraient toutes deux « aucun
-- octroi » avant que l'une n'écrive, et le compte serait crédité deux fois.
--
-- Partiel pour la taille : la plupart des mouvements — octrois d'inscription,
-- bonus de parrainage, consommations, ajustements — n'ont pas de paiement, et
-- il n'y a rien à gagner à les indexer. Pas pour admettre plusieurs nuls : un
-- index total le ferait aussi.
CREATE UNIQUE INDEX "credit_transaction_un_octroi_par_paiement"
    ON "credit_transaction"("payment_id") WHERE "payment_id" IS NOT NULL;

-- Les cinq paliers de départ (ux-admin §5.4), ajustables depuis
-- l'administration. La remise s'affiche : c'est un argument de vente.
INSERT INTO "credit_bundle" ("id", "amount", "currency", "credits", "bonus_percent", "position", "is_active") VALUES
  (gen_random_uuid(),   500, 'XAF',   5, NULL, 1, true),
  (gen_random_uuid(),  1000, 'XAF',  10, NULL, 2, true),
  (gen_random_uuid(),  2000, 'XAF',  22,   10, 3, true),
  (gen_random_uuid(),  5000, 'XAF',  57,   15, 4, true),
  (gen_random_uuid(), 10000, 'XAF', 120,   20, 5, true);

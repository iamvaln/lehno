-- L'administration. Un compte d'exploitation n'est pas un compte d'utilisateur :
-- aucune des tables ci-dessous ne référence "user", et aucune table existante ne
-- gagne de colonne. La séparation empêche par construction qu'une session d'un
-- domaine serve dans l'autre — ce qu'aucune relecture ne garantit.

CREATE TYPE "admin_role" AS ENUM ('support', 'admin');
CREATE TYPE "audit_actor" AS ENUM ('admin', 'user');

-- L'adresse est en citext, comme celle d'un utilisateur : une adresse ne change
-- pas de titulaire selon sa casse.
CREATE TABLE "admin" (
    "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
    "email"        CITEXT NOT NULL,
    "display_name" TEXT,
    "role"         "admin_role" NOT NULL DEFAULT 'support',
    "is_active"    BOOLEAN NOT NULL DEFAULT true,
    "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "admin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_email_key" ON "admin"("email");

-- admin_id est nullable : une demande de code pour une adresse inconnue laisse
-- une ligne sans admin. C'est ce qui permet de répondre la même chose, et dans
-- le même temps, qu'à une adresse connue — l'écran ne dit jamais si un compte
-- existe. L'index porte donc sur l'adresse visée, jamais sur l'admin.
CREATE TABLE "admin_otp_code" (
    "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_id"     UUID,
    "target_email" TEXT NOT NULL,
    "code_hash"    TEXT NOT NULL,
    "expires_at"   TIMESTAMPTZ NOT NULL,
    "consumed_at"  TIMESTAMPTZ,
    "attempts"     INTEGER NOT NULL DEFAULT 0,
    "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "admin_otp_code_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admin_otp_code_admin_id_fkey" FOREIGN KEY ("admin_id")
        REFERENCES "admin"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "admin_otp_code_target_email_idx" ON "admin_otp_code"("target_email");

CREATE TABLE "admin_refresh_token" (
    "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_id"    UUID NOT NULL,
    "family_id"   UUID NOT NULL,
    "token_hash"  TEXT NOT NULL,
    "parent_id"   UUID,
    "expires_at"  TIMESTAMPTZ NOT NULL,
    "consumed_at" TIMESTAMPTZ,
    "revoked_at"  TIMESTAMPTZ,
    "user_agent"  TEXT,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "admin_refresh_token_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admin_refresh_token_admin_id_fkey" FOREIGN KEY ("admin_id")
        REFERENCES "admin"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "admin_refresh_token_token_hash_key" ON "admin_refresh_token"("token_hash");
CREATE INDEX "admin_refresh_token_admin_id_revoked_at_idx" ON "admin_refresh_token"("admin_id", "revoked_at");
CREATE INDEX "admin_refresh_token_family_id_idx" ON "admin_refresh_token"("family_id");

-- Le journal. Volontairement sans clé étrangère sur actor_id : une trace qui
-- doit faire foi ne disparaît pas avec ce qu'elle décrit. Effacer un compte
-- efface ses données, pas la mémoire des gestes qu'on a posés dessus.
CREATE TABLE "audit_log" (
    "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_type"  "audit_actor" NOT NULL,
    "actor_id"    UUID NOT NULL,
    "action"      VARCHAR(64) NOT NULL,
    "reason"      TEXT,
    "target_type" VARCHAR(40),
    "target_id"   UUID,
    "metadata"    JSONB,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id"),

    -- « Sans motif, la requête échoue » (spec technique §7). La règle est ici, en
    -- base, et pas seulement dans le service : une écriture par un autre chemin —
    -- une reprise manuelle, un script — ne doit pas pouvoir laisser un geste
    -- d'administration sans sa raison. Un utilisateur agissant chez lui n'a rien
    -- à justifier, d'où la condition sur actor_type.
    CONSTRAINT "audit_log_motif_obligatoire" CHECK (
        "actor_type" <> 'admin' OR ("reason" IS NOT NULL AND length(btrim("reason")) >= 6)
    )
);

CREATE INDEX "audit_log_actor_type_actor_id_idx" ON "audit_log"("actor_type", "actor_id");
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

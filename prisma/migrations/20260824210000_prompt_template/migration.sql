-- Les gabarits de production du studio du portrait. Ce qu'on demande au modèle
-- vit en base, jamais dans le code : on l'ajuste au vu des résultats, sans
-- livraison. C'est la section qui bougera le plus (ux-admin §5.8).
CREATE TYPE "prompt_kind" AS ENUM (
  'message', 'illustration', 'photo_style', 'note_classification', 'sensitive_detection'
);

CREATE TABLE "prompt_template" (
    "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
    "kind"                "prompt_kind" NOT NULL,
    -- L'orientation, la famille d'illustration ou le style visé.
    "key"                 VARCHAR(60) NOT NULL,
    "version"             INTEGER NOT NULL DEFAULT 1,
    "body"                TEXT NOT NULL,
    -- Ce qui est écarté : symboles d'occasion, visages, superlatifs, formules
    -- de carte de vœux. Ces listes se complètent à mesure qu'on voit passer
    -- des résultats, d'où le jsonb plutôt qu'un schéma figé.
    "guardrails"          JSONB,
    "ai_model_id"         UUID,
    "is_active"           BOOLEAN NOT NULL DEFAULT false,
    "created_by_admin_id" UUID,
    "created_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "prompt_template_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "prompt_template_ai_model_id_fkey" FOREIGN KEY ("ai_model_id")
        REFERENCES "ai_model"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    -- Sans clé étrangère vers admin : l'auteur d'un gabarit reste nommé même
    -- si son compte est un jour effacé, comme pour le journal d'audit.
    CONSTRAINT "prompt_template_version_positive" CHECK ("version" >= 1)
);

CREATE UNIQUE INDEX "prompt_template_kind_key_version_key"
    ON "prompt_template"("kind", "key", "version");
CREATE INDEX "prompt_template_kind_key_idx" ON "prompt_template"("kind", "key");

-- **Une seule version active par (kind, key)**, tenue par un index unique
-- partiel. La règle est en base parce qu'une seconde version active ne se
-- verrait pas : la génération en prendrait une au hasard, et l'écart de qualité
-- resterait inexplicable — précisément ce que le versionnage sert à éviter.
CREATE UNIQUE INDEX "prompt_template_une_seule_active"
    ON "prompt_template"("kind", "key") WHERE "is_active";

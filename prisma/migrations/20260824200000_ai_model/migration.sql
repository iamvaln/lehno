-- Le catalogue des modèles d'IA et leur ordre de repli. La priorité gouverne le
-- routage : le plus bas passe en premier, et l'indisponibilité de l'un bascule
-- sur le suivant. Disposer de trois fournisseurs distincts protège autant de la
-- panne que de la hausse tarifaire (spec technique).
CREATE TABLE "ai_model" (
    "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider"    VARCHAR(40) NOT NULL,
    "model_key"   VARCHAR(80) NOT NULL,
    "priority"    INTEGER NOT NULL,
    -- Repères de coût par unité, pour rapporter la dépense au revenu des
    -- crédits. Nullables : un fournisseur peut ne pas les publier.
    "cost_input"  DECIMAL(12,6),
    "cost_output" DECIMAL(12,6),
    -- Activable à chaud : retirer un modèle qui échoue ne demande pas de
    -- livraison, c'est tout l'intérêt de la table.
    "enabled"     BOOLEAN NOT NULL DEFAULT true,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "ai_model_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_model_provider_model_key_key" ON "ai_model"("provider", "model_key");
CREATE INDEX "ai_model_enabled_priority_idx" ON "ai_model"("enabled", "priority");

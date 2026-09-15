-- LA QUALITÉ D'IMAGE, ET LES TARIFS RÉELS.
--
-- L'adaptateur n'envoyait NI qualité NI taille : le fournisseur choisissait.
-- Deux portraits successifs pouvaient donc sortir différents sans que personne
-- l'ait demandé, et le prix par image variait du simple au quinzuple — ce qui
-- rendait toute marge incalculable.
--
-- EN BASE ET NON EN DUR : la qualité est précisément ce qu'on veut pouvoir
-- baisser un jour de pic, sans livrer.
ALTER TABLE "ai_model" ADD COLUMN "image_quality" VARCHAR(16);

-- ── LES TARIFS ──────────────────────────────────────────────────────────────
--
-- Relevés le 15/09/2026 : grilles publiées d'Anthropic et d'OpenAI, et pour
-- xAI l'API du compte elle-même, qui les expose (`/v1/language-models`).
--
-- `WHERE … IS NULL` PARTOUT : une migration ne doit jamais écraser un tarif
-- que l'administration aurait saisi. Elle pose un point de départ, elle ne
-- décide pas à la place de qui règle.
--
-- Anthropic — attention au piège : Opus 5 est à 5/25, PAS à 15/75. Ce dernier
-- est le tarif d'Opus 4.1, et le confondre triple le coût estimé d'un portrait.
UPDATE "ai_model" SET "cost_input" = 5.00,  "cost_output" = 25.00
  WHERE "model_key" = 'claude-opus-5'   AND "cost_input" IS NULL;
UPDATE "ai_model" SET "cost_input" = 2.00,  "cost_output" = 10.00
  WHERE "model_key" = 'claude-sonnet-5' AND "cost_input" IS NULL;
UPDATE "ai_model" SET "cost_input" = 1.00,  "cost_output" = 5.00
  WHERE "model_key" LIKE 'claude-haiku-4-5%' AND "cost_input" IS NULL;

-- DeepSeek, tarifs hors heures creuses — le plus défavorable des deux, parce
-- qu'une marge se dimensionne sur le pire cas, pas sur le meilleur.
UPDATE "ai_model" SET "cost_input" = 0.30,  "cost_output" = 1.20
  WHERE "model_key" = 'deepseek-flash'  AND "cost_input" IS NULL;
UPDATE "ai_model" SET "cost_input" = 1.32,  "cost_output" = 3.96
  WHERE "model_key" = 'deepseek-v4-pro' AND "cost_input" IS NULL;

-- xAI, lu dans l'API du compte : 20000 et 60000 centièmes de cent par 100 M.
UPDATE "ai_model" SET "cost_input" = 2.00,  "cost_output" = 6.00
  WHERE "model_key" = 'grok-4.6'        AND "cost_input" IS NULL;

-- ── LES IMAGES ──────────────────────────────────────────────────────────────
--
-- grok-imagine-image : deux cents pièce, confirmé par l'API xAI.
UPDATE "ai_model" SET "cost_per_image" = 0.02
  WHERE "model_key" = 'grok-imagine-image' AND "cost_per_image" IS NULL;

-- OpenAI facture les jetons de SORTIE d'une image, qui dépendent de la qualité.
-- En `high`, 1024×1024 rend 4160 jetons à 40 $/M — soit 0,1664 $ l'image.
-- Le prix n'a donc de sens QUE parce que la qualité est désormais fixée.
UPDATE "ai_model" SET "cost_per_image" = 0.1664, "image_quality" = 'high'
  WHERE "model_key" IN ('gpt-image-1', 'gpt-image-2') AND "cost_per_image" IS NULL;

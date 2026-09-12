-- Le verdict d'un essai échouait en base depuis qu'il existe.
--
-- `20260831060000_sort_dun_essai` a créé le type sous le nom `StudioTrialVerdict`
-- ; le schéma Prisma, lui, porte `@@map("studio_trial_verdict")` et le cherche
-- donc en minuscules avec tirets bas. Toute écriture du champ tombait sur
-- « type "public.studio_trial_verdict" does not exist ».
--
-- CE N'ÉTAIT PAS VISIBLE, et c'est ce qui l'a laissé passer : aucun test
-- n'appelle `StudioEssaiService.juger`, et c'est la seule voie qui écrit ce
-- champ. Les deux boutons de l'Atelier — « Garder » et « Écarter » — rendaient
-- donc une erreur interne, sans que rien d'autre ne s'en aperçoive.
--
-- C'est le troisième de cette famille dans ce dépôt : une énumération dont le
-- nom Postgres et le `@@map` divergent ne se voit qu'à la première écriture.
-- `IdeaFeedback` et `AITask` ont coûté la même recherche.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StudioTrialVerdict') THEN
    ALTER TYPE "StudioTrialVerdict" RENAME TO "studio_trial_verdict";
  END IF;
END
$$;

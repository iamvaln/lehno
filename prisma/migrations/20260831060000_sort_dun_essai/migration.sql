-- Le sort d'un essai : ce qu'on a PENSÉ du résultat, et non ce que l'appel a
-- rendu — `status` dit déjà si le modèle a répondu.
--
-- Nul tant qu'on n'a pas tranché : un essai qu'on n'a pas jugé n'est pas un
-- essai jugé mauvais. Les essais déjà en base restent donc à nul, ce qui est
-- exact — personne ne les a jugés.
--
-- « Publié » n'est pas un membre : ce n'est pas l'essai qu'on publie, c'est sa
-- configuration. L'écran le déduit de l'état de celle-ci.
CREATE TYPE "StudioTrialVerdict" AS ENUM ('kept', 'discarded');

ALTER TABLE "studio_trial" ADD COLUMN "verdict" "StudioTrialVerdict";

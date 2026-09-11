-- Les gabarits de production s'en vont tout à fait.
--
-- La SURFACE est partie avec `08e8102` : le contrôleur, l'écran, leurs tests,
-- l'entrée de navigation, les schémas. La table, l'énumération et la colonne
-- étaient restées le temps de vérifier qu'aucune ligne n'existait en
-- production. Vérifié : le produit n'est pas en ligne, et la base ne porte
-- qu'un compte d'essai et un administrateur d'essai.
--
-- POURQUOI ELLE S'EN VA. `prompt_template` date du 24 août, et sa migration
-- disait l'intention en toutes lettres : « Ce qu'on demande au modèle vit en
-- base, jamais dans le code : on l'ajuste au vu des résultats, sans
-- livraison. » Le Studio est arrivé quatre jours plus tard avec une autre
-- réponse — la structure de l'invite reste en TypeScript, seules les parties
-- réglables vivent en base — et c'est lui qui a été branché. La première
-- tentative est restée, avec son écran, à écrire des lignes que RIEN ne lisait.
--
-- `action_run.prompt_template_id` part avec elle : elle n'a JAMAIS été
-- renseignée. Son commentaire promettait « la version exacte du gabarit qui a
-- produit ce contenu » ; aucune ligne de production ne l'écrivait, et la
-- promesse était donc fausse depuis le premier jour. Ce que le Studio met à sa
-- place est meilleur : `studio_config` porte l'empreinte, la version publiée et
-- l'essai qui l'a justifiée.
--
-- CE QUI RESTE, ET QUI DOIT RESTER : les deux libellés d'audit
-- `prompt_template_create` et `prompt_template_activate` dans l'administration.
-- Le journal garde les gestes qui ont eu lieu ; les retirer afficherait un code
-- brut à la place d'une phrase, sur des lignes qu'on ne peut plus réécrire.

ALTER TABLE "action_run" DROP COLUMN IF EXISTS "prompt_template_id";

DROP TABLE IF EXISTS "prompt_template";

DROP TYPE IF EXISTS "prompt_kind";

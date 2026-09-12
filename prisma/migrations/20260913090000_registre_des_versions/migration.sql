-- LE REGISTRE DES VERSIONS — ce qu'on accepte de servir.
--
-- Une version publiée est une version ENREGISTRÉE : le serveur ne sert pas ce
-- qu'il ne connaît pas. C'est une liste blanche, et elle tend un piège qu'il
-- faut connaître — un build parti au magasin sans être enregistré bloquerait
-- tous ses utilisateurs, exactement ceux qui viennent de mettre à jour.
--
-- CE QUI LE DÉSAMORCE : un build inconnu ne reçoit pas un refus sec, il reçoit
-- « mettez à jour ». C'est le seul geste sensé pour un client qu'on ne reconnaît
-- pas, et le pire cas d'un oubli devient « on invite à réinstaller » plutôt que
-- « l'application ne marche plus ».
--
-- Voir `specs/spec-registre-des-versions.md`.
CREATE TABLE "app_version" (
    "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
    "platform"      "api_client_type" NOT NULL,
    -- Ce qu'un humain lit. PAS une clé : deux builds peuvent porter la même
    -- version, et c'est le cas ordinaire d'un correctif recompilé.
    "version"       VARCHAR(20) NOT NULL,
    -- L'ENTIER MONOTONE, et c'est LUI qui décide de « plus ancien que ».
    -- Comparer les `semver` en chaînes rendrait « 1.10.0 » plus ancien que
    -- « 1.9.0 » — un défaut qui ne se voit qu'au dixième correctif mineur.
    "build_number"  INTEGER NOT NULL,
    -- Posé sur la release qui INTRODUIT la rupture, jamais sur un plancher qu'il
    -- faudrait penser à relever : on y pense toujours après.
    "forces_update" BOOLEAN NOT NULL DEFAULT false,
    "is_retired"    BOOLEAN NOT NULL DEFAULT false,
    "store_url"     TEXT,
    "notes"         TEXT,
    "published_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "app_version_pkey" PRIMARY KEY ("id")
);

-- L'IDENTITÉ D'UN BUILD. La version, elle, peut se répéter.
CREATE UNIQUE INDEX "app_version_platform_build_number_key"
  ON "app_version"("platform", "build_number");
CREATE INDEX "app_version_platform_build_number_idx"
  ON "app_version"("platform", "build_number");

-- ─── LE BUILD REJOINT L'ORIGINE SUR LES SIX TABLES ───────────────────────────
--
-- La version y était déjà. Le build s'y ajoute pour deux raisons : c'est LUI qui
-- se compare, et c'est lui qui rend lisible « combien d'appareils sont sous ce
-- build » AVANT qu'on ne force une mise à jour.
--
-- Ce compteur n'est pas un confort : poser `forces_update` met hors service tous
-- les appareils en dessous, et c'est le geste le plus lourd du panneau — plus
-- lourd que couper un client, parce qu'il ne se voit pas venir. Le poser sans
-- savoir combien de gens il déloge serait le poser à l'aveugle.
ALTER TABLE "login_activity" ADD COLUMN "app_build" INTEGER;
ALTER TABLE "audit_log" ADD COLUMN "app_build" INTEGER;
ALTER TABLE "ai_usage" ADD COLUMN "app_build" INTEGER;
ALTER TABLE "action_run" ADD COLUMN "app_build" INTEGER;
ALTER TABLE "credit_transaction" ADD COLUMN "app_build" INTEGER;
ALTER TABLE "payment" ADD COLUMN "app_build" INTEGER;

-- La lecture qui sert au compteur : « qui est passé, sous quel build, depuis
-- quand ». Sans index, elle balaierait la table entière à chaque ouverture du
-- panneau.
CREATE INDEX "login_activity_app_build_created_at_idx"
  ON "login_activity"("app_build", "created_at");

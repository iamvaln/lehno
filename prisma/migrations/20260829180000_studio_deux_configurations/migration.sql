-- Le studio se scinde : une configuration pour le message, une pour le portrait.
--
-- Elles n'ont vécu ensemble que par accident d'écriture, et ça coûtait deux
-- choses qu'on ne voyait pas.
--
-- 1. UNE SEULE EMPREINTE pour les deux. Reformuler un garde-fou du message
--    faisait retomber les essais du portrait, et modifier un style de dessin
--    faisait retomber ceux du message. Chaque réglage rendait l'autre à
--    éprouver alors qu'il n'avait pas bougé.
--
-- 2. PIRE, et c'est ce qui rend la correction urgente : l'essai du studio
--    appelle le modèle du MESSAGE (`reglages.modeles.message`). Publier un
--    changement de style de dessin se débloquait donc avec un essai qui avait
--    produit un texte. On mettait en service un portrait que PERSONNE n'avait
--    vu — exactement la faute que « rien ne se publie sans essai » existe pour
--    empêcher, passée par le trou entre les deux générations.

CREATE TYPE "studio_config_kind" AS ENUM ('message', 'portrait');

ALTER TABLE "studio_config" ADD COLUMN "kind" "studio_config_kind";

-- Les lignes existantes deviennent des configurations de MESSAGE, et c'est le
-- seul choix honnête : leur essai a produit un texte, donc c'est le message
-- qu'il a éprouvé. Les déclarer « portrait » leur donnerait une couverture
-- d'essai qu'aucune image n'a jamais justifiée.
UPDATE "studio_config" SET "kind" = 'message' WHERE "kind" IS NULL;
ALTER TABLE "studio_config" ALTER COLUMN "kind" SET NOT NULL;

/* CONSÉQUENCE ASSUMÉE : le portrait n'a plus de configuration en service.
   C'est la vérité rétablie, pas une régression — il n'en a jamais eu de prouvée.
   Il en retrouvera une quand quelqu'un en composera une et l'éprouvera sur un
   modèle d'image. Fabriquer ici une ligne `portrait` publiée à partir des
   anciens réglages reproduirait exactement le défaut qu'on répare : une
   publication sans essai. */

-- Les unicités deviennent PAR NATURE. Sans ça, publier le message empêcherait
-- de publier le portrait — l'index actuel n'admet qu'une seule ligne
-- `published` dans toute la table.
DROP INDEX "studio_config_une_seule_publiee";
DROP INDEX "studio_config_un_seul_brouillon";
DROP INDEX "studio_config_version_unique";

CREATE UNIQUE INDEX "studio_config_une_seule_publiee"
    ON "studio_config"("kind") WHERE "state" = 'published';
CREATE UNIQUE INDEX "studio_config_un_seul_brouillon"
    ON "studio_config"("kind") WHERE "state" = 'draft';

-- La version se compte par nature elle aussi : « la version 3 du message » et
-- « la version 3 du portrait » sont deux choses, et les faire partager une
-- numérotation ferait sauter celle de l'une à chaque publication de l'autre.
CREATE UNIQUE INDEX "studio_config_version_unique"
    ON "studio_config"("kind", "version") WHERE "version" IS NOT NULL;

CREATE INDEX "studio_config_kind_state_idx" ON "studio_config"("kind", "state", "created_at");

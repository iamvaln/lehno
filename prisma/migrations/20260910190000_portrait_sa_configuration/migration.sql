-- LE PORTRAIT DIT QUELLE CONFIGURATION L'A PRODUIT.
--
-- L'approbation lisait la configuration COURANTE — `state = 'published'` — pour
-- retrouver la consigne de l'ambiance. Or le brief a été composé avec la
-- consigne d'ALORS. Reformuler « nature » entre le lancement et l'approbation
-- faisait donc composer l'image avec un texte, et le brief avec un autre : le
-- dessin ne correspondait plus à ce qu'on venait de relire.
--
-- L'HISTORIQUE EXISTAIT DÉJÀ. Chaque publication est une ligne de
-- `studio_config` ; celle qu'on remplace passe en `superseded` au lieu de
-- disparaître. Il ne manquait que le lien.
--
-- Ça règle aussi un refus qu'on n'aurait pas dû avoir à écrire : une ambiance
-- SUPPRIMÉE du catalogue faisait échouer l'approbation. En lisant la
-- configuration d'origine, elle y est toujours — un portrait payé s'approuve,
-- quoi qu'on ait publié depuis.
--
-- RESTRICT et non SET NULL : une configuration citée par un portrait ne se
-- supprime pas. Sans elle, la consigne qui a produit le texte est perdue, et
-- l'approbation redeviendrait ce qu'elle était.
ALTER TABLE "portrait" ADD COLUMN "studio_config_id" UUID;

ALTER TABLE "portrait" ADD CONSTRAINT "portrait_studio_config_id_fkey"
    FOREIGN KEY ("studio_config_id") REFERENCES "studio_config"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "portrait_studio_config_id_idx" ON "portrait"("studio_config_id");

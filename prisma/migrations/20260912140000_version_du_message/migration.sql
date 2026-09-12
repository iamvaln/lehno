-- LA VERSION QUI A PRODUIT CE MESSAGE.
--
-- Le portrait portait déjà `studio_config_id` ; le message non. Sans ce lien,
-- un avis sur une production ne mesure rien : on apprend qu'elle a déplu, pas
-- laquelle des consignes en est cause.
--
-- NULLABLE POUR DE BON. Les messages déjà écrits n'ont pas ce lien et rien ne
-- peut l'inventer — on ne sait pas ce qui tournait au moment où ils ont été
-- produits. Leur poser la version courante serait pire qu'un trou : une donnée
-- fausse, que le panneau compterait.
--
-- ON REPREND, ON NE COMPLÈTE PAS : aucun `UPDATE` ici, à dessein.
ALTER TABLE "generated_message" ADD COLUMN "studio_config_id" UUID;

-- `RESTRICT`, comme pour le portrait : une configuration citée par un message
-- ne se supprime pas, sinon la consigne qui l'a produit est perdue.
ALTER TABLE "generated_message"
  ADD CONSTRAINT "generated_message_studio_config_id_fkey"
  FOREIGN KEY ("studio_config_id") REFERENCES "studio_config"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Le panneau lira « combien de rejets pour cette version » : l'index porte donc
-- sur la colonne du regroupement, pas sur la clé primaire.
CREATE INDEX "generated_message_studio_config_id_idx"
  ON "generated_message"("studio_config_id");

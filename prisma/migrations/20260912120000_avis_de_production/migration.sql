-- ON POUVAIT APPROUVER, JAMAIS REJETER.
--
-- Un portrait ne connaissait que `generated` et `approved` ; un message,
-- `generated` / `edited` / `sent`. Aucune production ne portait donc d'avis
-- négatif, sauf les idées — et l'avis est précisément ce qui donne son sens à
-- tout l'atelier : on publiait une configuration sans jamais savoir si on avait
-- amélioré quoi que ce soit.
--
-- Le rejet est un STATUT et non un pouce posé à côté. Pour le portrait, les
-- deux s'excluent : approuver FABRIQUE l'image et coûte, rejeter dit « je ne
-- paie pas celui-là ». C'est un signal plus fort qu'un pouce, et c'est lui qui
-- rend le ménage du stockage possible — sans rejet explicite, on ne peut rien
-- effacer sans risquer d'emporter ce que quelqu'un gardait.
--
-- Les idées gardent leur `feedback` à part, et c'est justifié depuis le premier
-- jour : « noter et retenir sont deux gestes distincts ». Quelqu'un peut
-- trouver une idée excellente et ne pas la retenir.
ALTER TYPE "PortraitStatus" ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE "generated_message_status" ADD VALUE IF NOT EXISTS 'rejected';

-- ET AUCUNE NE DISAIT QUELLE VERSION L'AVAIT PRODUITE, sauf le portrait.
--
-- Les deux manquaient ENSEMBLE, et il les faut ensemble : un pouce en bas sans
-- savoir quelle version l'a produit ne mesure rien, et une version publiée sans
-- avis ne dit pas si elle vaut mieux que la précédente.
--
-- `ON DELETE RESTRICT`, comme sur le portrait : une configuration citée par une
-- production ne se supprime pas, sinon la consigne qui l'a produite est perdue
-- et l'avis porté dessus ne désigne plus rien.
--
-- NULLABLE, et il le reste : les productions d'avant ce jour n'ont pas de lien,
-- et l'inventer serait pire que l'absence — on attribuerait à une version des
-- avis qu'elle n'a pas mérités.
ALTER TABLE "generated_message"
  ADD COLUMN "studio_config_id" UUID;
ALTER TABLE "generated_message"
  ADD CONSTRAINT "generated_message_studio_config_id_fkey"
  FOREIGN KEY ("studio_config_id") REFERENCES "studio_config"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "generated_idea_set"
  ADD COLUMN "studio_config_id" UUID;
ALTER TABLE "generated_idea_set"
  ADD CONSTRAINT "generated_idea_set_studio_config_id_fkey"
  FOREIGN KEY ("studio_config_id") REFERENCES "studio_config"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- LA LECTURE QUI JUSTIFIE TOUT ÇA : « combien de rejets par version ». Elle
-- part de la configuration et compte les productions ; sans index, elle
-- balaierait la table entière à chaque ouverture du panneau.
CREATE INDEX "generated_message_studio_config_id_status_idx"
  ON "generated_message" ("studio_config_id", "status");
CREATE INDEX "generated_idea_set_studio_config_id_idx"
  ON "generated_idea_set" ("studio_config_id");
CREATE INDEX "portrait_studio_config_id_status_idx"
  ON "portrait" ("studio_config_id", "status");

-- ET LE PORTRAIT NE DISAIT PAS QUELLE CONSIGNE AVAIT ÉCRIT SON TEXTE.
--
-- `studio_config_id` désigne le CATALOGUE — nature `portrait` : les ambiances,
-- les compositions, le modèle d'image. Son commentaire disait « la
-- configuration qui a produit le brief », et c'était faux : le brief a la
-- sienne, nature `portrait_brief`, et elle ne se notait nulle part.
--
-- Les deux sont deux versions réelles et séparées : l'une choisit les mots,
-- l'autre les dessine, l'une s'éprouve sur un modèle de texte, l'autre sur un
-- modèle d'image. Sans ce second lien, rejeter un portrait ne disait rien de la
-- consigne qui avait choisi ses mots — l'avis se perdait à mi-chemin.
ALTER TABLE "portrait"
  ADD COLUMN "brief_studio_config_id" UUID;
ALTER TABLE "portrait"
  ADD CONSTRAINT "portrait_brief_studio_config_id_fkey"
  FOREIGN KEY ("brief_studio_config_id") REFERENCES "studio_config"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "portrait_brief_studio_config_id_status_idx"
  ON "portrait" ("brief_studio_config_id", "status");

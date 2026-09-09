-- Le dépôt en cours vise désormais AUTRE CHOSE qu'un avatar.
--
-- Une seule place par personne, et c'est assez : on choisit une photo, on la
-- dépose, on confirme — les trois se suivent. Une place par image obligerait
-- chaque table à porter sa colonne d'attente, pour un état de quelques secondes.
--
-- La cible dit à quoi rattacher la clé : `avatar`, ou `souhait:<id>`. Sans elle,
-- la confirmation devrait recevoir la cible du client — qui pourrait alors
-- rattacher sa photo au souhait de quelqu'un d'autre.
ALTER TABLE "user" RENAME COLUMN "avatar_pending_key" TO "depot_en_cours_key";
ALTER TABLE "user" ADD COLUMN "depot_en_cours_cible" TEXT;

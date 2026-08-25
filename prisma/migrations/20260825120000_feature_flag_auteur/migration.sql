-- Qui a basculé le drapeau. Le dictionnaire l'exige (§ FeatureFlag), et sans
-- lui une extinction en production reste anonyme : on saurait que la
-- fonctionnalité est éteinte, jamais par qui ni quand la décision a été prise.
--
-- Nullable, et « on delete set null » : la réconciliation au démarrage crée les
-- lignes manquantes sans auteur — personne n'a basculé quoi que ce soit —, et
-- la trace de la bascule doit survivre au retrait du compte d'administration
-- qui l'a faite. Effacer en cascade reviendrait à perdre l'histoire en même
-- temps que la personne.
ALTER TABLE "feature_flag"
  ADD COLUMN "updated_by_admin_id" uuid
  REFERENCES "admin"("id") ON DELETE SET NULL;

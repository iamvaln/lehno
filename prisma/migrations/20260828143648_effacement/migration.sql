-- L'effacement réel des comptes supprimés (politique de confidentialité §7,
-- spec technique §9.11).
--
-- Une seule colonne, et elle porte tout le mécanisme : `erased_at` dit que la
-- ligne a été VIDÉE, ce que `status` ne peut pas dire. Un compte effacé reste
-- `deleted` avant comme après le passage, parce que sa ligne `user` n'est
-- jamais supprimée — `payment` et `credit_transaction` la référencent en
-- CASCADE, et les emporter détruirait des pièces comptables.

ALTER TABLE "user" ADD COLUMN "erased_at" TIMESTAMPTZ;

-- L'index de la FILE DE TRAVAIL, et il est PARTIEL à dessein : la tâche de nuit
-- ne cherche que les comptes qui restent à vider. Un index complet grossirait
-- avec tout l'historique des comptes déjà effacés — c'est-à-dire avec
-- exactement les lignes que la requête n'a plus jamais à lire.
--
-- Prisma ne sait pas exprimer un index partiel : il vit ici, et nulle part
-- ailleurs. Le déclarer aussi dans schema.prisma le ferait recréer complet à la
-- prochaine migration engendrée, silencieusement.
CREATE INDEX "user_effacement_en_attente_idx"
    ON "user" ("status", "deletion_requested_at")
    WHERE "erased_at" IS NULL;

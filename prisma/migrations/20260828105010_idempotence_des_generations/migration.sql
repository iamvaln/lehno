-- AlterTable
ALTER TABLE "action_run" ADD COLUMN "idempotency_key" VARCHAR(128);

-- CreateIndex
--
-- LA garantie, et elle vient de la base — pas d'une lecture préalable. Entre un
-- « cette clé existe-t-elle ? » et l'écriture, deux clics rapides passeraient
-- tous les deux : c'est précisément la fenêtre qu'on veut fermer.
--
-- Postgres traite les nuls comme distincts : autant de lancements sans clé
-- qu'on veut. La protection est offerte, jamais imposée.
CREATE UNIQUE INDEX "action_run_user_id_idempotency_key_key" ON "action_run"("user_id", "idempotency_key");

-- CreateIndex
--
-- Le rattrapage des exécutions restées en attente balaie par état et par âge :
-- sans cet index, il parcourrait toute la table à chaque passage de nuit.
CREATE INDEX "action_run_status_created_at_idx" ON "action_run"("status", "created_at");

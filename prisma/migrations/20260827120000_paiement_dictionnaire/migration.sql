-- `credit_transaction.payment_id` remis à ce que le dictionnaire décrit.
--
-- Deux écarts relevés en relisant, sur un lien construit la veille.

-- ─── 1. L'unicité couvrait plus que sa raison d'être ────────────────────────
--
-- L'index posait « un seul mouvement par paiement », quel qu'en soit le type.
-- Il tenait bien la garantie pour laquelle il existe — deux confirmations
-- concurrentes ne créditent pas deux fois, l'une échoue à l'écriture — mais sa
-- portée débordait.
--
-- Le dictionnaire réserve la contrainte au type `purchase`, et prévoit que
-- `payment_id` serve **aussi** « sur l'ajustement qui reprend un
-- remboursement ». Deux mouvements désignent donc légitimement le même
-- paiement : l'achat, et l'ajustement qui l'annule. Sous l'index précédent, le
-- remboursement entrait en collision avec l'achat — le service aurait rendu un
-- conflit là où il devait écrire, et un litige se serait réglé à l'estime.
--
-- Corrigé avant le chantier des remboursements (ux-admin §6, « déclencher un
-- remboursement »), pas pendant : `refunded` est déjà un état lisible que rien
-- ne pose.
--
-- Toujours partiel, et toujours pour la **taille** : la plupart des mouvements
-- — octrois d'inscription, bonus de parrainage, consommations — n'ont pas de
-- paiement. Pas pour admettre plusieurs nuls : Postgres les traite déjà comme
-- distincts, un index total en accepterait autant.
DROP INDEX "credit_transaction_un_octroi_par_paiement";

CREATE UNIQUE INDEX "credit_transaction_un_octroi_par_paiement"
    ON "credit_transaction"("payment_id")
    WHERE "payment_id" IS NOT NULL AND "type" = 'purchase';

-- ─── 2. Effacer un paiement orphelinait le crédit qu'il a produit ───────────
--
-- Le lien était en `ON DELETE SET NULL` : effacer un paiement passait, et la
-- ligne de crédit restait sans savoir d'où elle vient. C'est précisément le
-- litige que ce lien devait rendre impossible à régler à l'estime.
--
-- Le dictionnaire dit `on delete restrict`. Aucun chemin n'efface un paiement
-- aujourd'hui — la divergence était dormante, pas inoffensive. La garantie vaut
-- pour le jour où l'un existera : elle refusera, plutôt que d'orpheliner en
-- silence.
--
-- Sûr vis-à-vis des cascades : `payment` et `credit_transaction` descendent
-- toutes deux de `user` en cascade, mais rien n'efface une ligne `user` — l'état
-- « effacé » d'un compte est un statut, pas une suppression.
ALTER TABLE "credit_transaction" DROP CONSTRAINT "credit_transaction_payment_id_fkey";

ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE RESTRICT;

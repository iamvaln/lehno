-- La remise d'un palier se DÉDUIT ; elle ne se range plus.
--
-- `bonus_percent` était un smallint saisi à la main au panneau, que rien ne
-- rattachait aux montants qu'il résume : un palier pouvait annoncer 20 % quand
-- son rapport prix/crédits en valait cinq, et aucun test ne tombait — il n'y
-- avait rien à comparer.
--
-- On le SUPPRIME plutôt que de le laisser dormir. Une colonne qui n'est plus
-- lue mais reste écrivable est pire qu'absente : elle continue de porter une
-- valeur qu'on croit faire autorité, et la prochaine personne qui la voit s'y
-- fie. La remise se calcule maintenant depuis `credits × credit_unit_price` et
-- `amount` (voir apps/api/src/payments/remise.ts), donc la configuration est
-- structurellement la source de vérité : rien à recalculer quand le prix
-- unitaire change, rien à invalider, rien qu'une modification directe en base
-- puisse rendre menteur.
ALTER TABLE "credit_bundle" DROP COLUMN "bonus_percent";

-- Ce qu'un paiement doit FIGER, pour la même raison que `fee_amount` :
-- « changer un taux ne doit pas fausser rétroactivement la comptabilité ».
--
-- `credit_unit_price` — le prix unitaire du jour. Sans lui, « quelle réduction
-- cette personne a-t-elle obtenue ? » n'est plus reconstructible après un
-- changement de prix : on lit 1000 F pour 12 crédits sans savoir si le plein
-- tarif valait 100 ou 120.
--
-- `bundle_amount` — le prix du palier acheté. `amount` le porte de fait, et
-- c'est justement pourquoi les garder tous les deux vaut la colonne : l'écart
-- entre ce qui a été facturé et ce que le palier affichait devient DÉTECTABLE
-- au lieu d'être invisible.
--
-- Ce n'est pas un confort d'analyse. `credit_bundle_id` est en ON DELETE SET
-- NULL : supprimer un palier fait perdre aux paiements historiques jusqu'à sa
-- référence. Sans valeurs figées sur la ligne, l'information a purement
-- disparu — et c'est en litige qu'on va la chercher.
--
-- Nullables, et elles doivent le rester : les lignes déjà en base n'ont pas ces
-- montants, et les remplir après coup avec le prix d'aujourd'hui écrirait
-- exactement le mensonge que ces colonnes existent pour empêcher.
ALTER TABLE "payment" ADD COLUMN "credit_unit_price" DECIMAL(12,2);
ALTER TABLE "payment" ADD COLUMN "bundle_amount" DECIMAL(12,2);

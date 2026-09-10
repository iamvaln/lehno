-- LE PORTRAIT FIGE CE QUI A ÉTÉ CHOISI.
--
-- Sans ces deux colonnes, l'approbation ne savait pas ce que l'utilisateur
-- avait demandé : elle reprenait la première voie active du catalogue et la
-- première ambiance de son groupe. Quelqu'un qui choisissait « abstrait »
-- recevait un paysage — le choix était ignoré, sans qu'aucune erreur ne
-- s'affiche.
--
-- Ce n'est pas seulement l'approbation qui en dépend. Le BRIEF a été composé
-- avec la consigne de l'ambiance choisie : produire l'image avec une autre
-- rendrait un dessin qui ne correspond pas au texte qu'on vient de relire.
--
-- Même doctrine que `payment.fee_amount` : ce qui a été annoncé se fige sur la
-- ligne. Le catalogue peut changer entre le lancement et l'approbation —
-- désactiver une ambiance ne doit pas transformer un portrait en attente.
ALTER TABLE "portrait" ADD COLUMN "visual_path" VARCHAR(20);
ALTER TABLE "portrait" ADD COLUMN "ambiance_id" VARCHAR(60);

-- Nulles ENSEMBLE ou pleines ensemble sur les voies qui ouvrent une ambiance.
-- La voie `aucune` n'en ouvre aucune : elle garde son ambiance nulle, et c'est
-- le seul cas où la dissymétrie est légitime.
ALTER TABLE "portrait" ADD CONSTRAINT "portrait_ambiance_suppose_une_voie"
    CHECK ("ambiance_id" IS NULL OR "visual_path" IS NOT NULL);

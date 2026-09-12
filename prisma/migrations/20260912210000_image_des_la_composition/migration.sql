-- L'IMAGE EXISTE DÈS LA COMPOSITION, pas seulement à l'acceptation.
--
-- L'ancienne contrainte disait « (status = 'approved') = (image_key IS NOT
-- NULL) ». Elle encodait le défaut qu'on répare : elle affirmait que SEUL ce qui
-- est accepté a une image, ce qui rendait impossible l'état « composée, pas
-- encore jugée » — et donc impossible de juger une image qu'on a vue.
--
-- La nouvelle dit la vraie règle : le brief seul n'a pas d'image, tout le reste
-- en a une. Un rejet n'efface rien — c'est un AVIS, pas une suppression, et
-- l'utilisateur a payé cette image.
--
-- POSÉE EN BASE, comme l'ancienne, parce que le statut et la clé s'écrivent à
-- des moments différents et qu'une seule des deux écritures qui aboutit est
-- exactement le cas qu'on ne veut pas laisser passer.
--
-- DANS UNE MIGRATION À PART : `ALTER TYPE ... ADD VALUE` ne peut pas servir dans
-- la même transaction que sa valeur, et cette contrainte cite `composed`.
ALTER TABLE "portrait" DROP CONSTRAINT IF EXISTS "portrait_image_suit_approbation";
ALTER TABLE "portrait" ADD CONSTRAINT "portrait_image_des_la_composition"
    CHECK (("status" = 'generated') = ("image_key" IS NULL));

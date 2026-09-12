-- La photo dont le portrait s'inspire, en attente de sa génération.
--
-- Distincte de `depot_en_cours_key`, qui dit « un téléversement est ouvert ».
-- Celle-ci dit « une photo a été jugée et attend qu'on s'en serve ». Les
-- confondre ferait qu'un dépôt d'avatar ouvert entre-temps effacerait une photo
-- déjà validée — et l'utilisateur perdrait un geste sans comprendre lequel.
--
-- ELLE NE SORT JAMAIS DU SERVEUR. Le client reçoit une URL de dépôt et rien
-- d'autre : la doctrine est écrite sur `depotAvatarSchema`, et lui donner la
-- clé permettrait de la remplacer par celle d'un reçu de paiement ou d'un
-- export, puis de nous faire signer une lecture dessus.
--
-- Elle s'efface dès la génération achevée. C'est ce que l'écran promet au
-- moment du dépôt, et une promesse d'effacement qui ne s'exécute pas est pire
-- que pas de promesse : elle rassure sans protéger.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "photo_source_key" TEXT;

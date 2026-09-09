-- La photo d'un souhait, déposée par son auteur.
--
-- `image_url` et `image_key` COEXISTENT, et ce n'est pas une redondance :
-- l'URL est le lien d'une boutique — une image qu'on ne possède pas et qu'on ne
-- peut que pointer —, la clé désigne une photo prise par l'utilisateur et rangée
-- dans notre stockage. « Le bleu indigo, pas le turquoise » se règle mieux en
-- une image qu'en une phrase.
--
-- Une clé, jamais une URL : une URL présignée expire, et la ranger donnerait des
-- liens morts. Le serveur signe une lecture à chaque affichage.
ALTER TABLE "wishlist_item" ADD COLUMN "image_key" TEXT;
ALTER TABLE "owner_wish" ADD COLUMN "image_key" TEXT;

-- La photo de profil se range par sa CLÉ, jamais par son URL.
--
-- Une URL présignée expire : la ranger donnerait des liens morts, et lierait la
-- donnée au fournisseur. Le serveur signe une URL de lecture à chaque
-- affichage. La colonne portait déjà une convention voisine ailleurs
-- (`proof_key`) ; elle s'y range enfin.
--
-- Le renommage préserve ce qui s'y trouve : à ce jour, rien — aucune route ne
-- permettait d'y écrire.
ALTER TABLE "user" RENAME COLUMN "avatar_url" TO "avatar_key";

-- La clé d'un dépôt en cours, pas encore confirmé.
--
-- Elle existe parce que le client ne choisit rien : c'est le serveur qui
-- engendre la clé en signant l'URL de dépôt, et qui la retient. Accepter une
-- clé venue du client laisserait quelqu'un pointer son avatar vers celle d'un
-- autre — un reçu, un export — et nous ferions ensuite signer une lecture
-- dessus.
ALTER TABLE "user" ADD COLUMN "avatar_pending_key" TEXT;

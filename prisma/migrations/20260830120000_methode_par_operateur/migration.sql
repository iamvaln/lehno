-- Un seul numéro par opérateur, et l'opérateur vient du canal.
--
-- La règle reposait sur `brand`, qui est du TEXTE LIBRE. Une liste de choix à
-- l'écran ne la faisait pas mordre : un client d'une version antérieure, ou un
-- appel direct, envoyait « MTN MoMo » là où un autre envoyait « MTN » — deux
-- méthodes pour un même opérateur, et rien ne s'en apercevait.
--
-- La clé devient donc l'opérateur du CANAL, que le serveur résout lui-même. Le
-- client ne le saisit plus ; il désigne un canal, qu'il lit déjà pour la
-- recharge.

ALTER TABLE "payment_method" ADD COLUMN "operator" VARCHAR(40);

-- Les comptes mobile money sans opérateur PARTENT.
--
-- Le service n'ouvre plus aucun chemin pour en créer, et ceux qui existent sont
-- inutilisables : la règle ne les voit pas, et un remboursement ne saurait pas
-- vers quel opérateur partir. Les garder aurait demandé un index partiel pour
-- les accommoder — une précaution de migration de production, sur un service
-- qui n'est pas en ligne. Il n'y a rien à ménager.
DELETE FROM "payment_method" WHERE "kind" = 'mobile_money' AND "operator" IS NULL;

-- L'index reste PARTIEL, et pour une seule raison désormais : les CARTES ont
-- `operator` nul définitivement — elles ne passent pas par un canal
-- d'opérateur, leur réseau vient du prestataire. La clause dit donc une règle
-- du modèle, plus une commodité de reprise.
CREATE UNIQUE INDEX "payment_method_un_numero_par_operateur"
    ON "payment_method"("user_id", "operator") WHERE "operator" IS NOT NULL;

-- Une liste de souhaits appartient à un COMPTE, et facultativement à une
-- occasion.
--
-- ─── CE QUI CLOCHAIT ────────────────────────────────────────────────────────
--
-- La liste n'avait pas de propriétaire : il se lisait par `wishlist →
-- event_occurrence → user`. Et ses souhaits ne lui étaient pas rattachés non
-- plus — `owner_wish` pointait l'occurrence, pas la liste.
--
-- Deux conséquences. La maquette demande une liste « sans occasion » : elle
-- n'aurait eu ni propriétaire, ni endroit où accrocher ses souhaits. Et la
-- chaîne de propriété traversait une table qui n'a rien à voir avec la
-- question — l'occurrence dit QUAND, pas À QUI.
--
-- ─── LE PROPRIÉTAIRE, EN CLAIR ──────────────────────────────────────────────
--
-- Rempli depuis l'occurrence, qui reste la source pour les listes existantes.
-- Écrit en trois temps — colonne nullable, remplissage, passage en NOT NULL —
-- parce qu'une colonne obligatoire ne s'ajoute pas à une table pleine.
ALTER TABLE "wishlist" ADD COLUMN "user_id" UUID;

UPDATE "wishlist" w
SET "user_id" = o."user_id"
FROM "event_occurrence" o
WHERE o."id" = w."event_occurrence_id";

-- Aucune liste ne peut rester sans propriétaire : `event_occurrence_id` était
-- NOT NULL jusqu'ici, donc la jointure ci-dessus les a toutes couvertes. Si
-- une ligne échappait, cette contrainte le dirait maintenant plutôt qu'au
-- premier appel.
ALTER TABLE "wishlist" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "wishlist_user_id_idx" ON "wishlist"("user_id");

-- ─── L'OCCASION DEVIENT FACULTATIVE ─────────────────────────────────────────
--
-- « Une seule liste par occasion » reste vrai — « un cadeau de Noël n'est pas
-- un cadeau de mariage », et deux listes sur la même occasion rendraient le
-- partage ambigu. Mais l'unicité devient PARTIELLE : sans elle, deux listes
-- sans occasion se heurteraient sur `NULL`… ce que Postgres autorise déjà,
-- puisqu'il tient les nuls pour distincts. L'index partiel dit donc la règle
-- telle qu'elle est, au lieu de la laisser dépendre de ce détail.
ALTER TABLE "wishlist" ALTER COLUMN "event_occurrence_id" DROP NOT NULL;
DROP INDEX "wishlist_event_occurrence_id_key";
CREATE UNIQUE INDEX "wishlist_event_occurrence_id_key"
    ON "wishlist"("event_occurrence_id") WHERE "event_occurrence_id" IS NOT NULL;

-- L'effacement de l'occasion ne doit plus emporter la liste : elle a désormais
-- sa propre existence. Elle redevient « sans occasion », ce qui est un état
-- légitime — et ses souhaits survivent avec elle.
ALTER TABLE "wishlist" DROP CONSTRAINT "wishlist_event_occurrence_id_fkey";
ALTER TABLE "wishlist" ADD CONSTRAINT "wishlist_event_occurrence_id_fkey"
    FOREIGN KEY ("event_occurrence_id") REFERENCES "event_occurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── LES SOUHAITS APPARTIENNENT À LEUR LISTE ────────────────────────────────
--
-- `owner_wish` pointait l'occurrence. C'est ce qui rendait la liste sans
-- occasion impossible, et c'est aussi ce qui obligeait chaque lecture à passer
-- par une table qui ne répond pas à la question posée.
ALTER TABLE "owner_wish" ADD COLUMN "wishlist_id" UUID;

UPDATE "owner_wish" ow
SET "wishlist_id" = w."id"
FROM "wishlist" w
WHERE w."event_occurrence_id" = ow."event_occurrence_id";

-- UN SOUHAIT SANS LISTE NE PEUT PAS EXISTER, et il n'y en a pas : la liste
-- était créée avant qu'on puisse y noter quoi que ce soit. La contrainte le
-- vérifie plutôt que de le supposer.
ALTER TABLE "owner_wish" ALTER COLUMN "wishlist_id" SET NOT NULL;
ALTER TABLE "owner_wish" ADD CONSTRAINT "owner_wish_wishlist_id_fkey"
    FOREIGN KEY ("wishlist_id") REFERENCES "wishlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "owner_wish_wishlist_id_idx" ON "owner_wish"("wishlist_id");

-- `event_occurrence_id` DISPARAÎT plutôt que de rester en double. Deux chemins
-- vers la même occasion — par la liste, et en direct — finiraient par diverger
-- le jour où l'un est mis à jour sans l'autre ; et c'est un souhait rattaché à
-- une occasion qui n'est plus celle de sa liste qu'on découvrirait, sans savoir
-- lequel des deux croire.
DROP INDEX "owner_wish_event_occurrence_id_idx";
ALTER TABLE "owner_wish" DROP COLUMN "event_occurrence_id";

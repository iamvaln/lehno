-- Six clés étrangères prescrites par le dictionnaire du projet, omises du
-- plan de la tâche 7 : Person.userId (propriétaire), Event.authorUserId,
-- Note.authorUserId, Note.eventId (contextualisation éventuelle),
-- WishlistItem.authorUserId, et EventOccurrence.userId — copie dénormalisée
-- du propriétaire pour le cloisonnement, qui doit mourir avec lui comme
-- Person.userId.
--
-- Le SQL généré par `prisma migrate dev --create-only` reproposait, comme
-- documenté dans prisma/README.md, de repasser les colonnes citext en text
-- et de supprimer les colonnes ip : retiré avant application.

-- AddForeignKey
ALTER TABLE "person" ADD CONSTRAINT "person_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_occurrence" ADD CONSTRAINT "event_occurrence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note" ADD CONSTRAINT "note_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note" ADD CONSTRAINT "note_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_item" ADD CONSTRAINT "wishlist_item_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

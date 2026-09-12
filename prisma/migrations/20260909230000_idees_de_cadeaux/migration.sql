-- Les idées de cadeaux produites par une génération, et l'avis porté dessus.
--
-- ─── ELLES SE CONSERVENT
--
-- Décidé le 9 septembre. Une idée de cadeau n'appartient à personne : « si
-- quelqu'un aime le rouge et qu'on a une idée de t-shirt rouge, ça ne lui
-- appartient pas ». Les avis portés dessus servent à mesurer la pertinence des
-- invites — et cette mesure garde sa valeur longtemps après que le compte qui
-- les a demandées a disparu.
--
-- C'est donc le traitement d'`action_run` et de `feedback`, pas celui de
-- `generated_message` : le jeu survit à l'effacement du compte, délié. D'où
-- ON DELETE SET NULL sur `user_id` et `event_occurrence_id`, là où le message
-- généré est en CASCADE. Les colonnes sont nullables POUR ÇA, jamais pour un
-- jeu neuf.
--
-- ─── NOTER ET RETENIR SONT DEUX GESTES
--
-- Et les confondre détruirait le signal qu'on vient chercher. Quelqu'un peut
-- trouver une idée excellente et ne pas la retenir — budget, déjà offerte l'an
-- dernier, pas pour cette personne-là. « Bonne idée, mauvais moment » est
-- précisément ce qui distingue une invite qui produit du juste d'une invite qui
-- produit du plausible. Déduire l'avis de l'acceptation mesurerait l'occasion,
-- plus la pertinence.
CREATE TYPE "IdeaFeedback" AS ENUM ('up', 'down');

CREATE TABLE "generated_idea_set" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "action_run_id" UUID NOT NULL,
    "user_id" UUID,
    "event_occurrence_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_idea_set_pkey" PRIMARY KEY ("id")
);

-- Un jeu par exécution : relancer produit un AUTRE jeu, il ne complète pas le
-- précédent. Sans cette unicité, une reprise interrompue pourrait en écrire un
-- second sur la même exécution, et `resultId` n'aurait plus de réponse unique.
CREATE UNIQUE INDEX "generated_idea_set_action_run_id_key" ON "generated_idea_set"("action_run_id");
CREATE INDEX "generated_idea_set_user_id_created_at_idx" ON "generated_idea_set"("user_id", "created_at");

CREATE TABLE "generated_idea" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "set_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "details" TEXT,
    -- L'ordre dans lequel le modèle les a rendues. Conservé : une idée mieux
    -- notée en cinquième position qu'en première dit quelque chose sur le
    -- gabarit, et le tri par avis l'effacerait.
    "position" SMALLINT NOT NULL,
    -- Une fourchette indicative. Nulle quand le modèle n'en propose pas :
    -- l'inventer vaudrait moins que se taire.
    "price_min" DECIMAL(12,2),
    "price_max" DECIMAL(12,2),
    "currency" VARCHAR(3),
    -- Nul tant que PERSONNE N'A RÉPONDU — ce qui n'est pas « ni l'un ni
    -- l'autre » et ne se compte pas de la même façon dans une moyenne.
    "feedback" "IdeaFeedback",
    "feedback_at" TIMESTAMPTZ,
    "wishlist_item_id" UUID,
    "accepted_at" TIMESTAMPTZ,

    CONSTRAINT "generated_idea_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "generated_idea_wishlist_item_id_key" ON "generated_idea"("wishlist_item_id");
CREATE INDEX "generated_idea_set_id_position_idx" ON "generated_idea"("set_id", "position");
-- Pour la question qui justifie tout ça : « quelle version d'invite plaît le
-- plus ». Elle se pose sur l'avis, jointe à l'exécution puis au gabarit.
CREATE INDEX "generated_idea_feedback_idx" ON "generated_idea"("feedback");

-- Une fourchette ne s'inverse pas, et une borne sans devise ne veut rien dire.
-- Posé en base plutôt qu'en code : c'est le modèle qui remplit ces colonnes, et
-- il rend ce qu'il veut.
ALTER TABLE "generated_idea" ADD CONSTRAINT "generated_idea_fourchette_ordonnee"
    CHECK ("price_min" IS NULL OR "price_max" IS NULL OR "price_min" <= "price_max");
ALTER TABLE "generated_idea" ADD CONSTRAINT "generated_idea_prix_a_une_devise"
    CHECK (("price_min" IS NULL AND "price_max" IS NULL) OR "currency" IS NOT NULL);

-- L'avis et sa date vont ensemble : un avis sans date ne se compare pas dans le
-- temps, et une date sans avis ne désigne rien. Retirer son avis remet les deux
-- à nul.
ALTER TABLE "generated_idea" ADD CONSTRAINT "generated_idea_avis_et_sa_date"
    CHECK (("feedback" IS NULL) = ("feedback_at" IS NULL));

-- Même règle pour l'acceptation. `SetNull` sur le souhait laisse cependant
-- `accepted_at` seul quand le souhait est retiré de la liste : c'est voulu, et
-- c'est le cas intéressant — « on l'a retenue, puis abandonnée ».
ALTER TABLE "generated_idea" ADD CONSTRAINT "generated_idea_retenue_a_une_date"
    CHECK ("wishlist_item_id" IS NULL OR "accepted_at" IS NOT NULL);

ALTER TABLE "generated_idea_set" ADD CONSTRAINT "generated_idea_set_action_run_id_fkey"
    FOREIGN KEY ("action_run_id") REFERENCES "action_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "generated_idea_set" ADD CONSTRAINT "generated_idea_set_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "generated_idea_set" ADD CONSTRAINT "generated_idea_set_event_occurrence_id_fkey"
    FOREIGN KEY ("event_occurrence_id") REFERENCES "event_occurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "generated_idea" ADD CONSTRAINT "generated_idea_set_id_fkey"
    FOREIGN KEY ("set_id") REFERENCES "generated_idea_set"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "generated_idea" ADD CONSTRAINT "generated_idea_wishlist_item_id_fkey"
    FOREIGN KEY ("wishlist_item_id") REFERENCES "wishlist_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

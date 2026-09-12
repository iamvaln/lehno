-- L'AVIS SUR UNE PRODUCTION — et le lien manquant du jeu d'idées.
--
-- Les idées portaient déjà `feedback` / `feedback_at`, par proposition. Le
-- portrait et le message n'avaient rien : on pouvait approuver, jamais rejeter.
-- Cette migration étend LA MÊME FORME plutôt que d'en inventer une seconde.
--
-- L'AVIS N'EST PAS L'ÉTAT. `approved` dit qu'on garde le portrait, `sent` qu'on
-- a envoyé le message — ce sont des GESTES. L'avis est un JUGEMENT, et les deux
-- se séparent : on approuve un portrait passable parce qu'on a payé, on envoie
-- un message qu'on juge moyen faute de temps. Ranger le jugement dans
-- l'énumération d'état ferait perdre les deux.
--
-- NUL VEUT DIRE « PERSONNE N'A TRANCHÉ », jamais « satisfait » : compter les
-- non-jugés du bon côté ferait dire à toute version qu'elle plaît.
ALTER TABLE "portrait" ADD COLUMN "feedback" "IdeaFeedback";
ALTER TABLE "portrait" ADD COLUMN "feedback_at" TIMESTAMPTZ;

ALTER TABLE "generated_message" ADD COLUMN "feedback" "IdeaFeedback";
ALTER TABLE "generated_message" ADD COLUMN "feedback_at" TIMESTAMPTZ;

-- L'avis et sa date vont ensemble, exactement comme sur `generated_idea` : un
-- avis sans date ne se compare pas dans le temps, une date sans avis ne désigne
-- rien. Retirer son avis remet les deux à nul.
ALTER TABLE "portrait" ADD CONSTRAINT "portrait_avis_et_sa_date"
    CHECK (("feedback" IS NULL) = ("feedback_at" IS NULL));
ALTER TABLE "generated_message" ADD CONSTRAINT "generated_message_avis_et_sa_date"
    CHECK (("feedback" IS NULL) = ("feedback_at" IS NULL));

-- LA VERSION QUI A PRODUIT LE JEU D'IDÉES.
--
-- Portée par le JEU et non par chaque proposition : une génération emploie une
-- seule configuration, et la poser sur les quatre idées ferait quatre fois la
-- même donnée — avec quatre occasions de diverger.
--
-- Nullable pour de bon, et aucun `UPDATE` ici : les jeux déjà produits n'ont pas
-- ce lien et rien ne peut l'inventer. Leur poser la version courante serait pire
-- qu'un trou — une donnée fausse, que le panneau compterait.
ALTER TABLE "generated_idea_set" ADD COLUMN "studio_config_id" UUID;

-- `RESTRICT` comme ailleurs : une configuration citée par une production ne se
-- supprime pas, sinon la consigne qui l'a produite est perdue.
ALTER TABLE "generated_idea_set"
  ADD CONSTRAINT "generated_idea_set_studio_config_id_fkey"
  FOREIGN KEY ("studio_config_id") REFERENCES "studio_config"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Les index portent sur la colonne du REGROUPEMENT : le panneau lira « combien
-- de rejets pour cette version », et « combien pour ce modèle » par la
-- jointure sur l'exécution.
CREATE INDEX "generated_idea_set_studio_config_id_idx"
  ON "generated_idea_set"("studio_config_id");
CREATE INDEX "portrait_feedback_idx" ON "portrait"("studio_config_id", "feedback");
CREATE INDEX "generated_message_feedback_idx"
  ON "generated_message"("studio_config_id", "feedback");

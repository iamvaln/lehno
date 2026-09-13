-- POURQUOI UNE PRODUCTION A DÉPLU.
--
-- Le pouce existe sur les trois natures depuis le 12. Il dit QU'une version
-- déplaît, jamais EN QUOI — et c'est pourtant la seule chose qu'on vient
-- chercher : un « je n'aime pas » sans raison ne fait pas avancer la consigne
-- suivante.
--
-- LES DEUX FORMES, ET C'EST L'ARBITRAGE RENDU. Un motif fermé OBLIGATOIRE, qui
-- se compte et se compare entre versions ; une note libre FACULTATIVE, qui dit
-- ce qu'aucune liste n'avait prévu. Les motifs seuls ne diraient jamais ce qui
-- manque à la liste — or les premiers mois sont exactement ceux où l'on ne sait
-- pas quoi lister. La note seule ne se compterait pas, et personne ne relit
-- trois cents phrases.
--
-- C'est la forme qu'a déjà `audit_reason` dans ce dépôt, et elle y a fait ses
-- preuves.

-- ── LE REGISTRE ──────────────────────────────────────────────────────────────
--
-- EN BASE ET NON DANS LE CODE : il faut pouvoir ajouter un motif sans livrer une
-- version. Depuis que le registre des versions existe, livrer n'est plus anodin
-- — un motif de plus ne vaut pas de demander à tout le monde de mettre à jour.
CREATE TABLE "feedback_reason" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(48) NOT NULL,
    "label_fr" VARCHAR(120) NOT NULL,
    "label_en" VARCHAR(120) NOT NULL,
    -- LES MÊMES JETONS QUE `NATURES_STUDIO` (`portrait`, `message`, `idees`).
    -- Le panneau lit la performance par nature sous ces noms-là ; en inventer
    -- d'autres imposerait une table de traduction entre deux listes à tenir
    -- d'accord — et « idea » contre « idees » est l'écart qu'on ne voit qu'en
    -- production.
    "natures" VARCHAR(24)[] NOT NULL,
    "position" SMALLINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "feedback_reason_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feedback_reason_code_key" ON "feedback_reason"("code");
CREATE INDEX "feedback_reason_is_active_position_idx"
  ON "feedback_reason"("is_active", "position");

-- Contraint de forme, comme `audit_reason.code`. Sans cette règle, quelqu'un
-- collerait un libellé — « Ne lui ressemble pas » — dans le champ du code, et on
-- serait revenu au point de départ : un texte d'affichage en guise de clé de
-- comptage, qu'une correction d'orthographe coupe en deux.
ALTER TABLE "feedback_reason" ADD CONSTRAINT "feedback_reason_code_forme"
    CHECK ("code" ~ '^[a-z][a-z0-9_]{2,47}$');

-- Une nature inconnue rendrait un motif invisible sans que rien ne le signale :
-- il ne sortirait d'aucune liste, et personne ne saurait pourquoi.
ALTER TABLE "feedback_reason" ADD CONSTRAINT "feedback_reason_natures_connues"
    CHECK ("natures" <@ ARRAY['portrait', 'message', 'idees']::VARCHAR(24)[]
           AND array_length("natures", 1) >= 1);

-- ── LE SEMIS ─────────────────────────────────────────────────────────────────
--
-- COURT EXPRÈS. Une liste longue se parcourt mal sur un téléphone, et surtout :
-- on ne sait pas encore ce qui déplaît. C'est la note libre qui l'apprendra, et
-- le registre s'étoffera de ce qu'elle aura montré — sans livraison.
INSERT INTO "feedback_reason" ("code", "label_fr", "label_en", "natures", "position") VALUES
  -- Les quatre qui valent pour tout ce qu'un modèle produit.
  ('off_topic',   'Hors sujet',            'Off topic',            ARRAY['portrait', 'message', 'idees']::VARCHAR(24)[], 0),
  ('inaccurate',  'Inexact',               'Inaccurate',           ARRAY['portrait', 'message', 'idees']::VARCHAR(24)[], 1),
  ('wrong_tone',  'Le ton ne va pas',      'Wrong tone',           ARRAY['portrait', 'message', 'idees']::VARCHAR(24)[], 2),
  ('bland',       'Fade, sans surprise',   'Bland',                ARRAY['portrait', 'message', 'idees']::VARCHAR(24)[], 3),
  -- Le portrait est une IMAGE : ce qui cloche s'y voit, et ne se dit pas avec
  -- le vocabulaire d'un texte.
  ('poor_likeness', 'Ne lui ressemble pas', 'Poor likeness',       ARRAY['portrait']::VARCHAR(24)[], 4),
  ('botched_image', 'Image ratée',          'Botched image',       ARRAY['portrait']::VARCHAR(24)[], 5),
  -- Une idée cadeau se juge sur la personne et sur le porte-monnaie.
  ('not_their_taste', 'Pas son genre',      'Not their taste',     ARRAY['idees']::VARCHAR(24)[], 6),
  ('out_of_budget',   'Hors budget',        'Out of budget',       ARRAY['idees']::VARCHAR(24)[], 7);

-- ── CE QUE PORTE CHAQUE PRODUCTION ───────────────────────────────────────────
ALTER TABLE "portrait" ADD COLUMN "feedback_reason_code" VARCHAR(48);
ALTER TABLE "portrait" ADD COLUMN "feedback_note" VARCHAR(500);

ALTER TABLE "generated_message" ADD COLUMN "feedback_reason_code" VARCHAR(48);
ALTER TABLE "generated_message" ADD COLUMN "feedback_note" VARCHAR(500);

ALTER TABLE "generated_idea" ADD COLUMN "feedback_reason_code" VARCHAR(48);
ALTER TABLE "generated_idea" ADD COLUMN "feedback_note" VARCHAR(500);

-- LE MOTIF EXISTE EXACTEMENT QUAND LE POUCE EST EN BAS.
--
-- `IS NOT DISTINCT FROM` et non `=` : sur un avis nul, `"feedback" = 'down'`
-- vaut NULL, et une contrainte qui vaut NULL est SATISFAITE. Écrite avec `=`,
-- elle aurait laissé passer un motif sur une production sans avis — exactement
-- ce qu'elle existe pour empêcher.
--
-- Pourquoi l'imposer ici et pas seulement au service : c'est la seule garantie
-- qui survive à un appelant qui se trompe. Un rejet sans motif ne se compte pas,
-- et un motif sans rejet ne désigne rien.
ALTER TABLE "portrait" ADD CONSTRAINT "portrait_motif_si_rejet"
    CHECK (("feedback" IS NOT DISTINCT FROM 'down') = ("feedback_reason_code" IS NOT NULL));
ALTER TABLE "generated_message" ADD CONSTRAINT "generated_message_motif_si_rejet"
    CHECK (("feedback" IS NOT DISTINCT FROM 'down') = ("feedback_reason_code" IS NOT NULL));
ALTER TABLE "generated_idea" ADD CONSTRAINT "generated_idea_motif_si_rejet"
    CHECK (("feedback" IS NOT DISTINCT FROM 'down') = ("feedback_reason_code" IS NOT NULL));

-- LA NOTE SUIT L'AVIS. Elle n'est pas réservée au rejet — quelqu'un qui aime
-- peut dire pourquoi, et ça vaut d'être lu —, mais une note sans avis serait un
-- commentaire sur rien, que le retrait de l'avis aurait dû emporter.
ALTER TABLE "portrait" ADD CONSTRAINT "portrait_note_suit_l_avis"
    CHECK ("feedback_note" IS NULL OR "feedback" IS NOT NULL);
ALTER TABLE "generated_message" ADD CONSTRAINT "generated_message_note_suit_l_avis"
    CHECK ("feedback_note" IS NULL OR "feedback" IS NOT NULL);
ALTER TABLE "generated_idea" ADD CONSTRAINT "generated_idea_note_suit_l_avis"
    CHECK ("feedback_note" IS NULL OR "feedback" IS NOT NULL);

-- PAS DE CLÉ ÉTRANGÈRE VERS `feedback_reason`, ET C'EST DÉLIBÉRÉ.
--
-- Un motif RETIRÉ doit cesser d'être proposé sans rien casser de ce qu'il a déjà
-- justifié ; une clé étrangère le tiendrait, mais elle interdirait aussi de
-- supprimer une ligne du registre — or le registre n'a pas de gouvernance ici,
-- et `audit_reason` ne fait pas autrement pour `audit_log.reason_code`. Ce qu'on
-- veut vraiment garantir, c'est que le code EXISTAIT au moment du clic : c'est
-- le service qui le vérifie, contre la liste active.

-- Le panneau lira « quels motifs par version » : le regroupement porte sur la
-- configuration, et le motif est la colonne qu'on compte.
CREATE INDEX "portrait_feedback_reason_idx"
  ON "portrait"("studio_config_id", "feedback_reason_code")
  WHERE "feedback_reason_code" IS NOT NULL;
CREATE INDEX "generated_message_feedback_reason_idx"
  ON "generated_message"("studio_config_id", "feedback_reason_code")
  WHERE "feedback_reason_code" IS NOT NULL;
-- L'idée ne porte pas la version : c'est le JEU qui la porte (le 12). Le
-- regroupement se fait donc par jointure, et l'index utile est celui du motif.
CREATE INDEX "generated_idea_feedback_reason_idx"
  ON "generated_idea"("feedback_reason_code")
  WHERE "feedback_reason_code" IS NOT NULL;

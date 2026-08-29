-- L'historisation des configurations réglées en administration.
--
-- Le journal d'audit dit ce qui a CHANGÉ. Il ne dit pas ce qui était EN VIGUEUR
-- à une date donnée : pour le savoir il faudrait rejouer toutes ses entrées
-- depuis l'origine, en espérant qu'aucune ne manque. Une période de validité y
-- répond en une lecture.
--
-- Le déclencheur est en base, et non dans l'application, parce qu'un historique
-- alimenté par le code est contourné par tout ce qui n'est pas le code : une
-- graine, une migration, un `updateMany`, une session psql un soir de panne. Un
-- historique contourné ne se contente pas d'être incomplet — IL MENT. Il
-- affirme qu'une configuration était en vigueur alors qu'une autre l'était.
-- C'est pire que de ne pas en avoir : on cesse de le vérifier.

CREATE TABLE "payment_channel_history" (
    "id"                 UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_channel_id" UUID NOT NULL,
    -- Les colonnes du canal, DANS SON ORDRE. Voir la fonction plus bas : elle
    -- insère positionnellement, donc une divergence d'ordre ou de nombre fait
    -- échouer la première écriture au lieu de laisser l'historique dériver.
    "kind"         "payment_method_kind" NOT NULL,
    "operator"     VARCHAR(40) NOT NULL,
    "country"      VARCHAR(2) NOT NULL,
    "label"        VARCHAR(80) NOT NULL,
    "fee_percent"  DECIMAL(5,2) NOT NULL,
    "fee_fixed"    DECIMAL(12,2) NOT NULL,
    "fee_min"      DECIMAL(12,2),
    "fee_max"      DECIMAL(12,2),
    "fee_borne_by" "fee_bearer" NOT NULL,
    "currency"     VARCHAR(3) NOT NULL,
    "is_active"    BOOLEAN NOT NULL,
    "position"     SMALLINT,
    "updated_at"   TIMESTAMPTZ NOT NULL,
    -- La période. `valid_to IS NULL` veut dire « en vigueur ».
    "valid_from"   TIMESTAMPTZ NOT NULL,
    "valid_to"     TIMESTAMPTZ,
    -- L'auteur peut être nul : une migration en a un qui n'est pas un
    -- administrateur. Le MOTIF, lui, ne le peut pas — voir la fonction.
    "changed_by"   UUID,
    "reason"       TEXT NOT NULL,
    CONSTRAINT "payment_channel_history_pkey" PRIMARY KEY ("id"),
    -- Pas de cascade vers le canal, et pas de clé étrangère du tout : la ligne
    -- d'historique doit SURVIVRE à l'effacement du canal. C'est ce qui permet
    -- à un paiement de garder son explication complète quand le canal qui l'a
    -- porté disparaît.
    CONSTRAINT "payment_channel_history_periode" CHECK ("valid_to" IS NULL OR "valid_to" >= "valid_from")
);

-- Deux administrateurs modifiant le même canal en même temps produiraient sans
-- cela deux lignes ouvertes — et « quelle configuration était en vigueur »
-- deviendrait indéterminé exactement là où on l'interroge. La base refuse la
-- seconde ; l'appel rejoue.
CREATE UNIQUE INDEX "payment_channel_history_une_seule_ouverte"
    ON "payment_channel_history"("payment_channel_id") WHERE "valid_to" IS NULL;

CREATE INDEX "payment_channel_history_par_canal_et_date"
    ON "payment_channel_history"("payment_channel_id", "valid_from" DESC);

-- ─────────────────────────────────────────────────────────────────────────────

-- Une seule fonction pour les sept tables de configuration à venir. Elle prend
-- en argument le nom de la table d'historique et celui de la colonne qui porte
-- l'entité.
CREATE OR REPLACE FUNCTION historiser() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    table_historique text := TG_ARGV[0];
    colonne_entite   text := TG_ARGV[1];
    motif  text;
    acteur uuid;
    cible  uuid;
BEGIN
    -- Le motif est une CONDITION POUR ÉCRIRE, pas une colonne qu'on remplit si
    -- on y pense. Sans ce refus, « raison du changement » redeviendrait
    -- facultative le jour où quelqu'un est pressé — et l'historique perdrait ce
    -- qui le rend relisible deux ans plus tard.
    --
    -- Les migrations et les graines posent explicitement app.reason à
    -- 'migration'. L'échappatoire est nommée, donc visible en revue.
    motif := nullif(current_setting('app.reason', true), '');
    IF motif IS NULL THEN
        RAISE EXCEPTION
            'historisation refusée : aucune raison posée (app.reason) pour % sur %',
            TG_OP, TG_TABLE_NAME
            USING ERRCODE = 'check_violation';
    END IF;

    acteur := nullif(current_setting('app.actor_id', true), '')::uuid;
    cible  := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;

    -- Fermer la version en cours AVANT d'en ouvrir une autre : l'index partiel
    -- ci-dessus refuserait l'insertion dans l'ordre inverse.
    EXECUTE format(
        'UPDATE %I SET valid_to = now() WHERE %I = $1 AND valid_to IS NULL',
        table_historique, colonne_entite
    ) USING cible;

    -- Un effacement ferme la période et n'en ouvre aucune : la configuration a
    -- cessé d'exister, ce qui est une information en soi.
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    -- L'insertion est POSITIONNELLE, sans liste de colonnes. C'est délibéré :
    -- une colonne ajoutée à l'entité sans l'être à l'historique fait échouer
    -- cette instruction immédiatement et bruyamment. Une liste nommée
    -- l'accepterait en silence, et l'historique se mettrait à omettre un champ
    -- sans que rien ne le signale — on ne le découvrirait qu'au litige.
    EXECUTE format(
        'INSERT INTO %I SELECT gen_random_uuid(), (jsonb_populate_record(NULL::%I, $1)).*, now(), NULL, $2, $3',
        table_historique, TG_TABLE_NAME
    ) USING to_jsonb(NEW), acteur, motif;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "payment_channel_historiser"
    AFTER INSERT OR UPDATE OR DELETE ON "payment_channel"
    FOR EACH ROW EXECUTE FUNCTION historiser('payment_channel_history', 'payment_channel_id');

-- Les canaux déjà en place entrent avec la date de cette migration. Ce qui les
-- précède est PERDU, et le dater plus tôt serait exactement le mensonge que ce
-- chantier existe pour empêcher.
INSERT INTO "payment_channel_history"
SELECT gen_random_uuid(), c.*, now(), NULL, NULL, 'migration'
FROM "payment_channel" c;

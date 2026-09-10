-- Quatre manques que la maquette demandait et que les schémas `.strict()`
-- refusaient. Chacun se tient seul ; ils voyagent ensemble parce qu'ils
-- viennent du même relevé et qu'une migration par colonne coûterait plus à
-- relire qu'à écrire.

-- ─── CE QU'ON FAIT D'UN VŒU REÇU ────────────────────────────────────────────
--
-- DEUX INTERRUPTEURS, ET ILS NE DISENT PAS LA MÊME CHOSE. Le premier décide si
-- le vœu paraît sur le Mur ; le second, si le nom de qui l'a écrit paraît avec.
-- Les fondre obligerait à choisir entre « je le montre avec son nom » et « je
-- ne le montre pas » — or « je le montre sans dire de qui » est précisément ce
-- qu'on veut d'un mot maladroit qu'on garde quand même.
--
-- LES DEUX NAISSENT FAUX. Un vœu reçu n'est pas public parce qu'il est arrivé :
-- il le devient parce que son destinataire l'a décidé. Le défaut inverse
-- publierait rétroactivement tout ce qui est déjà en base.
ALTER TABLE "received_wish" ADD COLUMN "is_public" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "received_wish" ADD COLUMN "show_author" BOOLEAN NOT NULL DEFAULT false;

-- Montrer le nom de quelqu'un sur un vœu qu'on n'expose pas ne veut rien dire,
-- et laisserait un réglage actif que rien n'affiche — celui qu'on croit avoir
-- retiré parce que la page ne le montre plus, et qui ressort le jour où l'on
-- republie.
ALTER TABLE "received_wish" ADD CONSTRAINT "received_wish_auteur_suppose_public"
    CHECK ("show_author" = false OR "is_public" = true);

-- ─── « MA WISHLIST » SUR LE MUR ─────────────────────────────────────────────
--
-- Le Mur expose déjà le lien de l'occurrence courante (`wishLinkUrl`), mais
-- rien ne permettait de le TAIRE : un Mur publié exposait la liste, ou il
-- fallait fermer le Mur entier pour la cacher.
--
-- Faux par défaut, comme `is_enabled` : ce qui se publie se décide, ça ne
-- s'hérite pas.
ALTER TABLE "wall" ADD COLUMN "show_wishlist" BOOLEAN NOT NULL DEFAULT false;

-- ─── LE CODE USSD DE SECOURS ────────────────────────────────────────────────
--
-- L'écran d'attente d'un versement le montre : quand l'application de
-- l'opérateur ne s'ouvre pas — et elle ne s'ouvre pas souvent —, composer
-- *126# reste le seul chemin. Sans lui, l'écran dit « ouvrez votre application »
-- à quelqu'un dont l'application ne s'ouvre pas.
--
-- Sur le CANAL et non sur le compte de collecte : le code appartient à
-- l'opérateur, pas au numéro. Le poser sur le compte obligerait à le recopier
-- sur chacun, et à tous les corriger le jour où l'opérateur le change.
--
-- L'historique le porte aussi : il recopie le canal colonne pour colonne, par
-- déclencheur. Une colonne ajoutée d'un seul côté ferait mentir la reprise —
-- « quelle configuration était en vigueur » rendrait un canal sans son code.
ALTER TABLE "payment_channel" ADD COLUMN "ussd" VARCHAR(32);

-- ─── ET POURQUOI L'HISTORIQUE SE RECONSTRUIT AU LIEU DE S'ALLONGER ──────────
--
-- Le déclencheur `historiser()` insère POSITIONNELLEMENT, et c'est délibéré :
-- « une colonne ajoutée à l'entité sans l'être à l'historique fait échouer cette
-- instruction immédiatement et bruyamment. Une liste nommée l'accepterait en
-- silence, et l'historique se mettrait à omettre un champ sans que rien ne le
-- signale — on ne le découvrirait qu'au litige. »
--
-- Un simple ADD COLUMN sur l'historique ne suffit donc PAS : Postgres l'ajoute
-- en fin de table, après `reason_code`, alors que l'insertion l'attend juste
-- après `updated_at` — à la place qu'il occupe dans le canal. Les neuf cas de
-- `historisation.test.ts` tombent aussitôt, ce qui est le déclencheur faisant
-- exactement son travail.
--
-- On reconstruit donc la table dans le bon ordre. Rien ne la référence — pas de
-- clé étrangère entrante, à dessein : « la ligne d'historique doit SURVIVRE à
-- l'effacement du canal » — la reconstruction est donc sûre.
CREATE TABLE "payment_channel_history_neuf" (
    "id"                 UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_channel_id" UUID NOT NULL,
    -- Les colonnes du canal, DANS SON ORDRE. `ussd` y figure là où le canal le
    -- porte : en dernier, parce qu'un ADD COLUMN l'y a mis.
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
    "ussd"         VARCHAR(32),
    -- La période, puis qui et pourquoi.
    "valid_from"   TIMESTAMPTZ NOT NULL,
    "valid_to"     TIMESTAMPTZ,
    "changed_by"   UUID,
    "reason"       TEXT NOT NULL,
    "reason_code"  VARCHAR(48),
    CONSTRAINT "payment_channel_history_neuf_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_channel_history_neuf_periode" CHECK ("valid_to" IS NULL OR "valid_to" >= "valid_from")
);

-- La recopie NOMME ses colonnes : c'est le seul endroit où l'on doit s'affranchir
-- de la position, puisque justement on la change.
INSERT INTO "payment_channel_history_neuf" (
    "id", "payment_channel_id", "kind", "operator", "country", "label",
    "fee_percent", "fee_fixed", "fee_min", "fee_max", "fee_borne_by",
    "currency", "is_active", "position", "updated_at",
    "valid_from", "valid_to", "changed_by", "reason", "reason_code"
)
SELECT
    "id", "payment_channel_id", "kind", "operator", "country", "label",
    "fee_percent", "fee_fixed", "fee_min", "fee_max", "fee_borne_by",
    "currency", "is_active", "position", "updated_at",
    "valid_from", "valid_to", "changed_by", "reason", "reason_code"
FROM "payment_channel_history";

DROP TABLE "payment_channel_history";
ALTER TABLE "payment_channel_history_neuf" RENAME TO "payment_channel_history";
ALTER TABLE "payment_channel_history" RENAME CONSTRAINT "payment_channel_history_neuf_pkey" TO "payment_channel_history_pkey";
ALTER TABLE "payment_channel_history" RENAME CONSTRAINT "payment_channel_history_neuf_periode" TO "payment_channel_history_periode";

-- Les index repartent avec la table : ils sont tombés avec l'ancienne.
CREATE UNIQUE INDEX "payment_channel_history_une_seule_ouverte"
    ON "payment_channel_history"("payment_channel_id") WHERE "valid_to" IS NULL;
CREATE INDEX "payment_channel_history_par_canal_et_date"
    ON "payment_channel_history"("payment_channel_id", "valid_from");

-- ─── LA LISTE A UN NOM ET UNE CLÔTURE ───────────────────────────────────────
--
-- `name` : nul veut dire « le nom se compose depuis l'occasion » — « Liste de
-- Célarine, anniversaire 2026 ». Une colonne remplie par défaut avec ce libellé
-- se figerait le jour où l'occasion change de nom, et personne ne saurait
-- pourquoi les deux ne s'accordent plus.
--
-- `closes_at` : après cette date, la liste ne reçoit plus de réservation. Nul
-- veut dire « jusqu'à l'occasion », qui est le cas ordinaire — poser la date de
-- l'occurrence par défaut aurait le même défaut que ci-dessus.
ALTER TABLE "wishlist" ADD COLUMN "name" VARCHAR(120);
ALTER TABLE "wishlist" ADD COLUMN "closes_at" TIMESTAMPTZ;

-- Les champs de la fiche d'un proche que le dictionnaire décrit depuis le
-- début et que l'implémentation avait laissés de côté.
--
-- Écrite à la main plutôt qu'engendrée : le schéma porte des types que le diff
-- de Prisma ne connaît pas (citext sur waitlist_signup.email), et une commande
-- `dev` proposerait de les rétrograder sans que rien ne le signale.

CREATE TYPE "person_relation" AS ENUM (
  'famille_proche', 'famille_etendue', 'ami', 'partenaire',
  'collegue', 'relation_pro', 'connaissance'
);

CREATE TYPE "person_gender" AS ENUM ('female', 'male', 'other', 'unspecified');

CREATE TYPE "contact_channel" AS ENUM ('whatsapp', 'sms', 'email', 'autre');

ALTER TABLE "person"
  -- Comment on l'appelle, par opposition à comment on le liste.
  ADD COLUMN "calling_name" text,
  ADD COLUMN "avatar_url" text,
  -- `relation` s'ajoute À CÔTÉ de `relation_hint`, elle ne la remplace pas :
  -- l'énumération sert la génération, le texte libre garde la nuance qu'elle
  -- écrase. Les deux coexistent, c'est écrit au dictionnaire.
  ADD COLUMN "relation" "person_relation",
  -- Défaut 'unspecified' plutôt que NULL : l'absence de réponse est une
  -- réponse légitime, et la distinguer d'un champ jamais rempli n'apporterait
  -- rien à un signal de dernier recours.
  ADD COLUMN "gender" "person_gender" DEFAULT 'unspecified',
  ADD COLUMN "city" text,
  -- Code ISO 3166-1 alpha-2.
  ADD COLUMN "country" varchar(2),
  ADD COLUMN "preferred_channel" "contact_channel";

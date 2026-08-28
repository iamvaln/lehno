-- Le cadeau réservé à ceux qui attendaient, et la trace du courrier d'ouverture.
--
-- Le lien envoyé ne porte RIEN : la détection se fait sur l'adresse au moment
-- de la création du compte. Un bonus porté par le lien serait transférable —
-- quelqu'un le fait suivre à dix amis, et dix comptes touchent un cadeau
-- réservé à un inscrit. Sur l'adresse, le lien peut circuler autant qu'il veut :
-- seul celui qui attendait vraiment reçoit quelque chose.
ALTER TABLE "waitlist_signup"
  ADD COLUMN IF NOT EXISTS "invited_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "converted_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "converted_at" TIMESTAMPTZ;

-- L'anti-double-crédit vit ICI, dans le schéma, pas dans du code : sans cette
-- contrainte, supprimer son compte et recommencer suffirait à toucher le cadeau
-- autant de fois qu'on veut.
CREATE UNIQUE INDEX IF NOT EXISTS "waitlist_signup_converted_user_id_key"
  ON "waitlist_signup" ("converted_user_id");

-- « Ceux qui n'ont pas encore été prévenus » : sans cet index, chaque envoi
-- balaierait toute la table.
CREATE INDEX IF NOT EXISTS "waitlist_signup_invited_at_idx"
  ON "waitlist_signup" ("invited_at");

-- Le montant, réglable AVANT le lancement et sans redéploiement — comme les
-- crédits de bienvenue. Zéro veut dire « pas de cadeau » : on peut donc lancer
-- sans, et l'activer plus tard.
insert into "system_parameter" ("id", "key", "value", "value_type", "description", "updated_at") values
  (gen_random_uuid(), 'waitlist_bonus_credits', '10', 'number', 'Crédits offerts, en plus du cadeau de bienvenue, à qui attendait sur la liste', now())
on conflict ("key") do nothing;

-- La source du mouvement, à part de `gift` : celui-ci est discrétionnaire, le
-- cadeau d'attente est systématique et se compte.
ALTER TYPE "credit_source" ADD VALUE IF NOT EXISTS 'waitlist_bonus';

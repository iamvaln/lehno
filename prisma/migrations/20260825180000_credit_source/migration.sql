-- Pourquoi un mouvement de crédit existe, en CODE STABLE plutôt qu'en phrase.
--
-- `reason` portait « inscription » et « parrainage — arrivé par une
-- invitation » : du français, que le client devrait reconnaître pour séparer
-- les deux lignes de l'écran de bienvenue, et qui ne se traduit pas. Le contrat
-- commun l'interdit d'ailleurs — « les erreurs portent des codes, jamais des
-- phrases ; le client traduit le code ».
--
-- `type` ne suffit pas : un « grant » d'inscription et un « grant » de
-- parrainage se ressemblent, et ce sont pourtant deux gestes distincts dont
-- l'un se mérite. Les confondre efface la raison d'inviter quelqu'un.
CREATE TYPE "credit_source" AS ENUM (
  'signup_grant', 'referral_bonus', 'purchase', 'manual_topup',
  'promo_code', 'consumption', 'admin_adjustment'
);

-- Ajoutée avec un défaut le temps de reprendre les lignes existantes, puis le
-- défaut est retiré : chaque mouvement doit DIRE d'où il vient, et laisser un
-- défaut ferait passer un oubli futur pour un ajustement d'administration.
ALTER TABLE "credit_transaction"
  ADD COLUMN "source" "credit_source" NOT NULL DEFAULT 'admin_adjustment';

UPDATE "credit_transaction" SET "source" = 'signup_grant'
  WHERE "referral_id" IS NULL AND "type" = 'grant';
UPDATE "credit_transaction" SET "source" = 'referral_bonus'
  WHERE "referral_id" IS NOT NULL;

ALTER TABLE "credit_transaction" ALTER COLUMN "source" DROP DEFAULT;

-- `reason` demeure : une note libre pour le journal et l'administration — un
-- motif de rejet, une observation. Le client ne l'affiche jamais.

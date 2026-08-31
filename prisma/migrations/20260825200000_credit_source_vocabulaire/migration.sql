-- Le vocabulaire d'un mouvement de crédit, repris du point de vue de celui qui
-- le lit.
--
-- « admin_adjustment » disait « on a corrigé une erreur » là où l'on voulait
-- souvent dire « on vous offre quelque chose ». Deux nouvelles opposées sous un
-- même mot : celui qui lit son historique ne pouvait pas les distinguer.
--
-- Il se scinde, et deux valeurs manquaient :
--   gift        un geste commercial, un dédommagement
--   reward      une récompense — concours, défi
--   correction  une erreur réparée : le seul cas qui disait vraiment
--               « ajustement »
--   refund      un remboursement, que le dictionnaire prévoyait déjà sans que
--               l'énumération le porte
--
-- Le type se RECRÉE plutôt que de s'étendre : PostgreSQL sait ajouter une
-- valeur à une énumération, jamais en retirer une. Laisser « admin_adjustment »
-- en base alors que Prisma ne la connaît plus ferait échouer la lecture de
-- toute ligne qui la porte — un échec différé, au premier historique consulté.

CREATE TYPE "credit_source_new" AS ENUM (
  'signup_grant', 'referral_bonus', 'purchase', 'manual_topup', 'promo_code',
  'gift', 'reward', 'consumption', 'refund', 'correction'
);

-- Les lignes existantes deviennent des corrections : c'est le sens le plus
-- prudent. On ne peut pas deviner après coup lesquelles étaient des cadeaux, et
-- promettre un cadeau qui n'en était pas serait pire que de nommer une
-- correction.
ALTER TABLE "credit_transaction"
  ALTER COLUMN "source" TYPE "credit_source_new"
  USING (
    CASE "source"::text
      WHEN 'admin_adjustment' THEN 'correction'
      ELSE "source"::text
    END
  )::"credit_source_new";

DROP TYPE "credit_source";
ALTER TYPE "credit_source_new" RENAME TO "credit_source";

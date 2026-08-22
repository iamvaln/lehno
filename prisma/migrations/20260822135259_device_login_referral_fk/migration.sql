-- Généré par `prisma migrate dev --create-only`, puis nettoyé à la main :
-- Prisma ne connaît pas les types `citext` et `inet` posés par la migration
-- précédente (SQL écrit à la main) ; le diff automatique proposait donc de
-- les défaire (repasser les colonnes en `text`, supprimer les colonnes
-- `ip`). Ces lignes ont été retirées — seuls les changements de FK et de
-- nullabilité listés ci-dessous sont réels.

-- DropForeignKey
ALTER TABLE "device_signup" DROP CONSTRAINT "device_signup_user_id_fkey";

-- AlterTable
-- Le compte redevient facultatif : la trace d'inscription par appareil
-- (device_id, created_at) doit survivre à la suppression du compte pour
-- que le plafond anti-abus sur un même appareil continue de compter.
ALTER TABLE "device_signup" ALTER COLUMN "user_id" DROP NOT NULL;

-- AddForeignKey
-- Parrainage : relation d'un compte vers lui-même. La suppression du
-- parrain ne doit pas emporter les comptes parrainés.
ALTER TABLE "user" ADD CONSTRAINT "user_referred_by_fkey" FOREIGN KEY ("referred_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_signup" ADD CONSTRAINT "device_signup_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
-- La trace de connexion survit à la suppression du compte, avec
-- attempted_email comme repli pour l'investigation.
ALTER TABLE "login_activity" ADD CONSTRAINT "login_activity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

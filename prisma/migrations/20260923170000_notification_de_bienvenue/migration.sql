-- Un type de notification pour l'accueil, à l'inscription — §10B du relevé
-- des essais. L'écran de bienvenue (app/(connexion)/bienvenue.tsx) existait
-- déjà, mais rien ne saluait l'arrivée dans le centre de notifications ni
-- par courriel : `signup.service.ts` n'écrivait aucune notification, et
-- aucun type d'accueil n'existait dans l'énumération.
--
-- ALTER TYPE … ADD VALUE ne se défait pas : Postgres ne sait pas retirer une
-- valeur d'un enum. C'est le prix de la forme, et il est assumé.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'welcome';

-- La voie d'entrée, et la mise en service des adresses.
--
-- Les colonnes « ip » existent depuis la migration d'identité, posées avec
-- l'intention de les conserver « pour investigation, jamais lues par le client
-- Prisma ». L'intention protégeait de l'exposition accidentelle — mais elle
-- avait un effet qu'on n'avait pas prévu : Prisma ne peut pas écrire une
-- colonne qu'il ne modélise pas, et ces adresses sont donc restées vides
-- depuis le premier jour. Une trace d'investigation qui ne contient rien ne
-- protège de rien.
--
-- Le modèle les porte désormais, et la garde contre l'exposition devient un
-- test plutôt qu'une absence : /admin/login-activity ne les rend pas, et le
-- contrat publié n'a aucun champ pour les recevoir.

-- Par où quelqu'un est entré. Sans elle, une série d'échecs par code ne se
-- distingue pas d'une série par fournisseur externe — or c'est exactement
-- l'usage que ux-admin §5.13 annonce.
CREATE TYPE "login_method" AS ENUM ('otp', 'google', 'apple');

-- Nullable : les traces déjà écrites n'ont pas de voie, et l'inventer après
-- coup serait pire que de la laisser vide.
ALTER TABLE "login_activity" ADD COLUMN "method" "login_method";

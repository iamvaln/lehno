-- LE STATUT ET L'AVIS SONT DEUX AXES, ET CETTE MIGRATION POSE LE PREMIER.
--
-- `20260912180000_avis_sur_les_productions` a posé le second : `feedback` sur
-- chaque production, avec sa date. Celle-ci ne le double pas — elle complète.
--
--   le STATUT dit ce qu'on FAIT de l'objet ;
--   l'AVIS dit ce qu'on en PENSE, et c'est un pas de plus.
--
-- Les confondre écraserait une distinction qui compte : on peut garder sans
-- jamais dire qu'on a aimé — c'est même le cas ordinaire, donner un avis est un
-- geste qu'on ne franchit pas forcément — et on peut garder sans aimer. Une
-- image qu'on ne trouve pas réussie mais qu'on garde quand même dit quelque
-- chose de précis, que ni l'un ni l'autre ne porterait seul.
--
-- DATÉE APRÈS LES LEURS, ET VOLONTAIREMENT. La première version de ce lot
-- portait l'horodatage 120000, passait donc AVANT, et ajoutait des colonnes que
-- les leurs ajoutent aussi. La seconde serait tombée sur « la colonne existe
-- déjà » — au déploiement, c'est-à-dire au pire moment.

-- ─── `composed` : l'état qui manquait ────────────────────────────────────────
--
-- `approuver` fabriquait l'image ET valait acceptation dans le même geste. Aucun
-- état ne portait donc « l'image existe, personne n'a dit ce qu'il en pense » :
-- on ne pouvait juger qu'un TEXTE, alors que ce qu'on juge est ce qu'on a vu.
--
-- C'est un état TERMINAL LÉGITIME, et la plupart des portraits y resteront.
-- Refaire n'est pas rejeter : quelqu'un peut produire cinq portraits en
-- changeant les réglages et les garder tous.
ALTER TYPE "PortraitStatus" ADD VALUE IF NOT EXISTS 'composed';

-- ─── `rejected` : « je ne garde pas celle-ci » ───────────────────────────────
--
-- Distinct du pouce en bas, qui dit « je ne l'ai pas trouvée réussie ». C'est le
-- statut, et lui seul, qui autoriserait un jour à effacer quelque chose : un
-- avis négatif sur une image qu'on garde n'autorise rien.
--
-- Sur le message, `rejected` est distinct d'`edited` : « je l'ai arrangé » n'est
-- pas « il ne va pas », et les confondre mesurerait la retouche au lieu du
-- ratage.
ALTER TYPE "PortraitStatus" ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE "generated_message_status" ADD VALUE IF NOT EXISTS 'rejected';

-- ─── La consigne qui a écrit le TEXTE du portrait ────────────────────────────
--
-- `studio_config_id` désigne le CATALOGUE — nature `portrait` : les ambiances,
-- les compositions, le modèle d'image. Son commentaire disait « la configuration
-- qui a produit le brief », et c'était faux : le brief a la sienne, nature
-- `portrait_brief`, et elle ne se notait nulle part.
--
-- Les deux sont deux versions réelles et séparées : l'une choisit les mots,
-- l'autre les dessine, l'une s'éprouve sur un modèle de texte, l'autre sur un
-- modèle d'image. Sans ce second lien, un avis sur un portrait ne disait rien de
-- la consigne qui avait choisi ses mots — il se perdait à mi-chemin.
--
-- `RESTRICT` comme les autres : une configuration citée par une production ne se
-- supprime pas, sinon la consigne qui l'a produite est perdue.
ALTER TABLE "portrait"
  ADD COLUMN "brief_studio_config_id" UUID;
ALTER TABLE "portrait"
  ADD CONSTRAINT "portrait_brief_studio_config_id_fkey"
  FOREIGN KEY ("brief_studio_config_id") REFERENCES "studio_config"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- « Combien par version, et de quel côté » — la lecture qui justifie tout ça.
-- Sur le STATUT ici ; les index de l'AVIS sont posés par la migration voisine,
-- et les deux se lisent ensemble sans se recouvrir.
CREATE INDEX "portrait_brief_studio_config_id_status_idx"
  ON "portrait" ("brief_studio_config_id", "status");
CREATE INDEX "portrait_studio_config_id_status_idx"
  ON "portrait" ("studio_config_id", "status");
CREATE INDEX "generated_message_studio_config_id_status_idx"
  ON "generated_message" ("studio_config_id", "status");

-- Le studio s'ouvre aux autres générations de TEXTE.
--
-- On ne produit pas qu'un message : cinq tâches passent par un modèle de texte,
-- et trois sont celles que l'utilisateur demande et paie — le message, les
-- idées de cadeau, et le brief qui précède l'image. Seule la première se
-- réglait ; les deux autres tournaient sur des valeurs figées dans le code,
-- qu'une livraison seule pouvait changer.
--
-- CHACUNE SA NATURE, donc ses essais, sa publication et son historique. C'est
-- la leçon du découpage message/portrait : une empreinte commune faisait
-- retomber les essais de l'un dès que l'autre bougeait.
--
-- `portrait_brief` est DISTINCT de `portrait`. L'un règle le texte qui choisit
-- les mots, l'autre l'image qui les dessine ; l'un s'éprouve sur un modèle de
-- texte, l'autre sur un modèle d'image. Les confondre, c'était précisément le
-- défaut que le découpage a réparé — un essai de texte débloquait la
-- publication d'un rendu que personne n'avait vu.

ALTER TYPE "studio_config_kind" ADD VALUE IF NOT EXISTS 'idees';
ALTER TYPE "studio_config_kind" ADD VALUE IF NOT EXISTS 'portrait_brief';

-- AUCUNE LIGNE N'EST INSÉRÉE ICI, et ce n'est pas un oubli. PostgreSQL refuse
-- d'employer une valeur d'énumération dans la transaction qui l'ajoute, et
-- Prisma joue chaque migration dans une transaction. Le semis du studio pose
-- les deux configurations au démarrage suivant, avec leur empreinte calculée
-- par le code qui en détient la définition.

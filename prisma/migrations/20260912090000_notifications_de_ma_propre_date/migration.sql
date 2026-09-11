-- Deux types de notification pour MA PROPRE DATE.
--
-- Jusqu'ici le planificateur balayait toutes les échéances sans regarder
-- `person.is_self`, et posait `event_reminder` / `event_day_of` sur la date du
-- titulaire comme sur celle d'un proche. Ce qui partait, mot pour mot :
-- « Une date pour Valentine approche… Le bon moment pour préparer un mot » —
-- par courriel, à Valentine, pour l'anniversaire de Valentine.
--
-- Deux types plutôt qu'un drapeau sur les précédents, PARCE QUE LES PRÉFÉRENCES
-- SE RÈGLENT PAR TYPE : quelqu'un qui ne veut pas qu'on lui rappelle son propre
-- anniversaire veut toujours qu'on lui rappelle celui de sa mère. Un drapeau
-- n'aurait donné aucun interrupteur pour les séparer.
--
-- ALTER TYPE … ADD VALUE ne se défait pas : Postgres ne sait pas retirer une
-- valeur d'un enum. C'est le prix de la forme, et il est assumé — les deux
-- valeurs sont nommées d'après ce qu'elles disent, pas d'après l'écran du jour.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'own_date_reminder';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'own_date_day_of';

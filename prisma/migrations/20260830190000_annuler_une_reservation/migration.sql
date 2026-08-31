-- Une réservation annulée se dit au propriétaire.
--
-- `wish_reserved` l'avait prévenu qu'un cadeau était couvert ; il planifie
-- autour. Ne rien dire quand il se libère laisserait attendre un cadeau que
-- personne n'apporte.
--
-- Une valeur d'énumération s'ajoute, elle ne se retire pas : PostgreSQL ne sait
-- pas supprimer un membre d'un enum sans le reconstruire, et une notification
-- déjà posée porterait alors un type inexistant.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'wish_reservation_cancelled';

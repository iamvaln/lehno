-- L'heure de retour annoncée, distincte du rythme de réessai.
--
-- Les confondre était une erreur : un rythme de quinze minutes ne dit pas que
-- le service revient dans quinze minutes. L'écran de maintenance a deux états
-- — avec et sans heure —, et tant qu'une seule valeur existait, il ne pouvait
-- jamais atteindre le second, celui qui ne promet rien.
--
-- Vide par défaut, et vide veut dire « on ne sait pas ». Une valeur illisible
-- vaut pareil : mieux vaut ne rien annoncer qu'annoncer le 31 février.
insert into "system_parameter" ("id", "key", "value", "value_type", "description", "updated_at") values
  (gen_random_uuid(), 'maintenance_until', '', 'string', 'Heure de retour annoncée pendant un arrêt (ISO 8601, UTC). Vide : aucune annonce', now())
on conflict ("key") do nothing;

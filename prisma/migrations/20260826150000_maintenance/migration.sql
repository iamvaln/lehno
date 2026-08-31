-- L'arrêt pour intervention, en paramètres plutôt qu'en table.
--
-- Deux lignes de system_parameter suffisent, et elles donnent gratuitement
-- l'écran d'administration : /admin/parameters est générique et refuse déjà
-- toute clé qu'il ne connaît pas. Une table dédiée aurait demandé son propre
-- contrôleur, son propre écran et sa propre trace d'audit, pour un booléen.
--
-- Ce n'est PAS un drapeau de fonctionnalité : un drapeau rend 404 (« ça
-- n'existe pas »), un arrêt rend 503 (« reviens »). Confondre les deux ferait
-- lire une fenêtre de maintenance comme une suppression.
insert into "system_parameter" ("id", "key", "value", "value_type", "description", "updated_at") values
  (gen_random_uuid(), 'maintenance_mode', 'false', 'boolean', 'Arrêt de l''API pour intervention : seuls /admin et /public/maintenance répondent', now()),
  (gen_random_uuid(), 'maintenance_retry_after_seconds', '900', 'duration', 'Délai annoncé au client avant nouvelle tentative, pendant un arrêt', now())
on conflict ("key") do nothing;

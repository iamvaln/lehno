-- LES MOTIFS DES DEUX GESTES SUR UNE VERSION.
--
-- Le second — poser `forces_update` — est LE GESTE LE PLUS LOURD DU PANNEAU :
-- il met hors service tous les appareils en dessous, d'un coup, sans que
-- personne n'ait rien demandé. Plus lourd que couper un client, parce qu'il ne
-- se voit pas venir.
--
-- AUCUN MOTIF NEUF : les quatre employés ici sont déjà semés par le kit. En
-- inventer des synonymes ferait deux listes à tenir d'accord, et un comptage par
-- motif qui mentirait d'autant plus qu'on y croirait.
--
-- Le déclencheur d'historisation exige une raison, y compris pour une migration.
SELECT set_config('app.reason', 'Semis des motifs du registre des versions', true);

INSERT INTO "audit_reason_scope" ("reason_id", "geste", "position")
SELECT r.id, v.geste, v.position FROM (VALUES
  -- Enregistrer une version : le cas ordinaire est une publication.
  ('new_contract',        'app_version_register', 0),
  ('routine_check',       'app_version_register', 1),
  ('fixing_an_error',     'app_version_register', 2),

  -- La modifier : poser le drapeau, déclasser, corriger un lien. `warning` est
  -- là pour le cas qui compte — on force une mise à jour parce qu'une version
  -- fait courir un risque, et le motif doit pouvoir le dire.
  ('warning',             'app_version_update', 0),
  ('fixing_an_error',     'app_version_update', 1),
  ('access_compromised',  'app_version_update', 2),
  ('routine_check',       'app_version_update', 3)
) AS v(code, geste, position)
JOIN "audit_reason" r ON r."code" = v.code
ON CONFLICT DO NOTHING;

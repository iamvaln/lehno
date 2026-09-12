-- LES MOTIFS DES TROIS GESTES SUR UN CLIENT API.
--
-- Sans eux, le panneau n'aurait rien à proposer et chaque coupure demanderait
-- une phrase écrite de zéro — c'est exactement ce que le module des motifs
-- existe pour éviter.
--
-- AUCUN MOTIF NEUF N'EST CRÉÉ : les cinq employés ici sont déjà semés par le kit
-- et disent déjà ce qu'il faut. En inventer des synonymes — « clé
-- compromise » à côté d'« accès compromis » — ferait deux listes à tenir
-- d'accord, et un comptage par motif qui mentirait d'autant plus qu'on y
-- croirait.
--
-- LE DÉCLENCHEUR D'HISTORISATION EXIGE UNE RAISON (`app.reason`), et il la
-- refuse absente — y compris pour une migration. On la pose donc, et elle dit
-- ce qu'elle est : le code, lui, peut manquer, parce qu'une migration n'en a
-- jamais.
SELECT set_config('app.reason', 'Semis des motifs du panneau des clients API', true);

INSERT INTO "audit_reason_scope" ("reason_id", "geste", "position")
SELECT r.id, v.geste, v.position FROM (VALUES
  -- Ouvrir une paire : un nouveau build, un environnement, une campagne de
  -- charge qui veut son propre identifiant pour ne pas polluer les chiffres.
  ('new_contract',        'api_client_create', 0),
  ('load_test',           'api_client_create', 1),
  ('routine_check',       'api_client_create', 2),

  -- Tourner la clé. `access_compromised` est LE cas qui compte : c'est pour lui
  -- que la rotation existe, et c'est le seul avantage réel de la clé — on la
  -- remplace sans changer l'identifiant, donc sans rompre la série des
  -- chiffres déjà notés.
  ('access_compromised',  'api_client_rotate', 0),
  ('routine_check',       'api_client_rotate', 1),
  ('fixing_an_error',     'api_client_rotate', 2),

  -- Couper ou rouvrir. Couper un client coupe UNE APPLICATION ENTIÈRE, sur tous
  -- les appareils à la fois : le motif n'est pas une formalité.
  ('access_compromised',  'api_client_update', 0),
  ('fixing_an_error',     'api_client_update', 1),
  ('routine_check',       'api_client_update', 2)
) AS v(code, geste, position)
JOIN "audit_reason" r ON r."code" = v.code
ON CONFLICT DO NOTHING;

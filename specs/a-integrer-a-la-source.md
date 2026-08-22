# À ajouter aux documents source

Après review, il manque ceci. À ajouter dans la source, pas dans les fichiers générés.

## Spécification technique

1. §6, tableau des surfaces publiques — ajouter la ligne : `/public/waitlist` · POST · Déposer son adresse sur la liste d'attente pendant le pré-lancement.
2. §9.2, premier point — préciser que le code est haché en **HMAC-SHA-256 sous clé d'environnement**, comparé en temps constant, et qu'aucune fonction de hachage lente (bcrypt, argon2, scrypt) n'a d'emploi dans le produit.
3. §16, couverture des écrans — la landing doit lire : `/public/config`, `/public/waitlist` (pré-lancement).

## Dictionnaire de données

4. Entité **`NotificationPreference`** : `user_id`, `type`, `push_enabled`, `email_enabled`, unique (`user_id`, `type`).
5. Sur **`User`** : `timezone`, `send_hour`, `digest_frequency` (`monthly`|`weekly`|`never`), `reminder_lead_days` (nullable).
6. Entité **`Device`** : `user_id`, `push_token`, `platform` (`ios`|`android`), `app_version`, `is_active`, `last_seen_at`, unique (`user_id`, `push_token`).
7. Énum **`notification_type`** — porter à 14 valeurs : `event_reminder`, `event_day_of`, `digest`, `contribution_received`, `wish_received`, `enrichment_nudge_global`, `enrichment_nudge_person`, `generation_ready`, `payment_succeeded`, `payment_failed`, `credits_received`, `login_code`, `security`, `account`.
8. Sur **`Notification`** : `title_key`, `body_params` (jsonb), `read_at`, `target_route`, `dedupe_key` (unique), `scheduled_for` ; canal `in_app` dans l'énum.
9. Sur **`AIUsage`** : `action_run_id` devient nullable, ajouter `purpose` (`note_classification`, `sensitive_detection`, `portrait`, `gift_ideas`, `wish_message`) et `user_id` nullable.
10. Entité **`RefreshToken`** : `user_id`, `family_id`, `token_hash`, `parent_id`, `expires_at`, `consumed_at`, `revoked_at`, `user_agent`, `ip`.
11. Entité **`WaitlistSignup`** : `email` (citext, unique), `locale`, `source`, `ip`.
12. Entités **`SupportRequest`**, **`Feedback`**, **`DataExportRequest`**.
13. Sur **`Schedule`** — fixer deux règles : le 29 février se marque le 28 les années communes ; un offset tombant sur un jour absent est ramené au dernier jour du mois, les offsets suivants se calculant toujours depuis la `reference_date`.

## À trancher

14. Le tarif sur la landing : retiré le 2026-08-22, mais présent dans la maquette v3 (100 F le crédit, 5 crédits offerts). S'il reste, ces montants doivent venir de `/public/config`, pas être écrits en dur.
15. Le mode sombre : présent dans la maquette v3, absent de toutes les specs. S'applique-t-il au mobile ?

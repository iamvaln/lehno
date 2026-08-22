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

## Accueil

15. §5.8 — `/me/home` est décrit comme rendant « prochaines échéances, contributions en attente, reprises, compteurs », et le texte qui suit parle de « cinq blocs venus de quatre ressources ». L'accueil réécrit n'en porte plus que deux : une **phrase d'accueil** composée selon la situation, et les **trois échéances les plus proches**. Plus de contributions, plus de reprises, plus de compteurs — ils ont quitté l'écran. À reprendre, sinon on construit trois blocs que rien n'affiche.

## Mode sombre

14. Le mode sombre s'applique **aussi au mobile** — il n'est aujourd'hui décrit nulle part. À porter dans `ux-app-mobile-lehno.md` :
    - le parti pris de conception dit « le fond reste blanc, le texte sombre » : à réécrire en termes de rôles (fond, texte, panneau) plutôt que de couleurs, les deux thèmes devant s'y reconnaître ;
    - dire ce qui choisit le thème — réglage système par défaut, et bascule manuelle dans Moi (3.17) ou Mon profil (3.23), persistée ;
    - la planche d'identité ne décrit que le clair : y ajouter le jeu sombre, celui de la maquette v3 faisant foi.

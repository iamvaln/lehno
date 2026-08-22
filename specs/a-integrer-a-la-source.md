# À intégrer aux documents source

Les specs de ce dossier sont **régénérées** depuis une source qui ignore les corrections apportées ici. La régénération du 2026-08-22 a déjà effacé trois passages de la spécification technique. Ce document rassemble ce qu'il faut porter **dans la source**, pour que la prochaine régénération le conserve.

Trois parties : **A** ce qui a été perdu et doit revenir · **B** ce qui a survécu mais tomberait à la prochaine régénération · **C** une décision en attente.

---

## A — Spécification technique : trois passages effacés

### A1 · §6, tableau des surfaces publiques

Ajouter une ligne, après celle de `/public/legal/{document}` :

| Chemin | Méthode | Rôle |
|---|---|---|
| `/public/waitlist` | POST | Déposer son adresse sur la liste d'attente, tant que la landing est en pré-lancement |

*Pourquoi.* La landing de pré-lancement capte des adresses (`preLaunch` dans la maquette v3) et n'a aucun point d'entrée pour les déposer. À conserver tant que la landing garde sa liste d'attente.

### A2 · §9.2, premier point du code à usage unique

Remplacer « Conservé **haché**, jamais en clair, avec une durée de vie courte. » par :

> - Conservé **haché**, jamais en clair, avec une durée de vie courte. Le hachage est un **HMAC-SHA-256 sous clé tenue dans l'environnement** : un code à six chiffres ne compte qu'un million de valeurs, qu'une lecture de la base suffirait à énumérer si le condensé se calculait sans secret. La comparaison se fait en temps constant. Aucun mot de passe n'existe dans le produit — l'entrée repose sur le code et les fournisseurs d'identité —, donc aucune fonction de hachage lente (bcrypt, argon2, scrypt) n'a d'emploi ici : elle n'ajouterait rien à la défense et offrirait un levier de saturation sur un point d'entrée ouvert sans compte.

*Pourquoi.* « Haché » seul laisse le choix ouvert, et le réflexe est d'attraper une fonction de mot de passe — inadaptée ici, et coûteuse sur un point d'entrée accessible sans compte. La décision mérite d'être écrite avec sa raison.

### A3 · §16, couverture des écrans

L'entrée **Surfaces publiques** doit lire :

> **Surfaces publiques.** Landing → `/public/config`, `/public/waitlist` (pré-lancement) · Collecte nominatif et public → …

*Pourquoi.* §16 est la table de contrôle : un écran dont un point d'entrée manque ici signale un trou. A1 et A3 disent le même fait à deux endroits — les deux doivent bouger ensemble.

---

## B — Dictionnaire de données : neuf ajouts, encore présents

Ces ajouts vivent aujourd'hui dans `dictionnaire-donnees-lehno.md` (voir sa section « Révisions ») mais **pas dans la source**. Une régénération du dictionnaire les effacerait, et la phase 1 ne tient pas sans eux.

| # | Ce qui manquait | Ce qu'il faut dans la source |
|---|---|---|
| B1 | Les préférences de notification (§13.1 de la spec technique, `/me/notification-preferences`) n'avaient pas d'entité | Entité **`NotificationPreference`** : `user_id`, `type` (notification_type), `push_enabled`, `email_enabled`, unicité sur (`user_id`, `type`). Absence de ligne = valeurs par défaut. Plus, sur **`User`** : `timezone` (IANA), `send_hour` (0–23), `digest_frequency` (`monthly`\|`weekly`\|`never`), `reminder_lead_days` (nullable) |
| B2 | Les jetons d'appareil (`/me/devices`) n'avaient pas d'entité | Entité **`Device`** : `user_id`, `push_token`, `platform` (`ios`\|`android`), `app_version`, `is_active`, `last_seen_at`, unicité sur (`user_id`, `push_token`). Distincte de `DeviceSignup`, qui compte les inscriptions |
| B3 | `notification_type` portait 4 valeurs, le catalogue §13.2 en demande 14 | `event_reminder`, `event_day_of`, `digest`, `contribution_received`, `wish_received`, `enrichment_nudge_global`, `enrichment_nudge_person`, `generation_ready`, `payment_succeeded`, `payment_failed`, `credits_received`, `login_code`, `security`, `account` |
| B4 | `Notification` ne portait pas de quoi s'afficher | Colonnes **`title_key`**, **`body_params`** (jsonb), **`read_at`**, **`target_route`**, **`dedupe_key`** (unique), **`scheduled_for`** ; canal `in_app` ajouté à l'énum. Le serveur transporte des clés, pas des phrases : la langue d'interface peut changer après l'envoi |
| B5 | `ai_usage.action_run_id` était non nul | Le rendre **nullable**, ajouter **`purpose`** (`note_classification`, `sensitive_detection`, `portrait`, `gift_ideas`, `wish_message`) et **`user_id`** nullable. Le classement des notes et la détection du sensible sont gratuits, donc sans `ActionRun` — mais se paient en argent réel, et les omettre fausserait le suivi de marge promis en §12.3 |
| B6 | La rotation du jeton de rafraîchissement (§9.1) n'avait pas de table | Entité **`RefreshToken`** : `user_id`, `family_id`, `token_hash` (SHA-256, sans clé — 256 bits ne s'énumèrent pas), `parent_id`, `expires_at`, `consumed_at`, `revoked_at`, `user_agent`, `ip`. Rejouer un jeton consommé révoque toute la lignée |
| B7 | La landing de pré-lancement n'avait où déposer une adresse | Entité **`WaitlistSignup`** : `email` (citext, unique), `locale`, `source`, `ip`. Rattachée à aucun `User` — une adresse déposée ne crée pas de compte |
| B8 | Les écrans Aide et Réglages appelaient trois entités absentes | **`SupportRequest`** (`subject`, `body`, `app_version`, `platform`, `status`), **`Feedback`** (`rating`, `body`, `app_version`), **`DataExportRequest`** (`status`, `file_url`, `expires_at`, `completed_at`) |
| B9 | Deux règles de calendrier restaient ouvertes | Sur **`Schedule`** : un anniversaire du **29 février** se marque le **28** les années communes ; un offset tombant sur un jour absent du mois d'arrivée est **ramené au dernier jour** de ce mois. Les offsets suivants se calculent toujours depuis la `reference_date`, jamais depuis une échéance déjà ramenée — le décalage ne s'accumule pas. Calcul en dates civiles, dans le fuseau de l'utilisateur |

---

## C — En attente d'arbitrage : le tarif sur la landing

Deux décisions se contredisent :

- le **2026-08-22**, le tarif est retiré de la landing, et `ux-surfaces-publiques-lehno.md` §3.1 porte ce retrait avec sa raison ;
- la **maquette v3**, plus récente, porte une section « Ce que ça coûte » : *Gratuit* · **100 F le crédit** · *5 crédits offerts à l'inscription*.

Il faut trancher, puis aligner la maquette et la spec.

**Si le tarif reste**, un point est à corriger dans la maquette : `100 F` et `5 crédits` y sont **écrits en dur** dans la table de chaînes. La spécification technique (§6) veut que la landing lise ces montants sur `/public/config` — `credit_unit_price` et `signup_free_credits` — plutôt que de les figer dans le code du site. Un prix figé dans une page devient faux le jour où l'administration le change.

---

## Deux points de méthode

**Le dictionnaire n'a pas été régénéré cette fois** — c'est pourquoi la partie B a survécu. Elle tombera à la prochaine régénération si la source ne l'absorbe pas d'ici là.

**Trois chaînes mortes** subsistent dans la table de la maquette v3, héritées de l'ancien accueil et que plus rien n'affiche : `qaAnniv`, `qaNote`, `qaFiche`, ainsi que `contribs`, `reprises` et `voirTout`. À retirer, faute de quoi elles reviendront dans une prochaine maquette.

# Lehno — Dictionnaire de données

Document technique de référence pour le build. Il détaille, pour chaque entité, ses attributs, leurs types (PostgreSQL), leur nullabilité, leurs contraintes et leurs relations.

Il **complète** la documentation fonctionnelle (`doc-fonctionnelle-assistant-anniversaires.md`), qui reste la source du modèle (entités, relations, intentions). En cas d'évolution : le *modèle* se met à jour dans la doc fonctionnelle, les *attributs détaillés* dans ce dictionnaire.

## Conventions

- **Types** : types PostgreSQL. `uuid`, `text`, `varchar(n)`, `timestamptz`, `date`, `numeric(p,s)`, `integer`, `boolean`, `jsonb`, et types énumérés (`enum`) explicités par entité.
- **Clé primaire** : chaque entité porte `id uuid` (PK), généré (`gen_random_uuid()`), non affiché dans les tables ci-dessous sauf mention.
- **Horodatage** : `created_at timestamptz not null default now()` et, quand l'entité est modifiable, `updated_at timestamptz not null default now()`. Non répétés dans chaque table sauf pertinence.
- **Multi-tenant** : chaque entité est rattachée à un compte propriétaire, directement (`user_id`) ou via son parent. Pour les entités possédées en propre, `user_id uuid not null references "user"(id)`. Pour les entités de **contenu** (`Note`, `Event`), le rattachement au propriétaire passe par le parent (`person_id → person.user_id`) ; leur propre champ `user_id` a un autre sens — l'**auteur** de la contribution, nullable (null pour une contribution anonyme, voir chaque table).
- **FK / suppression** : le comportement `on delete` est précisé par relation (`cascade`, `restrict`, `set null`).
- **Nommage** : `snake_case` pour les colonnes ; les noms d'entités sont donnés dans leur forme logique (le nom de table réelle est laissé à l'implémentation).
- **Enums** : définis comme types PostgreSQL `enum` ou tables de référence selon préférence d'implémentation ; les valeurs sont fixées ici.

---

# 1. Identité & compte

## User

Titulaire et compte fusionnés. Racine du cloisonnement multi-tenant.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | Identité interne immuable ; jamais l'e-mail |
| email | citext | non | oui | — | Identifiant de connexion ; `citext` pour l'unicité insensible à la casse |
| email_verified | boolean | non | — | false | Passe à true après vérification OTP |
| username | citext | non | oui | — | Pseudo public unique |
| display_name | text | oui | — | — | Nom d'affichage libre (facultatif) |
| avatar_url | text | oui | — | — | Photo de profil ; nul si l'initiale est utilisée. Reprise sur le `Wall` et auprès de la signature d'un `GeneratedProfile` |
| referral_code | varchar(16) | non | oui | généré | Jeton de partage de parrainage ; **pas** un credential |
| referred_by | uuid | oui | — | — | FK → user(id) on delete set null ; parrain éventuel |
| status | user_status (enum) | non | — | 'active' | `active` \| `suspended` \| `pending_deletion` (désactivé, dans le délai de grâce) \| `deleted` |
| deletion_requested_at | timestamptz | oui | — | — | Début du délai de grâce ; l'effacement définitif intervient après `account_grace_period_days` |
| deletion_reason | text | oui | — | — | Raison du départ, facultative (motif choisi ou texte libre) |
| gender | person_gender (enum) | oui | — | 'unspecified' | **Sert l'accord grammatical** de ce que l'utilisateur signe : *je suis fier* ou *fière*. Demandé au studio, à la première génération |
| ui_language | varchar(10) | non | — | 'fr' | Langue de l'interface (code BCP 47, ex. `fr`, `en`) ; distincte de `person.language`, la langue de communication propre à chaque proche |
| theme | ui_theme (enum) | non | — | 'system' | Apparence choisie : `system` (suit l'appareil) \| `light` \| `dark` |
| timezone | varchar(64) | non | — | 'Africa/Douala' | Fuseau IANA ; décide de « aujourd'hui » et de l'heure des envois |
| send_hour | smallint | non | — | 9 | Heure locale des rappels et récapitulatifs (0–23) |
| digest_frequency | digest_frequency (enum) | non | — | 'monthly' | `monthly` \| `weekly` \| `never` |
| reminder_lead_days | smallint | oui | — | — | Délai d'anticipation par défaut des rappels ; nul = valeur du `SystemParameter`. Un `Schedule` peut le surcharger |
| created_at | timestamptz | non | — | now() | |
| updated_at | timestamptz | non | — | now() | |

- Enum `user_status` : `active`, `suspended`, `pending_deletion`, `deleted`.
- **Suppression avec délai de grâce** : la demande passe le compte en `pending_deletion` et renseigne `deletion_requested_at`. Le compte est alors inaccessible et ses surfaces publiques cessent de répondre, mais les données sont conservées jusqu'à l'expiration du délai (`SystemParameter` `account_grace_period_days`, trente jours par défaut), puis effacées. Un retour en arrière pendant le délai passe par l'assistance.
- Le **solde de crédits** n'est pas une colonne : il se calcule comme somme de `credit_transaction.amount` pour ce `user_id` (voir CreditTransaction).
- La self-Person (fiche de l'utilisateur sur lui-même) est une `person` rattachée à ce `user_id` et repérée par `person.is_self = true`.

## OTPCode

Code à usage unique pour vérification d'e-mail et connexion. Éphémère.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| user_id | uuid | oui | — | — | FK → user(id) on delete cascade ; nul si compte pas encore créé |
| target_email | citext | non | — | — | E-mail ciblé (inscription avant création du user) |
| code_hash | text | non | — | — | Code **haché**, jamais en clair |
| reason | otp_reason (enum) | non | — | — | `email_verification` \| `login` |
| expires_at | timestamptz | non | — | — | Courte durée (quelques minutes) |
| consumed_at | timestamptz | oui | — | — | Renseigné à la consommation |
| attempts | integer | non | — | 0 | Compteur de tentatives (anti-brute-force) |
| created_at | timestamptz | non | — | now() | |

- Enum `otp_reason` : `email_verification`, `login`.
- Purge recommandée des codes expirés/consommés (rétention courte).

## FederatedIdentity

Rattachement d'un compte à un fournisseur d'identité externe (Google, Apple), pour la connexion en un geste. Un `User` peut en porter plusieurs, et garde toujours la connexion par OTP.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| user_id | uuid | non | — | — | FK → user(id) on delete cascade |
| provider | identity_provider (enum) | non | — | — | `google` \| `apple` |
| provider_user_id | text | non | — | — | Identifiant stable fourni par le fournisseur |
| email_at_link | citext | oui | — | — | E-mail transmis lors du rattachement (trace ; l'e-mail de référence reste `user.email`) |
| created_at | timestamptz | non | — | now() | |
| last_used_at | timestamptz | oui | — | — | Dernière connexion via ce fournisseur |

- Enum `identity_provider` : `google`, `apple`.
- Unicité sur (`provider`, `provider_user_id`) : une identité externe ne peut pointer que vers un compte.
- Au plus une identité par fournisseur et par `User` (index unique sur `user_id`, `provider`).
- **Un seul compte par personne** : si l'e-mail fourni correspond à un `User` existant et vérifié, l'identité s'y rattache au lieu de créer un second compte. Apple pouvant transmettre une adresse relais privée, le rattachement s'appuie d'abord sur `provider_user_id`.

## PaymentMethod

Moyen de paiement enregistré par un `User` pour ses recharges, et destination d'un éventuel remboursement. Un utilisateur peut en enregistrer **plusieurs**. Le traitement diffère selon la nature : une **carte** vit chez le prestataire, qui rend une référence opaque ; un **compte mobile money** s'identifie par son **numéro de téléphone**, que l'application conserve chiffré, car il est nécessaire pour initier une transaction et pour verser un remboursement.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| user_id | uuid | non | — | — | FK → user(id) on delete cascade |
| provider_ref | text | oui | — | — | Référence chez le prestataire, pour une carte tokenisée ; nul pour un compte mobile money |
| msisdn | text | oui | — | — | Numéro du compte mobile money, **chiffré au repos** ; nécessaire pour initier une transaction et verser un remboursement. Nul pour une carte |
| kind | payment_method_kind (enum) | non | — | — | `mobile_money` (cas le plus courant sur le marché visé) \| `card` |
| brand | varchar(40) | oui | — | — | Opérateur (`MTN MoMo`, `Orange Money`) ou réseau de carte, pour l'affichage |
| last4 | varchar(4) | oui | — | — | Derniers chiffres du numéro de téléphone ou de la carte, pour l'affichage |
| expires_at | date | oui | — | — | Échéance éventuelle |
| last_used_at | timestamptz | oui | — | — | Dernier paiement réussi ou tenté avec cette méthode ; **détermine celle qui est proposée par défaut** à l'achat |
| first_successful_payment_at | timestamptz | oui | — | — | Date du premier paiement réussi avec cette méthode ; **nul tant qu'elle n'a jamais servi** |
| created_at | timestamptz | non | — | now() | Date d'enregistrement ; sert au délai d'éligibilité au remboursement |

- Enum `payment_method_kind` : `mobile_money`, `card`.
- Le numéro d'un compte mobile money (`msisdn`) est **chiffré au repos**, déchiffré pour la seule communication avec le prestataire, et **masqué partout à l'affichage** — seuls l'opérateur et `last4` paraissent à l'écran. Il n'entre dans aucun journal.
- **Enregistrement à la volée** : au premier achat, la méthode se crée pendant le parcours de paiement, puis sert à lancer l'opération dans la foulée.
- **Choix par défaut** : l'achat propose la méthode dont `last_used_at` est le plus récent ; l'utilisateur peut en désigner une autre ou en ajouter une nouvelle, qui prend alors la tête.
- **Éligibilité au remboursement** : une méthode ne peut recevoir un remboursement que si `created_at` remonte à plus de deux semaines **et** que `first_successful_payment_at` est renseigné. Le délai est porté par un `SystemParameter` (`refund_method_min_age_days`), réglable par l'`Admin`.

## Payment

Achat de crédits réglé par un `User`. Alimente l'historique des paiements et le reçu.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| user_id | uuid | non | — | — | FK → user(id) on delete cascade |
| payment_method_id | uuid | oui | — | — | FK → payment_method(id) on delete set null ; méthode utilisée |
| mode | payment_mode (enum) | non | — | 'provider' | Par quelle voie ce paiement se règle |
| credit_bundle_id | uuid | oui | — | — | FK → credit_bundle(id) on delete set null ; le palier acheté |
| collection_account_id | uuid | oui | — | — | FK → collection_account(id) on delete restrict ; le compte qui a REÇU l'argent, sur les voies manuelles |
| payer_msisdn | varchar(32) | oui | — | — | Le numéro depuis lequel le client déclare avoir versé — semi-manuel seulement |
| proof_key | text | oui | — | — | Reçu déposé par le client ou saisi par l'administrateur : image ou PDF. Référence sur le stockage |
| provider_ref | text | oui | oui | — | Référence de la transaction. Chez le prestataire pour `provider` ; **saisie par l'administrateur** sur les voies manuelles, à la confirmation. Nulle tant qu'elle n'est pas connue — d'où l'unicité partielle, sur les valeurs présentes |
| payment_channel_id | uuid | oui | — | — | FK → payment_channel(id) on delete restrict ; le canal employé, et son barème |
| fee_amount | numeric(12,2) | oui | — | — | Les frais **annoncés à l'aperçu**, figés ici. Pas ceux que le canal porte aujourd'hui : changer un taux ne doit pas fausser rétroactivement la comptabilité |
| expected_amount | numeric(12,2) | oui | — | — | Ce qu'on **attend sur le compte**, calculé à l'aperçu depuis le montant, les frais et `fee_borne_by` |
| received_amount | numeric(12,2) | oui | — | — | Ce que l'administrateur a **constaté sur le compte**. Comparé à `expected_amount` : un écart se traite, il ne se devine pas |
| direction | payment_direction (enum) | non | — | 'charge' | `charge` (achat) \| `refund` (remboursement) |
| amount | numeric(12,2) | non | — | — | Montant réglé |
| currency | varchar(3) | non | — | — | Code ISO 4217 |
| credits | integer | non | — | — | Nombre de crédits achetés (ou repris, si remboursement) |
| status | payment_status (enum) | non | — | 'pending' | `pending` (en attente de validation chez l'opérateur) \| `succeeded` \| `failed` (refusé) \| `expired` (validation jamais donnée) \| `refunded` |
| failure_reason | text | oui | — | — | Motif du refus, pour l'affichage |
| created_at | timestamptz | non | — | now() | |

- Enum `payment_direction` : `charge`, `refund`.
- Enum `payment_mode` : `provider` (l'intégration, quand elle existera), `semi_manual` (le client verse puis dépose son reçu), `manual` (un administrateur saisit tout depuis le back-office).
- **Les deux voies manuelles sont des `Payment`, pas une entité à part.** Elles ont le même cycle de vie, la même histoire d'états, et produisent le même `CreditTransaction` portant `payment_id`. Une table parallèle obligerait à tenir deux registres, deux historiques et deux chemins d'octroi — et une recharge manuelle n'apparaîtrait pas dans l'historique des paiements du client.
- **`provider_ref` est nulle tant que la référence n'est pas connue.** Sur la voie du prestataire elle arrive avec la notification ; sur les voies manuelles, c'est l'administrateur qui la consigne au moment de confirmer. L'unicité porte donc sur les valeurs présentes (index unique partiel) — sans quoi deux demandes en attente entreraient en collision sur une valeur nulle.
- **Trois montants, et ils ne disent pas la même chose.** `amount` est le prix du palier ; `expected_amount` ce qu'on attend sur le compte une fois les frais appliqués selon `fee_borne_by` ; `received_amount` ce qui est réellement arrivé. Un seul champ ne suffirait pas : sans `expected_amount`, on ne saurait pas si un écart vient du client ou du barème ; sans `received_amount`, on ne saurait pas qu'il y a écart.
- **`fee_amount` est figé au moment de l'aperçu.** Le barème d'un canal change ; un paiement passé garde les frais qui lui ont été annoncés. Lire le taux du jour pour expliquer un paiement d'il y a trois mois donnerait un chiffre faux, et personne ne s'en apercevrait.
- **`received_amount` n'est pas `amount`.** Le premier est ce que l'administrateur a vu arriver sur le compte, le second ce que le paiement visait. Les confondre effacerait le cas qui compte : un client qui verse moins que le palier choisi. L'écart se traite — on crédite le palier correspondant, ou on rejette avec motif — mais il ne se devine pas après coup.
- **Le reçu ne prouve rien.** Un montage est facile : l'administrateur **vérifie la réception sur le compte de l'opérateur** avant de confirmer, et ne se fie pas à l'image. Le fichier suit les règles des fichiers reçus (type vérifié par le contenu, poids borné, métadonnées retirées) et s'efface une fois la demande traitée.
- **Seul un administrateur confirme ou rejette**, quelle que soit la voie. Chaque passage d'état ouvre une ligne de `PaymentStatusHistory` avec `origin = 'admin'`, `changed_by_admin_id` renseigné et un **motif obligatoire** — c'est ce qui rend le registre lisible le jour d'un litige.
- **À la confirmation** : les crédits sont octroyés une seule fois (unicité partielle sur `credit_transaction.payment_id` **là où `type` vaut `purchase`** — un remboursement rattaché au même paiement violerait sinon la contrainte), et le client reçoit une notification par courriel **et** par poussée.
- Enum `payment_status` : `pending`, `succeeded`, `failed`, `expired`, `refunded`.
- Chaque changement d'état ouvre une ligne dans `PaymentStatusHistory` et ferme la précédente.
- Un `pending` se résout par trois voies, dans cet ordre : la **notification du prestataire** ; à défaut, l'**interrogation de son point d'état**, engagée une fois le délai de notification dépassé ; en dernier ressort, la **confirmation manuelle d'un administrateur**, avec motif. Les crédits ne sont octroyés qu'au passage à `succeeded`, une seule fois quelle que soit la voie qui l'a constaté. Sans résolution au terme du délai configuré, l'opération passe à `expired`.
- Un `Payment` réussi produit une `CreditTransaction` de type `purchase` ; un remboursement produit une transaction d'ajustement qui reprend les crédits correspondants.
- Le premier `Payment` réussi d'une méthode renseigne son `first_successful_payment_at`.

## DeviceSignup

Trace des créations de compte par appareil, pour limiter l'abus du parrainage (créer plusieurs comptes afin d'encaisser plusieurs fois les crédits offerts).

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| device_id | varchar(128) | non | — | — | Identifiant d'appareil fourni par l'application mobile |
| user_id | uuid | oui | — | — | FK → user(id) **on delete set null** ; compte créé depuis cet appareil. Nul lorsque ce compte a été supprimé — la trace, elle, demeure |
| ip | inet | oui | — | — | Adresse au moment de la création ; conservée pour d'éventuelles investigations, sans entrer dans le calcul du plafond |
| created_at | timestamptz | non | — | now() | |

- Index sur (`device_id`), pour compter les comptes d'un même appareil.
- **Plafond de comptes par appareil** : le décompte porte sur le seul `device_id`, et compte **toutes** les lignes de cet appareil, que le compte associé existe encore ou non. Au-delà du seuil (`SystemParameter` `max_accounts_per_device`, trois par défaut), la création est refusée.
- **La trace survit au compte.** Une suppression met `user_id` à nul sans effacer la ligne : effacer en cascade rendrait le plafond contournable en créant puis supprimant des comptes à la chaîne. C'est aussi ce que veut la règle générale des traces de sécurité (10.11 de la spécification technique), qui les fait survivre sous une forme anonymisée.
- Un appareil peut légitimement servir à plusieurs personnes (téléphone familial, appareil revendu) : le seuil laisse cette marge, et un administrateur peut lever le blocage au cas par cas.

## PaymentStatusHistory

Historique des états d'un `Payment`. Chaque état occupe une ligne, ouverte à son début et fermée lorsqu'un autre lui succède : le champ `status` du paiement dit où il en est, cette table dit **comment il y est arrivé**.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| payment_id | uuid | non | — | — | FK → payment(id) on delete cascade |
| status | payment_status (enum) | non | — | — | L'état pendant cet intervalle |
| started_at | timestamptz | non | — | now() | Entrée dans cet état |
| ended_at | timestamptz | oui | — | — | Sortie ; **nul pour l'état en cours** |
| changed_by_user_id | uuid | oui | — | — | FK → user(id) on delete set null ; l'utilisateur, lorsque le changement vient de son geste |
| changed_by_admin_id | uuid | oui | — | — | FK → admin(id) on delete set null ; l'administrateur, en cas de confirmation manuelle |
| origin | status_change_origin (enum) | non | — | — | Ce qui a provoqué le changement |
| reason | text | oui | — | — | Motif — **obligatoire** lorsque `origin = 'admin'` |
| provider_payload_ref | text | oui | — | — | Référence de la notification ou de la réponse d'interrogation qui a motivé le changement |
| created_at | timestamptz | non | — | now() | |

- Enum `status_change_origin` : `user` (le geste qui lance l'achat), `webhook` (notification du prestataire), `polling` (interrogation de son point d'état), `admin` (confirmation manuelle), `system` (expiration ou traitement programmé).
- **Une seule ligne ouverte par paiement** : `ended_at` nul ne concerne que l'état courant, et son `status` correspond toujours à celui du `Payment`.
- **Les lignes sont définitives** : un état passé ne se modifie ni ne s'efface, ce qui fonde la valeur de preuve de l'historique.
- La **durée d'un état** se lit directement — combien de temps un paiement est resté en attente, quand la notification est arrivée, quelle voie l'a résolu.
- Un changement d'origine `admin` rejoint également le **journal d'audit** (`AuditLog`), qui porte la vue transverse des actions d'administration.

## NotificationPreference

Réglage d'une nature de message pour un utilisateur. **L'absence de ligne vaut valeurs par défaut** : on n'écrit que ce qui s'écarte de l'ordinaire.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| user_id | uuid | non | — | — | FK → user(id) on delete cascade |
| type | notification_type (enum) | non | — | — | La nature réglée |
| push_enabled | boolean | non | — | true | |
| email_enabled | boolean | non | — | true | |
| updated_at | timestamptz | non | — | now() | |

- Unicité sur (`user_id`, `type`).
- Les natures `login_code`, `security` et `account` ignorent ces réglages : elles partent toujours.
- L'heure d'envoi, la fréquence du récapitulatif et le délai d'anticipation vivent sur le `User`, car ils valent pour toutes les natures.

## Device

Appareil enregistré pour recevoir les notifications poussées. À distinguer de `DeviceSignup`, qui compte les créations de compte.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| user_id | uuid | non | — | — | FK → user(id) on delete cascade |
| push_token | text | non | — | — | Jeton fourni par le service de notification |
| platform | notification_platform (enum) | non | — | — | `ios` \| `android` |
| app_version | varchar(20) | oui | — | — | Utile au support et au diagnostic |
| is_active | boolean | non | — | true | Passe à faux lorsque le service déclare le jeton invalide |
| last_seen_at | timestamptz | oui | — | — | Dernière ouverture depuis cet appareil |
| created_at | timestamptz | non | — | now() | |

- Unicité sur (`user_id`, `push_token`).
- Un jeton durablement rejeté cesse d'être sollicité ; le taux de jetons invalides est surveillé.

## RefreshToken

Jeton de rafraîchissement d'une session. Sa rotation permet de détecter le vol d'un jeton.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| user_id | uuid | non | — | — | FK → user(id) on delete cascade |
| family_id | uuid | non | — | — | Lignée issue d'une même connexion |
| token_hash | varchar(64) | non | oui | — | **SHA-256 sans clé** : 256 bits tirés au hasard ne s'énumèrent pas, contrairement à un code à six chiffres |
| parent_id | uuid | oui | — | — | FK → refresh_token(id) ; jeton dont celui-ci est issu |
| expires_at | timestamptz | non | — | — | |
| consumed_at | timestamptz | oui | — | — | Renseigné à l'échange |
| revoked_at | timestamptz | oui | — | — | Renseigné à la déconnexion ou à la révocation d'une lignée |
| user_agent | text | oui | — | — | Pour l'affichage des connexions récentes |
| ip | inet | oui | — | — | Investigation |
| created_at | timestamptz | non | — | now() | |

- **Rejouer un jeton déjà consommé révoque toute la lignée** (`family_id`) : c'est le signe qu'une copie circule.

## WaitlistSignup

Adresse déposée sur la liste d'attente pendant le pré-lancement. **Rattachée à aucun `User`** : déposer son adresse ne crée pas de compte.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| email | citext | non | oui | — | |
| locale | varchar(10) | oui | — | — | Langue de la page au dépôt |
| source | varchar(40) | oui | — | — | Provenance, si connue |
| ip | inet | oui | — | — | Limitation d'abus |
| created_at | timestamptz | non | — | now() | |

## SupportRequest

Message adressé à l'équipe depuis l'écran d'aide.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| user_id | uuid | non | — | — | FK → user(id) on delete cascade |
| subject | varchar(140) | oui | — | — | |
| body | text | non | — | — | |
| app_version | varchar(20) | oui | — | — | Joint automatiquement |
| platform | notification_platform (enum) | oui | — | — | Joint automatiquement |
| status | support_request_status (enum) | non | — | 'open' | `open` \| `answered` \| `closed` |
| created_at | timestamptz | non | — | now() | |

## Feedback

Avis laissé depuis l'application.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| user_id | uuid | oui | — | — | FK → user(id) on delete set null |
| rating | smallint | oui | — | — | 1 à 5, si donné |
| body | text | oui | — | — | |
| app_version | varchar(20) | oui | — | — | |
| created_at | timestamptz | non | — | now() | |

## DataExportRequest

Demande d'export de ses données personnelles.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| user_id | uuid | non | — | — | FK → user(id) on delete cascade |
| status | export_status (enum) | non | — | 'pending' | `pending` \| `ready` \| `failed` \| `expired` |
| file_url | text | oui | — | — | Adresse temporaire du fichier produit |
| expires_at | timestamptz | oui | — | — | Au-delà, le fichier est retiré |
| completed_at | timestamptz | oui | — | — | |
| created_at | timestamptz | non | — | now() | |

## LoginActivity

Trace de toutes les tentatives de connexion, consultable par l'`Admin`.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| user_id | uuid | oui | — | — | FK → user(id) on delete set null ; nul si e-mail inconnu |
| attempted_email | citext | oui | — | — | E-mail saisi (utile si `user_id` nul) |
| result | login_result (enum) | non | — | — | `success` \| `failure` |
| ip | inet | oui | — | — | Adresse IP |
| user_agent | text | oui | — | — | Agent / appareil |
| geo_approx | text | oui | — | — | Géolocalisation approximative éventuelle |
| created_at | timestamptz | non | — | now() | Horodatage de la tentative |

- Enum `login_result` : `success`, `failure`.

---

# 2. Fiches & contenu

## Person

Fiche d'un proche, ou fiche de l'utilisateur lui-même (self-Person).

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| user_id | uuid | non | — | — | FK → user(id) on delete cascade ; propriétaire |
| display_name | text | non | — | — | Nom lisible du proche, tel qu'il apparaît dans les listes |
| calling_name | text | oui | — | — | **Comment on l'appelle** — « Karim », « Maman », « mon vieux ». Employé dans les contenus générés ; à défaut, `display_name` |
| avatar_url | text | oui | — | — | Photo du proche, facultative. À défaut, l'initiale du `display_name` |
| is_self | boolean | non | — | false | true pour la self-Person (support du Wall) |
| relation | person_relation (enum) | oui | — | — | Lien avec ce proche ; oriente le ton et les idées de cadeaux |
| relation_hint | text | oui | — | — | « on se connaît d'où », en toutes lettres — souvent plus riche que l'enum. Renseigné par le proche via une collecte publique, ou par le propriétaire |
| gender | person_gender (enum) | oui | — | 'unspecified' | **Sert l'accord grammatical** des contenus produits pour ce proche. Demandé au studio, à la première génération, jamais dans le carnet |
| city | text | oui | — | — | Ville, pour suggérer des adresses et des sorties |
| country | varchar(2) | oui | — | — | Code ISO 3166-1 alpha-2 |
| birth_date | date | oui | — | — | **Sa date de naissance.** Elle appartient au PROCHE, pas à un événement : c'est un fait de son identité, et l'anniversaire n'en est qu'une conséquence |
| birth_year_known | boolean | non | — | true | false quand on connaît le jour et le mois sans l'année — on suit alors l'anniversaire sans pouvoir dire l'âge |
| register | person_register (enum) | oui | — | — | Registre de communication |
| language | varchar(10) | oui | — | — | Langue préférée (code BCP 47, ex. `fr`, `en`) |
| preferred_channel | contact_channel (enum) | oui | — | — | Par où on lui écrit d'ordinaire ; oriente la longueur du message produit |
| created_at | timestamptz | non | — | now() | |
| updated_at | timestamptz | non | — | now() | |

- Enum `person_register` : `familier`, `amical`, `formel`.
- Enum `person_relation` : `famille_proche`, `famille_etendue`, `ami`, `partenaire`, `collegue`, `relation_pro`, `connaissance`.
- Enum `person_gender` : `female`, `male`, `other`, `unspecified`.
- Enum `contact_channel` : `whatsapp`, `sms`, `email`, `autre`.
- **La date de naissance vit ICI, et l'anniversaire s'en déduit.** Un anniversaire n'est pas une donnée de plus : c'est le prochain jour de l'année qui porte le même jour et le même mois que la naissance — celui de cette année s'il est devant nous, celui de l'année prochaine sinon. La porter sur un `Event` reviendrait à ranger un fait d'identité parmi les rendez-vous, et à devoir la corriger à deux endroits le jour où elle se révèle fausse.
- **`birth_year_known` accompagne la date, pas l'événement.** C'est la naissance dont l'année est inconnue, pas l'anniversaire — celui-ci a toujours une année, celle qui vient. Le champ décide si une fiche peut annoncer un âge.
- **`relation` et `relation_hint` coexistent** : l'enum sert la génération, le texte libre garde la nuance que l'enum écrase (« on a fait la fac ensemble »). Une réponse de collecte publique peut proposer une `relation`, que le propriétaire confirme.
- **Le genre sert d'abord la grammaire.** En français, on n'écrit pas à quelqu'un sans savoir : *fier ou fière*, *le meilleur ou la meilleure*. Ce n'est pas un signal, c'est un accord. Sans lui, un message est soit fautif, soit contraint à des tournures neutres qui sonnent creux.
- **Il se demande au studio, à la première génération**, là où il sert — « pour écrire correctement : fier ou fière ? » —, jamais dans le carnet. Un champ posé sans raison paraît intrusif ; posé à l'endroit où il sert, il ne l'est pas. `unspecified` reste une réponse légitime, et la génération emploie alors des tournures qui s'en passent.
- **Il oriente aussi les idées de cadeaux**, mais faiblement : une seule note bien prise vaut mieux que lui.
- Contrainte : au plus une `person` avec `is_self = true` par `user_id` (index unique partiel).

## Event

Occasion datée rattachée à une `Person`.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| person_id | uuid | non | — | — | FK → person(id) on delete cascade ; propriétaire via `person.user_id` (cloisonnement) |
| author_user_id | uuid | oui | — | — | FK → user(id) on delete set null ; **auteur** de l'événement (User qui l'a créé, ou dont la contribution l'a produit) ; **null si contribution anonyme** |
| label | text | oui | — | — | Libellé libre (ex. « Rencontre », « Mariage ») |
| kind | event_kind (enum) | non | — | 'other' | Routage UX : `birthday` \| `other` |
| event_nature | event_nature (enum) | non | — | 'happy' | Tonalité : `happy` \| `sensitive` |
| reference_date | date | non | — | — | Date d'ancrage, **toujours à venir**. Un événement dit quand la chose SERA — un mariage, une soutenance. Pour un anniversaire, elle vaut la prochaine échéance, calculée depuis `person.birth_date` |
| created_at | timestamptz | non | — | now() | |
| updated_at | timestamptz | non | — | now() | |

- Enum `event_kind` : `birthday`, `other`.
- Enum `event_nature` : `happy`, `sensitive`.
- Pas de champ `event_type` : le caractère récurrent/ponctuel se déduit des `schedule` rattachés.
- Affichage bilingue : un événement `birthday` porte un libellé fourni par les traductions de l'app (« anniversaire » / « birthday ») ; un événement `other` affiche son `label` libre tel qu'il a été saisi, sans traduction (contenu utilisateur).

## Schedule

Règle transformant `reference_date` en échéances. Un `Event` en porte une ou plusieurs.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| event_id | uuid | non | — | — | FK → event(id) on delete cascade |
| type | schedule_type (enum) | non | — | — | `recurrent` \| `offset` |
| unit | schedule_unit (enum) | oui | — | — | Requis si `recurrent` : `day`\|`week`\|`month`\|`quarter`\|`year` |
| interval | integer | oui | — | — | Requis si `recurrent` : tous les N (≥ 1) |
| offset_unit | offset_unit (enum) | oui | — | — | Requis si `offset` : `day`\|`month` |
| offset_amount | integer | oui | — | — | Requis si `offset` : +N |
| lead_time_days | integer | oui | — | — | Délai d'anticipation du rappel propre à ce schedule |
| created_at | timestamptz | non | — | now() | |

- Enum `schedule_type` : `recurrent`, `offset`.
- **Jours absents du calendrier.** Un anniversaire du **29 février** se marque le **28 février** les années communes. Plus généralement, une échéance qui tomberait sur un jour absent du mois d'arrivée est **ramenée au dernier jour** de ce mois (un offset d'un mois depuis le 31 janvier échoit le 28 ou le 29 février).
- **Pas de dérive.** Les offsets successifs se calculent toujours depuis la `reference_date`, jamais depuis une échéance déjà ramenée : le décalage ne s'accumule pas.
- **Dates civiles.** Le calcul se fait en dates civiles, dans le fuseau de l'utilisateur — « aujourd'hui » désigne autre chose selon l'endroit.
- Enum `schedule_unit` : `day`, `week`, `month`, `quarter`, `year`.
- Enum `offset_unit` : `day`, `month`.
- Contrainte : si `type = recurrent` → `unit` et `interval` non nuls ; si `type = offset` → `offset_unit` et `offset_amount` non nuls (contrainte `check`).

## EventOccurrence

Instance datée d'un `Event` pour une échéance donnée (l'anniversaire d'une année). Ancrage du contenu millésimé.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| event_id | uuid | non | — | — | FK → event(id) on delete cascade |
| user_id | uuid | non | — | — | Propriétaire (dérivé de l'event) ; cloisonnement/index |
| occurrence_date | date | non | — | — | Date concrète de cette échéance |
| occurrence_year | integer | oui | — | — | Millésime (dérivable de la date ; pratique pour requêter/indexer) |
| status | occurrence_status (enum) | non | — | 'upcoming' | `upcoming` (avant fenêtre) \| `collecting` (fenêtre ouverte) \| `closed` (après) — dérivable de la date et des délais, matérialisable pour requêter |
| created_at | timestamptz | non | — | now() | |

- Enum `occurrence_status` : `upcoming`, `collecting`, `closed`.
- Unicité logique (`event_id`, `occurrence_date`) : une seule occurrence par échéance.
- **Fenêtre de vœux** : `[occurrence_date − wish_window_lead_days, occurrence_date + wish_window_trail_days]`, les deux délais venant de `SystemParameter` (défauts 7 et 30). Le `WishCollectionLink` de l'occurrence n'accepte les `ReceivedWish` que dans cette fenêtre.
- **Cycle de vie** : créée à la saisie de l'anniversaire (échéance à venir) ; à la fermeture de la fenêtre, l'occurrence de l'année suivante est ouverte. Une seule occurrence courante par event à la fois.

## Note

Capture en texte libre, classée en catégories.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| person_id | uuid | non | — | — | FK → person(id) on delete cascade ; propriétaire via `person.user_id` (cloisonnement) |
| author_user_id | uuid | oui | — | — | FK → user(id) on delete set null ; **auteur** de la note (User qui l'a laissée) ; **null si contribution anonyme** via un lien de collecte |
| event_id | uuid | oui | — | — | FK → event(id) on delete set null ; contextualisation éventuelle |
| event_occurrence_id | uuid | oui | — | — | FK → event_occurrence(id) on delete cascade ; renseigné pour une **note de circonstance**, propre à une occasion précise (idée de cadeau pour ce mariage, tenue à prévoir…). Nul pour une **note durable**, qui décrit le proche et vaut d'une année sur l'autre |
| content | text | non | — | — | Contenu libre |
| origin | content_origin (enum) | non | — | 'owner' | `owner` \| `collected` |
| created_at | timestamptz | non | — | now() | Horodatage (distingue récent/périmé) |

- Enum `content_origin` : `owner`, `collected`.
- Le classement en catégories est une relation N–N (voir NoteCategory).
- **Deux natures de notes**, distinguées par `event_occurrence_id` : les **durables** (nul) décrivent le proche et nourrissent la génération de chaque année ; les **de circonstance** (renseigné) appartiennent à une occasion et s'affichent sur sa page. Les deux nourrissent la génération de l'occasion concernée.

## Category

Catégorie de classement des notes. **Ensemble fixe défini par le système** (aucune catégorie personnalisée par l'utilisateur). Les libellés d'affichage (français et anglais) proviennent des ressources de traduction de l'application, indexés par `code` ; ils ne sont pas stockés en base.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| code | varchar(40) | non | oui | — | Identifiant stable, clé de traduction (ex. `gift_ideas`) |
| kind | category_kind (enum) | non | — | — | `ponctuelle` \| `durable` |
| is_constraint | boolean | non | — | false | true pour `dislikes_nogo` (contrainte active) |

- Enum `category_kind` : `ponctuelle`, `durable`.
- Socle des `code` : `gift_ideas`, `message_ideas`, `facts`, `encouragements`, `challenges` (ponctuelles) ; `interests`, `dislikes_nogo` (durables ; `dislikes_nogo` a `is_constraint = true`).

## PersonAttribute

Trait caractéristique d'un proche, **extrait des notes** par la passe de classement — jamais saisi dans un formulaire. C'est ce qui donne, en un regard, le topo d'une personne.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| person_id | uuid | non | — | — | FK → person(id) on delete cascade |
| kind | attribute_kind (enum) | non | — | — | Ce que l'attribut décrit |
| value | text | non | — | — | La valeur, telle qu'elle a été dite |
| note_id | uuid | oui | — | — | FK → note(id) on delete set null ; **la note d'où il vient** |
| observed_at | date | non | — | — | Date de la note dont il est tiré |
| created_at | timestamptz | non | — | now() | |

- Enum `attribute_kind` : `color`, `animal`, `food`, `drink`, `clothing_size`, `shoe_size`, `fragrance`, `style`, `hobby`, `occupation`, `avoid`.
- **Le plus récent l'emporte** : unicité sur (`person_id`, `kind`), la valeur nouvelle remplaçant l'ancienne. Une personne aime le bleu en mars et le vert en septembre : c'est le vert qu'on retient.
- **Chaque attribut garde sa provenance** — `note_id` et `observed_at` permettent d'afficher la ligne de provenance et de remonter à ce qui a été écrit.
- **Aucun formulaire ne les demande.** Ils naissent de la passe qui classe les notes : le même appel, avec quelques valeurs de sortie de plus. Le client affiche ce qui vient ; une valeur absente n'apparaît pas.
- `avoid` recoupe la catégorie `dislikes_nogo` : l'attribut porte la valeur précise (« alcool »), la catégorie porte la note entière.

## NoteCategory (association)

Rattachement N–N d'une `Note` à ses `Category` (une note peut relever de deux catégories).

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| note_id | uuid | non | — | — | FK → note(id) on delete cascade |
| category_id | uuid | non | — | — | FK → category(id) on delete restrict |
| assigned_by | assignment_source (enum) | non | — | 'auto' | `auto` (classement automatique) \| `user` (correction) |

- PK composite (`note_id`, `category_id`).
- Enum `assignment_source` : `auto`, `user`.
- **Zéro ligne est un état valide.** Une note que le système n'a pas su ranger reste sans catégorie : aucun repli sur une catégorie fourre-tout. Elle paraît alors dans le bloc « à ranger » de la fiche, et **nourrit la génération comme les autres** — celle-ci lit le contenu, non le classement.
- **`dislikes_nogo` ne pèse pas comme les autres.** Six catégories organisent l'affichage ; celle-ci **contraint ce que le produit propose** (`category.is_constraint = true`). Se tromper de rangement ailleurs coûte un désordre ; se tromper ici fait proposer du vin à quelqu'un qui ne boit pas.

## WishlistItem

Souhait **qu'un proche m'a fait connaître**, ou que j'ai noté pour lui, rattaché à une `EventOccurrence`. Il est **privé** : personne d'autre que moi ne le voit, et il ne se partage pas.

**À distinguer de `OwnerWish`**, qui porte mes propres souhaits. Ce sont deux fonctionnalités : ce qu'un proche ose me demander à moi n'est pas ce qu'il publierait, et la liste qu'il créerait plus tard n'aurait aucun lien avec celle-ci.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| event_occurrence_id | uuid | non | — | — | FK → event_occurrence(id) on delete cascade ; l'année concernée |
| author_user_id | uuid | oui | — | — | FK → user(id) on delete set null ; **auteur** (null si contribution anonyme). Cloisonnement via l'occurrence → event → person |
| label | text | non | — | — | Intitulé du souhait |
| link | text | oui | — | — | URL éventuelle |
| image_url | text | oui | — | — | Photo de l'objet, facultative ; recomposée et servie depuis le stockage (voir 9.6 de la spécification technique) |
| details | text | oui | — | — | Précisions libres : taille, couleur, référence, où le trouver |
| price | numeric(12,2) | oui | — | — | Prix indicatif |
| currency | varchar(3) | oui | — | — | Code ISO 4217 si `price` renseigné |
| status | wishlist_status (enum) | non | — | 'available' | `available` \| `reserved` \| `fulfilled` ; **`reserved` est dérivé** d'une `WishReservation` confirmée |
| origin | wishlist_origin (enum) | non | — | — | `collected` \| `accepted_idea` \| `owner` |
| is_shortlisted | boolean | non | — | false | **Repère personnel** : je marque ce qui m'intéresse. La préparation le remonte en tête des suggestions. Invisible pour tout autre que moi, et sans effet sur la disponibilité |
| created_at | timestamptz | non | — | now() | |
| updated_at | timestamptz | non | — | now() | |

- Enum `wishlist_status` : `available`, `reserved`, `fulfilled`.
- Enum `wishlist_origin` : `collected`, `accepted_idea`, `owner`.
- **Aucune réservation ici.** Un souhait de proche ne se réserve pas : il se **marque**. Marquer n'engage à rien — on peut en marquer cinq et n'en offrir qu'un.
- `fulfilled` reste une décision du propriétaire ; `reserved` découle d'une réservation confirmée (voir `WishReservation`).

## FeatureFlag

Drapeau de fonctionnalité. Sert à **livrer progressivement** : une fonctionnalité éteinte disparaît de l'application et se refuse côté serveur.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| key | varchar(64) | non | oui (PK) | — | Correspond à une clé du registre, tenu dans le code |
| enabled | boolean | non | — | false | **Éteint par défaut** : une ligne absente vaut éteint |
| updated_at | timestamptz | non | — | now() | |
| updated_by_admin_id | uuid | oui | — | — | FK → admin(id) on delete set null |

- **La table ne porte que l'état.** Ce qu'un drapeau gouverne, sa portée, ses dépendances et **la liste des écrans et points d'entrée qu'il couvre** vivent dans le **registre**, en code : ajouter un drapeau demande un déploiement, et une clé mal orthographiée ne compile pas.
- **Réconciliation au démarrage** : les clés du registre absentes de la table y sont créées éteintes ; un état déjà réglé n'est jamais touché.
- **Les drapeaux sont globaux** : tout le monde voit la même chose. L'activation par compte (essais restreints, A/B) reste une extension possible, sans changement pour les clients — le serveur rend déjà **la liste résolue pour le demandeur**, jamais l'état brut des drapeaux.
- **Un drapeau inconnu d'un client vaut éteint.** Le parc ne se met pas à jour d'un bloc : une version installée ignore un drapeau créé après elle.
- **La vérité est côté serveur.** Le client masque ; le serveur refuse. Sans quoi une version périmée ou modifiée passerait outre.

## CreditBundle

Palier d'achat de crédits. **Réglé par l'administration** : montant, crédits obtenus, remise affichée.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| amount | numeric(12,2) | non | — | — | Prix du palier |
| currency | varchar(3) | non | — | 'XAF' | Code ISO 4217 |
| credits | integer | non | — | — | Crédits obtenus, remise comprise |
| bonus_percent | smallint | oui | — | — | Remise annoncée à l'écran ; nulle sur les petits paliers |
| position | smallint | non | — | — | Ordre d'affichage |
| is_active | boolean | non | — | true | |
| updated_at | timestamptz | non | — | now() | |

- **Aucune saisie libre d'un montant** : on achète un palier, et rien d'autre. Le plus petit palier fixe le minimum d'achat.
- **La remise s'affiche** — c'est un argument de vente, pas un calcul caché.
- Valeurs de départ, à ajuster depuis l'administration : 500 F → 5 crédits · 1 000 F → 10 · 2 000 F → 22 (+10 %) · 5 000 F → 57 (+15 %) · 10 000 F → 120 (+20 %).

## PaymentChannel

Un **canal de paiement** offert par le service, et ses frais : « MTN MoMo au
Cameroun, 2 % ». Réglé depuis le back-office.

**À ne pas confondre avec `PaymentMethod`**, et c'est la distinction qui évite
d'embrouiller la comptabilité :

- `PaymentChannel` est ce que **le service propose** — un opérateur, un pays, un
  barème. Il en existe une poignée, réglés par l'administration.
- `PaymentMethod` est ce qu'**un client a enregistré** — son numéro, sa carte.
  Il y en a autant que de clients.

Les fondre reviendrait à porter un taux de frais sur le numéro de téléphone de
chaque client, et à devoir tous les corriger le jour où MTN change son barème.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| kind | payment_method_kind (enum) | non | — | — | `mobile_money` \| `card` |
| operator | varchar(40) | non | — | — | `mtn_momo`, `orange_money`, … |
| country | varchar(2) | non | — | — | Code ISO 3166-1 alpha-2 : **les frais diffèrent d'un pays à l'autre**, même chez le même opérateur |
| label | varchar(80) | non | — | — | Nom affiché — « MTN Mobile Money » |
| fee_percent | numeric(5,2) | non | — | 0 | Part proportionnelle, en pourcentage |
| fee_fixed | numeric(12,2) | non | — | 0 | Part fixe, dans la devise du canal. Certains opérateurs prennent les deux |
| fee_min | numeric(12,2) | oui | — | — | Plancher éventuel des frais |
| fee_max | numeric(12,2) | oui | — | — | Plafond éventuel |
| fee_borne_by | fee_bearer (enum) | non | — | 'payer' | Qui supporte les frais |
| currency | varchar(3) | non | — | 'XAF' | Devise du barème |
| is_active | boolean | non | — | true | |
| position | smallint | oui | — | — | Ordre d'affichage |
| updated_at | timestamptz | non | — | now() | |

- Enum `fee_bearer` : `payer` (le client verse le montant **plus** les frais, et
  le service reçoit le montant plein) ; `payee` (les frais sont **prélevés** sur
  le versement, et le service reçoit moins que ce que le client a envoyé).
- **Sur le mobile money, c'est le client qui paie les frais** — tranché le
  25/08/2026. Un palier à 1 000 F fait verser **1 020 F**, et il en arrive
  **1 000**. `fee_borne_by = 'payer'`, et l'écart attendu sur le compte est
  nul : tout manque est donc un vrai écart, pas le fonctionnement de
  l'opérateur.
- **Le champ demeure malgré tout, parce que la carte se comporte à l'inverse.**
  Un prestataire de carte prélève sa part sur ce qu'il reverse : le client est
  débité de 1 000 et le service en reçoit 980 (`fee_borne_by = 'payee'`). Coder
  la règle du mobile money en dur rendrait la carte inexprimable le jour où
  elle arrivera, et le montant attendu serait alors faux sans que rien ne le
  signale.
- **Unicité logique sur (`operator`, `country`, `kind`)** : un même opérateur
  n'a qu'un barème par pays. Deux lignes concurrentes rendraient l'aperçu
  indéterminé.
- **Jamais supprimé, seulement désactivé** : un `Payment` passé le référence, et
  son barème explique le montant qui a été versé ce jour-là.
- **Le barème du jour ne réécrit pas le passé.** Un `Payment` conserve les frais
  qui lui ont été annoncés (`fee_amount`), et non ceux que le canal porte
  aujourd'hui. Sans cela, changer un taux fausserait rétroactivement toute la
  comptabilité.
- Sa modification est une action sensible : elle passe au journal d'audit.

## CollectionAccount

Un compte d'opérateur sur lequel les clients versent. **Géré depuis le
back-office** : on en ouvre un, on le nomme, on décide s'il paraît dans
l'application.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| label | varchar(80) | non | — | — | Nom affiché — « Orange Money principal » |
| operator | varchar(40) | non | — | — | L'opérateur : `orange_money`, `mtn_momo`, … |
| number | varchar(32) | non | — | — | Le numéro sur lequel verser |
| is_visible_in_app | boolean | non | — | false | **Paraît-il dans l'application ?** Un compte peut servir aux saisies d'administration sans être proposé aux clients |
| is_active | boolean | non | — | true | Un compte fermé cesse d'être proposé, sans disparaître des paiements passés |
| position | smallint | oui | — | — | Ordre d'affichage |
| created_at | timestamptz | non | — | now() | |
| updated_at | timestamptz | non | — | now() | |

- **`is_visible_in_app` et `is_active` ne disent pas la même chose.** Le premier
  décide de ce que le client voit ; le second, de ce qui reste employable. Un
  compte peut être actif pour l'administration et invisible dans l'application
  — le temps d'un essai, ou parce qu'il sert d'appoint.
- **Jamais supprimé, seulement désactivé** : un `Payment` passé le référence, et
  effacer le compte rendrait ce paiement inexplicable.
- Sa modification est une action sensible : elle passe au journal d'audit.

## ManualTopUp — **retirée**, absorbée par `Payment`

Cette entité décrivait la demande de recharge manuelle comme une chose à part.
Elle ne l'est pas : c'est un **paiement**, avec le même cycle de vie et la même
histoire d'états. Voir `Payment.mode` — `semi_manual` et `manual`.

Ce que la fusion évite : deux registres à tenir, deux historiques d'états, deux
chemins d'octroi de crédits. Et surtout, une recharge manuelle qui n'aurait pas
paru dans l'historique des paiements du client — alors que c'est un paiement,
du point de vue de celui qui a versé l'argent.

La correspondance, pour qui lisait l'ancienne table :

| Ancien champ | Devient |
|---|---|
| `user_id` | `payment.user_id` |
| `credit_bundle_id` | `payment.credit_bundle_id` |
| `declared_amount` | `payment.amount` — ce que le paiement visait |
| `operator` | `payment.collection_account_id` → le compte, qui porte son opérateur |
| `proof_key` | `payment.proof_key` |
| `status` `pending`/`approved`/`rejected` | `payment.status` `pending`/`succeeded`/`failed` |
| `reason` | le motif de la ligne `payment_status_history` correspondante |
| `handled_by_admin_id` | `payment_status_history.changed_by_admin_id` |
| `handled_at` | `payment_status_history.started_at` de l'état final |

## GiftGiven

Ce qui a été offert à un proche, une année donnée. **Sans cette trace, rien n'empêche de proposer en 2027 le cadeau de 2026** — or c'est la mémoire que le produit promet.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| person_id | uuid | non | — | — | FK → person(id) on delete cascade |
| event_occurrence_id | uuid | oui | — | — | FK → event_occurrence(id) on delete set null ; l'occasion, si elle est connue |
| label | text | non | — | — | Ce qui a été offert, en toutes lettres |
| wishlist_item_id | uuid | oui | — | — | FK → wishlist_item(id) on delete set null ; renseigné si le cadeau venait de la liste |
| given_on | date | oui | — | — | Date de l'offrande, si elle diffère de l'occasion |
| created_at | timestamptz | non | — | now() | |

- **Trois façons d'alimenter cette trace** : marquer un `WishlistItem` comme `fulfilled` (le libellé est repris), retenir une idée proposée par la génération, ou saisir librement un cadeau trouvé ailleurs.
- La génération d'idées **lit cet historique** et écarte ce qui a déjà été offert.
- La fiche d'un proche affiche cet historique par année.

## OwnerWish

**Mon** souhait, sur **ma** liste. Rattaché à une `EventOccurrence` qui m'appartient — mon anniversaire, mon mariage, ma crémaillère : un cadeau de Noël n'est pas un cadeau de mariage.

Sa raison d'être est d'**être partagé** : c'est la surface la plus visible du produit vers l'extérieur.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| event_occurrence_id | uuid | non | — | — | FK → event_occurrence(id) on delete cascade ; une occasion **de l'utilisateur lui-même** |
| label | text | non | — | — | Intitulé du souhait |
| link | text | oui | — | — | URL éventuelle |
| image_key | text | oui | — | — | Photo de l'objet, facultative |
| details | text | oui | — | — | Taille, couleur, référence, où le trouver |
| price | numeric(12,2) | oui | — | — | Prix indicatif |
| currency | varchar(3) | oui | — | — | Code ISO 4217 si `price` renseigné |
| status | wishlist_status (enum) | non | — | 'available' | `available` \| `reserved` \| `fulfilled` ; **`reserved` est dérivé** d'une réservation confirmée |
| is_public | boolean | non | — | true | Exposé sur la liste partagée ; un souhait peut rester privé |
| position | smallint | oui | — | — | Ordre voulu par le propriétaire |
| created_at | timestamptz | non | — | now() | |
| updated_at | timestamptz | non | — | now() | |

- **Seul un `OwnerWish` se réserve** (voir `WishReservation`). Un souhait de proche se marque, il ne se réserve pas.
- Le propriétaire est **prévenu de chaque réservation confirmée** — c'est ce qui rend la liste vivante après le partage.
- **Aucun lien avec `WishlistItem`.** Si un proche crée un compte, il compose sa propre liste : ce qu'il m'avait confié n'est pas ce qu'il publierait, et sa liste publique sera plus longue.
- Une liste dont l'occasion est passée **s'archive** et cesse d'accepter des réservations.

## WishReservation

Réservation d'un souhait public par un visiteur, **sans compte**. Elle évite que deux proches offrent la même chose.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| owner_wish_id | uuid | non | — | — | FK → owner_wish(id) on delete cascade ; **seuls mes propres souhaits se réservent** |
| user_id | uuid | oui | — | — | FK → user(id) on delete set null ; renseigné lorsque le réservant a un compte Lehno |
| email | citext | non | — | — | Adresse du réservant ; celle du compte s'il en a un, sinon celle qu'il a donnée |
| display_name | varchar(80) | oui | — | — | Nom donné par le visiteur, si `show_identity` |
| show_identity | boolean | non | — | false | Le visiteur choisit si le propriétaire voit son nom |
| status | reservation_status (enum) | non | — | 'pending' | `pending` \| `confirmed` \| `cancelled` \| `expired` |
| code_hash | text | oui | — | — | **HMAC-SHA-256 sous clé** du code à usage unique saisi dans la page — même type et même règle que `OTPCode.code_hash`, la longueur libre laissant place au préfixe de version qui rend la rotation de clé indolore. Nul lorsque le réservant est connecté : son adresse est déjà vérifiée |
| attempts | smallint | non | — | 0 | Tentatives de saisie ; au-delà du seuil, le code est brûlé |
| session_token_hash | varchar(64) | oui | oui | — | SHA-256 du jeton remis après confirmation ; permet au visiteur de retrouver **ses** réservations en revenant |
| confirmed_at | timestamptz | oui | — | — | |
| cancelled_at | timestamptz | oui | — | — | |
| expires_at | timestamptz | non | — | — | Une réservation non confirmée se libère au terme du délai |
| created_at | timestamptz | non | — | now() | |

- Enum `reservation_status` : `pending`, `confirmed`, `cancelled`, `expired`.
- **Une seule réservation confirmée par souhait** : index unique partiel sur `owner_wish_id` là où `status` vaut **`confirmed`** — et là seulement. Inclure `pending` reviendrait à laisser la première demande occuper le souhait, donc à permettre qu'une adresse inventée le bloque : plusieurs réservations en attente coexistent, la première confirmée l'emporte, les autres passent à `expired`.
- **Deux chemins selon qui réserve.** Un **utilisateur connecté** réserve en un geste : son adresse est déjà vérifiée par son compte, la réservation naît `confirmed` et se rattache à lui. Un **visiteur sans compte** donne son adresse, reçoit un **code à usage unique** qu'il saisit dans la page, et la réservation ne tient qu'une fois ce code vérifié. Tant qu'elle est `pending`, le souhait reste disponible pour un autre — sans quoi une adresse inventée bloquerait un cadeau.
- **Retrouver ses réservations.** Un utilisateur connecté les voit dans son espace, sur tous ses appareils. Un visiteur sans compte est reconnu par son jeton de session dans le même navigateur ; ailleurs, il redonne son adresse et un nouveau code — c'est **l'adresse qui fait l'identité**, le jeton n'étant qu'un raccourci.
- **Protections contre l'abus.** Le débit est limité **par adresse destinataire** autant que par origine — borner la seule origine laisserait le point d'entrée servir à arroser la boîte d'un tiers. Les **adresses jetables** sont refusées, et l'**énumération d'une même boîte** par suffixes (`a+1@`, `a+2@`) est détectée et bornée, la partie qui suit le `+` étant ignorée pour le décompte.
- **Ce que voit le public.** Un souhait réservé apparaît comme tel, **jamais par qui**. Le visiteur qui revient avec son jeton de session retrouve ses propres réservations, et celles-là seulement.
- **Ce que voit le propriétaire.** L'état `reserved`, et le nom du réservant **si** ce dernier l'a autorisé (`show_identity`). Le reste demeure anonyme.

---

# 3. Surfaces publiques

## Wall

Vue publique curée sur la self-Person de l'utilisateur.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| user_id | uuid | non | oui | — | Un `Wall` par utilisateur |
| slug | varchar(40) | non | oui | — | Segment d'URL public |
| is_enabled | boolean | non | — | false | Le mur est-il publié |
| show_birthday_date | boolean | non | — | true | Exposer la date d'anniversaire |
| welcome_message | text | oui | — | — | Mot d'accueil personnel, facultatif ; s'affiche sous le message d'accueil composé par le produit à partir du prénom |
| created_at | timestamptz | non | — | now() | |
| updated_at | timestamptz | non | — | now() | |

- Le contenu exposé dérive de la self-Person : catégories `interests` marquées publiques et `owner_wish.is_public = true`. La visibilité par élément vit sur ces entités, pas sur le `Wall`.
- **Pas de `wishlist_item` ici.** Cette ligne visait autrefois `wishlist_item.is_public` ; c'était une confusion entre les deux tables de souhaits. Un `WishlistItem` est ce qu'un proche m'a confié : il est privé, ne se partage pas, et son booléen — désormais `is_shortlisted` — n'est qu'un repère personnel. Ce qui se publie est `OwnerWish`, dont c'est la raison d'être.

## CollectionLink

Lien de collecte, nominatif ou public, durable et révocable.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| user_id | uuid | non | — | — | Propriétaire |
| type | collection_link_type (enum) | non | — | — | `nominatif` \| `public` |
| token | varchar(32) | non | oui | — | Jeton d'accès dans l'URL |
| person_id | uuid | oui | — | — | FK → person(id) on delete cascade ; requis si `nominatif` |
| is_active | boolean | non | — | true | Révocable (pas d'expiration automatique) |
| created_at | timestamptz | non | — | now() | |

- Enum `collection_link_type` : `nominatif`, `public`.
- **Pas de champ d'expiration** : le lien est durable ; sa fermeture passe par `is_active = false`.
- Contrainte : `person_id` non nul si `type = nominatif`.

## WishCollectionLink

Canal distinct dédié à la réception de messages de vœux, rattaché à une `EventOccurrence`.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| event_occurrence_id | uuid | non | — | — | FK → event_occurrence(id) on delete cascade ; **obligatoire** (lien sans occurrence = erreur) |
| user_id | uuid | non | — | — | Propriétaire (destinataire des vœux) |
| token | varchar(32) | non | oui | — | Jeton d'accès ; l'URL référence l'occurrence (`wish?occurrence=…`) |
| is_active | boolean | non | — | true | Révocable |
| created_at | timestamptz | non | — | now() | |

- N'accepte les `ReceivedWish` que pendant la fenêtre de vœux de l'occurrence (voir EventOccurrence). Hors fenêtre : refus.
- Le `Wall` expose le lien de l'occurrence courante ; une nouvelle occurrence chaque année ⇒ un nouveau lien.

## Submission

Soumission entrante en attente de validation (file `ReviewQueue`). Un lien peut en produire plusieurs.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| user_id | uuid | non | — | — | Destinataire (propriétaire du lien) |
| collection_link_id | uuid | non | — | — | FK → collection_link(id) on delete cascade |
| submitter_name | text | oui | — | — | Nom du répondant (lien public) |
| relation_hint | text | oui | — | — | « on se connaît d'où » (lien public) |
| submitter_email | citext | oui | — | — | Facultatif ; contact pour que le propriétaire recontacte le répondant au sujet de sa contribution |
| submitter_username | citext | oui | — | — | Facultatif ; pseudo Lehno auto-déclaré, sert à résoudre l'`author_user_id` à la validation (rattachement souple, non authentifié) |
| birth_date | date | oui | — | — | Date soumise |
| personal_note | text | oui | — | — | Mot personnel |
| status | submission_status (enum) | non | — | 'pending' | `pending` \| `validated` \| `rejected` |
| reviewed_at | timestamptz | oui | — | — | Renseigné au traitement |
| created_at | timestamptz | non | — | now() | |

- Enum `submission_status` : `pending`, `validated`, `rejected`.
- Les souhaits saisis sont portés en lignes par `SubmittedWish` (ci-dessous), et non dans un champ de la `Submission`.
- À validation : `birth_date` → `event`, chaque `submitted_wish` **retenu** → `wishlist_item` (origin `collected`), `personal_note` → `note` (catégorie `facts`). Peut créer une nouvelle `person` (lien public).
- Les **messages de vœux d'anniversaire** ne passent pas par ce canal : ils arrivent via `WishCollectionLink` et deviennent des `received_wish`.

## SubmittedWish

Souhait individuel d'une `Submission`, porté en ligne (plutôt qu'en blob) pour recevoir un **statut de review par souhait**, visible du répondant à la réouverture de son lien nominatif.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| submission_id | uuid | non | — | — | FK → submission(id) on delete cascade |
| label | text | non | — | — | Intitulé du souhait saisi |
| link | text | oui | — | — | URL éventuelle |
| price | numeric(12,2) | oui | — | — | Prix indicatif |
| currency | varchar(3) | oui | — | — | Code ISO 4217 si `price` renseigné |
| review_status | submitted_wish_review (enum) | non | — | 'pending' | `pending` \| `retained` (retenu) \| `discarded` (écarté) — décidé par le propriétaire |
| wishlist_item_id | uuid | oui | — | — | FK → wishlist_item(id) on delete set null ; renseigné quand `retained` a produit un `WishlistItem` |
| created_at | timestamptz | non | — | now() | |

- Enum `submitted_wish_review` : `pending`, `retained`, `discarded`.
- `retained` produit un `WishlistItem` (origin `collected`) ; `discarded` conserve la trace pour l'afficher au répondant. Le répondant lit ce `review_status` à la réouverture de son lien (via le `token` du `CollectionLink` nominatif).

---

# 4. Génération (sorties premium)

## GeneratedProfile

Portrait généré et persistant. C'est une **image** que l'utilisateur envoie à son proche, accompagnée d'un mot.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| action_run_id | uuid | non | — | — | FK → action_run(id) on delete cascade ; production |
| person_id | uuid | non | — | — | FK → person(id) on delete cascade ; **le portrait appartient au proche** |
| source_from | date | oui | — | — | Début de la plage de notes retenue ; nul si tout l'historique |
| source_to | date | oui | — | — | Fin de la plage de notes retenue ; nul si tout l'historique |
| event_occurrence_id | uuid | oui | — | — | FK → event_occurrence(id) on delete set null ; renseigné si le portrait a été produit depuis la préparation d'un anniversaire |
| user_id | uuid | non | — | — | Cloisonnement |
| orientation | portrait_orientation (enum) | non | — | — | Ce que le portrait exprime ; commande le texte comme l'illustration |
| visual_kind | portrait_visual (enum) | non | — | 'illustration' | `illustration` \| `photo` \| `none` — une seule voie d'image à la fois |
| illustration_family | illustration_family (enum) | oui | — | — | `nature` \| `animal` \| `abstract` ; si `visual_kind = illustration` |
| photo_style | photo_style (enum) | oui | — | — | Le style appliqué à la photo ; si `visual_kind = photo` |
| brief_text | text | oui | — | — | Ce que l'utilisateur ajoute pour orienter le dessin ; conservé le temps de la génération |
| sender_note | text | oui | — | — | La note de l'expéditeur, courte et discrète (« Fait avec soin par Valentine ») |
| content | text | non | — | — | Le message produit, deux à quatre phrases à la première personne |
| content_short | text | oui | — | — | Version courte du message, pour le format vertical |
| status | generated_profile_status (enum) | non | — | 'generated' | `generated` \| `approved` |
| image_key | text | oui | — | — | Référence de l'image composée sur le stockage de fichiers. **Jamais une URL signée** : celle-ci se demande au moment d'afficher, et expire |
| source_photo_key | text | oui | — | — | Photo déposée, si `visual_kind = photo`. **Effacée dès le traitement terminé** ; seule l'image composée demeure |
| created_at | timestamptz | non | — | now() | |
| updated_at | timestamptz | non | — | now() | |

- Enum `generated_profile_status` : `generated`, `approved`.
- Enum `portrait_orientation` : `relation`, `your_progress`, `our_progress`, `motivation`, `support`, `character`, `pride`, `affection`, `gratitude`, `what_you_taught_me`, `wish`, `tribute`.
- Enum `portrait_visual` : `illustration`, `photo`, `none`.
- Enum `illustration_family` : `nature`, `animal`, `abstract`.
- Enum `photo_style` : trois styles définis par la marque ; leurs noms restent à arrêter.
- **`tribute` est à part.** Il neutralise l'accent chaud, écarte toute illustration joyeuse et emprunte un registre sobre : une occasion sensible ne partage pas le gabarit d'une déclaration de fierté.
- **La photo ne transite qu'au moment du traitement.** Elle n'est pas conservée : `source_photo_key` est vidée dès la production terminée, et le fichier retiré du stockage par le traitement horaire.
- **Le portrait est une image, pas une page.** Il ne s'expose à aucune adresse publique : l'utilisateur l'enregistre et l'envoie lui-même, accompagné d'un mot. Le **pied de marque fait partie de l'image** — c'est ainsi qu'il fait connaître Lehno, sans lien à suivre.
- Le portrait se génère **à tout moment** depuis la fiche du proche, et **plusieurs portraits coexistent** dans le temps pour une même personne : ils donnent à voir l'évolution de la relation. `source_from` / `source_to` mémorisent la plage de notes retenue (les deux nuls = tout l'historique).

## GeneratedMessage

Brouillon de message de vœux, persistant.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| action_run_id | uuid | non | — | — | FK → action_run(id) on delete cascade |
| event_occurrence_id | uuid | non | — | — | FK → event_occurrence(id) on delete cascade ; l'année concernée |
| user_id | uuid | non | — | — | Cloisonnement |
| content | text | non | — | — | Brouillon (éditable) |
| status | generated_message_status (enum) | non | — | 'generated' | `generated` \| `edited` \| `sent` |
| created_at | timestamptz | non | — | now() | |
| updated_at | timestamptz | non | — | now() | |

- Enum `generated_message_status` : `generated`, `edited`, `sent`.
- Pas de partage public (à la différence du portrait). L'envoi est manuel (marque `sent`).
- Message **sortant** (l'owner écrit à un proche) ; à ne pas confondre avec `ReceivedWish` (entrant).
- Les **idées cadeaux** générées n'ont pas d'entité : seules les retenues persistent en `wishlist_item` (origin `accepted_idea`).

## ReceivedWish

Message d'anniversaire reçu d'un tiers via le `CollectionLink` du `Wall`, rattaché à une `EventOccurrence`. Entrant.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| event_occurrence_id | uuid | non | — | — | FK → event_occurrence(id) on delete cascade ; l'année concernée |
| user_id | uuid | non | — | — | Destinataire (propriétaire) ; cloisonnement |
| wish_collection_link_id | uuid | oui | — | — | FK → wish_collection_link(id) on delete set null ; canal d'arrivée |
| author_user_id | uuid | oui | — | — | FK → user(id) on delete set null ; auteur s'il a un compte, null si anonyme |
| author_name | text | oui | — | — | Nom de l'auteur tel que soumis (si anonyme) |
| content | text | non | — | — | Le message de vœux |
| status | received_wish_status (enum) | non | — | 'pending' | `pending` \| `approved` \| `rejected` (modéré avant affichage) |
| is_public | boolean | non | — | false | **Inactif** : les vœux reçus restent privés, le Mur n'a pas de livre d'or. Champ conservé pour une éventuelle publication ultérieure |
| show_author | boolean | non | — | true | **Inactif**, comme `is_public` : afficherait le nom de l'auteur si la publication était ouverte un jour |
| created_at | timestamptz | non | — | now() | |

- Enum `received_wish_status` : `pending`, `approved`, `rejected`.
- Modéré par l'owner (`pending` → `approved` / `rejected`), puis **conservé en privé** : un vœu approuvé se lit dans son Mur côté application et ne s'affiche jamais sur la page publique. Les champs `is_public` et `show_author` restent en place mais **ne sont pas exploités** en l'état. Entrant ; distinct de `wishlist_item` et de `generated_message`.

---

# 5. Crédits & croissance

## PremiumAction

Type d'action premium consommant des crédits.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| code | varchar(40) | non | oui | — | `gift_ideas` \| `portrait` \| `wish_message` |
| label | text | non | — | — | Libellé |
| credit_cost | integer | non | — | 1 | Coût en crédits (piloté par la donnée ; 1 pour toutes actuellement) |
| enabled | boolean | non | — | true | Action active ou non |

## ActionRun

Exécution d'une action premium.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| user_id | uuid | non | — | — | Auteur |
| premium_action_id | uuid | non | — | — | FK → premium_action(id) on delete restrict |
| event_occurrence_id | uuid | oui | — | — | Cible : l'occurrence pour laquelle la génération est lancée ; FK → event_occurrence(id) on delete set null |
| prompt_template_id | uuid | oui | — | — | FK → prompt_template(id) on delete set null ; **la version exacte du gabarit qui a produit ce contenu** |
| credits_spent | integer | non | — | — | Recopié à l'exécution (fige l'historique) |
| status | action_run_status (enum) | non | — | — | `success` \| `failure` |
| internal_cost | numeric(12,6) | oui | — | — | Coût IA réel = agrégat des `ai_usage` ; interne, non facturé |
| created_at | timestamptz | non | — | now() | |

- Enum `action_run_status` : `success`, `failure`.
- **La version du gabarit est retenue** : sans elle, comprendre pourquoi les productions d'une semaine valaient mieux que celles de la suivante devient impossible.

## CreditTransaction

Registre des mouvements de crédits. Le solde d'un `User` en est la somme.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| user_id | uuid | non | — | — | Titulaire |
| type | credit_txn_type (enum) | non | — | — | `grant` \| `purchase` \| `consumption` \| `adjustment` |
| amount | integer | non | — | — | Signé (+ crédit, − débit) |
| action_run_id | uuid | oui | — | — | FK → action_run(id) ; si `consumption` |
| referral_id | uuid | oui | — | — | FK → referral(id) ; si `grant` de parrainage |
| payment_id | uuid | oui | — | — | FK → payment(id) on delete restrict ; si `purchase`, et sur l'ajustement qui reprend un remboursement |
| promo_code_id | uuid | oui | — | — | FK → promo_code(id) ; si `grant` de code promo |
| reason | text | oui | — | — | Libellé libre (octroi direct, ajustement admin…) |
| created_at | timestamptz | non | — | now() | |

- Enum `credit_txn_type` : `grant`, `purchase`, `consumption`, `adjustment`.
- Solde = `sum(amount) where user_id = ?`. Aucune colonne de solde stockée.
- **Un paiement et un octroi sont deux choses.** Le `Payment` porte l'argent et un cycle de vie qui lui est propre (`pending` → `succeeded` / `failed` / `expired` / `refunded`) ; la `CreditTransaction` porte le mouvement en crédits, et n'existe qu'une fois le paiement abouti. Les fondre en une seule ligne obligerait à écrire un mouvement dès l'initiation, puis à le défaire si l'opérateur refuse — un solde qui monte et redescend au gré d'un paiement en attente.
- **Chaque ligne dit d'où elle vient.** `payment_id` pour un achat, `referral_id` pour un parrainage, `promo_code_id` pour un code, `action_run_id` pour une consommation. Sans ce pointeur, une ligne de +20 crédits ne se rattache à rien : on ne saurait ni quel paiement l'a produite, ni quoi reprendre lors d'un remboursement — la ligne d'ajustement n'aurait aucun moyen de désigner l'achat qu'elle annule, et un litige se règlerait à l'estime.
- **Unicité partielle sur `payment_id` là où `type = 'purchase'`.** C'est ce qui rend l'octroi unique STRUCTUREL plutôt que dépendant du code qui le vérifie : un paiement se résout par trois voies — notification, interrogation, confirmation manuelle — et deux d'entre elles peuvent constater le succès à quelques secondes d'écart. Sans la contrainte, le compte est crédité deux fois. Même logique que l'unicité sur `referral.invited_user_id`.
- **`on delete restrict` et non `cascade`** : effacer un paiement ne doit pas faire disparaître le crédit qu'il a produit. Un solde qui change parce qu'on a nettoyé une table est un solde qu'on ne peut plus expliquer.

## Referral

Trace d'un parrainage.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| referrer_id | uuid | non | — | — | FK → user(id) ; parrain |
| invited_user_id | uuid | oui | — | oui | FK → user(id) ; filleul (nul tant que pas inscrit) |
| code_used | varchar(16) | non | — | — | `referral_code` employé |
| status | referral_status (enum) | non | — | 'invited' | `invited` \| `registered` \| `credited` |
| created_at | timestamptz | non | — | now() | |

- Enum `referral_status` : `invited`, `registered`, `credited`.
- Anti-double-crédit : contrainte d'unicité sur `invited_user_id` (un filleul crédité une seule fois).
- Les deux bonus (parrain, filleul) sont des `credit_transaction` de type `grant` référençant ce `referral` ; leurs montants viennent de `SystemParameter`.

## PromoCode

Code octroyant des crédits : campagne ou coupon.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| code | varchar(32) | non | oui | — | Code saisi par l'utilisateur |
| credit_value | integer | non | — | — | Crédits octroyés |
| valid_from | timestamptz | oui | — | — | Début de validité |
| valid_until | timestamptz | oui | — | — | Fin de validité |
| max_uses | integer | oui | — | — | Plafond total d'utilisations (nul = illimité) |
| uses_count | integer | non | — | 0 | Compteur d'utilisations |
| once_per_user | boolean | non | — | true | Usage unique par personne |
| is_active | boolean | non | — | true | Activable/désactivable |
| created_at | timestamptz | non | — | now() | |

- **Campagne** : `once_per_user = true` mais `max_uses` élevé/illimité, sur une période. **Coupon** : `max_uses = 1`. Modélisés par les mêmes champs.
- La consommation crée un `credit_transaction` de type `grant` référençant le `promo_code`.

## PromoCodeRedemption (association)

Trace d'utilisation d'un `PromoCode` par un `User` (pour appliquer `once_per_user` et `max_uses`).

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| promo_code_id | uuid | non | — | — | FK → promo_code(id) on delete cascade |
| user_id | uuid | non | — | — | FK → user(id) on delete cascade |
| credit_transaction_id | uuid | non | — | — | FK → credit_transaction(id) ; le grant émis |
| created_at | timestamptz | non | — | now() | |

- Contrainte d'unicité (`promo_code_id`, `user_id`) si `once_per_user = true`.

---

# 6. Configuration & exploitation

## SystemParameter

Configuration globale clé-valeur, éditable par l'`Admin`. Non rattachée à un `User`.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| key | varchar(64) | non | oui | — | Identifiant du paramètre |
| value | text | non | — | — | Valeur (interprétée selon `value_type`) |
| value_type | param_value_type (enum) | non | — | — | `number` \| `money` \| `duration` \| `boolean` \| `string` |
| description | text | oui | — | — | Rôle du paramètre |
| updated_at | timestamptz | non | — | now() | |

- Enum `param_value_type` : `number`, `money`, `duration`, `boolean`, `string`.
- Clés attendues (indicatif) : `credit_unit_price`, `signup_free_credits`, `referral_bonus_referrer`, `referral_bonus_invited`, `reminder_lead_days_default`, `relance_cadence`, `wish_window_lead_days` (défaut 7), `wish_window_trail_days` (défaut 30), `fair_use_cap`.

## Admin

Compte d'exploitation, distinct des données d'un `User`.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| email | citext | non | oui | — | Connexion admin |
| display_name | text | oui | — | — | |
| role | admin_role (enum) | non | — | 'support' | `support` \| `admin` |
| is_active | boolean | non | — | true | |
| created_at | timestamptz | non | — | now() | |

- Enum `admin_role` : `support`, `admin`.
- **`support`** : consultation des comptes, suspension/rétablissement, modération, traitement des suppressions en cours, consultation des paiements. **`admin`** : tout cela, plus les paramètres globaux, les modèles d'IA, les codes promotionnels, les ajustements de crédits et remboursements (y compris la levée du blocage anti-fraude), l'effacement immédiat d'un compte, le journal d'audit et la gestion des accès admin.
- L'authentification admin peut réutiliser le mécanisme OTP (à préciser à l'implémentation).

## AIModel

Catalogue des modèles d'IA et configuration de routage.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| provider | varchar(40) | non | — | — | Fournisseur |
| model_key | varchar(80) | non | — | — | Identifiant du modèle chez le fournisseur |
| priority | integer | non | — | — | Ordre de préférence / repli (plus bas = prioritaire) |
| cost_input | numeric(12,6) | oui | — | — | Repère de coût par unité en entrée |
| cost_output | numeric(12,6) | oui | — | — | Repère de coût par unité en sortie |
| enabled | boolean | non | — | true | Activable/désactivable à chaud |
| created_at | timestamptz | non | — | now() | |
| updated_at | timestamptz | non | — | now() | |

- Unicité logique (`provider`, `model_key`).

## StudioConfig

Configuration d'ensemble du studio. **Un brouillon se modifie librement ; une publication met en service.** Sans cette séparation, chaque frappe partirait en production.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| version | integer | non | oui | — | S'incrémente à chaque publication |
| state | studio_config_state (enum) | non | — | 'draft' | `draft` \| `published` \| `superseded` |
| settings | jsonb | non | — | — | Orientations actives et leur ordre, ambiances, motif, modèle par production, gabarits retenus |
| published_at | timestamptz | oui | — | — | |
| published_by_admin_id | uuid | oui | — | — | FK → admin(id) on delete set null |
| note | text | oui | — | — | Ce que cette publication change, en une ligne |
| created_at | timestamptz | non | — | now() | |

- Enum `studio_config_state` : `draft`, `published`, `superseded`.
- **Une seule version publiée à la fois** : index unique partiel là où `state` vaut `published`. Publier fait passer la précédente à `superseded`.
- **Le retour arrière republie une version antérieure**, sans la reconstruire.
- **Rien ne se publie sans essai** : au moins une `StudioTrial` doit exister sur le brouillon.

## StudioProfile

Profil de simulation employé pour essayer une configuration. Composé et conservé par l'administrateur ; **ne correspond à aucun compte réel**.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| label | varchar(80) | non | — | — | Ce que ce profil met à l'épreuve (« fiche pauvre, nom long, anglais ») |
| payload | jsonb | non | — | — | Le proche simulé : nom, relation, registre, langue, notes, orientation visée |
| is_sensitive | boolean | non | — | false | Marque le cas d'une occasion sensible |
| created_at | timestamptz | non | — | now() | |

- Les profils doivent couvrir **ce qui met un gabarit à l'épreuve** : fiche riche et fiche pauvre, nom court et nom long, les deux langues, relation familiale et professionnelle, et au moins un cas sensible.

## StudioTrial

Essai d'une configuration sur un profil de simulation. **Sert la décision, jamais un utilisateur.**

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| studio_config_id | uuid | non | — | — | FK → studio_config(id) on delete cascade ; la version essayée |
| studio_profile_id | uuid | non | — | — | FK → studio_profile(id) on delete set null |
| admin_id | uuid | oui | — | — | FK → admin(id) on delete set null |
| output | jsonb | oui | — | — | Le message produit, la référence de l'image |
| cost | numeric(12,6) | oui | — | — | Coût réel de l'essai |
| status | ai_usage_status (enum) | non | — | — | `success` \| `error` \| `timeout` |
| created_at | timestamptz | non | — | now() | |

- **Un essai coûte en argent réel** sans consommer de crédit ni toucher un compte. L'écran affiche son coût et le cumul du jour ; un plafond quotidien (`SystemParameter` `studio_trial_daily_cap`) évite qu'une après-midi de réglages passe inaperçue.
- Les productions d'essai s'enregistrent dans `AIUsage` avec un `action_run_id` nul, comme les autres appels sans production visible.

## PromptTemplate

Gabarit de production du studio : ce qu'on demande au modèle pour un message, une illustration ou un traitement de photo. **Les gabarits vivent en base**, jamais dans le code : ils s'ajustent au vu des résultats.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| kind | prompt_kind (enum) | non | — | — | Ce que le gabarit produit |
| key | varchar(60) | non | — | — | L'orientation, la famille ou le style visé |
| version | integer | non | — | 1 | S'incrémente à chaque modification |
| body | text | non | — | — | Les consignes adressées au modèle |
| guardrails | jsonb | oui | — | — | Ce qui est écarté : symboles, formules, tournures |
| ai_model_id | uuid | oui | — | — | FK → ai_model(id) on delete set null ; le modèle visé |
| is_active | boolean | non | — | false | Une seule version active par (`kind`, `key`) |
| created_by_admin_id | uuid | oui | — | — | FK → admin(id) on delete set null |
| created_at | timestamptz | non | — | now() | |

- Enum `prompt_kind` : `message`, `illustration`, `photo_style`, `note_classification`, `sensitive_detection`.
- Unicité sur (`kind`, `key`, `version`) ; **une seule version active** par (`kind`, `key`), garantie par un index unique partiel.
- **Les versions ne se modifient pas.** Ajuster un gabarit crée une version nouvelle ; l'ancienne demeure, ce qui permet d'y revenir et de comprendre un écart de qualité.
- Chaque `ActionRun` retient le `prompt_template_id` qui l'a produit (voir `ActionRun`).

## AIUsage

Trace d'un appel modèle. Elle couvre **tous** les appels, y compris ceux qui ne produisent rien de visible.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| action_run_id | uuid | oui | — | — | FK → action_run(id) on delete cascade ; **nul** pour un appel sans production visible |
| purpose | ai_purpose (enum) | non | — | — | Ce à quoi l'appel a servi |
| origin | ai_origin (enum) | non | — | 'user_action' | Ce qui l'a déclenché : un geste, un traitement programmé, une reprise |
| correlation_id | varchar(64) | oui | — | — | Identifiant de corrélation, le même que celui des journaux techniques |
| user_id | uuid | oui | — | — | FK → user(id) on delete set null ; rapporte le coût à un compte |
| ai_model_id | uuid | oui | — | — | FK → ai_model(id) on delete set null ; modèle effectivement utilisé |
| provider | varchar(40) | non | — | — | Copié (traçabilité même si `ai_model` évolue) |
| model_key | varchar(80) | non | — | — | Copié |
| tokens_in | integer | oui | — | — | Tokens en entrée |
| tokens_out | integer | oui | — | — | Tokens en sortie |
| cost | numeric(12,6) | oui | — | — | Coût réel calculé de cet appel |
| latency_ms | integer | oui | — | — | Latence |
| status | ai_usage_status (enum) | non | — | — | `success` \| `error` \| `timeout` |
| created_at | timestamptz | non | — | now() | |

- Enum `ai_usage_status` : `success`, `error`, `timeout`.
- Enum `ai_purpose` : `note_classification`, `sensitive_detection`, `portrait`, `gift_ideas`, `wish_message`.
- Enum `ai_origin` : `user_action`, `scheduled_job`, `retry`, `studio_trial`.
- **L'origine sépare ce que le coût ne distingue pas** : une passe d'arrière-plan d'un geste de l'utilisateur, une première classification d'une reprise, un essai du studio d'une production réelle. Sans elle, on voit la dépense monter sans savoir quelle passe l'a causée.
- L'`internal_cost` de l'`action_run` = somme des `cost` de ses `ai_usage` rattachés.
- **Les appels gratuits comptent aussi.** Le classement d'une note et la détection d'un événement sensible ne coûtent aucun crédit à l'utilisateur, mais se paient en argent réel : les omettre fausserait le suivi de marge du tableau de bord.

## AuditLog

Journal des actions sensibles (admin et compte).

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| actor_type | audit_actor (enum) | non | — | — | `admin` \| `user` |
| actor_id | uuid | non | — | — | Réfère à admin(id) ou user(id) selon `actor_type` |
| action | varchar(64) | non | — | — | Ex. `credit_adjust`, `link_revoke`, `wall_moderate`, `data_delete` |
| target_type | varchar(40) | oui | — | — | Type d'entité visée |
| target_id | uuid | oui | — | — | Identifiant visé |
| metadata | jsonb | oui | — | — | Détails contextuels |
| created_at | timestamptz | non | — | now() | |

- Enum `audit_actor` : `admin`, `user`.
- Distinct des logs techniques (hors base).

---

# 7. Rappels

## Notification

Trace d'un rappel ou d'une relance émis vers l'utilisateur.

| Champ | Type | Null | Unique | Défaut | Notes |
|---|---|---|---|---|---|
| id | uuid | non | oui (PK) | gen_random_uuid() | |
| user_id | uuid | non | — | — | Destinataire |
| type | notification_type (enum) | non | — | — | Voir enum |
| event_occurrence_id | uuid | oui | — | — | FK → event_occurrence(id) on delete set null ; cible d'un rappel d'échéance |
| person_id | uuid | oui | — | — | FK → person(id) on delete set null ; cible d'une relance par personne |
| channel | notification_channel (enum) | non | — | — | `email` \| `push` \| `in_app` |
| title_key | varchar(60) | non | — | — | **Clé de traduction** du titre ; le serveur transporte des clés, jamais des phrases — la langue d'interface peut changer après l'envoi |
| body_params | jsonb | oui | — | — | Valeurs à insérer dans le gabarit traduit (prénom, date, nombre) |
| target_route | text | oui | — | — | Écran à ouvrir : une notification mène là où l'on agit |
| dedupe_key | varchar(120) | oui | oui | — | Empêche qu'un même fait produise deux envois ; porte le type et sa cible |
| scheduled_for | timestamptz | oui | — | — | Envoi prévu, dans le fuseau du destinataire |
| sent_at | timestamptz | oui | — | — | Horodatage d'envoi |
| read_at | timestamptz | oui | — | — | Lecture dans le centre de notifications |
| status | notification_status (enum) | non | — | 'pending' | `pending` \| `sent` \| `read` \| `failed` |
| created_at | timestamptz | non | — | now() | |

- Enum `notification_type` : `event_reminder`, `event_day_of`, `digest`, `contribution_received`, `wish_received`, `enrichment_nudge_global`, `enrichment_nudge_person`, `generation_ready`, `payment_succeeded`, `payment_failed`, `credits_received`, `login_code`, `security`, `account`.
- Enum `notification_channel` : `email`, `push`, `in_app`.
- Enum `notification_status` : `pending`, `sent`, `read`, `failed`.
- Sert l'anti-doublon, le centre de notifications in-app et les métriques.
- Les types `login_code`, `security` et `account` partent quelles que soient les préférences.

---

# Annexe — Inventaire des enums

| Enum | Valeurs |
|---|---|
| user_status | active, suspended, pending_deletion, deleted |
| ui_theme | system, light, dark |
| digest_frequency | monthly, weekly, never |
| notification_platform | ios, android |
| support_request_status | open, answered, closed |
| export_status | pending, ready, failed, expired |
| otp_reason | email_verification, login |
| login_result | success, failure |
| identity_provider | google, apple |
| payment_method_kind | mobile_money, card |
| payment_direction | charge, refund |
| payment_status | pending, succeeded, failed, expired, refunded |
| payment_mode | provider, semi_manual, manual |
| fee_bearer | payer, payee |
| status_change_origin | user, webhook, polling, admin, system |
| person_register | familier, amical, formel |
| attribute_kind | color, animal, food, drink, clothing_size, shoe_size, fragrance, style, hobby, occupation, avoid |
| person_relation | famille_proche, famille_etendue, ami, partenaire, collegue, relation_pro, connaissance |
| person_gender | female, male, other, unspecified |
| contact_channel | whatsapp, sms, email, autre |
| event_kind | birthday, other |
| event_nature | happy, sensitive |
| schedule_type | recurrent, offset |
| occurrence_status | upcoming, collecting, closed |
| schedule_unit | day, week, month, quarter, year |
| offset_unit | day, month |
| content_origin | owner, collected |
| category_kind | ponctuelle, durable |
| assignment_source | auto, user |
| wishlist_status | available, reserved, fulfilled |
| wishlist_origin | collected, accepted_idea, owner |
| reservation_status | pending, confirmed, cancelled, expired |
| collection_link_type | nominatif, public |
| submission_status | pending, validated, rejected |
| submitted_wish_review | pending, retained, discarded |
| generated_profile_status | generated, approved |
| portrait_orientation | relation, your_progress, our_progress, motivation, support, character, pride, affection, gratitude, what_you_taught_me, wish, tribute |
| portrait_visual | illustration, photo, none |
| illustration_family | nature, animal, abstract |
| generated_message_status | generated, edited, sent |
| received_wish_status | pending, approved, rejected |
| action_run_status | success, failure |
| credit_txn_type | grant, purchase, consumption, adjustment |
| referral_status | invited, registered, credited |
| param_value_type | number, money, duration, boolean, string |
| admin_role | support, admin |
| ai_usage_status | success, error, timeout |
| ai_purpose | note_classification, sensitive_detection, portrait, gift_ideas, wish_message |
| ai_origin | user_action, scheduled_job, retry, studio_trial |
| prompt_kind | message, illustration, photo_style, note_classification, sensitive_detection |
| studio_config_state | draft, published, superseded |
| audit_actor | admin, user |
| notification_type | event_reminder, event_day_of, digest, contribution_received, wish_received, enrichment_nudge_global, enrichment_nudge_person, generation_ready, payment_succeeded, payment_failed, credits_received, login_code, security, account |
| notification_channel | email, push, in_app |
| notification_status | pending, sent, read, failed |

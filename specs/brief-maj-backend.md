# Lehno — Ce qui a changé, côté serveur

À lire avec `brief-maj-contrat-commun.md`, qui porte ce qui vous engage avec les clients. Ce document ne traite que le serveur ; le back-office a le sien (`brief-maj-admin.md`).

Références : `spec-technique-lehno.md`, `dictionnaire-donnees-lehno.md`, `ux-admin-lehno.md`, `spec-portrait-lehno.md`.


> **Corrigé le 25/08/2026 — `ManualTopUp` n'existe plus.** Elle a été absorbée
> par `Payment`, distingué par son `mode` : `provider`, `semi_manual`, `manual`.
> Une entité séparée aurait obligé à tenir deux registres et deux historiques
> d'états, et **embrouillerait la comptabilité** — une recharge manuelle
> n'aurait même pas paru dans l'historique des paiements du client, alors que
> c'en est un du point de vue de celui qui a versé l'argent.
>
> Les chemins deviennent : `/admin/payments` (lecture et **saisie**),
> `/admin/payments/{id}/decision` (confirmer ou rejeter, avec la référence de
> la transaction et le montant constaté), et `/admin/collection-accounts` (les
> comptes sur lesquels les clients versent). Voir le dictionnaire, sections
> `Payment` et `CollectionAccount`.

---

## 1. Les drapeaux — registre en code, état en base

- **En code** : les clés, ce que chacune gouverne, sa portée, ses dépendances, et **la liste des points d'entrée et écrans couverts**. Ajouter un drapeau demande un déploiement ; en échange, une clé mal orthographiée ne compile pas.
- **En base** : `feature_flag` porte l'**état seul** — `key`, `enabled`, `updated_at`, et qui a basculé. Une ligne absente vaut éteint.
- **Réconciliation au démarrage** : les clés du registre absentes de la table y sont créées éteintes ; un état déjà réglé n'est jamais touché.

**Le garde passe avant l'authentification**, et rend `404`. Autrement, le statut distinguerait « éteinte » de « non authentifiée » et trahirait l'existence de la fonctionnalité.

**`/admin/feature-flags` rend la couverture** de chaque drapeau, d'après le registre : le back-office doit annoncer ce qu'une bascule éteint sans que l'information soit dupliquée.

---

## 2. Le modèle — ce qui a bougé

| Entité | Ce qui change |
|---|---|
| `OwnerWish` | **Nouvelle.** Mes souhaits, seuls réservables. `WishReservation.owner_wish_id` |
| `WishlistItem` | `is_shortlisted` remplace `is_public` — un repère personnel, invisible aux tiers |
| `FeatureFlag` | **Nouvelle**, réduite à l'état |
| `CreditBundle` | **Nouvelle.** Paliers d'achat, réglés en administration |
| `ManualTopUp` | **Nouvelle.** Recharge manuelle avec justificatif |
| `GiftGiven` | **Nouvelle.** Ce qui a été offert ; la génération d'idées **l'écarte des suggestions** |
| `PromptTemplate` | **Nouvelle.** Gabarits versionnés, une seule version active par (`kind`, `key`) |
| `StudioConfig` / `StudioProfile` / `StudioTrial` | **Nouvelles.** Brouillon, profils de simulation, essais |
| `GeneratedProfile` | Orientation, voie d'image, famille, style, `image_key`, `source_photo_key`. `share_token` **supprimé** |
| `ActionRun` | `prompt_template_id` — la version exacte qui a produit le contenu |
| `AIUsage` | `origin` (`user_action`, `scheduled_job`, `retry`, `studio_trial`) et `correlation_id` |
| `Person` | `calling_name`, `avatar_url`, `relation`, `gender`, `city`, `country`, `preferred_channel` |
| `DeviceSignup.user_id` | **Nullable, `on delete set null`** |
| `Payment` | État `expired` ; `PaymentStatusHistory` trace chaque état |
| `NoteCategory` | **Zéro ligne est un état valide** |
| `Schedule` | Règles du 29 février et du débordement de fin de mois |

---

## 3. Cinq pièges du modèle

**`DeviceSignup` en cascade rendait le plafond contournable.** Effacer la trace avec le compte permettait de créer puis supprimer à la chaîne. La ligne survit, son lien se rompt. Même règle pour toutes les traces de sécurité (§10.11).

**L'index de réservation porte sur `confirmed` seul.** Inclure `pending` laisserait la première demande occuper le souhait — donc une adresse inventée bloquerait un cadeau. Plusieurs réservations en attente coexistent ; la première confirmée l'emporte, les autres passent à `expired`.

**Les offsets se calculent depuis la `reference_date`**, jamais depuis une échéance déjà ramenée au dernier jour du mois. Sinon le décalage s'accumule d'une occurrence à l'autre.

**Les versions de `PromptTemplate` ne se modifient pas.** Ajuster crée une version nouvelle ; l'ancienne demeure, ce qui permet d'y revenir et d'expliquer un écart de qualité.

**`AIUsage.action_run_id` est nullable.** Le classement des notes et la détection du sensible ne produisent rien de facturable, mais coûtent en argent réel. Les omettre fausserait le suivi de marge.

---

## 4. Sécurité — ce qui se démontre

**L'OTP est haché en HMAC-SHA-256 sous clé d'environnement.** Un code à six chiffres ne compte qu'un million de valeurs : un condensé sans secret s'énumère à partir d'une lecture de base. **Aucune fonction lente** (bcrypt, argon2, scrypt) — elle n'ajouterait rien à la défense et offrirait un levier de saturation sur un point d'entrée ouvert sans compte. Comparaison en temps constant.

**`RefreshToken` emploie SHA-256 sans clé** — 256 bits tirés au hasard ne s'énumèrent pas. Rejouer un jeton consommé **révoque toute la lignée** : c'est le signe qu'une copie circule.

**Le débit se borne par adresse destinataire** autant que par origine. Borner la seule origine laisse le point d'entrée servir à arroser la boîte d'un tiers.

**Les relais de confiance se déclarent.** Sans ce réglage, l'adresse lue est celle du relais, et le plafond « par origine » devient **un compteur unique partagé par tous les visiteurs** — la limitation ne limite plus rien.

**Les origines autorisées forment une liste fermée**, jamais `*`.

**Le justificatif d'une recharge manuelle ne prouve rien.** Un montage est facile : l'administrateur **vérifie la réception sur le compte de l'opérateur**. Le fichier suit les règles des fichiers reçus (§10.6) et **s'efface une fois la demande traitée**.

---

## 5. Le stockage — R2

Plan gratuit : 10 Go, un million d'écritures, dix millions de lectures par mois, **sans frais de sortie**.

- **URL signées à durée courte.** La base garde la **référence de l'objet**.
- **Nom de fichier tiré au hasard** — un portrait est intime, son adresse ne se devine pas.
- **Redimensionner à l'enregistrement** : rien n'est stocké à une taille qui ne sert pas.
- **`source_photo_key` s'efface dès le traitement terminé** — un traitement horaire s'en charge. Une photo de tiers n'a aucune raison de rester.
- **Alerte à 70 % du plafond**, pas quand il est atteint.

---

## 6. Le paiement, et ses trois voies de résolution

Un `pending` se résout **dans cet ordre** :

1. **La notification de l'opérateur** — la voie normale.
2. **L'interrogation de son point d'état** — engagée **une fois le délai de notification dépassé**, répétée jusqu'à résolution ou expiration. Elle ne tourne pas en parallèle : elle prend le relais.
3. **La confirmation manuelle** depuis le back-office, avec motif.

**Les crédits sont octroyés une seule fois**, quelle que soit la voie qui a constaté le succès. Sans résolution au terme du délai, l'opération passe à `expired`.

`PaymentStatusHistory` trace chaque état avec son début, sa fin, son origine (`user`, `webhook`, `polling`, `admin`, `system`) et son auteur.

---

## 7. Le studio du portrait

**Les gabarits vivent en base**, jamais dans le code.

**`StudioConfig` sépare le brouillon de la publication** : on ajuste librement, seule la publication met en service. Une seule version publiée à la fois (index unique partiel). Le retour arrière **republie** une version antérieure plutôt que de la reconstruire.

**La publication est refusée tant qu'aucun `StudioTrial` n'a tourné** sur le brouillon en cours.

**Un essai coûte en argent réel sans consommer de crédit** : il s'enregistre dans `AIUsage` avec `origin = studio_trial` et `action_run_id` nul. Plafond quotidien en `SystemParameter`.

---

## 8. Le back-office

Deux sections nouvelles dans la famille Économie : **§5.7 Fonctionnalités**, **§5.9 Studio du portrait** (trois entrées : réglages en service, composition, banc d'essai).

**Le rôle `support` n'a accès à aucune section de la famille Économie** — paramètres, fonctionnalités, modèles d'IA, studio, offres —, **y compris en lecture**. Ces sections **ne figurent pas dans sa navigation**.

---

## 9. Ce qui reste ouvert

- Les **schémas détaillés** de requête et de réponse.
- Le **fournisseur** du traitement d'image et sa politique de conservation — une photo de tiers ne peut pas servir à entraîner un modèle.
- Le **délai d'attente de la notification** avant bascule sur l'interrogation, et le délai d'expiration — à caler sur chaque opérateur.
- Le **mécanisme de chiffrement au repos** des numéros mobile money, et la rotation de sa clé.

# Plan — l'API d'administration (`/v1/admin`)

Branche : `feature/api-admin`, partie de `develop`.
Sources : spec technique §7 (points d'entrée) et §8 (droits) · `specs/ux-admin-lehno.md` §6 (rôles) · `specs/dictionnaire-donnees-lehno.md` (Admin, AuditLog, AIModel, AIUsage) · `packages/contracts/src/admin.ts` (formes déjà écrites pour le back-office).

## Ce qui existe, et ce qui manque

L'API sert l'authentification, le profil et les surfaces publiques — 24 modèles au schéma, 26 fichiers de test. **Aucun point d'entrée `/v1/admin`**, et **aucun modèle d'administration** : ni `Admin`, ni `AdminRole`, ni `AuditLog`.

Le back-office visuel, lui, est fini et tourne sur des fixtures validées par `@lehno/contracts`. Ce plan remplace ces fixtures par un serveur, sans qu'aucun écran ne soit réécrit.

## Trois décisions, prises ici plutôt qu'au fil de l'eau

**1. Le motif entre en colonne, pas en `metadata`.** Le dictionnaire donne à `AuditLog` un `metadata jsonb` et rien d'autre. Or la spec §7 pose que « les appels qui modifient l'état d'un compte, un solde ou un contenu **exigent un motif** ; sans lui la requête échoue ». Un motif rangé dans du JSON n'est ni contraint, ni indexable, ni lisible en SQL — et c'est précisément la trace qui doit faire foi. J'ajoute donc `reason text` au modèle, **non nul lorsque `actor_type = 'admin'`**, garanti par une contrainte de vérification. C'est un écart au dictionnaire, assumé et à reporter.

**2. Deux systèmes de comptes, deux jeux de tables.** Techniquement, `OtpCode` n'aurait rien demandé : son `user_id` est déjà nullable et son index porte sur `(target_email, reason)` — une valeur d'enum de plus aurait suffi. Le propriétaire tranche autrement, et pour une raison qui n'est pas technique : **un compte d'exploitation n'est pas un compte d'utilisateur**, et les deux ne partagent aucune table.

Ce que ça achète : aucune requête ne peut confondre les deux natures de porteur, et une session ne peut pas fuiter d'un domaine à l'autre — par construction, plutôt que par vigilance. Ce que ça coûte : deux tables de plus, et une rotation de jeton qu'il ne faut pas écrire deux fois, d'où un service de rotation **paramétré par son dépôt**. C'est le stockage qui se dédouble, pas le raisonnement.

Le **service** OTP est réemployé tel quel : hachage HMAC sous clé, comparaison en temps constant, consommation atomique. Seules les tables changent.

**3. Le rôle se vérifie par une garde, jamais par le contrôleur.** `AdminGuard` établit qui appelle, `RolesGuard` lit un décorateur `@Role("admin")` posé sur la route. Un rôle insuffisant rend `403`. L'interface masque ce qu'elle ne peut pas faire, mais **c'est le serveur qui refuse** (§7) — et un test le vérifie sur chaque route réservée.

## Les tâches

- [x] **1. Schéma** — `Admin`, enum `AdminRole`, `AuditLog` (avec `reason`), `AdminOtpCode`, `AdminRefreshToken`. Migration, et tests de schéma sur le modèle de `schema-identity.test.ts`. Les deux tables d'administration ne référencent **que** `admin(id)` : aucune colonne ne pointe vers `user`.
- [x] **2. Entrer** — `POST /admin/auth/otp`, `otp/verify`, `DELETE /admin/auth/session`. Réemploi d'`OtpService` et `TokenService`. **La réponse ne dit jamais si un compte existe.**
- [x] **3. Les deux gardes** — `AdminGuard`, `RolesGuard`, décorateur `@Role`. Un compte désactivé (`is_active = false`) est refusé même avec un jeton valide.
- [x] **4. Les paramètres, et le journal avec eux** — `GET`/`PATCH /admin/parameters`. L'ordre vient du propriétaire : après les administrateurs, les réglages du système, puis les entités. Le journal naît ici plutôt qu'en tâche isolée — un service partagé écrit avant son premier appelant se conçoit dans le vide, et sa garantie est de toute façon déjà en base depuis la tâche 1.
- [x] **5. Comptes** *(les entités, dans l'ordre demandé : utilisateurs, puis fiches)* — `GET /admin/users` (curseur, filtres), `GET`/`PATCH /admin/users/{id}`, `POST /admin/users/{id}/credits`, `/device-limit`. Le détail ne rend **ni fiches, ni notes, ni souhaits** : le cloisonnement tient en administration, et `compteDetailSchema` ne les porte pas.
- [ ] **6. Paiements** — `GET /admin/payments`, `/refund`, `/retry`, `/confirm`, `/refund-override`. La règle anti-fraude du remboursement — méthode enregistrée depuis plus de deux semaines **et** ayant déjà servi — est appliquée ici, et sa levée est un geste à part, journalisé.
- [x] **7a. Demandes de suppression** — livré. La modération attend une table de signalement, qui nexiste pas au schéma.
- [ ] **7b. Modération** — `GET /admin/moderation`, `/decision`. Effacer un compte sans attendre la fin du délai de grâce est réservé à `admin`.
- [ ] **8. Modèles d'IA** — `GET`/`PATCH /admin/ai-models`. Le catalogue et la priorité de routage ; les paramètres sont faits en tâche 4.
- [ ] **9. Lecture seule** — `GET /admin/audit-log`, `/login-activity`, `/metrics`. Le journal d'audit est réservé à `admin` (spec §6, contre le paquet de passation).
- [ ] **10. Le reste** — `/admin/admins`, `/admin/external-links`, `/admin/exports`, `/admin/dashboard`.
- [ ] **11. Câblage** — le back-office quitte ses fixtures pour l'API.

## Relecture des specs du 24 août, 16 h 22

Trois changements arrivés après l'écriture de ce plan.

**Le portrait n'est plus une page, c'est une image.** `/public/portraits/{token}` **disparaît** de la spec technique. L'utilisateur enregistre l'image et l'envoie lui-même ; le pied de marque fait partie de l'image, et c'est ainsi qu'il fait connaître Lehno, sans lien à suivre. Le paquet de passation des surfaces publiques avait pris cette décision seul et la signalait comme telle : **la spec l'a rejointe**. Une surface publique de moins à construire.

**Une section d'administration entière apparaît — le Studio du portrait (§5.8).** Cinq points d'entrée : `/admin/portrait-studio/{orientations,visual-styles,templates,templates/{id},preview}`. Ce n'est pas un réglage de plus : c'est la section « qui bougera le plus », avec un **banc d'essai** qui produit sur une fiche de démonstration **sans consommer de crédit ni toucher à un compte réel**.

**`PromptTemplate` entre au dictionnaire, et c'est le morceau qui structure le reste.** Les gabarits de production vivent **en base, jamais dans le code**. Les versions sont **immuables** : ajuster crée une version nouvelle, l'ancienne demeure. Une seule version active par (`kind`, `key`), tenue par un index unique partiel. Et chaque `ActionRun` retient **la version exacte** qui l'a produit — sans quoi comprendre pourquoi les productions d'une semaine valaient mieux que celles de la suivante est impossible.

- [ ] **12. Le studio du portrait** — `PromptTemplate` au schéma, ses cinq points d'entrée, et le banc d'essai. La tâche 8 (modèles d'IA) devient sa voisine : un gabarit vise un modèle.

**Le back-office visuel ne porte pas cette section.** Le paquet de passation en décrivait quinze, aucune ne s'appelle Studio. L'outil livré est donc en retard d'un écran sur la spec — à signaler au propriétaire plutôt qu'à combler en silence.

## La suite, en checklist — à suivre sans interruption

- [x] **1. Schéma** de l'administration
- [x] **2. Entrer** par code
- [x] **3. Les deux gardes**
- [x] **4. Les paramètres**, et le journal né avec eux
- [x] **5. Les comptes** — liste, détail, changement d'état
- [x] **6. Les demandes de suppression** — file de travail, sans écriture propre
- [x] **7. Les deux lectures de suivi** — journal d'audit (admin) et connexions (support)
- [ ] **8. Les administrateurs** — `GET`/`POST`/`PATCH`/`DELETE /admin/admins`. Inviter, changer de rôle, révoquer. Réservé à `admin`, et **on ne se révoque pas soi-même** : un outil qui laisse fermer la dernière porte derrière soi est un outil cassé.
- [ ] **9. Les modèles d'IA** — `AIModel` au schéma (le dictionnaire le décrit, la base ne l'a pas), puis `GET`/`PATCH /admin/ai-models`. Priorité de routage, activation à chaud.
- [ ] **10. L'export d'une liste filtrée** — `POST /admin/exports`, sur `DataExportRequest` qui existe déjà. L'export **dit sa portée**.
- [ ] **11. Le tableau de bord** — `GET /admin/dashboard`, agrégé sur ce qui existe : comptes par état, suppressions à échéance, connexions échouées, gestes récents. Les tuiles qui demandent des murs, des crédits ou des paiements attendent leurs tables.
- [ ] **12. Le studio du portrait** — en dernier, à la demande du propriétaire : trop de questions encore ouvertes.

**Hors de portée tant que le schéma ne les porte pas** : la modération (aucune table de signalement, et le dictionnaire n'en décrit pas), les transactions (ni `Payment` ni `CreditTransaction`), les liens externes, et la part des métriques qui compte des murs ou des crédits.

## Ce que ce plan ne couvre pas

Les codes promotionnels et les parrainages (`/admin/promo-codes`, `/admin/referrals`) : la phase 3 les porte, et aucun écran ne les demande aujourd'hui.

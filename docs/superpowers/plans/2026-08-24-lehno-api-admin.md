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

- [ ] **1. Schéma** — `Admin`, enum `AdminRole`, `AuditLog` (avec `reason`), `AdminOtpCode`, `AdminRefreshToken`. Migration, et tests de schéma sur le modèle de `schema-identity.test.ts`. Les deux tables d'administration ne référencent **que** `admin(id)` : aucune colonne ne pointe vers `user`.
- [ ] **2. Entrer** — `POST /admin/auth/otp`, `otp/verify`, `DELETE /admin/auth/session`. Réemploi d'`OtpService` et `TokenService`. **La réponse ne dit jamais si un compte existe.**
- [ ] **3. Les deux gardes** — `AdminGuard`, `RolesGuard`, décorateur `@Role`. Un compte désactivé (`is_active = false`) est refusé même avec un jeton valide.
- [ ] **4. Le journal** — `AuditService.consigner()`, appelé par chaque écriture. **Sans motif, l'appel échoue avant d'atteindre la base.** C'est le point d'appui de tout le reste.
- [ ] **5. Comptes** — `GET /admin/users` (curseur, filtres), `GET`/`PATCH /admin/users/{id}`, `POST /admin/users/{id}/credits`, `/device-limit`. Le détail ne rend **ni fiches, ni notes, ni souhaits** : le cloisonnement tient en administration, et `compteDetailSchema` ne les porte pas.
- [ ] **6. Paiements** — `GET /admin/payments`, `/refund`, `/retry`, `/confirm`, `/refund-override`. La règle anti-fraude du remboursement — méthode enregistrée depuis plus de deux semaines **et** ayant déjà servi — est appliquée ici, et sa levée est un geste à part, journalisé.
- [ ] **7. Modération et suppressions** — `GET /admin/moderation`, `/decision`. Effacer un compte sans attendre la fin du délai de grâce est réservé à `admin`.
- [ ] **8. Configurations** — `GET`/`PATCH /admin/parameters`, `/ai-models`. Chaque écriture porte la valeur quittée dans le journal.
- [ ] **9. Lecture seule** — `GET /admin/audit-log`, `/login-activity`, `/metrics`. Le journal d'audit est réservé à `admin` (spec §6, contre le paquet de passation).
- [ ] **10. Le reste** — `/admin/admins`, `/admin/external-links`, `/admin/exports`, `/admin/dashboard`.
- [ ] **11. Câblage** — le back-office quitte ses fixtures pour l'API.

## Ce que ce plan ne couvre pas

Les codes promotionnels et les parrainages (`/admin/promo-codes`, `/admin/referrals`) : la phase 3 les porte, et aucun écran ne les demande aujourd'hui.

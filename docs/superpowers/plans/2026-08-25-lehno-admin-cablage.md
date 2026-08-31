# Lehno — le back-office branché sur son API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire parler deux moitiés déjà écrites. Neuf contrôleurs `/v1/admin` sont livrés et testés ; l'outil d'administration tourne sur des données factices et n'appelle rien. Ce plan les relie, et aligne la navigation sur la spécification révisée.

**Architecture:** Un client d'API unique dans `apps/admin/src/api/`, typé par `@lehno/contracts`. Les écrans ne connaissent ni URL, ni jeton, ni statut HTTP : ils reçoivent des données ou un code d'erreur. Aucun écran ne change de gabarit — ils changent de source.

**Tech Stack:** Vite 7, React 19, Vitest + Testing Library, `@lehno/contracts` (Zod).

**Spec:** `specs/brief-maj-admin.md` · `specs/brief-maj-contrat-commun.md` §1 et §2 · `specs/ux-admin-lehno.md` §5 et §6

---

## Contraintes globales

- **Le client ne montre jamais le message brut d'une erreur** (contrat commun §2). Le serveur rend un **code stable** ; l'outil le traduit. Un message non traduit se voit en test, il ne se devine pas en production.
- **Le serveur décide du rôle.** La bascule de rôle de la bande d'aperçu est un outil d'écriture, pas un contrôle : à la tâche 2, le rôle vient de `/admin/auth/otp/verify` et la bascule ne survit qu'en `import.meta.env.DEV`.
- **Une section entièrement fermée ne figure pas dans le menu** (brief §2). Le support ne voit pas des portes closes.
- **Une action hors des droits n'apparaît pas** (brief §8). `RoleGate` existe déjà ; c'est lui qui le porte.
- **Motif obligatoire** sur tout ce qui modifie un compte, un solde ou un contenu. Le serveur refuse sans lui — l'interface ne doit pas laisser partir la requête.
- **Pas de total dans la pagination** : le contrat est à curseur (spec technique §3).
- **Aucune couleur, ombre, durée ni rayon en dur** — la règle d'adhérence de `@lehno/tokens` couvre `apps/admin/**` depuis le socle de design.
- **`@Inject(...)` explicite** partout côté serveur : esbuild n'émet pas `design:paramtypes`.
- **TDD** : le test s'écrit d'abord, on le voit échouer, puis on le fait passer. Commit à chaque tâche.
- Commentaires en français, identifiants et code en anglais. Messages de commit en français à l'impératif.
- **Un `pnpm test` qui affiche « 0 tasks » n'est pas un feu vert** ; vérifier « cache miss » ou lancer le paquet directement. Et **jamais de tube derrière un `&&`** : le statut de sortie devient celui du tube, et un échec passe inaperçu.

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `apps/admin/src/api/client.ts` | L'appel : base, jeton, corps, statut, code d'erreur |
| `apps/admin/src/api/session.ts` | La paire de jetons, son rafraîchissement, sa fin |
| `apps/admin/src/api/hooks.ts` | `useRessource` — chargement, erreur, rechargement |
| `apps/admin/src/i18n/{fr,en}.ts` | Les codes d'erreur traduits |
| `apps/admin/src/App.tsx` | La navigation des quatre familles, et ce que le rôle en retire |

Le client vit dans son propre dossier parce qu'il se teste sans écran, et parce qu'il changera moins souvent que les pages.

---

### Tâche 1 : Le client d'API

**Décision.** Un seul point de passage. Une réponse d'erreur porte un code stable ; le client le remonte tel quel et **n'invente pas de message**. Un `401` déclenche un rafraîchissement, puis une seule reprise : deux reprises masqueraient une boucle.

**Fichiers :**
- Créer : `apps/admin/src/api/client.ts`, `apps/admin/src/api/session.ts`
- Test : `apps/admin/src/api/client.test.ts`

- [ ] Test : un `204` ne rend rien et ne tente pas de lire du JSON
- [ ] Test : un `404` rend le code `not_found`, jamais le corps du serveur
- [ ] Test : un `401` rafraîchit puis rejoue **une** fois ; un second `401` ferme la session
- [ ] Test : le jeton part en en-tête `Authorization`, jamais en paramètre d'URL
- [ ] Test : une réponse hors schéma échoue au lieu d'être rendue à l'écran

### Tâche 2 : L'authentification réelle

**Décision.** L'écran de connexion parle à `/admin/auth/otp` et `/otp/verify`. Le rôle rendu par le serveur remplace l'état local. Un courriel inconnu **ne reçoit pas de code** (décision du porteur), et l'écran ne le dit pas : il affiche le même accusé dans les deux cas.

**Fichiers :**
- Modifier : `apps/admin/src/pages/Connexion.tsx`, `apps/admin/src/App.tsx`
- Test : `apps/admin/src/pages/Connexion.test.tsx`

- [ ] Test : l'accusé est identique pour un courriel connu et un inconnu
- [ ] Test : un code refusé affiche le libellé traduit du code, pas le message du serveur
- [ ] Test : le rôle affiché après entrée est celui du serveur, pas celui de la bande d'aperçu
- [ ] Test : la déconnexion appelle `DELETE /admin/auth/session` et efface la paire

### Tâche 3 : La navigation de la spécification révisée

**Décision.** Quatre familles — Exploitation · Économie · Supervision · Outils — et quatorze sections. Le support n'a **aucune** entrée de la famille Économie : elle n'est pas grisée, elle est absente.

**Fichiers :**
- Modifier : `apps/admin/src/App.tsx`, `apps/admin/src/i18n/{fr,en}.ts`
- Test : `apps/admin/src/App.test.tsx`

- [ ] Test : la navigation d'un `admin` porte les quatorze sections dans les quatre familles
- [ ] Test : celle d'un `support` ne porte **aucune** section d'Économie, et la famille n'a pas d'en-tête vide
- [ ] Test : chaque section a un libellé dans les deux langues — aucune clé manquante

### Tâche 4 : Le tableau de bord

- [ ] Test : les alertes et les indicateurs viennent de `GET /admin/dashboard`
- [ ] Test : un échec de chargement affiche un état d'erreur, jamais un tableau vide qui ment
- [ ] Test : un clic sur une alerte mène à sa section

### Tâche 5 : Les comptes, liste et fiche

- [ ] Test : la liste pagine par curseur, sans total affiché
- [ ] Test : le filtre et la recherche passent en paramètres de requête, pas en filtrage local
- [ ] Test : ouvrir une fiche appelle `GET /admin/users/{id}`
- [ ] Test : suspendre exige un motif d'au moins six caractères, et le bouton reste indisponible sans lui

### Tâche 6 : Les paramètres

- [ ] Test : la liste vient de `GET /admin/parameters`
- [ ] Test : l'enregistrement envoie le motif et rend l'écran au dernier état connu du serveur
- [ ] Test : la section est **absente** pour un support (famille Économie)

### Tâche 7 : Les demandes de suppression

- [ ] Test : la file vient de `GET /admin/deletions`
- [ ] Test : les délais sont calculés par le serveur, pas recalculés à l'écran

### Tâche 8 : Les deux lectures — journal d'audit et connexions

- [ ] Test : `GET /admin/audit-log` et `GET /admin/login-activity` alimentent les deux sections
- [ ] Test : le journal d'audit n'apparaît pas pour un support (ux-admin §6)

### Tâche 9 : Les modèles d'IA

- [ ] Test : la liste et l'ordre de repli viennent de `GET /admin/ai-models`
- [ ] Test : la section est absente pour un support

---

## Ce qui suit ce plan

Hors périmètre ici, faute de branche fusionnée ou de table :

- **§5.7 Fonctionnalités** — attend le registre de drapeaux porté par `feature/phase1-proches`. À la fusion, réconcilier `FeatureFlag` : le brief backend veut **qui a basculé**, le modèle écrit ne porte que `key`, `enabled`, `updated_at`.
- **§5.4 Crédits et paiements**, **§5.8 facturé contre réel**, **§7 Ressources** — demandent `CreditBundle`, `ManualTopUp`, `Payment`, `PaymentStatusHistory`, `AIUsage`, `ActionRun`. Aucune n'existe.
- **§5.9 Studio du portrait** — en dernier, par décision du porteur : trois questions restent ouvertes au §10 du brief.

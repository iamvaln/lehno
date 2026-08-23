# Plan — le back-office de Lehno, en visuel

Source de design : `specs/ADMIN identity for Lehno.zip` (`design_handoff_back_office/`).
Source fonctionnelle : `specs/ux-admin-lehno.md`.
Contrats d'API : `specs/spec-technique-lehno.md` §7 et §3.

## Ce que ce plan couvre, et ce qu'il ne couvre pas

**Il couvre** ce que le paquet montre : la coquille, les dix-sept composants
d'administration, les quatre gabarits, et les sept pages pilotes — tableau de bord,
liste, détail, formulaire, suppressions, profil, connexion.

**Il ne couvre pas** le serveur. Il n'existe aujourd'hui **aucun point d'entrée
`/v1/admin`**, ni rôle `admin_role` au schéma Prisma. Tout est rendu sur des données de
démonstration. C'est délibéré : la demande porte sur le visuel.

**Ce qui rend ce choix tenable** : les fixtures sont **typées sur les contrats de la spec
technique §7**, dans `packages/contracts`. Le jour où l'API existe, on remplace la source
des données sans retoucher un écran. Une fixture non typée obligerait à tout réécrire.

---

## Contraintes globales

Reprises du plan de phase 0, plus celles propres à l'admin.

- **Aucun hexadécimal dans un composant.** Les couleurs passent par les variables CSS.
- **Aucune ombre nulle part.** La profondeur vient des filets d'un pixel.
- **Le gris de mention est `#6B6579`** en thème clair — valeur portée par `@lehno/tokens`,
  jamais recopiée.
- **Aucune chaîne écrite dans un composant.** Tout vient du dictionnaire, en `fr` et `en`.
- **Fraunces n'entre pas dans l'admin.** `--font-display` vaut `var(--font-body)` sous
  `.lehno-admin` : un composant partagé avec le produit rend en Karla sans qu'on y touche.
- **Le rôle retire, il ne grise pas.** `RoleGate` ne rend pas ses enfants. Un bouton grisé
  promet une permission qu'on n'a pas.
- **L'interface masque, elle ne protège pas.** Le rôle se revérifie au serveur ; `RoleGate`
  n'est jamais un garde-fou.
- **Toute action qui change un état passe par `ConfirmWithReason`** et porte un motif —
  sans exception, y compris « laisser » en modération : ne rien faire est une décision.
- **Le cloisonnement tient en administration.** Aucun écran n'expose le contenu d'une fiche
  ou d'une note. En modération, seul l'élément signalé s'ouvre.

## Quatre décisions prises avant d'écrire ce plan

1. **Périmètre** — ce que le paquet montre, exactement. Les quinze sections réemploient les
   quatre gabarits ; les construire douze fois avec des données inventées n'apprend rien.
2. **Jetons** — `@lehno/tokens` gagne une couche admin plutôt que de reprendre le
   vocabulaire d'alias du paquet. Une seule source de couleur dans le dépôt (tâche 2).
3. **Journal d'audit** — réservé au rôle `admin`, comme la spec §6, et **contre** le paquet
   qui le donne en lecture au support. Le journal sert à contrôler le travail de l'équipe ;
   le donner à ceux qu'il observe lui retire sa fonction. Même arbitrage pour la suspension
   et les suppressions, où le paquet et la spec divergent aussi.
4. **Familles de navigation** — « À traiter · Finances · Gestion · Suivi · Outils », comme
   le `dico.json` et le README principal. Le README du ui_kit, qui annonce « Utilisateurs ·
   Réglages · Suivi · Outils », est périmé.

## Une décision qui reste ouverte — à trancher en tâche 4

**La pagination.** La spec technique §3 impose le parcours **par curseur** : la requête
porte `limit` et `cursor`, la réponse rend les éléments et le curseur suivant. Le composant
`Pagination` du paquet demande `page`, `parPage` et **`total`** — qu'une API à curseur ne
peut pas fournir, et il affiche « 1–20 sur 347 » et « page 2 / 18 ».

Les deux ne se concilient pas. Trois issues, la première recommandée :

- **Adapter le composant au curseur** : « Précédent · Suivant », sans total ni numéro de
  page. Fidèle à la spec, moins riche à l'écran.
- **Faire une exception pour `/v1/admin`** : décalage et total, réservés à l'admin, dont les
  volumes sont connus et le public interne. Le composant reste tel quel.
- **Rendre le total facultatif** : le composant tombe sur « Précédent · Suivant » quand
  `total` est absent, et affiche le compte quand il est là.

---

## Structure des fichiers

```
apps/admin/
  index.html
  vite.config.ts
  vitest.config.ts
  tsconfig.json
  package.json
  src/
    main.tsx
    App.tsx                    Routage local (aucun serveur) et état de rôle, thème, langue
    styles/global.css          Structure seulement — aucune couleur
    i18n/{fr,en}.ts            Repris de dico.json, sans clé morte
    i18n/index.ts              messages(langue)
    composants/
      coquille/{AdminShell,Sidebar,Topbar}.tsx
      donnees/{DataTable,Pagination,FilterBar,EmptyState,StatusPill}.tsx
      signaux/{StatCard,AlertPill,AuditTrail,Toast}.tsx
      actions/{RoleGate,ConfirmWithReason,ExportButton}.tsx
      page/{PageHeader,PageTabs,Breadcrumb,FormRow}.tsx
    pages/
      TableauDeBord.tsx  Liste.tsx  Detail.tsx  Formulaire.tsx
      Suppressions.tsx   Profil.tsx  Connexion.tsx
    fixtures/*.ts              Données de démonstration, typées sur les contrats
  public/brand/                Copie de images/brand/svg/
  test/*.test.tsx

packages/contracts/src/admin.ts   Les types de /v1/admin, d'après la spec §7
packages/tokens/src/admin.ts      La couche admin : couleurs et densité
```

---

### Tâche 1 : Squelette Vite, membre de l'espace de travail

**Fichiers :** `apps/admin/{package.json,vite.config.ts,vitest.config.ts,tsconfig.json,index.html}`,
`apps/admin/src/{main.tsx,App.tsx}`, `apps/admin/src/styles/global.css`
**Test :** `apps/admin/test/amorcage.test.tsx`

**Interfaces :** produit l'application `@lehno/admin`, montée par Vite, testée par Vitest.

**Les pièges.** `@lehno/tokens` expose ses sources TypeScript (`main: ./src/index.ts`) :
Vite doit les résoudre, et il lui faut `resolve.extensionAlias` pour les imports en `.js`
qui pointent des `.ts`, comme pour `apps/web`. Et `pnpm lint` traverse tout l'arbre depuis
la racine : `dist/` est déjà ignoré, rien à ajouter.

- [ ] **Étape 1 : le test qui échoue** — monter `<App />` et vérifier que la coquille rend
      la marque et le titre de la page d'accueil.
- [ ] **Étape 2 : le voir échouer** — `pnpm --filter @lehno/admin test`, l'application
      n'existe pas.
- [ ] **Étape 3 : implémenter** le squelette. `global.css` ne porte **aucune couleur** :
      seulement la remise à zéro, la famille de texte et la règle de mouvement réduit.
- [ ] **Étape 4 : le voir passer**, puis `pnpm --filter @lehno/admin build`.
- [ ] **Étape 5 : commit** — `admin: squelette Vite, membre de l'espace de travail`

---

### Tâche 2 : La couche admin de `@lehno/tokens`

**Fichiers :** `packages/tokens/src/admin.ts`, export depuis `packages/tokens/src/index.ts`
**Test :** `packages/tokens/src/admin.test.ts`

**Interfaces :** produit `adminThemes: { light, dark }` et `adminTokens` (densité, rayons,
échelle de texte), plus `adminCssVariables(theme)` sur le modèle de `cssVariables`.

**Ce que la couche porte.** Six couleurs qui diffèrent du produit, et elles seules :

| Rôle | Clair | Sombre |
|---|---|---|
| `chrome` (les barres — un outil a des barres, une application non) | `#F7F6FA` | `#131219` |
| `bg` | `#FFFFFF` | `#17161F` |
| `surface` | `#F2F0F7` | `#1E1C29` |
| `card` | `#FFFFFF` | `#1B1928` |
| `line` | `#E8E5EF` | `#262433` |
| `line2` | `#DCD8E6` | `#34314A` |

Plus la densité : contrôles 32 px, padding horizontal 13 px, ligne de tableau 44 px ;
rayons 5 · 6 · 6 · 8 · 10 · 12 ; texte display 30/26/21/18/15, body 15/14/13/12,
mention 11 ; interlignage 1,2 en titre et 1,5 en texte ; barre latérale 232 px, barre
haute 52 px. La ligne cochée est `color-mix(in oklab, violet 7%, card)` en clair et 18 %
en sombre — **pas un quatrième violet**.

Le violet, le rouge, l'abricot, les courbes de mouvement et la règle du focus **ne sont pas
redéfinis** : ils viennent des thèmes du produit.

- [ ] **Étape 1 : le test qui échoue** — les six couleurs sont celles du tableau ; le
      contraste du texte sur `chrome` et sur `surface` passe 4,5:1 dans les deux thèmes ;
      la couche admin ne redéfinit ni `violet` ni `apricot`.
- [ ] **Étape 2 : le voir échouer.**
- [ ] **Étape 3 : implémenter**, en réemployant `contrastRatio` déjà présent dans le paquet.
- [ ] **Étape 4 : le voir passer** — `pnpm --filter @lehno/tokens test`.
- [ ] **Étape 5 : commit** — `jetons: la couche admin, six couleurs et la densité d'un outil`

---

### Tâche 3 : Contrats `/v1/admin` et fixtures typées

**Fichiers :** `packages/contracts/src/admin.ts`, export depuis l'index ;
`apps/admin/src/fixtures/*.ts`
**Test :** `packages/contracts/src/admin.test.ts`

**Interfaces :** produit les types de requête et de réponse des vingt-cinq points d'entrée
de la spec §7, et les fixtures qui s'y conforment.

**Ce que la spec impose, et qui doit se voir dans les types :**

- **Motif obligatoire.** Tout appel qui modifie l'état d'un compte, un solde ou un contenu
  porte un `motif` dans son corps. Le type le rend **requis**, pas optionnel : c'est ce qui
  garantit que le journal d'audit dit quelque chose.
- **Deux rôles.** `AdminRole = "support" | "admin"`, comme `admin_role` au modèle.
- **Pagination** — selon la décision prise en tâche 4.
- **Le numéro mobile money est masqué** à l'affichage, opérateur et derniers chiffres
  seulement : le type ne porte jamais le numéro complet.
- **Aucun contenu de fiche ni de note** n'apparaît dans un type d'administration.

- [ ] **Étape 1 : le test qui échoue** — chaque fixture se valide contre son type ; un appel
      de mutation sans `motif` ne compile pas ; aucun type ne porte de champ de contenu.
- [ ] **Étape 2 : le voir échouer.**
- [ ] **Étape 3 : implémenter** les types puis les fixtures.
- [ ] **Étape 4 : le voir passer.**
- [ ] **Étape 5 : commit** — `contrats: les types de /v1/admin, et des fixtures qui s'y tiennent`

---

### Tâche 4 : La coquille — `AdminShell`, `Sidebar`, `Topbar`

**Fichiers :** `apps/admin/src/composants/coquille/*.tsx`
**Test :** `apps/admin/test/coquille.test.tsx`

**La décision de pagination se prend ici**, parce que `Pagination` est écrit en tâche 5 et
que les types de la tâche 3 en dépendent.

**Ce que les tests doivent tenir :**

- Les cinq familles s'affichent dans l'ordre ; le tableau de bord est **au-dessus**, sans
  titre de famille.
- **Rien n'apparaît deux fois** : aucun libellé de section n'est présent deux fois dans la
  barre latérale.
- **La barre latérale ne compte pas** : un item en alerte porte un point, jamais un nombre.
- Sous 900 px, la barre latérale sort de la grille ; le bouton de menu apparaît ; le voile
  referme. Au-dessus, le bouton est absent.
- L'étiquette de rôle affiche le rôle connecté.
- Le menu de compte n'expose « accès des administrateurs » qu'au rôle `admin`.

- [ ] **Étape 1 : le test qui échoue** — les six points ci-dessus.
- [ ] **Étape 2 : le voir échouer.**
- [ ] **Étape 3 : implémenter.**
- [ ] **Étape 4 : le voir passer.**
- [ ] **Étape 5 : commit** — `admin: la coquille, sa navigation en familles et son repli sous 900 px`

---

### Tâche 5 : Les composants de données

**Fichiers :** `apps/admin/src/composants/donnees/{DataTable,Pagination,FilterBar,EmptyState,StatusPill}.tsx`
**Test :** `apps/admin/test/donnees.test.tsx`

**Le contrat de `DataTable`, qui est le composant le plus chargé du paquet.** Colonnes
déclarées, rendu par colonne, tri **remonté et non appliqué** — « le tableau n'ordonne ni ne
pagine : il affiche l'état du tri et remonte le clic ; la page trie, découpe, et pose
`<Pagination>` dessous ». Sélection multiple facultative, actions par ligne dans un menu,
défilement horizontal sous 900 px avec largeur minimale de 520 px.

- [ ] **Étape 1 : le test qui échoue** — le tableau **ne réordonne pas** ses lignes quand on
      clique un en-tête, il appelle `onTri` ; la colonne de cases n'apparaît que si
      `onSelection` est passé ; le chevron n'apparaît que si `onOuvrir` est passé ; `vide`
      rend l'état vide quand `lignes` est vide.
- [ ] **Étape 2 : le voir échouer.**
- [ ] **Étape 3 : implémenter**, pagination selon la décision de la tâche 4.
- [ ] **Étape 4 : le voir passer.**
- [ ] **Étape 5 : commit** — `admin: tableau, filtres et pagination, sans opinion sur les données`

---

### Tâche 6 : Les composants de signal et d'action

**Fichiers :** `apps/admin/src/composants/signaux/*.tsx`, `apps/admin/src/composants/actions/*.tsx`,
`apps/admin/src/composants/page/*.tsx`
**Test :** `apps/admin/test/{signaux,actions}.test.tsx`

**Les trois règles se testent ici, et elles sont le cœur de l'outil :**

- `RoleGate` **ne rend rien** quand le rôle n'y a pas droit — pas un enfant désactivé, rien.
- `ConfirmWithReason` **n'appelle pas `onConfirmer` tant qu'aucun motif n'est donné** ; la
  conséquence est affichée ; « Autre — préciser » est ajouté d'office aux motifs.
- `AlertPill` porte son rappel de notification quand un courriel est déjà parti, et
  **ne notifie pas deux fois pour la même cause** tant que la pastille est à l'écran.
- `ExportButton` **dit sa portée** avant d'exporter, et rappelle que l'export est journalisé.
- `Toast` s'efface seul ; `Banner` reste. **Une erreur bloquante n'est jamais un toast.**

- [ ] **Étape 1 : le test qui échoue** — les cinq points ci-dessus.
- [ ] **Étape 2 : le voir échouer.**
- [ ] **Étape 3 : implémenter.**
- [ ] **Étape 4 : le voir passer.**
- [ ] **Étape 5 : commit** — `admin: le rôle retire, le motif s'exige, l'export dit sa portée`

---

### Tâche 7 : Les messages, en deux langues

**Fichiers :** `apps/admin/src/i18n/{fr,en,index}.ts`
**Test :** `apps/admin/test/i18n.test.ts`

Repris de `ui_kits/admin/dico.json`, dont les dix-huit clés de premier niveau sont
symétriques entre `fr` et `en` — vérifié. Le type de `en` reprend celui de `fr`, ce qui
interdit à la compilation une clé oubliée ou en trop, comme dans `apps/web`.

- [ ] **Étape 1 : le test qui échoue** — les deux tables ont les mêmes clés, à toute
      profondeur ; aucune valeur n'est vide ; les gabarits à trou (`{a}`, `{total}`) portent
      les mêmes trous dans les deux langues.
- [ ] **Étape 2 : le voir échouer.**
- [ ] **Étape 3 : implémenter.**
- [ ] **Étape 4 : le voir passer.**
- [ ] **Étape 5 : commit** — `admin: les messages, en deux langues et sous un même type`

---

### Tâche 8 : Le tableau de bord

**Fichiers :** `apps/admin/src/pages/TableauDeBord.tsx`
**Test :** `apps/admin/test/tableau-de-bord.test.tsx`

**Ce que la page doit dire.** Elle s'ouvre sur **ce qui ne va pas, avant tout chiffre** :
trois `AlertPill` au plus, sur une ligne, chacune menant à sa liste. Puis les cartes
d'indicateurs, puis la file « à traiter ».

- [ ] **Étape 1 : le test qui échoue** — jamais plus de trois alertes rendues, même si la
      source en porte cinq ; les alertes précèdent les cartes dans l'ordre du document ;
      chaque carte mène à sa section ; la file « à traiter » rend un état vide qui dit ce
      qui est possible.
- [ ] **Étape 2 : le voir échouer.**
- [ ] **Étape 3 : implémenter.**
- [ ] **Étape 4 : le voir passer.**
- [ ] **Étape 5 : commit** — `admin: le tableau de bord ouvre sur ce qui ne va pas`

---

### Tâche 9 : Les gabarits liste, détail et formulaire

**Fichiers :** `apps/admin/src/pages/{Liste,Detail,Formulaire,Suppressions}.tsx`
**Test :** `apps/admin/test/gabarits.test.tsx`

- **Liste** — en-tête et actions, barre de filtres avec remise à zéro, tableau, pagination,
  état vide. Une seule action pleine dans l'en-tête.
- **Détail** — fil d'Ariane dont la racine est posée par le composant, quatre onglets
  (vue d'ensemble, murs, crédits, sécurité), et **`AuditTrail` en pied**.
- **Formulaire** — onglets, rangs avec aide et **valeur précédente rappelée**, enregistrement
  explicite.
- **Suppressions** — le gabarit liste, avec les deux gestes du délai de grâce : effacer
  maintenant, annuler. Les deux passent par `ConfirmWithReason`.

- [ ] **Étape 1 : le test qui échoue** — le détail rend son historique d'interventions ; le
      formulaire rappelle la valeur précédente d'un champ modifié et **n'enregistre pas
      sans geste explicite** ; « effacer maintenant » n'est pas rendu pour le rôle
      `support` ; la liste remet ses filtres à zéro.
- [ ] **Étape 2 : le voir échouer.**
- [ ] **Étape 3 : implémenter.**
- [ ] **Étape 4 : le voir passer.**
- [ ] **Étape 5 : commit** — `admin: les trois gabarits, et les deux gestes du délai de grâce`

---

### Tâche 10 : La connexion et le profil

**Fichiers :** `apps/admin/src/pages/{Connexion,Profil}.tsx`
**Test :** `apps/admin/test/connexion.test.tsx`

**La connexion est hors de la coquille**, sans navigation : une adresse, puis un code. Pas
de mot de passe (§5.1).

- [ ] **Étape 1 : le test qui échoue** — l'écran **répond la même chose** à une adresse
      connue et à une adresse inconnue ; le renvoi d'un code attend trente secondes ; trois
      codes refusés ferment la saisie.
- [ ] **Étape 2 : le voir échouer.**
- [ ] **Étape 3 : implémenter.**
- [ ] **Étape 4 : le voir passer.**
- [ ] **Étape 5 : commit** — `admin: l'entrée par code, qui ne dit jamais si un compte existe`

---

### Tâche 11 : Vérification à l'œil, et clôture

- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm --filter @lehno/admin build`.
- [ ] Ouvrir l'outil en clair et en sombre, dans les deux langues, aux deux rôles.
- [ ] Réduire sous 900 px : la barre latérale glisse, les tableaux défilent, la densité ne
      change pas. Sous 620 px, le compte connecté disparaît.
- [ ] Vérifier qu'**aucune ombre** n'apparaît dans le CSS produit.
- [ ] Comparer chaque écran au prototype du paquet, servi en parallèle.
- [ ] **Commit** — `admin: vérification des deux thèmes, des deux langues et des deux rôles`

---

## Ce que ce plan laisse ouvert

- **Le serveur.** Aucun point d'entrée `/v1/admin` n'existe. Les fixtures tiennent lieu de
  données, et les contrats de la tâche 3 sont ce qui rendra le câblage mécanique.
- **Le rôle `admin_role` au schéma Prisma**, absent lui aussi.
- **Les graphiques de métriques** (§5.9), que le paquet ne représente pas.
- **La gestion des accès des administrateurs** (§6) : l'entrée du menu existe, l'écran non.
- **L'export de données** : le bouton et son état de préparation existent, le point d'entrée
  `POST /admin/exports` non.
- **La recherche globale** ne mène nulle part tant que son écran de résultats n'est pas
  conçu.

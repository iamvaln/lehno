# Revue — `web-landing` contre le paquet de passation

**Date** : 2026-08-23
**Portée** : `apps/web/`, `packages/tokens/` du worktree `web-landing`, comparés au paquet
`/tmp/lehno-handoff/design_handoff_surfaces_publiques/` et à `specs/design-system-lehno.md`.

**Verdicts**

| | |
|---|---|
| **Conformité au paquet de passation** | ❌ |
| **Qualité (indépendamment de la conformité)** | ✅ approuvée pour ce qu'elle couvre |

La branche est un travail propre, testé (31 tests, tous verts), qui respecte fidèlement
le plan qu'on lui a donné. Ce plan n'est pas le paquet de passation — il en est
l'ancêtre. L'écart n'est donc pas une faute d'exécution ; c'est un plan obsolète exécuté
avec soin.

---

## 1. L'ampleur de l'écart sur les fondations

**Comptage.** Le paquet définit **environ 140 jetons** CSS (`--*`) répartis sur
`colors.css` (62 : 30 valeurs brutes + 32 alias sémantiques par thème), `typography.css`
(29), `spacing.css` (23), `shape.css` (14), `motion.css` (12). La branche en déclare
**17** — tous des couleurs (`packages/tokens/src/themes.ts`, type `ColorRole`), rien
d'autre.

**Ce qui manque en entier, pas seulement en nom :**
- **Intentions de message.** Aucun rôle `info` / `success` / `warning` / `error` dans
  `themes.ts`. Conséquence observée : `FormulaireAttente.tsx:71` affiche l'échec d'envoi
  en `color: var(--text)` — la même couleur qu'une phrase normale. La page compense par
  `role="alert"`, ce qui évite qu'un lecteur d'écran rate le message, mais visuellement
  rien ne distingue une erreur d'un texte neutre. C'est un vrai manque, pas une
  question de nom.
- **Mouvement.** Zéro transition, zéro easing, dans tout `apps/web/`. `grep` ne trouve
  que le bloc `@media (prefers-reduced-motion: reduce)` — qui réduit des animations qui
  n'existent pas. Ni le survol des liens, ni le bouton du thème, ni le menu-accordéon
  n'animent.
- **Formes.** Les rayons existent visuellement mais ne sont pas des jetons : ce sont des
  nombres bruts semés dans `style={{ borderRadius: 10 }}`, `13`, `18`, `28`, `35`, `44`,
  `9`, `2`… Certains ne correspondent à aucune valeur de l'échelle du paquet
  (`radius-xs 8 · sm 10 · md 12 · lg 13 · xl 18 · 2xl 22 · pill 999`) : `35` et `44`
  n'existent nulle part dans cette échelle.
- **Espacements.** Même chose : `padding: "18px 20px"`, `margin: "22px 0 0"` etc. sont
  écrits en dur, jamais via une échelle `--space-*`.

**Mécanique ou réécriture ?** Sur les couleurs seules, une reprise serait en bonne
partie mécanique : les valeurs hexadécimales de la branche et du paquet **coïncident
presque terme à terme** (`bg`/`--surface-page`, `text`/`--text-body`,
`violet`/`--action`, `panel`/`--surface-panel`, `apricot`/`--celebrate`, etc. — mêmes
six chiffres, noms différents). Une table de correspondance ferait l'essentiel du
travail sur les couleurs. Mais le reste ne se laisse pas mapper : il n'y a rien côté
branche à quoi rattacher les jetons de mouvement, de forme fine et d'espacement du
paquet — il faut les **introduire**, pas les renommer. Et la couche composants
(`components/core`, `forms`, `feedback`, `content`, `navigation`, `brand` du paquet — 15
composants avec contrat `.d.ts`) n'a pas d'équivalent : la branche écrit du JSX à plat,
en style inline, section par section, sans bibliothèque de composants réutilisables.
Adopter le paquet à la lettre est donc une **reconstruction**, pas un remplacement de
jetons.

---

## 2. Le mécanisme de thème

Le paquet : classe `lehno-nuit` sur `<body>`, pas plus bas.
La branche : attribut `data-theme="dark"|"light"` sur `<html>` (donc **au-dessus** de
`<body>`, pas en dessous) — `apps/web/lib/theme-script.ts` pose
`document.documentElement.dataset.theme`, et `theme-css.ts` émet des règles
`:root[data-theme="light"] { … }` / `:root[data-theme="dark"] { … }`.

**Le résultat est le même, et probablement plus sûr.** La mise en garde du paquet
(« `color` s'hérite en valeur calculée, un thème posé plus bas ne recolore pas le texte
hérité au-dessus ») vise le cas où le sélecteur de thème est posé sur un conteneur
**intermédiaire** : tout ce qui est rendu hors de ce conteneur — notamment du contenu
téléporté directement sur `<body>` (un modal, un toast rendu par portail React) — resterait
dans l'ancien thème, parce que les propriétés `color` déjà calculées en amont ne se
recalculent pas rétroactivement. Poser l'attribut sur `<html>`, au-dessus de `<body>`,
n'a pas ce défaut : c'est l'ancêtre commun de tout ce que la page rend, y compris d'un
éventuel portail. Je n'ai trouvé aucun portail ni contenu injecté hors de l'arbre
`<html>` dans cette branche — le risque que la règle du paquet cible ne se matérialise
pas ici.

**Ce qui casserait réellement** : si du contenu venait à être injecté directement sur
`document.body` sans passer par l'arbre React sous `<html>` (un widget tiers, un script
de mesure qui écrit dans le DOM), le mécanisme actuel le couvre encore, puisque `<body>`
est lui-même sous `<html>`. Le seul cas de rupture serait un sélecteur de thème posé
**plus bas** que `<body>` — ce que la branche ne fait pas. Donc : divergence littérale
avec l'instruction du paquet (nom de classe, position exacte), mais pas de défaut
fonctionnel démontrable dans le code tel qu'il est.

**Une fragilité réelle, distincte** : `apps/web/app/globals.css` et `theme-css.ts`
n'émettent **aucune valeur de couleur sur `:root` nu** — seulement sous
`:root[data-theme="light"]` / `[data-theme="dark"]`. Si le script inline est bloqué
(Content-Security-Policy sans `nonce`/`hash` sur `script-src`, JavaScript désactivé),
`document.documentElement.dataset.theme` ne se pose jamais, aucun des deux blocs ne
matche, et **aucun jeton de couleur n'existe** — `background: var(--bg)` retombe sur
rien de déclaré. Le paquet ne documente pas explicitement ce cas non plus ; je le
signale comme un risque commun aux deux approches (script de thème avant peinture +
attribut), pas un écart au paquet. La tâche 21 du plan (CSP) doit couvrir ce point ; je
ne l'ai pas vérifiée dans ce worktree.

---

## 3. Ce que la branche a bien fait, indépendamment des noms

Les quatre exigences listées, communes aux deux documents, **sont tenues** :

- **Thème résolu avant la première peinture** : `theme-script.ts` s'exécute en ligne
  dans `<head>`, avant tout rendu — `theme-script.test.ts` couvre le choix explicite qui
  l'emporte sur le système, le repli sur `prefers-color-scheme`, et le cas où
  `localStorage` lève (navigation privée) sans planter la page. 4 tests, tous verts.
- **Polices auto-hébergées** : `lib/fonts.ts` utilise `next/font/google` (`Fraunces`,
  `Karla`), pas un lien CDN — conforme à la contrainte CSP du plan et à la remarque du
  paquet sur les polices. Les axes `SOFT`/`WONK` de Fraunces sont bien pilotés (via
  `.titre` et l'instance de police).
- **Repli si l'API ne répond pas** : `lib/config-publique.ts` retourne une configuration
  par défaut si `API_URL` est absent, si la réponse n'est pas `ok`, ou si `fetch` lève
  (réseau injoignable, DNS muet, délai dépassé) — les trois cas sont testés
  (`config-publique.test.ts`, 4 tests).
- **Bascule de langue** : `lib/langues.ts` + `BasculeLangue.tsx`, testée
  (`langues.test.ts`, 5 tests) ; le contenu vient de `messages/{fr,en}.ts`, aucune chaîne
  en dur dans les composants.

Deux points positifs supplémentaires, non demandés explicitement mais notables :
- **Aucune ombre nulle part** (`grep boxShadow` : rien) — la règle « la carte se
  dessine par une bordure et un fond, jamais par une ombre » est tenue partout,
  sans exception.
- **Focus clavier jamais supprimé** : `:focus-visible { outline: 2px solid var(--violet); outline-offset: 2px; }`
  dans `globals.css`, global, sur les deux thèmes — conforme au pixel près à la valeur
  du paquet (2 px, décalé de 2 px).

---

## 4. Les règles non négociables du paquet

- **Le violet ne teinte jamais le texte courant.** Tenu. Tous les usages de
  `var(--violet)`/`var(--violet-deep)` en couleur de texte portent sur des titres, des
  sur-titres, des libellés de bouton, un « J−3 » de maquette, la lettre « h » du
  logotype — jamais un paragraphe de corps. Les paragraphes utilisent `var(--muted)` ou
  `var(--text)`.
- **L'abricot ne côtoie jamais le rouge.** Tenu, mais **par absence** : il n'y a pas de
  rouge du tout dans la branche (voir §1 — pas de rôle `error`), donc la question ne se
  pose pas encore. Ce n'est pas une garantie pour la suite : le jour où un rôle
  `error`/rouge sera introduit, la règle devra être vérifiée activement, aucun garde-fou
  ne l'impose aujourd'hui.
- **Sur fond sombre, le texte d'un bouton plein passe à l'encre `#15131D`.** **Tenu, et
  testé.** `packages/tokens/src/themes.ts` : `dark.onViolet = "#15131D"`. Mieux : le test
  `themes.test.ts` vérifie explicitement `contrastRatio(onViolet, violet) >= 4.5` **dans
  les deux thèmes** — donc le cas 2,96:1 (blanc sur violet clair) que le paquet redoute
  est mécaniquement empêché de régresser. Tous les boutons pleins de la branche
  (`Entete`, `FormulaireAttente`, `ApercuMur`, `ApercuApplication`) utilisent
  `color: var(--on-violet)` et non une valeur figée — la bascule de thème suit
  correctement. C'est la meilleure nouvelle de cette revue : la règle d'accessibilité la
  plus concrète du paquet est respectée, alors même que son auteur ne l'a pas lu — parce
  qu'elle était déjà dans le plan (`Tâche 2`, table de palette) et dans
  `design-system-lehno.md` (§2.5).

**Une règle transverse en tension** : « un bouton plein par écran, au plus ». Au chargement
de la landing, l'en-tête affiche un bouton plein « Commencer » (ancre vers le
formulaire) **et** le formulaire d'attente affiche son propre bouton plein « Commencer »
— les deux visibles ensemble au-dessus du pli sur la plupart des tailles d'écran. Ce
sont la même action (le même « Commencer », vers la même destination), pas deux actions
concurrentes, ce qui atténue la portée du problème ; mais littéralement, deux pleins
coexistent à l'écran. Classé Mineur : c'est un choix d'ergonomie de landing courant, pas
un défaut de contraste ou de compréhension.

---

## 5. La landing elle-même

**Correspondance de section.** La branche : Entete → Hero → Etapes → Contenu → Mur →
Prix → Cloture → Pied. Le paquet, section 2.1 : en-tête → héros → trois temps → quatre
stations de contenu → prix → aplat de clôture → pied — **sans section « Mur »** dans la
landing elle-même. J'ai vérifié : aucun des fichiers `Hero.jsx`, `HowItWorks.jsx`,
`FeatureRow.jsx`, `Pricing.jsx`, `ClosingBand.jsx`, `SiteFooter.jsx` du paquet ne
mentionne le Mur ; `WallPage.jsx` en est une page séparée, à sa propre adresse. La
branche insère une section « Mur » (aperçu, maquette de téléphone) **au milieu de la
landing**, ce que le paquet ne prévoit pas à cet endroit.

**Explication de fond, pas un oubli isolé** : la branche ne reconstruit pas
`ui_kits/web/*.jsx`. Son commentaire de tête le dit lui-même
(`messages/fr.ts:1`) : *« La table de chaînes de "Landing Lehno v3.dc.html", transposée
telle quelle »*. C'est une maquette antérieure et distincte, dans `specs/Landing Lehno
v3.dc.html` — pas le paquet de passation. D'où une divergence de fond, structurelle,
pas seulement cosmétique : contenu, ordre des blocs, choix éditoriaux (la section Mur
dans la landing) viennent d'une autre source de vérité que celle qui fait désormais
autorité.

**Ce qui est néanmoins conforme, indépendamment de la source :**
- Ton : vouvoiement partout, aucun point d'exclamation (vérifié par `grep`), titres en
  phrases (« Soyez là le jour J », pas « Fonctionnalités »), casse en phrase partout.
- Un seul drapeau contrôle héros et clôture (`avantLancement`), venant de
  `process.env["NEXT_PUBLIC_LANCEMENT"]` — conforme à « deux états, un drapeau ».
- Pied : marque, signature, trois liens — correspond à la description du paquet pour
  `SiteFooter.jsx` (« Marque, signature, trois liens »), malgré la source différente.

**Les prix.** Conforme : `Prix.tsx` reçoit `config` depuis
`chargerConfig()` → `GET {API_URL}/v1/public/config`, jamais de valeur écrite en dur
dans le composant (`components/Prix.tsx`, `lib/config-publique.ts`). Testé
explicitement (`landing.test.tsx` : « affiche le prix venu de la configuration, jamais
une valeur écrite en dur »).

**Écarts ponctuels supplémentaires repérés :**
- **Seuil de repli mobile** : le paquet dit 880 px (« Sous 880 px : la navigation passe
  en accordéon »). La branche utilise 760 px (`@container page (max-width: 760px)`,
  `globals.css`). Ce n'est pas une erreur de la branche : le plan qu'elle suit fixe
  lui-même ce seuil à 760 px (Tâche 19, étape 5 : « réduire la fenêtre sous 760 px »).
  Divergence de spécification, pas un défaut.
- **Iconographie** : le paquet impose Lucide partout (`lucide-react` en production),
  contours ouverts, aucune icône pleine. La branche n'a **pas** `lucide-react` en
  dépendance (`package.json`) ; le menu-burger et la bascule de thème dessinent leurs
  propres SVG à la main. Les tracés sont proches du style Lucide (contours, arrondis)
  mais ne sont pas Lucide. C'est un écart aux deux documents à la fois — le paquet
  **et** `design-system-lehno.md` §11.2 l'exigent tous deux — donc pas seulement une
  divergence de source.
- **`next/image`** : non utilisé ; badges, logo et pastille du Mur sont des `<img>`
  classiques. Le README du paquet demande explicitement `next/image` pour les images.
  Impact mesurable : optimisation et dimensionnement automatiques perdus, budget de
  performance (800 ms, §3 du paquet) non vérifié ici.

---

## 6. Ce qui manque tout court (périmètre du paquet, hors la landing)

Sans compter ceci comme un défaut — c'est une carte du travail restant, la branche ne
prétendait couvrir que la landing (Tâche 19 du plan) :

- **Le Mur réel** (`GET /v1/public/walls/{username}` et sa page) — n'existe pas comme
  surface publique servie ; seule une maquette illustrative vit dans la landing.
- **Collecte** (`CollectPage`, 2 variantes), **Dépôt de vœux** (`WishDropPage`),
  **Invitation au parrainage** (`InvitePage`) — aucune de ces trois surfaces de lien
  n'existe.
- **Pages légales et FAQ** (`LegalPage`, `FaqPage`, `ContactPage`) — le pied de la
  landing pointe déjà vers `/conditions`, `/confidentialite`, `/contact`
  (`Pied.tsx`), mais ces routes ne sont pas implémentées : liens morts en l'état.
- **Pages d'état** (`StatePage` — lien révoqué, hors fenêtre, Mur non publié,
  introuvable) — absentes.
- **La coquille publique commune** (`PublicShell.jsx`) : rien dans la branche ne
  factorise l'en-tête + pied + aplat de clôture + bandeau de consentement pour les
  futures pages de lien ; `Entete`/`Pied`/`Cloture` sont actuellement couplés à la page
  d'accueil (`app/[locale]/page.tsx`), pas encore extraits en coquille réutilisable.
- **Bandeau de consentement** — absent (aucune mention de cookies/mesure dans le code).
- **Bibliothèque de composants** (`Button`, `Card`, `Tag`, `Icon`, `Avatar`,
  `SectionLabel`, `TextField`, `Banner`, `Countdown`, `Provenance`, `Quote`, `TabBar`,
  `Wordmark`, `BrandMark`, `SocialGlyph`) — aucun composant réutilisable de ce type ;
  chaque section de la landing écrit son propre balisage stylé en ligne. La ligne de
  provenance et le traitement du décompte (deux conventions de marque propres à Lehno,
  §1.5 du paquet) n'ont donc pas de composant dédié.
- **CTA « obtenir son propre espace » sur toutes les pages publiques** — non applicable
  tant que les autres pages n'existent pas, mais à garder en tête : sur la seule page
  qui existe (la landing), ce CTA se confond avec le CTA d'acquisition lui-même (il n'y
  a qu'un seul type de CTA pour l'instant).

---

## Classement

### Critique
- Aucun. Aucune violation d'une règle d'accessibilité mesurable n'a été trouvée — au
  contraire, la règle la plus sensible du paquet (texte de bouton en encre sur violet
  clair en sombre) est tenue et testée.

### Important
- **Absence de rôles de message (`info`/`success`/`warning`/`error`)** dans
  `packages/tokens` — un vrai manque fonctionnel : l'état d'erreur du formulaire
  d'attente n'a aujourd'hui aucun signal visuel de couleur, seulement `role="alert"`.
  Concerne les deux documents de référence, pas seulement le paquet.
- **Absence totale de jetons de mouvement** et d'animation dans le rendu (transitions,
  easings) — écart aux deux documents, § mouvement de `design-system-lehno.md` et du
  paquet.
- **Iconographie non-Lucide** — écart aux deux documents à la fois (pas seulement une
  divergence de source entre plan et paquet).
- **La landing est bâtie sur une maquette différente** (`Landing Lehno v3.dc.html`) de
  celle du paquet (`ui_kits/web/*.jsx`) : structure, présence d'une section Mur au sein
  de la landing, contenu éditorial — c'est l'écart de fond signalé en introduction de la
  tâche, confirmé et localisé précisément.
- **Nommage des jetons entièrement différent** (`--bg`/`--violet`/`--violet-deep`/…
  contre `--surface-page`/`--action`/`--text-accent`/…) sur les ~17 rôles que la branche
  couvre — mécaniquement remappable pour les couleurs, mais un chantier de recherche/
  remplacement sur l'ensemble de `apps/web/` (aucun composant n'importe les jetons par
  nom symbolique unique ; tout est en style inline avec `var(--nom-de-la-branche)`).

### Mineur
- **Mécanisme de thème sur `<html>` plutôt que sur `<body>`** — divergence littérale à
  l'instruction du paquet, mais sans défaut fonctionnel démontré dans ce code (voir
  §2). À corriger si l'on veut une conformité stricte au paquet, sans urgence
  fonctionnelle.
- **Seuil de repli responsive à 760 px au lieu de 880 px** — divergence de
  spécification (le plan suivi fixe 760 px explicitement), pas une erreur d'exécution.
- **Deux boutons pleins visibles simultanément** (en-tête + formulaire) au chargement
  de la landing — même action répétée, pas deux actions concurrentes ; à surveiller si
  d'autres CTA s'ajoutent.
- **`next/image` non utilisé** — perte d'optimisation automatique, sans casser la page.
- **Formes et espacements en valeurs brutes**, non tokenisés, y compris des valeurs
  hors de l'échelle du paquet (rayons `35`, `44`, `9`, `2`).
- **Liens de pied de page vers des routes non implémentées** (`/conditions`,
  `/confidentialite`, `/contact`) — cohérent avec « pas encore construit », mais à
  noter comme lien mort en l'état actuel du déploiement.

---

## Estimation de l'ampleur de la reprise

- **Couleurs** : reprise mécanique plausible — mapping direct nom-à-nom sur les ~17
  rôles existants, propagé par recherche/remplacement dans les fichiers `.tsx` (aucune
  indirection : tout est en `var(--nom)` inline). Quelques heures.
- **Compléter les jetons manquants** (messages, mouvement, forme, espacement en tant que
  jetons plutôt que valeurs brutes) : un chantier de taille moyenne sur
  `packages/tokens`, plus un passage sur chaque composant pour remplacer les nombres
  bruts.
- **Bibliothèque de composants** (15 composants du paquet, chacun avec son `.d.ts` et
  son `.prompt.md`) : c'est le plus gros morceau. Rien n'existe aujourd'hui côté
  branche à ce niveau d'abstraction — c'est une construction complète, pas un
  ajustement.
- **Reconstruire la landing depuis `ui_kits/web/*.jsx`** : nécessite de retravailler la
  structure (retirer la section Mur de la landing, ou la justifier comme choix propre à
  Lehno si le trancheur le souhaite), le contenu éditorial, l'ordre des blocs. Ampleur
  comparable à une réécriture, sur la base d'un contenu déjà bilingue et déjà relié à
  l'API — donc pas une réécriture depuis zéro, mais une reconstruction substantielle.
- **Le reste du périmètre « surfaces publiques »** (Mur réel, collecte, dépôt de vœux,
  invitation, pages légales/FAQ/contact, pages d'état, coquille publique, bandeau de
  consentement) : entièrement à construire — hors du périmètre de cette branche
  (Tâche 19 seulement), donc pas un manquement, mais une charge de travail restante
  sensiblement plus grande que ce qui a été livré ici.

Globalement : **plusieurs semaines** de travail pour une conformité complète au paquet
sur l'ensemble des surfaces publiques ; **quelques jours** pour ramener la seule landing
actuelle en conformité de jetons et d'icônes, sans toucher au reste du périmètre.

---

## Ce que je n'ai pas pu vérifier

- **La règle d'écart ΔL\*** (10,6 en sombre contre 6,7 en clair, pour l'alternance
  blanc/lilas et pour l'aplat de clôture) : je n'ai pas d'outil de mesure colorimétrique
  dans cette revue ; je n'ai vérifié que l'existence du rôle `band`/`onBand` et sa bonne
  bascule de valeur, pas la conformité chiffrée de l'écart perçu.
- **Le rendu visuel réel** (captures d'écran, comparaison pixel à pixel avec les
  prototypes du paquet) : je n'ai pas lancé le serveur de dev ni ouvert de navigateur ;
  l'analyse est faite sur le code source et les tests, pas sur un rendu observé.
- **La politique de sécurité de contenu (CSP)** et son effet réel sur le script de thème
  inline (nonce/hash) — dépend de la tâche 20/21 du plan, hors du périmètre de fichiers
  que j'ai inspectés.
- **Le budget de performance (800 ms, neuvième dixième)** — non mesuré, nécessiterait un
  déploiement ou un profilage réel.
- **La conformité exacte de `messages/en.ts`** au critère « écrit, non traduit mot à
  mot » — j'ai lu `fr.ts` en détail et vérifié l'absence de exclamation/Title Case, mais
  n'ai pas fait une relecture qualitative comparative complète de l'anglais.

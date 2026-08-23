# Lehno — Brief des illustrations

Ce brief sert à produire le jeu d'illustrations qui rejoindra le design system. Il découle de la charte d'identité visuelle, qui fait autorité sur les couleurs et les tracés.

## 1. Pourquoi elles existent

L'application est volontairement dépouillée : fond blanc, une seule action mise en avant, aucune ombre. Ce parti pris sert les écrans de travail, mais il laisse nus les écrans où **il n'y a rien à montrer** — un carnet neuf, une liste sans échéance, une attente, une erreur. Les illustrations réchauffent ces moments-là, et eux seuls.

Elles ne décorent pas l'application. Elles occupent la place que le contenu n'occupe pas encore.

## 2. La direction retenue

**Des formes pleines en aplats**, sans contour, prises dans la palette de la marque. Lorsque le sujet touche aux gens, des **silhouettes sans visage ni traits** — le produit parle de personnes, mais aucune illustration ne doit représenter un type de personne plutôt qu'un autre.

**Ce qu'on écarte, et pourquoi**
- *Le dessin au trait* — trop proche de la grille d'icônes ; à côté d'une barre d'onglets, on ne distinguerait plus le signe de l'image.
- *Les personnages détaillés* — visages, vêtements, coiffures datent vite et forcent des choix de représentation.
- *L'abstrait géométrique* — juste et intemporel, mais froid, alors que ces écrans demandent de la chaleur.

## 3. Les règles

**Couleurs** — trois maximum par illustration, prises dans la palette :

| Rôle | Clair | Sombre |
|---|---|---|
| Masse principale | `#7B6BB7` | `#9C8BD8` |
| Fond de forme | `#EDEAF7` | `#2E2945` |
| Accent chaud | `#F0CFB4` | `#F0CFB4` |
| Détail sombre | `#221F2B` | `#F2F0F7` |

**Chaque illustration existe dans les deux thèmes.** Ce n'est pas une inversion : les masses se rejouent, comme le fait la palette. L'accent abricot ne bouge pas.

**Format** — vectoriel, boîte de 200 × 160, marge intérieure de 8 %, fond transparent. Lisible à 120 px de large.

**Aucun texte dans l'illustration.** Les libellés vivent dans l'interface, où ils se traduisent.

**Aucune ombre, aucun dégradé** — la charte l'exclut partout.

**Un seul objet par image.** Une illustration qui raconte une scène complète fatigue et vieillit ; une forme claire se retient.

**Une par écran, jamais deux.**

## 4. Les situations à dessiner

### Priorité 1 — les états vides de l'application

| # | Situation | Ce qu'elle doit évoquer |
|---|---|---|
| 1 | **Carnet neuf** — aucun proche enregistré | Un carnet ouvert, des pages qui attendent. C'est l'écran du tout premier lancement |
| 2 | **Aucune échéance proche** — le carnet est rempli, rien n'arrive | Le calme, une pause. Surtout pas un manque |
| 3 | **Annuaire vide** — l'onglet Proches sans fiche | Des silhouettes en attente de se remplir |
| 4 | **Calendrier sans date** — l'onglet Dates | Une grille dont aucune case n'est marquée |
| 5 | **Aucune contribution à valider** | Une corbeille au repos, une pile rangée |
| 6 | **Aucune note sur une fiche** | Une page blanche dans le carnet |
| 7 | **Liste de souhaits vide** | Un paquet fermé, une étiquette sans nom |
| 8 | **Aucun portrait encore produit** | Un cadre qui attend son image |
| 9 | **Aucun mot reçu sur le Mur** | Une boîte aux lettres calme |
| 10 | **Recherche sans résultat** | Une loupe qui n'a rien trouvé, sans dramatiser |

### Priorité 2 — les attentes et les issues

| # | Situation | Ce qu'elle doit évoquer |
|---|---|---|
| 11 | **Génération en cours** | Quelque chose se compose. Peut s'animer légèrement |
| 12 | **Paiement en attente de validation** | La demande est partie vers le téléphone, on attend |
| 13 | **Paiement abouti** | Le soulagement, sans triomphe |
| 14 | **Paiement échoué ou expiré** | Une opération qui n'a pas abouti, sans faute |
| 15 | **Solde de crédits épuisé** | Une réserve vide, sans culpabiliser |

### Priorité 3 — l'entrée dans l'application

| # | Situation | Ce qu'elle doit évoquer |
|---|---|---|
| 16 | **Écran d'ouverture** | Le signe seul, sur fond de marque |
| 17 | **Écran de bienvenue** — les crédits offerts | Un accueil, un présent modeste |
| 18 | **Vérification par code** | Un message parti, un code qui arrive |

### Priorité 4 — les surfaces publiques

Celles-ci sont vues par des gens qui ne connaissent pas Lehno : elles doivent rester nettes et accueillantes.

| # | Situation | Ce qu'elle doit évoquer |
|---|---|---|
| 19 | **Lien révoqué** | Une porte fermée, sans reproche |
| 20 | **Fenêtre de vœux close** | Un moment passé |
| 21 | **Page introuvable** | Un chemin qui ne mène nulle part |
| 22 | **Mur dépublié** | Une page mise en retrait par son propriétaire |
| 23 | **Contribution envoyée** — remerciement | Un geste reçu |
| 24 | **Souhait réservé** — confirmation | Un cadeau mis de côté |

### Priorité 5 — le back-office

| # | Situation | Ce qu'elle doit évoquer |
|---|---|---|
| 25 | **File vide** — rien à traiter | Un plan de travail rangé |
| 26 | **Aucun résultat de recherche** | Sobriété, aucune émotion |

## 5. Le ton des illustrations

Il suit celui du produit : **intimiste, sans mièvrerie**.

- **Un état vide est un état normal**, pas un échec. Une illustration d'état vide ne montre ni personnage triste, ni point d'interrogation, ni carton d'avertissement.
- **Une erreur n'accuse personne.** Ni croix rouge, ni panneau de danger — la couleur d'erreur suffit dans le bandeau, l'illustration reste calme.
- **Une réussite ne triomphe pas.** Pas de confettis, pas de coche géante. Le produit se réjouit sobrement.
- **Aucun émoji, aucun élément de style qui date** — ni bulles, ni traits de vitesse, ni astres.

## 6. Ce qui est livré

- Les vingt-six illustrations en **SVG**, dans les deux thèmes, nommées par situation (`vide-carnet-neuf-clair.svg`).
- Un **fichier source** modifiable.
- Une **planche de contrôle** montrant les vingt-six à 120 px, dans les deux thèmes, pour vérifier qu'elles forment une famille.

## 7. Comment juger

1. **À 120 px** — l'illustration se lit-elle, ou devient-elle une tache ?
2. **Côte à côte** — les vingt-six paraissent-elles de la même main ?
3. **Dans les deux thèmes** — la version sombre est-elle rejouée, ou seulement inversée ?
4. **Sur l'écran réel** — occupe-t-elle le vide sans voler la vedette au texte et au bouton ?

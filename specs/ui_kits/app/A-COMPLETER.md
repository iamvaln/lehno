# À compléter — UI kit application, d'après `uploads/ux-app-mobile-lehno.md`

La spec UX mobile est arrivée après la construction du kit. Elle nomme **27 écrans**
et **6 composants transverses** ; le kit en couvre 6. Voici le delta, par ordre
d'utilité.

## 1. Corrections sur l'existant

- **Accueil (3.2)** — la phrase d'accueil est un texte composé selon la situation
  (« Une date aujourd'hui, deux cette semaine »), écrit en entier dans chaque langue,
  avec ses variantes singulier / pluriel. Pas de recollage de morceaux.
- **Accueil** — la carte la plus imminente porte **deux actions visibles**
  (*préparer*, *marquer envoyé*) ; les suivantes restent des lignes calmes.
  Le kit n'en montre qu'une.
- **Accueil** — deux états vides distincts : premier lancement (bouton *Ajouter un
  anniversaire* à la place de *Laisser une note*) et aucune échéance proche.
- **Proches (3.3)** — chaque ligne porte un **tag de type d'échéance**, neutre pour
  l'anniversaire, coloré pour les autres. Tri par date puis alphabétique. Absent du kit.
- **Fiche (3.4)** — il manque les blocs *Ses portraits*, *Événements et historique*,
  et le bloc *préparer* qui se réduit hors échéance.

## 2. Écrans manquants — par phase de construction

**Phase 1 (le socle)** — 3.1 connexion (5 vues), 3.5 saisie d'une note,
3.6 formulaire d'événement, 3.15 recherche, 3.19 détail d'un souhait,
3.21 détail d'une occasion.

**Phase 2** — 3.8 à valider, 3.13 centre de notifications, 3.20 partage d'un lien
de collecte.

**Phase 3** — 3.7 génération (composition, attente, aperçu), 3.16 reprises en cours,
3.22 aperçu et partage d'un portrait.

**Parrainage (3.9)** — écran manquant, et « Inviter un ami » de l'écran de
bienvenue l'attend : il renvoie provisoirement vers Moi.

**Phase 4** — 3.9 crédits et recharge (avec l'attente mobile money), 3.10 Mon Mur
(côté privé), 3.12 surfaces publiques dans l'application, 3.25 méthodes de paiement.

**Transverse** — 3.11 réglages, 3.17 Moi (à refaire en sections), 3.18 identité d'un
proche, 3.23 profil, 3.24 sécurité, 3.26 aide, 3.27 mes réservations.

## 3. Composants transverses à ajouter (§5)

| Composant | Ce que la spec impose |
|---|---|
| `NotificationBell` | Toujours dans l'en-tête, pastille sur non-lus. *Existe en dur dans `AppHeader` — à extraire.* |
| `CreditIndicator` | Présent à chaque action payante ; le coût s'affiche **avant** de lancer. |
| `EventCard` | La brique réutilisée accueil + fiches. La plus imminente porte ses actions. *Existe en dur — à extraire.* |
| `CategoryTag` | Sur chaque note ; un appui reclasse. |
| `SensitiveBanner` | Événement sensible : ton adapté, aucune idée de cadeau. |
| `PaidActionSheet` | Rappelle coût, solde et résultat attendu avant toute génération. |

## 4. États transverses (§6)

Trois familles absentes du kit, et la spec les traite comme du contenu, pas comme
des accidents :

- **États vides** — un par écran, « tournés vers l'action ». Les textes annoncent
  **ce qui est possible**, jamais ce qui manque : pas de « aucun proche », « vide »,
  « rien à faire ». *« Le calme est une réponse. »*
- **Chargement** — génération (attente soignée, que l'on peut **quitter sans perdre**),
  listes, envoi.
- **Hors connexion** — bandeau ; consultation possible en cache, génération et partage
  mis en attente et repris au retour du réseau.

## 5. Deux principes à inscrire dans le readme

- **Un écran, une intention** — et **au plus un bouton plein par écran**. Le readme
  porte déjà la règle des trois rangs ; il lui manque cette formulation.
- **Ce qui est rare vit ailleurs** — un geste fait quelques fois par an ne prend pas
  la place d'un geste quotidien. C'est ce qui explique que l'accueil ne porte que
  *Laisser une note*.

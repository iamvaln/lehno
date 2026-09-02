# Recette de bout en bout — application mobile

Ce document liste **ce qu'il faut éprouver**, pas ce qui a été éprouvé. L'état
d'avancement vit dans les cases à cocher : une case cochée veut dire *vu à
l'écran*, jamais *écrit et testé unitairement*.

Les tests de décisions couvrent la logique et ne voient rien de ce qui suit :
un texte qui déborde, un bouton qui n'ouvre rien, une section vide, un écran
inatteignable. Les quatre défauts trouvés jusqu'ici — le bandeau par-dessus la
barre d'état, le module natif qui empêchait le démarrage, l'onglet du carnet
sans route, le décompte qui contredisait le serveur — étaient tous invisibles
en test.

---

## 1. Entrée dans l'application

| # | Scénario | Attendu |
|---|---|---|
| 1.1 | Adresse inconnue → code → pseudo → compte | On entre dans l'accueil, session persistante |
| 1.2 | Adresse connue → code → session | On entre directement |
| 1.3 | Code faux | Message d'erreur, champs vidés, on reste |
| 1.4 | Code expiré | « Ce code a expiré », le décompte s'arrête |
| 1.5 | Quatrième demande de code en une heure | « Trop de tentatives », le délai est dit |
| 1.6 | Pseudo déjà pris | Le champ se marque, la raison s'affiche |
| 1.7 | Code de parrainage valide / inconnu / le sien | Trois issues distinctes à l'écran de bienvenue |
| 1.8 | Adresse mal formée | Le bouton reste inactif, aucun appel |
| 1.9 | Retour arrière depuis l'écran du code | On revient à l'adresse, rien n'est perdu |
| 1.10 | Liens légaux depuis la connexion | Les deux documents s'ouvrent |

## 2. Le carnet

| # | Scénario | Attendu |
|---|---|---|
| 2.1 | Carnet vide | État vide, un seul geste offert |
| 2.2 | Créer un proche : nom seul | Il apparaît, sa fiche s'ouvre |
| 2.3 | Créer avec naissance connue / année inconnue | Les deux formes acceptées |
| 2.4 | Recherche : trouvé / rien | Résultats, puis état vide propre |
| 2.5 | Fiche : goûts, refus, notes | Chaque section se remplit |
| 2.6 | Supprimer un proche | Confirmation, puis disparition |
| 2.7 | Carnet long | Pagination, pas de saut visuel |

## 3. Les dates

| # | Scénario | Attendu |
|---|---|---|
| 3.1 | Anniversaire sur un proche à naissance connue | La date se LIT, aucun sélecteur |
| 3.2 | Anniversaire sur un proche sans naissance | La section ne promet rien |
| 3.3 | Autre occasion | Jour et mois se saisissent |
| 3.4 | Les six rappels | Chacun se sélectionne, un seul actif |
| 3.5 | Liste / calendrier | Les deux vues, navigation par mois |
| 3.6 | Occasion passée | Elle se distingue de celle à venir |

## 4. Ce que l'accueil dit

| # | Scénario | Attendu |
|---|---|---|
| 4.1 | Rien dans les semaines | « Rien dans les semaines qui viennent » |
| 4.2 | Une date aujourd'hui | La phrase du jour, pas celle de la semaine |
| 4.3 | Une aujourd'hui + N cette semaine | Les deux comptes, sans doublon |
| 4.4 | Rien avant une date lointaine | La date est nommée |
| 4.5 | Cloche avec non-lues | Pastille chiffrée, pas un point |
| 4.6 | Bannière des reprises | Ne paraît que s'il y a quelque chose |

## 5. Les générations *(generation.message, .ideas, .portrait)*

| # | Scénario | Attendu |
|---|---|---|
| 5.1 | Préparer un message | Le coût s'annonce AVANT, la feuille se confirme |
| 5.2 | Solde insuffisant | On ne lance pas, on oriente vers la recharge |
| 5.3 | Génération en cours puis reprise | On la retrouve dans les reprises |
| 5.4 | Idées de cadeau | Cadrage, budget, note |
| 5.5 | Portrait | Studio, orientation, style, signature |
| 5.6 | Échec de génération | Un message, et le crédit n'est pas pris deux fois |

## 6. Le Mur *(wall)*

| # | Scénario | Attendu |
|---|---|---|
| 6.1 | Mur non publié | L'adresse se montre, ne se partage pas |
| 6.2 | Publier | L'adresse devient partageable |
| 6.3 | Aperçu public | Ce que l'autre verra, sans imiter la page |
| 6.4 | Mots reçus | Liste, et ce qui n'est pas approuvé n'y est pas |

## 7. Wishlists *(wishlist.own)*

| # | Scénario | Attendu |
|---|---|---|
| 7.1 | Créer une liste sur une occasion | Elle est nommée par son occasion |
| 7.2 | Ajouter un souhait | Prix, lien, photo |
| 7.3 | États d'un souhait | Libre / déjà offert ; « réservé » ne se pose pas |
| 7.4 | Partager | Le lien exige au moins un souhait |

## 8. Collecte et réservations *(collect, reservation)*

| # | Scénario | Attendu |
|---|---|---|
| 8.1 | Ouvrir une collecte | Lien public, montant |
| 8.2 | Sas de validation | Chaque contribution se tranche séparément |
| 8.3 | Rejet global | Aucune répartition n'est jointe |
| 8.4 | Mes réservations | Ce qu'on doit acheter, et pour quand |

## 9. Crédits et paiement *(topup.manual, topup.provider, referral)*

| # | Scénario | Attendu |
|---|---|---|
| 9.1 | Solde et trois derniers mouvements | « Tout voir » seulement s'il y a plus |
| 9.2 | Versement manuel | Compte de collecte, référence exigée |
| 9.3 | Méthodes de paiement | Un numéro par opérateur ; « Remplacer » le dit |
| 9.4 | Retirer une méthode | L'avertissement paraît si c'est la dernière |
| 9.5 | Parrainage | Code, invités, gains |

## 10. Compte et réglages

| # | Scénario | Attendu |
|---|---|---|
| 10.1 | Profil | Pseudo, langue, photo |
| 10.2 | Sécurité | « Cet appareil » coché, « les autres » déconnectés |
| 10.3 | Rappels | Canaux, heure |
| 10.4 | Mes données | Demande d'export, dernière demande |
| 10.5 | Fermer le compte | Aperçu, remboursement, code, délai de grâce |
| 10.6 | Se déconnecter | Sortie immédiate, cache et file vidés |
| 10.7 | Aide | Questions, contact, noter l'application |

## 11. États transversaux

| # | Scénario | Attendu |
|---|---|---|
| 11.1 | Hors connexion, lecture | Bandeau, contenu en cache |
| 11.2 | Hors connexion, écriture | « N actions repartiront », puis elles repartent |
| 11.3 | Arrêt pour intervention | L'écran remplace l'application |
| 11.4 | Drapeau éteint atteint par lien profond | « Cette page n'est pas là » |
| 11.5 | Français et anglais | Aucun débordement, aucune clé nue |
| 11.6 | Petit écran (iPhone SE) | Rien ne déborde |

---

## Défauts relevés

On note ici, on corrige à la fin — **sauf si un défaut empêche de continuer** :
dans ce cas on s'arrête, on le remonte, on corrige, on reprend.

| # | Où | Ce qui se passe | Bloquant |
|---|---|---|---|
| D1 | Création d'événement | Sur un anniversaire, la section « La date » affiche son titre et rien dessous tant qu'aucun proche n'est choisi. La règle du dépôt veut qu'une section vide parte avec son titre. | non |
| D2 | Inscription | Après « Get started », on retombe sur la connexion : le compte est créé mais la session ne suit pas. Cause non établie. | **oui** |

## Une note sur le pilotage

Chaque scénario demande entre cinq et quinze gestes, et la saisie d'un champ
échoue environ une fois sur trois — caractères perdus, champ mal vidé, focus
volé. Ce n'est pas un défaut du produit, c'est le coût du pilotage à la main :
il faut le compter dans le temps de la recette.

Le dépôt n'a AUCUN outillage d'écran — ni Detox, ni Maestro, ni
testing-library. Le jour où ces parcours devront se rejouer, c'est ce qui
manquera.

# UI kit — l'application Lehno

Recréation cliquable de l'application mobile. `index.html` monte le tout dans un
châssis d'appareil, avec une bascule clair / sombre.

## Navigation

**Accueil · Dates · Proches · Moi** — quatre onglets, pas davantage
(`components/navigation/TabBar`). Une fiche de proche et une préparation
s'ouvrent par-dessus les onglets, avec un retour en chevron.

| Fichier | Écran |
|---|---|
| `AccueilScreen.jsx` | Accueil — « Bonjour, Valentine » puis *Ce qui approche* |
| `DatesScreen.jsx` | Dates — toutes les échéances, groupées par mois |
| `ProchesScreen.jsx` | Proches — la liste des fiches |
| `ProcheScreen.jsx` | La fiche d'un proche — goûts, idées, no-go |
| `PreparationScreen.jsx` | La préparation — brouillon de message et idées de célébration |
| `MoiScreen.jsx` | Moi — crédits, Mur, réglages |
| `AppHeader.jsx` | En-tête : marque, compteur de notifications, ou titre + retour |
| `PhoneFrame.jsx` | Châssis d'appareil — décor de présentation, hors produit |

## Ce qui vient d'où

Les écrans composent les primitives de `components/` — aucun bouton, badge ou
carte n'est réimplémenté ici. Le contenu reprend les personnes et les notes des
maquettes validées (Awa Diop, Valery Bah, Mathias & Rose, Valentine).

## Ce qui n'est pas représenté

Connexion par code à usage unique, onboarding, états vides et de chargement,
saisie de note, écran de recharge de crédits : aucune source visuelle n'existe
pour ces vues. Elles ont été volontairement omises plutôt qu'inventées.

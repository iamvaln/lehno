# Lehno — Ce que chaque drapeau retire de l'écran

Le produit se livre par morceaux. **Quinze drapeaux** gouvernent ce qui est ouvert ; le socle — proches, notes, dates, occasions, rappels, compte — n'en a pas et ne s'éteint jamais.

Ce document ne dit pas comment allumer. Il dit **ce qui disparaît quand on éteint**, écran par écran, pour qu'aucun trou ne rende une page bancale.

La règle, que le lot des proches formule déjà : **un écran masqué laisse un trou, et le trou doit rester habitable.**

---

## 1. Le lancement, d'abord — c'est le cas réel

Ce n'est pas un exercice. Voici la configuration décidée pour la première version :

| Drapeau | État au lancement |
|---|---|
| `events.other` | **éteint** — anniversaires seuls |
| `topup.provider` | **éteint** — pas de paiement par opérateur |
| `credits` | allumé |
| `topup.manual` | allumé — verser puis déposer son reçu |
| Le reste | à trancher, mais **prévoyez-les éteints** |

**Un drapeau naît éteint.** Sur un déploiement neuf, tout ce qui n'a pas été allumé à la main est fermé. La version que verront les premiers utilisateurs est donc **la plus dépouillée**, pas la plus complète — c'est celle-là qu'il faut dessiner en premier, pas en dernier.

---

## 2. Les trois façons dont un drapeau se manifeste à l'écran

Elles n'appellent pas le même travail, et les confondre produit les trous mal remplis.

**Un écran entier disparaît.** Il sort de la navigation, et tout ce qui y menait sort avec. Le travail porte sur **ce qui pointait vers lui**.

**Un écran perd un morceau.** Il reste, amputé. C'est le cas le plus délicat : une carte à deux actions qui n'en garde qu'une ne doit pas paraître cassée.

**Un choix disparaît d'un formulaire.** Le formulaire reste, une option en moins. Le plus discret, et le plus facile à rater.

---

## 3. Écran par écran, ce qui tombe

### Ce qui disparaît entièrement

| Drapeau éteint | Écrans qui s'en vont | Ce qui pointait vers eux |
|---|---|---|
| `wishlist` | §3.19 Détail d'un souhait *(côté proche)* | Le bloc « préparer » de §3.4 et de §3.21 |
| `wishlist.own` | §3.29 Mes listes · public §3.6 | Une section de **Moi** (§3.17) |
| `wall` | §3.10 Mon Mur · public §3.4 | Une section de **Moi**, et la ligne du haut du profil |
| `collect` | §3.8 À valider · §3.20 Lien de collecte · public §3.2, §3.3 | **La cloche** (§3.13) perd une nature d'entrée ; l'en-tête de §3.4 perd « partager » |
| `wishes` | public §3.5 Dépôt de vœux | Le lien de vœux de **Moi** et du Mur |
| `reservation` | §3.27 Mes réservations | Une section de **Moi** |
| `generation.portrait` | §3.22 Aperçu d'un portrait · le studio | Le bloc « Ses portraits » de §3.4 disparaît en entier |
| `topup.provider` | §3.25 Méthodes de paiement · l'attente opérateur de §3.9 | La ligne « méthodes » de §3.9 et des Réglages |
| `referral` | public §3.7 Page d'invitation | La ligne « inviter » de §3.9 |

### Ce qui reste, amputé — **le travail difficile est ici**

| Drapeau éteint | L'écran qui reste | Ce qu'il perd |
|---|---|---|
| `events.other` | §3.6 Ajout d'un événement | **Le choix du type.** Plus de « anniversaire ou autre » : le formulaire s'ouvre directement sur un anniversaire |
| `generation.message` | §3.21 Une occasion, §3.7 | Une des deux actions de préparation |
| `generation.ideas` | §3.21 Une occasion, §3.7 | L'autre |
| `credits` | §3.9 Crédits | Tout l'achat. **Mais les générations restent disponibles et gratuites** si leur drapeau est allumé — l'écran ne doit pas dire « rechargez » |
| `topup.manual` | §3.9 Crédits | Le chemin « verser puis déposer son reçu » |

### Le cas qui piège

**`credits` éteint n'éteint pas les générations.** Elles deviennent gratuites. Un écran qui annonce un coût, ou qui renvoie vers la recharge, ment alors à l'utilisateur. Le bloc « préparer » doit pouvoir se présenter **sans mention de prix ni de solde**.

C'est le seul endroit où éteindre un drapeau *ajoute* de la valeur pour l'utilisateur au lieu d'en retirer.

---

## 4. Les quatre endroits qui doivent tenir à toutes les combinaisons

**La barre d'onglets.** Rien ne l'éteint aujourd'hui — Accueil, Dates, Proches, Moi, Réglages relèvent tous du socle. Mais **Moi** peut se vider entièrement : Mur, listes, lien de vœux, mots reçus et réservations dépendent tous d'un drapeau. Un onglet qui ne mène qu'à un écran vide est pire qu'un onglet absent. **À trancher : que devient Moi quand ses cinq sections sont fermées ?**

**Les cartes à deux actions.** La carte d'échéance perd *Préparer* si les générations sont éteintes. Elle ne doit pas paraître amputée — pas un bouton restant collé à gauche d'un vide.

**La cloche.** Elle rassemble cinq natures. `collect` éteint en retire deux (contributions, vœux). Elle doit rester crédible avec trois.

**§3.9 Crédits.** C'est l'écran le plus exposé : quatre drapeaux le touchent (`credits`, `topup.provider`, `topup.manual`, `referral`). **Au lancement il n'aura que le solde, les mouvements, et le versement manuel.** Dessinez-le d'abord dans cet état.

---

## 5. Ce qu'il ne faut jamais faire

- **Un bouton grisé.** Une fonctionnalité éteinte n'existe pas ; elle n'est pas « indisponible ».
- **Un « bientôt ».** Rien ne promet une date qu'on ne tient pas.
- **Un renvoi vers un écran vide.** Le lien disparaît avec sa destination.
- **Une section vide qui garde son titre.** Un intitulé sans contenu dit qu'il manque quelque chose.
- **Un espace laissé tel quel.** Ce qui reste se réorganise pour occuper la place, ou la place se referme.

---

## 6. Ce qui est déjà bon

Le lot des proches et celui de Dates/Moi/Réglages portent déjà la bonne intuition :

> **La barre d'onglets tient à trois comme à cinq.** Aucune largeur figée, et l'onglet d'ouverture existe toujours.
>
> **Les cartes à deux actions vivent avec une seule.**
>
> **Les renvois disparaissent** plutôt que de mener à un écran vide.

Ce document ne fait qu'étendre cette règle aux quinze drapeaux, et nommer les combinaisons qui la mettront à l'épreuve.

---

## 7. Ce qu'on vous demande concrètement

- [ ] **Dessiner §3.9 dans son état de lancement** — solde, mouvements, versement manuel. Sans méthodes de paiement, sans attente opérateur.
- [ ] **Dessiner §3.6 sans le choix du type** — le formulaire s'ouvre sur un anniversaire.
- [ ] **Trancher le sort de l'onglet Moi** quand ses cinq sections sont fermées.
- [ ] **Éprouver la fiche d'un proche (§3.4)** avec les générations éteintes : le bloc « préparer » et le bloc « Ses portraits » partent tous deux.
- [ ] **Vérifier la carte d'échéance** avec une seule action.

Le reste — les écrans qui disparaissent entièrement — ne demande que de vérifier que rien ne pointe vers eux.

---

*La liste des drapeaux et de leur couverture est engendrée depuis le registre du serveur, et publiée dans le contrat sur `GET /me/features`. Elle fait foi : ce que le client masque et ce que le serveur ferme doivent désigner la même chose.*

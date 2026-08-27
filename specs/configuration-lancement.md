# Lehno — la configuration du lancement

Ce que la première version montre, et ce qu'elle garde fermé. Décidé le 27/08/2026.

Ce document existe parce que la décision s'était prise **par morceaux, dans une conversation** : le designer avait un profil, le serveur une autre lecture, et personne n'avait la liste complète au même endroit. Une configuration de lancement qui ne vit nulle part se contredit d'elle-même.

---

## Le profil, clé par clé

| Drapeau | État | Pourquoi |
|---|---|---|
| `events.other` | **éteint** | Anniversaires seuls. Écarte toute la complexité de §3.6 — récurrences libres, jalons multiples, libellés. |
| `generation.message` | **allumé** | La génération la plus proche de la promesse, et la moins chère à produire. **C'est ce que les crédits achètent.** |
| `generation.ideas` | éteint | Dépend de `GiftGiven`, qui n'existe pas : sans elle, les idées reproposent le cadeau de l'an dernier. |
| `generation.portrait` | éteint | L'UX était encore en peaufinage, et le traitement d'image coûte le plus cher. |
| `topup.manual` | **allumé** | Verser sur un compte affiché, puis déposer son reçu. Le seul chemin de paiement au lancement. |
| `topup.provider` | éteint | L'intégration opérateur attend. |
| `referral` | **allumé** | Levier d'acquisition, développé de bout en bout. |
| `collect` | **allumé** | Remplit les fiches sans que l'utilisateur tape — la réponse à « je n'ai rien à noter ». |
| `wishlist` | éteint | `WishlistItem` porte encore `is_public` au lieu de `is_shortlisted`. |
| `wishlist.own` | éteint | `OwnerWish` n'existe pas. |
| `wall` | éteint | Aucune table. |
| `wishes` | éteint | Dépend du Mur. |
| `reservation` | éteint | Dépend du Mur et des listes. |
| `launch.live` | *à basculer le jour dit* | Éteint, la landing montre la liste d'attente ; allumé, les liens de magasin. |

---

## La cohérence qu'il a fallu rattraper

Une première lecture éteignait **les trois** générations. Les crédits n'auraient alors rien acheté : un écran de recharge, un versement manuel, des paliers — pour une valeur inexistante.

C'est ce qui a fait garder le message. **Une monnaie sans rien à acheter n'est pas une monnaie**, et un lancement qui la propose apprend à ses premiers utilisateurs que le produit promet à vide.

---

## Ce que ça fait de Lehno v1

Un carnet qui **retient les dates, garde ce qu'on sait des gens, rappelle à temps, et écrit le message le jour venu**. On peut faire compléter une fiche par le proche lui-même, et inviter quelqu'un.

Ce qu'il ne fait pas encore : les idées de cadeaux, les portraits, les listes de souhaits, le Mur, les vœux.

---

## Deux règles qui découlent du profil

**Un drapeau naît éteint.** Sur un déploiement neuf, tout ce qui n'a pas été allumé à la main est fermé. Ce tableau est donc une **liste de gestes à faire**, pas un état qui s'obtient tout seul. Les six clés allumées se basculent depuis le back-office, section Fonctionnalités.

**La landing lit les mêmes drapeaux que l'application.** Les clés qui décident d'une section de la page — les trois générations — ont reçu la portée `public` pour ça. La page parle des crédits **sans condition** : ils existent toujours, il n'y a rien à masquer. Ce sont les moyens de payer qui s'ouvrent et se ferment, et aucun n'a de section sur la page. Une page ne peut donc pas promettre ce qui est éteint : c'est structurel, pas discipliné.

La correspondance section → drapeaux vit **côté landing**, pas dans le registre : une section peut dépendre d'un drapeau ou d'un « ou » entre plusieurs, et c'est éditorial. Le serveur dit ce qui est actif, pas ce qu'on en montre.

**Et le trou doit rester habitable.** Un argument dont on retire un paragraphe doit encore se tenir — le titre au-dessus, l'ordre, la montée en puissance. C'est la même discipline que pour les écrans de l'application, appliquée à une page qui vend.

---

## Ce qui reste à trancher

- **Le prix du crédit et les paliers** au lancement. Réglés en administration, rien en dur.
- **Le nombre de crédits offerts à l'inscription** — cinq aujourd'hui en développement.
- **Le moment de basculer `launch.live`**, et ce qu'on fait de la liste d'attente accumulée.

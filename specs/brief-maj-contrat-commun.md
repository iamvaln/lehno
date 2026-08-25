# Lehno — Le contrat commun

À lire par **les deux équipes**. Ce document ne porte que ce qui les engage ensemble : les décisions qu'une seule d'entre elles ne peut pas appliquer seule.

Le reste vit dans `brief-maj-backend.md`, `brief-maj-mobile.md` et `brief-maj-admin.md`.

---

## 1. Les statuts

| Cas | Statut | Raison |
|---|---|---|
| Succès | `200` | |
| Création rendant une ressource nouvelle | **`201`** | Le client apprend un identifiant |
| Suppression | **`204`** | Rien à rendre |
| Requête mal formée | `400` | |
| Identification manquante ou invalide | `401` | |
| Droit refusé | `403` | En administration, où les chemins sont connus |
| Ressource absente, **hors de son périmètre**, ou gouvernée par un **drapeau éteint** | **`404`** | Un `403` confirmerait son existence |
| Conflit d'état | `409` | |
| Règle métier non satisfaite | `422` | |
| Trop de requêtes | `429` | |

**Les `POST` qui ne créent rien gardent `200`** — `/auth/otp` envoie un code, `/public/waitlist` est idempotent à dessein, une décision de validation modifie un état.

**Le `404` sur la ressource d'autrui n'est pas une commodité, c'est une règle** : répondre « interdit » apprendrait au demandeur que la ressource existe.

---

## 2. Les erreurs portent des codes, jamais des phrases

La réponse d'erreur porte un **code stable** (`insufficient_credits`), un message destiné au journal, et des détails éventuels.

**Le client ne montre jamais le message brut** : il traduit le code dans la langue de l'utilisateur. C'est ce qui rend l'application bilingue sans que le serveur ait à connaître la langue de celui qui l'appelle.

La même règle vaut pour les notifications : le serveur transporte `title_key` et `body_params`, jamais une phrase composée. La langue d'interface peut changer après l'envoi.

---

## 3. Les drapeaux de fonctionnalité

Douze drapeaux. Le socle — proches, notes, dates, occasions, rappels, compte — n'en a pas.

**Le partage des rôles**

- **Le serveur** tient le registre (en code), l'état (en base), résout les dépendances, et **refuse** un appel visant une fonctionnalité éteinte.
- **Le client** demande la liste, masque ce qui est éteint, et **ne décide de rien**.

**Ce que le serveur rend** : `/me/features` et `/public/features` rendent **la liste résolue pour le demandeur** — *ce qui est actif*, jamais l'état brut des drapeaux. Le jour où l'activation deviendra sélective, rien ne changera côté client.

**Les dépendances sont résolues côté serveur** avant l'envoi : `wall` emporte `wishes` et `reservation` ; `wishlist.own` emporte `reservation`. **Le client n'a aucune règle à connaître.**

**Un drapeau inconnu vaut éteint** — le parc ne se met pas à jour d'un bloc.

**Le cas qui trompe** : `credits` éteint laisse les générations **disponibles et gratuites** si leur propre drapeau est allumé. Éteindre le paiement ne doit pas éteindre le produit ; c'est `topup.manual` qui prend le relais.

Chaque drapeau porte, dans le registre, **la liste des écrans et des points d'entrée qu'il couvre**. C'est la référence commune : ce que le mobile masque et ce que le serveur ferme doivent désigner la même chose.

---

## 4. Deux entités de souhaits, sans lien entre elles

C'est le point le plus facile à implémenter de travers, des deux côtés.

| | `WishlistItem` | `OwnerWish` |
|---|---|---|
| Ce que c'est | Ce qu'un proche m'a confié | Mon souhait, sur ma liste |
| Visibilité | Privé — moi seul | Public, c'est sa raison d'être |
| Action | Je **marque** (`is_shortlisted`) | On **réserve** |
| Partage | Jamais | Oui |

**Aucune migration de l'un vers l'autre.** Si un proche crée un compte, il compose sa propre liste : ce qu'il m'avait confié n'est pas ce qu'il publierait.

`WishReservation` pointe vers `owner_wish_id`, **jamais** vers un `WishlistItem`.

**Le marquage n'est pas une réservation** : il n'engage à rien, personne d'autre ne le voit, et il remonte le souhait en tête des suggestions à la préparation.

---

## 5. Le prix, et ce qu'il cache

**Le prix est unique.** Un portrait coûte le même nombre de crédits quelle que soit sa voie d'image, alors qu'un traitement de photo coûte bien davantage à produire. C'est assumé : le prix est un réglage d'administration, pas un calcul.

**Les paliers remplacent la saisie libre.** On achète un `CreditBundle`, le plus petit fixe le minimum. Montants, crédits et remises se règlent depuis l'administration — rien en dur, ni côté serveur ni côté client.

**Le coût réel s'enregistre à part** : ce qui a été dépensé (`AIUsage.cost`) en face de ce qui a été facturé (`ActionRun.credits_spent`). Les opérations d'administration **ne facturent rien mais coûtent**.

---

## 6. Le classement des notes est asynchrone

**La note est enregistrée aussitôt**, telle qu'elle a été écrite. Le classement se fait **en arrière-plan**.

- **Le client n'attend pas** le classement pour confirmer la saisie.
- **Un échec n'est ni montré ni bloquant** — silencieux pour l'utilisateur, pas pour l'équipe, qui garde journaux et alertes.
- **Une note peut n'avoir aucune catégorie.** Aucun repli sur une catégorie fourre-tout ; zéro ligne dans `NoteCategory` est un état valide.
- **Une note non rangée sert quand même** : la génération lit le **contenu**, non le classement.

Côté écran, elle paraît dans un bloc **« à ranger »** sur la fiche, que l'utilisateur vide d'un geste.

---

## 7. Le portrait est une image

Pas une page publique. `share_token` a disparu ; le statut se réduit à `generated` → `approved`, et l'image se compose **à l'approbation**.

**Le serveur dépose l'image et rend une URL signée à durée courte.** Il ne transmet **jamais le binaire par l'API** : une image encodée dans une réponse JSON arrive d'un bloc, ce qui rend l'affichage progressif impossible et fait repasser chaque consultation par le serveur.

**La base garde la référence de l'objet**, jamais l'URL signée : le client en redemande une quand il affiche.

---

## 8. Les liens universels

Le domaine sert les fichiers d'association ; l'application déclare les chemins qu'elle prend en charge.

**Trois comportements** : installée et connecté (reconnaissance, et retour à son espace si le lien est le sien), installée sans compte (**aucun écran de connexion**), pas installée (le navigateur suffit).

**Le lien survit à l'installation** — même mécanisme que le code de parrainage.

**Un chemin inconnu d'une version installée s'ouvre dans le navigateur** plutôt que d'échouer.

---

## 9. Ce qui reste ouvert

- La **notation du décompte** — `J−3` / `3 days`, à éprouver par un test utilisateur. **Ne pas la figer dans un composant.**
- Les **schémas détaillés** de requête et de réponse, ressource par ressource.
- Les **noms des trois styles de photo** du portrait.

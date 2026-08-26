# Lehno — Ce que le serveur sert au mobile, au 26/08/2026

À lire avec `brief-maj-contrat-commun.md` (ce qui engage les deux équipes) et `brief-maj-mobile.md` (ce que l'UX demande à l'écran). Celui-ci ne traite que d'une chose : **ce qui répond aujourd'hui, et comment s'y brancher.**

Le contrat complet, avec les schémas et les notes d'intégration, se lit sur l'adresse ci-dessous. **Il fait autorité sur ce document** : lui est engendré depuis les schémas, celui-ci est écrit à la main.

---

## 1. Où se brancher

| | Adresse |
|---|---|
| API | `http://localhost:3001/v1` |
| Contrat (Redoc) | `http://localhost:4123/` |
| Contrat (JSON brut) | `http://localhost:4123/openapi.json` |
| Contrat (versionné) | `docs/api/openapi.json`, sur `develop` |

**Le préfixe `/v1` est sur toutes les routes.** Il n'est pas dans les chemins du contrat — il est dans `servers`.

**Tous les drapeaux sont allumés** sur cet environnement, à dessein : l'intégration doit pouvoir toucher chaque surface. Ce n'est pas l'état de production, et ce n'est pas ce que vous devez supposer dans le code.

---

## 2. Ce qui répond, en entier

Trente-huit routes. Tout ce qui n'est pas ici n'existe pas encore — inutile de le prévoir en repli.

**Sans compte** — `GET /public/config` · `GET /public/features` · `GET /public/maintenance` · `GET /public/legal/{document}` · `GET /public/invitations/{code}` · `POST /public/waitlist` · `POST /public/contact`

**Entrée** — `POST /auth/otp` · `POST /auth/otp/verify` · `POST /auth/register` · `POST /auth/federated` · `POST /auth/refresh` · `DELETE /auth/session`

**Compte** — `GET` `PATCH /me/profile` · `GET /me/profile/username-available` · `GET /me/features` · `GET /me/credits` · `GET /me/referral`

**Proches** — `GET` `POST /me/persons` · `GET` `PATCH` `DELETE /me/persons/{id}` · `GET` `POST /me/persons/{id}/notes` · `POST /me/notes`

**Dates** — `GET` `POST /me/events` · `GET` `PATCH` `DELETE /me/events/{id}` · `GET /me/occurrences` · `GET /me/occurrences/{id}` · `GET` `POST /me/occurrences/{id}/notes`

**Écrans composés** — `GET /me/home` · `GET /me/metadata`

---

## 3. Filtrer sur un proche — nouveau

La fiche d'un proche (§3.4) montre ses événements et son historique. Deux chemins acceptent désormais `personId` :

```
GET /me/events?personId={id}
GET /me/occurrences?personId={id}&from=2020-01-01
```

**Sans le paramètre, rien ne change** : le chemin rend tout le compte.

**Pourquoi ne pas filtrer côté client.** `/me/occurrences` applique son plafond (`limit`, 50 par défaut) **avant** que vous ne triiez. Un proche dont la prochaine date tombe loin sortirait de la fenêtre, et sa propre fiche l'afficherait vide.

**L'historique** s'obtient en remontant `from` dans le passé — `daysUntil` est signé, négatif pour une échéance passée.

**Un `personId` qui n'est pas au demandeur rend `404`**, jamais une liste vide. Une liste vide voudrait dire « ce proche existe et n'a rien », ce qui ferait de l'identifiant un oracle.

---

## 4. Les drapeaux — ce que vous en faites

La note complète est dans le contrat, sur `GET /me/features`, avec **la table de couverture des treize drapeaux** : écrans et chemins, engendrée depuis le registre du serveur. C'est la référence commune — ce que vous masquez et ce que le serveur ferme doivent désigner la même chose.

Les cinq règles, en bref :

1. **La liste porte ce qui est ACTIF**, dépendances déjà résolues. Jamais l'état brut.
2. **Absent = éteint.** Une clé inconnue de votre version l'est aussi. Les deux se confondent, à dessein.
3. **Vous ne décidez de rien.** Aucune règle de dépendance ne se code côté client.
4. **Lire au démarrage**, puis après chaque connexion ou changement de compte.
5. **Un chemin gouverné par un drapeau éteint rend `404`.** Le recevoir là où vous attendiez une réponse veut dire « relis la liste », pas « affiche une erreur ».

**Sans compte : `/public/features`. Avec : `/me/features`.** Jamais les deux.

### Livrer sans les listes de souhaits

C'est le cas prévu, et il marche : `wishlist` et `wishlist.own` restent éteints.

**Le piège** : `reservation` requiert `wishlist.own`. Elle disparaîtra donc de la liste **même si son propre interrupteur est allumé**. Résolu côté serveur — vous ne la voyez pas, vous la masquez, rien à en déduire.

**Le piège inverse, à ne pas reproduire** : `credits` éteint n'éteint **pas** les générations. Elles restent disponibles et gratuites si leur propre drapeau est allumé. Fermer le paiement ne doit pas fermer le produit.

Le **socle n'a pas de drapeau** : proches, notes, dates, occasions, rappels, compte. Il ne s'éteint jamais.

---

## 5. L'arrêt pour intervention — nouveau

**Ce n'est pas un drapeau, et les confondre casserait l'application.**

| | Drapeau éteint | Arrêt |
|---|---|---|
| Statut | `404` | **`503`**, code `maintenance` |
| Ce que ça dit | « cette surface n'existe pas » | « reviens, voici le délai » |
| Ce que vous faites | masquer l'écran | **écran d'attente, ne rien masquer** |
| Portée | une surface | toutes |
| Quand | lu au démarrage | tombe au milieu d'une session |

Un arrêt traité comme un drapeau ferait lire une fenêtre de deux heures comme une suppression définitive : l'écran disparaîtrait, et ne reviendrait qu'à la réinstallation.

**Ce que le `503` porte** : `details.retryAfterSeconds`. Attendez **ce délai-là**, pas un délai à vous — il vient du serveur pour que tout le parc applique la même règle, et pour qu'on puisse l'allonger si l'intervention dure.

**Puis interrogez `GET /public/maintenance`** plutôt que de rejouer l'appel d'origine :

```json
{ "maintenance": false, "retryAfterSeconds": null }
```

**Ne déconnectez personne, ne videz aucun cache local.** L'arrêt n'est pas une invalidation de session.

**Deux chemins répondent pendant un arrêt** : `/admin*` et `/public/maintenance`. Tous les autres rendent `503`, y compris `/public/config` et `/auth/*` — prévoyez donc l'écran d'attente **avant** l'entrée dans l'application, pas seulement après.

---

## 6. Ce qui n'existe pas encore, et pourquoi

Chacun attend une table absente du schéma. Ne construisez pas de repli : les chemins arriveront tels que le contrat les décrit.

| Chemins | Attend |
|---|---|
| `GET /me/persons/{id}/portraits` | `GeneratedProfile` |
| `GET` `POST /me/persons/{id}/gifts`, `PATCH` `DELETE /me/gifts/{id}` | `GiftGiven` |
| `GET` `POST /me/occurrences/{id}/wishes`, `PATCH` `DELETE /me/wishes/{id}` | `WishlistItem` |
| `/me/wishlists*`, `/me/owner-wishes/{id}` | `OwnerWish` |
| `/me/account`, `/me/sessions`, `/me/identities` | rien — à construire |

**Celui qui pèse le plus est `GiftGiven`** : la maquette dit que la génération d'idées lit cette liste et écarte ce qui a déjà servi. Tant qu'elle manque, la première version des idées cadeaux reproposera le cadeau de l'an dernier. À prévoir dans le calendrier, pas dans le code.

---

## 7. Les rappels qui vous concernent

**Les erreurs portent des codes, jamais des phrases.** Le `message` est destiné au journal ; vous traduisez le `code`. C'est ce qui rend l'application bilingue sans que le serveur connaisse la langue de l'appelant.

**`404` ne veut pas dire « bogue ».** Il couvre trois choses : la ressource n'existe pas, elle est à quelqu'un d'autre, ou son drapeau est éteint. Les trois sont indistinguables **à dessein** — un `403` confirmerait l'existence.

**Les statuts** : `201` sur une création qui rend un identifiant, `204` sur une suppression, `200` sur un `POST` qui ne crée rien (`/auth/otp` envoie un code, il ne crée pas de ressource).

**Le délai entre deux demandes de code est croissant** — 5 s, puis 25, puis 125 — et il vient du serveur dans `retryAfterSeconds`. Ne le recalculez pas de votre côté : deux versions du parc appliqueraient deux règles, et celle du serveur resterait la seule qui compte.

---

## 8. Ce qui reste ouvert

- La **notation du décompte** — `J−3` / `3 days` — n'est pas tranchée. **Ne pas la figer dans un composant.**
- Le **portrait** ne transite jamais en binaire par l'API : une URL signée à durée courte, redemandée à l'affichage.

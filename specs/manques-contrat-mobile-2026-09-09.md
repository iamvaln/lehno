# Ce que l'application mobile ne peut pas faire, et pourquoi

Relevé pendant la construction des **huit écrans** que la planche dessinait et
que l'application ne portait pas (PR #131 à #141).

Aucune de ces lignes n'est un défaut du mobile. Ce sont des endroits où la
**maquette demande quelque chose que le contrat ne sert pas** — et où la seule
réponse honnête était de ne pas dessiner le geste plutôt que d'afficher un
bouton sans effet.

> **La règle suivie partout** : une saisie qui s'évapore à l'envoi est pire
> qu'un champ absent. Un champ manquant se remarque et se réclame ; une saisie
> perdue se découvre après coup, sur un résultat souvent déjà payé.

---

## 1. Le plus lourd : deux générations sur trois sont refusées

`apps/api/src/me/generation.controller.ts`

- ligne 51 — la route porte `@Feature("generation.message")`
- lignes 59-60 — `if (corps.kind !== "wish_message") throw new AppError("resource_inactive", …)`

Seule la génération de **message** aboutit. Les **idées** et le **portrait**
sont refusés, avec « not available yet ».

Conséquences :

- `generation.ideas` et `generation.portrait` existent au registre, s'allument
  en administration, et **ne changent rien** — le contrôleur refuse quoi qu'il
  arrive ;
- lancer des idées exigerait en plus que `generation.message` soit allumé,
  puisque c'est ce drapeau qui garde la route ;
- deux écrans entiers — le cadrage (#138) et le portrait (#141) — sont dessinés,
  payants, drapeautés, et mènent à un refus.

Les deux écrans traitent le refus proprement et **ne débitent pas**. Le portrait
retire même « Refaire » après un tel refus, pour ne pas rouvrir une feuille qui
annonce un prix.

---

## 2. Des adresses qu'on ne peut pas donner

| Manque | Effet | Où |
|---|---|---|
| `collectionLinkSchema` porte `token`, **pas d'`url`** | ni partage ni copie d'un lien de collecte : on ne sait pas le composer | #131 |
| Composer l'adresse côté client la **figerait dans le parc installé** | l'API compose déjà `PUBLIC_WEB_URL` pour le Mur et la wishlist | |

**Demande** : servir `url` comme `${PUBLIC_WEB_URL}/c/${token}`. Les clés
`collectePartager`, `collecteCopier`, `lienCopieFait` attendent au dictionnaire.

---

## 3. Des schémas `.strict()` plus étroits que la maquette

| Schéma | Ce que la maquette demande | Où |
|---|---|---|
| `createWishlistSchema` | nom de liste, « sans occasion », clôture — il ne prend qu'une `occurrenceId` | #132 |
| `createCollectionLinkSchema` | le mot d'accompagnement — `strict` sur `type` + `personId` | #131 |
| `receivedWishSchema` | `isPublic` et `showAuthor` — refusés, et aucune route ne les bascule | #133 |
| `updateWallSchema` | l'interrupteur « Ma wishlist » | #133 |
| `startGenerationSchema` | le **budget** du cadrage — seulement `briefText` (280 car.) | #138 |
| `declarePaymentSchema` | le dépôt d'un reçu de versement | #136 |
| `paymentChannelSchema` | le **code USSD de secours** de l'écran d'attente | #136 |

---

## 4. Des états dessinés que le contrat ne porte pas

- **« Écarté »** : la maquette offre quatre positions à une idée, le contrat en
  porte trois (`status` + `isShortlisted`). Une quatrième pastille colorerait un
  bouton sans rien enregistrer. *(#134, #140)*
- **La photo d'un souhait ne s'écrit pas** : `imageUrl` est servi en lecture,
  absent des schémas d'écriture, aucune route d'envoi de fichier. *(#134)*
- **La photo de profil non plus** : `updateProfileSchema` ne porte pas
  `avatarUrl`. *(relevé à la revue)*
- **La provenance d'un souhait n'a ni verbatim ni date** : `Wish` porte `origin`
  et rien d'autre. *(#134)*
- **Le portrait ne s'expose à aucune adresse publique** : `updateWallSchema` n'a
  aucun champ où le loger — les deux boutons de mise au Mur sont absents. *(#141)*

---

## 5. Une route déclarée et non câblée

`startPaymentSchema` existe dans `packages/contracts/src/me-credits.ts` et
n'est **branché à aucune route**. `preview`, la déclaration, la liste et la
lecture sont toutes sous `@Feature("topup.manual")`.

**`topup.provider` n'a donc aucune surface.** L'écran de recharge (#136) prépare
les mots pour le jour où la route arrivera — `natureDeLAttente` et
`rienNAEtePreleve` lisent déjà `paiement.mode` — sans rien simuler.

---

## 6. Un sens inversé entre la planche et le contrat

`rechargeEconomie` : la maquette écrit **« −17 % »**, une remise calculée côté
client. Le contrat sert `bonusPercent`, c'est-à-dire **« +20 % offerts »**.

Une remise réduit le prix ; un bonus augmente les crédits. Ce n'est pas la même
promesse, et le signe de la maquette sur la donnée du contrat annoncerait un
rabais là où il y a un cadeau. **La copie a été corrigée côté mobile** — c'est
le seul endroit du lot où l'on s'écarte sciemment de la planche.

**À trancher** : soit le contrat sert une remise, soit la maquette dit le bonus.

---

## 7. Un écran qui manque, et qui n'est pas un manque de contrat

`POST /me/received-wishes/{id}/decision` existe et **aucun écran mobile ne
l'appelle**. `valider.tsx` traite les `Submission` de la collecte, pas les
`ReceivedWish`.

L'occasion (#140) n'affiche donc que les vœux `approved`, et la section dira
toujours « Aucun mot » tant que ce sas n'existe pas. Le drapeau `wishes` étant
éteint au lancement, ce n'est pas bloquant — **mais il faudra cet écran avant de
l'allumer.**

---

## 8. Ce que la pile empêche, et qui ne regarde pas le serveur

- **Pas de presse-papiers** : `expo-clipboard` n'est pas embarqué, et c'est un
  module natif. Les adresses restent sélectionnables (l'appui long copie) et le
  **partage** occupe la place du « Copier » de la planche. *(#133, #136)*
- **`Share.share` n'accepte `url` que sur iOS** : ailleurs la feuille s'ouvre
  vide **sans erreur**. « Enregistrer » n'est donc pas offert là où il ne peut
  aboutir. *(#141)*

---

## 9. La réduction des paliers — décidé le 9 septembre

Le pourcentage de remise était **saisi à la main** : `credit_bundle.bonus_percent`,
un `smallint` tapé au panneau, que rien ne rattachait aux chiffres qu'il
résume. Un palier pouvait annoncer 20 % quand son rapport prix/crédits en valait
cinq — sans qu'aucun test ne tombe.

Il est désormais **déduit côté mobile** (PR #136) des deux montants déjà
servis : `creditUnitPrice` par `/public/config` et `amount`/`credits` par
`/me/credit-bundles`. Le calcul retrouve exactement les 17 % et 27 % que la
maquette portait en dur.

### Ce qui est décidé, et qui revient au serveur

**Le serveur calcule et sert le pourcentage.** Deux raisons, et la seconde
compte autant que la première : on ne fait confiance qu'au serveur, et le
téléphone n'a pas à porter des traitements qu'on peut lui épargner.

Bénéfice supplémentaire : l'application n'aura **plus besoin d'appeler
`/public/config`** pour cet écran. C'est un aller-retour réseau de moins sur
l'appareil — et sur un téléphone, c'est le réseau qui pèse, pas le calcul.

**Au moment de servir, pas à l'enregistrement.** La réduction dépend de DEUX
tables : `credit_bundle` (par palier) et `system_parameter` (le prix unitaire,
global). La figer à l'écriture ferait qu'un changement de prix unitaire
invaliderait en silence tous les paliers. Le recalcul en cascade est faisable —
peu de lignes, même transaction — mais il ne gagne rien : l'arithmétique est
gratuite, et il ajoute une règle que **tout chemin d'écriture doit se rappeler**
(migration, peuplement, correction à la main, second endpoint). Calculé au
service, il n'y a rien à oublier.

C'est déjà la doctrine du dépôt, écrite sur `Payment.feeAmount` : *« les frais
annoncés à l'aperçu, figés ici. Pas ceux que le canal porte aujourd'hui. »* On
fige ce qu'on a promis sur une **transaction** ; on calcule la **vitrine** en
direct.

### Le panneau doit prévisualiser

En configurant un prix — unitaire ou de palier —, l'administrateur doit voir
**tout de suite la réduction que ces prix donnent**. Sans quoi on règle des
montants sans savoir ce qu'ils annoncent au client.

**Une seule implantation de la formule**, partagée entre l'aperçu du panneau et
la réponse de l'API. Deux implantations dériveraient, et le panneau montrerait
un chiffre pendant que l'application en affiche un autre — la panne exacte qu'on
vient de retirer, déplacée d'un cran.

### Le paiement doit figer ce qu'on lui a annoncé

`payment` porte déjà `amount`, `credits`, `currency`, `feeAmount` et
`expectedAmount`. Il **manque** :

- **le prix unitaire du jour** — sans lui, « quelle réduction cette personne
  a-t-elle obtenue ? » n'est pas reconstructible après un changement de prix :
  on lit 1000 F pour 12 crédits sans savoir si le plein tarif valait 100 ou 120 ;
- **le prix du palier acheté**, quand il y en a un. `amount` le porte de fait,
  mais rien ne le garantit : les garder tous deux rend l'écart détectable au
  lieu d'être invisible.

Ce n'est pas un confort. `creditBundleId` est en **`onDelete: SetNull`** :
supprimer un palier fait perdre aux paiements historiques jusqu'à sa référence.
Sans valeurs figées sur la ligne, l'information a purement disparu.

Même doctrine que `feeAmount`, même raison : changer un prix ne doit pas
fausser rétroactivement la comptabilité.

### Ce que devient `bonus_percent`

Redondant, et contredisable. Soit il disparaît du schéma et du contrat, soit il
devient un **forçage manuel explicite** — et il doit alors se nommer ainsi, le
panneau montrant la valeur calculée à côté de celle qu'on force.

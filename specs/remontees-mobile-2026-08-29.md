# Ce que le portage mobile a trouvé — point du 29 août

Tout ce qui suit a été **vérifié dans le dépôt à la date d'écriture**, pas
retenu de mémoire. Ce qui a été réglé entre-temps est marqué comme tel, en bas.

Trois destinataires : la **copie**, le **dessin**, le **contrat**. Et une
quatrième liste — ce qui m'attend, moi.

---

## 1. La copie fige ce que le serveur sert — sept fois

C'est le motif le plus répandu, et le plus coûteux : une valeur écrite dans le
dictionnaire est juste le jour où on l'écrit, et devient fausse **en silence**
le jour où le back-office change. Personne ne le voit avant qu'un utilisateur
ne tombe dessus.

| Clé | Ce qu'elle figeait | D'où ça vient vraiment |
|---|---|---|
| `versementNumero` | `+237 6 91 00 00 00` | `/me/collection-accounts` |
| `parrainageCode` | `VAL-4KX2` | `/me/referral` |
| `supprGrace` | « Trente jours », `bonjour@lehno.cm` | `gracePeriodDays`, `supportEmail` |
| `versementInviter` | « 2 crédits » | `/public/config` |
| `parrainageTexte` | « 2 crédits … 2 crédits » | `/public/config` + `/me/referral` |
| `supprSoldeRemboursable` | « le solde vous est remboursé » | `refundable`, ≠ `balance` |
| `supprCode` | « le code envoyé par **SMS** » | il part **par e-mail** |

**Les deux premiers sont les plus graves**, parce qu'ils déplacent de l'argent :

- **`versementNumero`** est le numéro **sur lequel on verse**. Le contrat ne
  rend que les comptes visibles ET actifs, précisément pour qu'« un client qui
  garde son écran ouvert ne verse pas sur un compte qu'on vient de retirer ».
  Figé, l'argent part au mauvais endroit et personne ne le sait avant de
  chercher un versement qui n'est jamais arrivé.
- **`parrainageCode`** figé donnerait le **même code à tout le monde** : les
  filleuls rattachés à un compte qui n'est pas le leur, ou à aucun.

Et **`supprSoldeRemboursable`** promettait le solde entier alors que les CGU §6
ne rendent que les crédits **achetés** — les offerts ne se remboursent pas.

**Côté application, c'est réparé** : ces clés sont retirées ou devenues des
fonctions des valeurs servies, et **une garde les refuse désormais** — aucune
adresse de service, aucun numéro de téléphone, aucun délai en toutes lettres
dans le dictionnaire, éprouvée par la panne dans les deux langues.

**Mais `specs/ui_kits/app/copy.js` les porte encore** : elles reviendront au
prochain import si la source n'est pas corrigée.

### Une lacune de traduction, qui bloque un écran

`reprisesUne` et `reprisesN` **n'existent qu'en français**. Ce sont les **deux
seules clés dépareillées sur 729** — parité vérifiée sur tout le fichier. Le
bandeau des reprises sur l'accueil attend donc sa traduction : mon test de
parité la refuse, et c'est lui qui empêche un anglophone de tomber sur du
français sans que personne le voie.

---

## 2. Le dessin — contradictions et manques

### Le kit gouverne un drapeau qui n'existe pas

**Huit écrans** lisent `on("credits")` pour rendre les générations gratuites :
`CadrageIdeesScreen`, `GenerationScreen`, `ListesScreen`, `NotificationsScreen`,
`OccasionScreen`, `PreparationScreen`, `RechargeScreen`, `StudioScreen`.

**`credits` n'est pas un drapeau.** Le registre l'interdit nommément, avec un
test : « les actions payantes consomment du crédit, toujours », et l'éteindre
« laissait des soldes indépensables ». Un drapeau inconnu vaut éteint — le mode
« générations gratuites » que ces huit écrans dessinent **n'est atteignable par
personne**.

Ce n'est pas théorique : j'ai codé ce drapeau sur la foi du kit, mes deux
fonctions rendaient donc toujours faux, et **la feuille de confirmation ne
s'ouvrait jamais** — un crédit débité au premier appui, sans que rien ne soit
annoncé.

### Le README se contredit sur l'onglet « Moi »

- ligne 43 : « L'onglet part quand `wall`, `wishlist.own`, `wishes` et
  `reservation` sont tous absents »
- ligne 72 : « Toutes fermées, **l'onglet disparaît** : la barre passe à quatre »
- ligne 233 : « **L'onglet ne disparaît plus** »

C'est l'ancienne règle laissée en tête et la nouvelle ajoutée en fin. Qui lit
dans l'ordre s'arrête à la première — c'est ce que j'ai fait, et j'ai construit
un hub Réglages autour d'une prémisse périmée.

### Le compte de collecte ne montre pas son nom

La maquette affiche « Le compte Lehno » et le numéro. Or au moment de valider,
**l'opérateur affiche le nom du destinataire**. Quelqu'un à qui l'on n'a annoncé
que « Lehno » voit s'afficher « ANA KAY » et peut renoncer, croyant s'être
trompé. J'affiche les trois champs ensemble — opérateur, numéro, nom.

### Deux gestes de Sécurité (3.24) que j'ai retirés

- **« Cet appareil » ne se coche pas.** Ni le contrat ni le client ne savent
  quelle lignée est la nôtre. Deviner par le `User-Agent` tomberait sur la
  mauvaise dès qu'un téléphone a deux sessions — on garderait celle qu'on
  croyait fermer.
- **« Déconnecter les autres appareils » ment.** Le libellé dit « les autres »
  dans les deux langues ; `DELETE /me/sessions` révoque **toutes** les lignées,
  celle qui appelle comprise. Le bouton promettrait de rester connecté ici, et
  déconnecterait.

Les deux se règlent d'un même geste côté serveur : **rendre l'identifiant de
session à la connexion**.

### Profil (3.23), trois écarts

- l'**adresse** est dessinée modifiable ; `updateProfileSchema` ne l'accepte
  pas — c'est le moyen de connexion, la changer demande de vérifier la nouvelle
  avant que l'ancienne ne cesse de valoir ;
- le **genre** manque au dessin alors que le contrat le réclame **nommément à
  cet écran** ;
- « changer la photo » n'a **aucune route**.

### Rappels (3.11) : trois interrupteurs pour deux natures

La maquette propose « une semaine avant », « la veille », « le jour même ». Le
contrat n'a que `event_reminder` et `event_day_of` — le délai se choisit **par
date**, pas globalement. Trois bascules dont deux commandent la même nature
s'éteindraient ensemble sans qu'on comprenne pourquoi.

Et `never` (le récapitulatif qu'on tait) n'a **aucun libellé**.

### Fermeture (3.24) : sept motifs, quatre libellés

Le contrat porte sept motifs de départ, la copie en libelle quatre — et l'un
des quatre, « Ça ne m'a pas servi », ne correspond proprement à aucun : il tient
de `no_longer_useful`, `too_complicated` et `missing_feature`. Le ranger de
force enverrait une raison **fausse** dans une donnée qui sert à décider du
produit.

Je n'offre que les trois correspondances sûres ; restent sans libellé :
`privacy_concern`, `too_complicated`, `missing_feature`, `other`.

### Deux rangs sans destination

- **« Questions fréquentes »** — aucune FAQ n'est servie ; les seuls documents
  sont `cgu`, `confidentialite`, `mentions`.
- **`mentions`** n'avait aucun libellé dans la copie de l'application. Réglé
  autrement : les mentions vivent sur le site, et c'est ce lien qu'on pose.

### Le lien de recharge, absent partout

`onRecharger` apparaît à **neuf endroits** du kit, et la primitive portée ne
pouvait pas le porter — `components/` n'avait jamais été livré, les primitives
avaient été reconstruites d'après leur usage. **Le dossier est arrivé le 29/08**,
le manque est donc réparable.

---

## 3. Le contrat — ce qui reste ouvert

- **`paymentChannelSchema` ne dit pas par où il passe.** Dès que les canaux se
  dédoublent en automatique et manuel, deux « MTN Cameroun » d'apparence
  identique mèneront à deux parcours différents. En attendant, je déduis le
  canal de l'opérateur du compte — et **je me tais quand deux canaux du même
  opérateur existent**, plutôt que de choisir un barème au hasard : c'est lui
  qui décide de ce que la personne verse **en plus**.
- **`brand` reste du texte libre** sur les méthodes de paiement. Une liste de
  choix à l'écran ne fera pas mordre la règle « un seul numéro par opérateur » :
  un vieux client, ou un appel direct, enverra toujours « MTN MoMo ».
- **Aucun identifiant de session n'est rendu à la connexion** — voir Sécurité
  ci-dessus.
- **`createNotesSchema` accepte `eventOccurrenceId` avec plusieurs proches**,
  alors qu'une occasion appartient à une seule personne.

---

## 4. Ce qui m'attend, moi

- **La recherche du carnet n'emploie pas `?q=`** alors qu'il existe désormais au
  contrat. Elle charge les pages et filtre en mémoire — tenable à dix proches,
  plus à cent. C'était une remontée backend, c'est devenu ma tâche.
- Le **bandeau des reprises**, dès que les deux clés anglaises arrivent.
- Les **quatre surfaces publiques** de « Moi » — toutes éteintes au lancement.
- **§3.25 Méthodes de paiement** — `topup.provider` éteint, sans urgence.
- Le bouton **« Copier le numéro »** attend `expo-clipboard` ; le numéro est
  sélectionnable en attendant.

---

## 5. Réglé depuis, et qui n'est plus à remonter

- **`?q=` sur `/me/persons`** — servi. Le reproche tombe côté backend.
- **L'administration des paliers, canaux et comptes de collecte** — les écrans
  existent (`/admin/credit-bundles`, `/admin/payment-channels`,
  `/admin/collection-accounts`). Ma remontée « aucun écran pour les gérer » est
  périmée.
- **Le prix des générations**, la **cible sur l'exécution**, le **`@Feature` qui
  ne gardait que le lancement** — trois manques signalés plus tôt, les trois
  corrigés.
- **`referral` contre `credits`** — tranché par `bonusParInvitation`, nul quand
  l'achat est fermé, avec la consigne de lire la valeur et jamais les deux
  drapeaux.
- **Le gris de mention** — ma mesure de contraste (2,39:1) était juste, le jeton
  a été retiré de la charte.
- **La valeur tactile** — ramenée à 44 ; « le pilote avait tort ».

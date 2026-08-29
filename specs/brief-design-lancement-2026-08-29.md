# Ce qui reste à dessiner pour le lancement

*29 août 2026 — écrit depuis le portage React Native, contre le kit et le
contrat servi.*

Ce document ne liste pas des envies. Il liste les endroits où **le lancement
demande un écran que le kit ne dessine pas**, parce que le kit a été dessiné
pour le produit entier et que le lancement n'en ouvre qu'une part.

La configuration du lancement, pour mémoire :

> anniversaires seuls, versement manuel, collecte et parrainage ouverts, le
> message généré. Tout le reste éteint.

Neuf écrans sortent de la navigation. **Le problème n'est pas qu'ils sortent —
c'est ce qu'ils emportent avec eux.**

---

## 1. Le hub du compte disparaît, et emporte le socle avec lui

**C'est le point le plus grave, et le seul qui empêche de livrer.**

« Moi » (3.17) n'est pas gouverné par un drapeau : c'est une conséquence. Ses
quatre sections — Mon Mur, wishlists, mots reçus, réservations — sont toutes
éteintes au lancement, donc l'onglet part. Un onglet qui ne mène qu'à un écran
vide est pire qu'un onglet absent.

Sauf que 3.17 ne porte pas que ces quatre sections. Il porte aussi, et le kit
les y dessine :

- **le solde de crédits, et le bouton « Recharger »** ;
- le parrainage — **ouvert au lancement** ;
- mon profil, sécurité et connexions, la langue ;
- l'aide, et **se déconnecter**.

Rien de tout cela ne suit un drapeau. Au lancement, **on ne peut donc ni voir
son solde, ni recharger, ni se déconnecter** — alors que les crédits sont le
cœur de l'économie du produit.

Le plan de portage a tranché en une phrase : *« l'identité — nom, adresse
publique, accès au profil — remonte en tête des Réglages »*.

**Correction du 29/08, après vérification** : j'avais écrit ici que rien ne
disait à quoi ce hub ressemble. C'est faux. **Le dictionnaire est plus récent
que `CompteScreens.jsx`** et porte déjà l'onglet (`ongletReglages`) et ses
quatre sections — *Crédits et paiements*, *Mon compte*, *Rappels et données*,
*Aide*. Il porte aussi une version des Rappels bien plus riche que le JSX ne
dessine : heure d'envoi, récapitulatif, cinq natures. **La décision était
prise ; c'est le JSX du kit qui est en retard sur sa propre copie.**

L'écran est donc porté, avec ces quatre sections et le motif de rangs de 3.17.
**Ce qui reste au designer** : confirmer l'ordre et la place du bloc crédits en
tête, et dire si 3.17 revient un jour en cinquième onglet ou disparaît pour de
bon.

---

## 2. La recharge, dans l'état que le lancement ouvre

**Décision prise le 29/08 : les paliers sont au lancement.** Le contrat les
imposait de toute façon — on ne peut pas déclarer un versement sans citer un
palier (`bundleId`) et un canal (`channelId`). Le plan disait « pas de
paliers » ; c'est cette phrase qui tombe, pas le contrat.

L'écran 3.9 dessine quatre états : paliers et moyens de paiement, attente
opérateur, abouti, échec. C'est le parcours **automatique**. Au lancement,
`topup.provider` est éteint et `topup.manual` allumé : l'ordre des gestes
s'inverse. **On verse d'abord depuis son application d'opérateur, puis on vient
le déclarer.** Rien ne pousse de demande sur le téléphone.

Manquent donc :

- **le formulaire de déclaration** — sur quel compte de collecte on a versé, le
  numéro employé, et **la référence de transaction que l'opérateur envoie par
  SMS**. Cette référence est obligatoire au contrat, et ce n'est pas un détail
  d'implémentation : c'est elle qui empêche deux personnes de réclamer les
  crédits d'un même versement. Aucune capture d'écran n'est demandée, jamais ;
- **l'état « déclaré, en attente de validation »** — différent de l'attente
  dessinée, qui est celle d'une demande poussée sur le téléphone. Ici on attend
  qu'un humain constate la réception. Ça peut durer, et l'écran doit le dire ;
- **la liste des mouvements** — le plan la nomme, aucun état ne la dessine. Les
  libellés existent déjà et sont figés au contrat, dans les deux langues :
  « Cadeau de bienvenue », « Bonus de parrainage », « Achat de crédits »,
  « Code promotionnel », « Cadeau », « Récompense », « Génération »,
  « Remboursement », « Correction ». Les montants sont signés : + au crédit,
  − au débit ;
- **les moyens de paiement** dessinés (mobile money / carte) sont à revoir :
  ils décrivent le parcours automatique, qui n'existe pas au lancement.

À noter, et ça ne relève pas du design : la table des paliers **n'est semée
nulle part dans le dépôt**, et l'administration n'a pas d'écran pour les gérer.
Tant que ça n'est pas fait, aucun versement n'est déclarable, quel que soit le
dessin.

---

## 3. Rien ne mène aux reprises

L'écran « Reprises en cours » (3.16) existe et est porté. **Aucun écran du kit
ne l'ouvre** — pas de `onOpen("reprises")` nulle part.

Or 3.7 en fait une promesse explicite. Le bouton « Faire autre chose en
attendant » renvoie à l'accueil, et le commentaire à côté dit : *« On retrouve
le travail dans les reprises (3.16) — c'est ce qui rend “vous pouvez fermer”
vrai plutôt que poli. »*

La promesse est écrite, le chemin n'est dessiné nulle part. Et l'entrée
naturelle serait « Moi », qui disparaît au lancement — voir le point 1.

---

## 4. « Préparer » sur la fiche d'un proche : préparer quoi ?

La fiche (3.15) dessine « Préparer » en bouton principal. Mais préparer vise
une **occasion**, jamais une personne : le contrat refuse un lancement qui ne
cite pas d'occurrence, et c'est cohérent — on n'écrit pas le même mot pour un
anniversaire et pour une date de mariage.

Une personne peut porter plusieurs dates. Le bouton ne dit pas laquelle il
prépare. Trois issues, et c'est un choix de design :

- il vise **la prochaine échéance**, et la nomme dans son libellé ;
- il ouvre **un choix** quand il y en a plusieurs, et va droit au but sinon ;
- il disparaît de la fiche, et ne vit que sur l'occasion (3.21).

---

## Ce qui n'attend personne d'autre que le portage

Pour être juste sur le partage : les portes vers 3.7 **sont dessinées**, et
c'est mon implémentation qui manque, pas la maquette.

- la carte de l'accueil porte trois gestes au kit — ouvrir l'occasion,
  préparer, marquer envoyé — et je n'ai câblé que le dernier ;
- un appui sur une échéance dans Dates ouvre **l'occasion** au kit ; chez moi
  il ouvre la fiche du proche. C'est une divergence que j'ai introduite ;
- **l'occasion (3.21) elle-même** est dessinée, ses 28 clés de texte sont déjà
  portées, et `/me/occurrences/:id` est servi. Il ne manque que l'écran.

Tant que 3.21 n'existe pas, tout le lot de la génération est bâti et
n'est atteignable par personne.

---

# Addendum du 29 août, après le portage des Réglages

## 5. Trois coquilles de texte, corrigées côté application

Elles sont réparées dans le dictionnaire du mobile et gardées par des tests.
**Mais `specs/ui_kits/app/copy.js` les porte encore** : elles reviendront au
prochain import si la source n'est pas corrigée.

- **`supprCode`** disait *« Le code envoyé par SMS »*. Il part **par e-mail** —
  `POST /me/account/deletion-code`, « il part par e-mail, et c'est tout
  l'intérêt du second facteur ».
- **`supprGrace`** figeait *« Trente jours »* et *« bonjour@lehno.cm »*. Le
  contrat sert `gracePeriodDays` et `supportEmail` **précisément** pour qu'ils
  ne le soient pas : « une adresse codée en dur dans le client vieillirait sans
  qu'on le sache ». La clé devient une fonction de ces deux valeurs.
- **`supprSoldeRemboursable`** promettait *« Le solde vous est remboursé »*. Les
  CGU §6 ne rendent que les crédits **achetés** ; les crédits offerts —
  bienvenue, parrainage, code promotionnel — ne se remboursent pas, et le
  contrat sépare `balance` de `refundable` pour cette raison. C'était une
  promesse fausse sur de l'argent.

## 6. Ce que le portage des Réglages a trouvé d'autre

- **Le lien de recharge est le motif le plus répandu du kit** — neuf endroits
  passent `onRecharger` — et il est **absent partout** : la primitive portée n'a
  pas la propriété, et §3.9 n'a pas de destination. Il reviendra d'un coup.
- **Rappels (3.11)** : trois interrupteurs deviennent deux. J−7 et J−1
  commandent la même nature au contrat — le délai se choisit **par date**, pas
  globalement. `never` n'a aucun libellé alors que le contrat le porte.
- **Sécurité (3.24)**, deux gestes retirés : « Cet appareil » ne se coche pas
  (aucun identifiant de session n'est rendu à la connexion), et « Déconnecter
  **les autres** appareils » ment — `DELETE /me/sessions` révoque **toutes** les
  lignées, celle qui appelle comprise. Les deux se règlent d'un même geste
  côté serveur : rendre l'identifiant de session à la connexion.
- **Profil (3.23)** : l'adresse est dessinée modifiable et ne l'est pas — c'est
  le moyen de connexion. Le **genre** manque au dessin alors que le contrat le
  réclame nommément à cet écran. « Changer la photo » n'a aucune route.

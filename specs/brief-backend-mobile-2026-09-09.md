# Ce que le serveur doit au mobile

Relevé en portant les **huit écrans** que la planche dessinait et que
l'application ne portait pas, puis en comparant les 33 écrans du kit au code
(PR #131 à #144).

Aucune ligne n'est un défaut du serveur *en soi*. Ce sont les endroits où le
client s'arrête faute de quoi continuer — et où la seule réponse honnête a été
de **ne pas dessiner le geste** plutôt que d'afficher un bouton sans effet.

> **La règle suivie partout, côté mobile** : une saisie qui s'évapore à l'envoi
> est pire qu'un champ absent. Un champ manquant se remarque et se réclame ;
> une saisie perdue se découvre après coup, sur un résultat souvent déjà payé.

Ordonné par ce qui bloque le produit, pas par difficulté.

---

## 1. Deux générations sur trois sont refusées — bloquant

`apps/api/src/me/generation.controller.ts`

- l. 51 — la route porte `@Feature("generation.message")`
- l. 59-60 — `if (corps.kind !== "wish_message") throw new AppError("resource_inactive", …)`

**Seule la génération de message aboutit.** Les idées et le portrait sont
refusés, avec « not available yet ».

Conséquences :

- `generation.ideas` et `generation.portrait` existent au registre, s'allument
  au back-office, et **ne changent rien** ;
- lancer des idées exigerait en plus que `generation.message` soit allumé,
  puisque c'est ce drapeau qui garde la route ;
- deux écrans entiers — le cadrage (#138) et le portrait (#141) — sont
  dessinés, payants, drapeautés, et mènent à un refus.

Les deux écrans traitent le refus proprement et **ne débitent pas**. Le portrait
retire même « Refaire » après un tel refus, pour ne pas rouvrir une feuille qui
annonce un prix.

**Ce qu'il faut** : accepter `wish_ideas` et `portrait`, et déplacer la garde de
drapeau sur la nature demandée plutôt que sur la route entière.

---

## 2. La réduction des paliers — décidé, à porter

Le pourcentage est aujourd'hui **saisi à la main** : `credit_bundle.bonus_percent`,
un `smallint` tapé au back-office, que **rien ne rattache aux montants qu'il
résume**. Un palier peut annoncer 20 % quand son rapport prix/crédits en vaut
cinq — et aucun test ne tombe.

**C'est une réduction de volume, pas un bonus de crédits.** On achète en lot,
donc le crédit coûte moins cher : 10 crédits à 1700 quand l'unité vaut 189,
c'est −10 %. Rien n'est offert en plus, c'est le prix qui baisse.

Tout le vocabulaire dit le contraire :

| Aujourd'hui | Devrait dire |
|---|---|
| `credit_bundle.bonus_percent` | une réduction |
| `bonusPercent` au contrat | idem |
| `apps/admin` : `` `+${p.remisePourcent} %` `` | `−N %` |
| `apps/admin/src/i18n/en.ts` : `remise: "Bonus"` | `Discount` |

Le mobile écrit déjà **« −N % »** — le seul des quatre à le dire juste.

### Le calcul, à deux moments et pour deux usages

1. **À la sauvegarde, au back-office — pour l'aperçu.** Poser « 10 crédits à
   1700 » doit montrer aussitôt « −10 % ». On ne règle pas des montants sans
   voir ce qu'ils annoncent au client.
2. **À la volée, au service — pour le mobile.** Quand quelqu'un ouvre la page
   des offres, le serveur recalcule et sert la valeur du moment.

**Aucune valeur stockée ne fait autorité**, et c'est ce qui rend le montage sûr :
la question du recalcul en cascade quand `credit_unit_price` change ne se pose
plus. Rien à invalider, rien qui pourrisse en silence, rien qu'une modification
directe en base puisse rendre menteur. La source de vérité est structurellement
la configuration.

Le coût est nul : une multiplication, une soustraction, une division, un
arrondi, sur trois à cinq lignes déjà chargées.

**Une seule implantation de la formule**, partagée par l'aperçu et le service.
Deux implantations dériveraient, et le back-office montrerait un chiffre pendant
que l'application en afficherait un autre.

Le mobile ne calcule rien : il lit le champ servi.

### Le paiement doit figer ce qu'on lui a annoncé

`payment` porte déjà `amount`, `credits`, `currency`, `feeAmount`,
`expectedAmount`. Il **manque** :

- **le prix unitaire du jour** — sans lui, « quelle réduction cette personne
  a-t-elle obtenue ? » n'est pas reconstructible après un changement de prix ;
- **le prix du palier acheté**, quand il y en a un.

Ce n'est pas un confort : `creditBundleId` est en **`onDelete: SetNull`**.
Supprimer un palier fait perdre aux paiements historiques **jusqu'à sa
référence** — l'information a purement disparu.

C'est déjà la doctrine du dépôt, écrite sur `Payment.feeAmount` : *« les frais
annoncés à l'aperçu, figés ici. Pas ceux que le canal porte aujourd'hui :
changer un taux ne doit pas fausser rétroactivement la comptabilité. »*

---

## 3. `hasWishlist` sur `/me/home`

Le contrat a **déjà tranché ce cas**, trois lignes plus haut dans le même objet :

```
hasPersons: z.boolean(),
```
> « Le client ne peut pas deviner lequel des deux depuis une liste vide : ce
> drapeau lui évite d'appeler `/me/persons` rien que pour choisir un libellé de
> bouton. »

L'accueil doit savoir si une liste existe pour décider d'afficher l'invitation à
en faire une — qui doit disparaître une fois acceptée. Il appelle donc
`/me/wishlists` **rien que pour ça**, sur l'écran le plus ouvert de
l'application.

L'appel part en parallèle et pas du tout quand `wishlist.own` est éteint, donc
l'attente ne s'allonge pas. Mais c'est **une requête de plus** : radio, batterie,
charge serveur, et un chemin d'erreur à traiter.

**Ce qu'il faut** : `hasWishlist: z.boolean()` à côté de `hasPersons`, un
`EXISTS` dans la requête que `HomeService` fait déjà. Le mobile retire alors une
quinzaine de lignes.

---

## 4. Un lien de collecte sans adresse

`collectionLinkSchema` porte un `token` et **pas d'`url`**. Le mobile ne peut
donc ni partager ni copier un lien : il ne sait pas le composer.

La composer côté client la **figerait dans le parc installé** — et l'API compose
déjà `PUBLIC_WEB_URL` pour le Mur et la wishlist.

**Ce qu'il faut** : servir `url` comme `${PUBLIC_WEB_URL}/c/${token}`. Les clés
`collectePartager`, `collecteCopier`, `lienCopieFait` attendent au dictionnaire.

---

## 5. Des schémas `.strict()` plus étroits que la maquette

| Schéma | Ce que la maquette demande |
|---|---|
| `createWishlistSchema` | nom de liste, « sans occasion », clôture — il ne prend qu'une `occurrenceId` |
| `createCollectionLinkSchema` | le mot d'accompagnement — `strict` sur `type` + `personId` |
| `receivedWishSchema` | `isPublic` et `showAuthor` — refusés, et aucune route ne les bascule |
| `updateWallSchema` | l'interrupteur « Ma wishlist » |
| `startGenerationSchema` | le **budget** du cadrage — seulement `briefText` (280 car.) |
| `declarePaymentSchema` | le dépôt d'un reçu de versement |
| `paymentChannelSchema` | le **code USSD de secours** de l'écran d'attente |

---

## 6. `topup.provider` n'a aucune surface

`startPaymentSchema` existe dans `packages/contracts/src/me-credits.ts` et n'est
**branché à aucune route**. `preview`, la déclaration, la liste et la lecture
sont toutes sous `@Feature("topup.manual")`.

L'écran de recharge (#136) prépare les mots pour le jour où la route arrivera —
`natureDeLAttente` et `rienNAEtePreleve` lisent déjà `paiement.mode` — sans rien
simuler.

---

## 7. Des états dessinés que le contrat ne porte pas

- **« Écarté »** : la maquette offre quatre positions à une idée, le contrat en
  porte trois (`status` + `isShortlisted`). Une quatrième pastille colorerait un
  bouton sans rien enregistrer.
- **La photo d'un souhait ne s'écrit pas** : `imageUrl` est servi en lecture,
  absent des schémas d'écriture, aucune route d'envoi de fichier.
- **La photo de profil non plus** : `updateProfileSchema` ne porte pas
  `avatarUrl`.
- **La provenance d'un souhait n'a ni verbatim ni date** : `Wish` porte `origin`
  et rien d'autre.
- **Le portrait ne s'expose à aucune adresse publique** : `updateWallSchema` n'a
  aucun champ où le loger.

---

## 8. `user.ui_language` naît en français

```
uiLanguage String @default("fr")
```

`ui_language` décide de la **langue des courriels**. Un compte créé depuis un
téléphone anglais naissait donc en français, et le code de connexion partait en
français à quelqu'un qui n'en lit pas un mot.

Le mobile compense depuis #123 : il envoie la langue de l'appareil par
`PATCH /me/profile` juste après l'inscription. **Le défaut reste faux pour tout
autre client**, et la compensation échoue silencieusement si l'appel ne passe
pas.

**Ce qu'il faut** : soit un défaut neutre, soit `POST /auth/register` qui accepte
la langue.

---

## 9. Le studio du message n'a aucune surface d'administration, et sa configuration semée ne se répare pas

Trouvé à l'appareil le 10 septembre 2026, en lançant une génération de message
depuis l'écran de préparation. L'application affiche « Quelque chose s'est mal
passé de notre côté. » ; le serveur porte une `ZodError` :

```
ZodError: [
  { "code": "invalid_type", "expected": "string", "received": "undefined",
    "path": ["modele"], "message": "Required" },
  { "code": "unrecognized_keys",
    "keys": ["motifs", "modeles", "ambiances", "voiesImage"],
    "message": "Unrecognized key(s) in object: …" }
]
    at StudioConfigurationService.reglagesMessageDe (studio/configuration.service.ts:86)
    at GenerationService.rassembler (me/generation.service.ts:440)
    at GenerationService.lancerMessage (me/generation.service.ts:65)
```

La ligne `studio_config` de nature `message` en base porte l'ANCIENNE forme —
celle d'avant que le message et le portrait ne se règlent séparément. Elle avait
été semée par `AmorceStudioService` sous une version antérieure du code, et
`reglagesMessageSchema` ne la lit plus.

**Trois choses manquent, et c'est leur conjonction qui rend la panne
définitive :**

1. **Aucune migration** n'a converti les lignes existantes lors du découpage.
2. **Le semis ne rejoue jamais.** `semerUne` sort sur
   `count({ where: { kind } }) > 0`, et c'est délibéré — « la seule chose à ne
   pas faire ici est de remettre en service les réglages du code par-dessus ce
   que l'administration a publié ». La garde est juste ; elle rend simplement la
   ligne périmée éternelle.
3. **Aucune route ne touche la configuration du message.** Le portrait a tout —
   `GET/PATCH admin/portrait-studio/config`, `config/publish`,
   `config/rollback`, `config/history`, profils, essais, candidats. Le message
   n'a **rien** : ni lecture, ni enregistrement, ni publication. Il n'existe
   donc aucun geste, ni d'administrateur ni d'exploitant, qui répare la ligne.

Conséquence : sur toute installation dont la table a été semée avant le
découpage — production comprise si elle a jamais démarré sur l'ancien code —
**chaque `POST /me/generations` de nature `wish_message` répond 500**, et le seul
recours est un `DELETE` en base suivi d'un redémarrage. C'est ce qu'il a fallu
faire en local pour poursuivre la recette.

**Ce qu'il faut**, par ordre de valeur :

- une **surface d'administration pour le studio du message**, symétrique de
  celle du portrait — c'est le manque de fond, les deux autres n'en sont que les
  symptômes ;
- une **migration** des lignes `kind = 'message'` vers la forme courante ;
- et, en attendant, que `reglagesMessageDe` ne laisse pas fuir une `ZodError`
  brute : une configuration publiée illisible est un incident d'exploitation, pas
  une panne anonyme. Le journal doit nommer la ligne et sa version, et la réponse
  doit se distinguer d'un 500 générique — sans quoi on cherche du côté du
  mobile, comme on l'a fait ici.

---

## 10. Le titulaire du compte n'a pas de fiche : `isSelf` se lit partout, ne s'écrit nulle part

Trouvé à l'appareil le 10 septembre 2026, en cherchant pourquoi « Nouvelle
wishlist » annonçait « Aucune date à vous pour l'instant » sur un compte qui
tourne depuis deux semaines.

`Person.isSelf` est `@default(false)` au schéma. **Aucun chemin de code ne le
met jamais à `true`** — ni l'inscription, ni `POST /me/persons`, dont le schéma
de création ne porte pas le champ. Au contrat, `isSelf` n'apparaît qu'une fois :
en LECTURE, sur la fiche rendue.

En base, sur le compte de recette : une seule personne, `is_self = f`.

**Cinq lectures reposent dessus, et les cinq sont mortes :**

```
me/wishlist.service.ts:127   where: { id: occurrenceId, userId,
                                      event: { person: { isSelf: true } } }
mur/mur.service.ts:85        where: { userId, isSelf: true }
mur/mur.service.ts:133       event: { kind: "birthday", person: { userId, isSelf: true } }
mur/mur.service.ts:224       person: { userId, isSelf: true }
me/data-export.service.ts:125  (export seulement)
```

**Ce que ça donne à l'écran**, et les trois symptômes se tiennent :

- **Une wishlist ne peut jamais viser une occasion.** La garde exige une
  occurrence dont la personne est `isSelf` ; il n'en existe aucune. C'est ce qui
  faisait de « Nouvelle wishlist » un cul-de-sac — le mobile le contourne
  désormais par la liste sans occasion (#G de la revue kit/mobile), mais la
  liste *datée*, elle, reste inatteignable.
- **« Ma date d'anniversaire » sur Mon Mur n'expose jamais rien.**
  L'interrupteur est là, il s'allume, et `mur.service` cherche un anniversaire
  rattaché à une personne `isSelf` qu'il ne trouve pas. L'aperçu répond
  honnêtement « Rien n'est public pour l'instant » — mais l'interrupteur, lui,
  promet.
- **On ne peut inscrire sa propre date nulle part.** Le sélecteur « Pour qui »
  de `POST /me/events` ne liste que les proches ; l'écran du profil n'a pas de
  champ de naissance — il n'existe que sur la fiche d'un proche.

**Ce qu'il faut**, et l'ordre compte :

1. **Créer la fiche de soi à l'inscription**, `isSelf = true`, nommée depuis le
   pseudo. C'est le correctif de fond : les cinq lectures se réveillent seules.
2. **Une reprise pour les comptes existants** — ils n'en ont aucun, et rien ne
   la leur donnera après coup.
3. Décider ensuite **qui écrit la date de naissance du titulaire** :
   `PATCH /me/profile` (qui ne porte pas `birthDate` aujourd'hui), ou la fiche
   de soi par `PATCH /me/persons/{id}` — auquel cas le mobile a déjà le champ,
   il ne lui manque que la fiche à ouvrir.

Tant que 1 et 2 ne sont pas faits, le mobile ne peut rien y faire : il n'a aucun
moyen de créer une fiche `isSelf`, le champ n'existant pas au contrat de
création.

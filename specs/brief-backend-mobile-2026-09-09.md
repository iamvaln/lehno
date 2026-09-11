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

## État au 11 septembre

Ce brief a deux jours et le serveur a bougé vite. Ce qui suit est vérifié à
cette date, sur `develop`, dans le code — pas de mémoire.

| § | Verdict | Ce qui l'a réglé |
|---|---|---|
| **1** — deux générations sur trois refusées | **clos** | `GENERATION_KINDS` porte les trois, et le contrôleur les traite |
| **3** — `hasWishlist` | **clos** | servi (`me-home.ts`) |
| **9** — l'établi du message | **clos** | `admin/text-studio/:nature/…` (#176) : lecture, historique, enregistrement, essais, publication, retour arrière — pour les trois natures de texte, `message`, `idees`, `portrait_brief` |
| **10** — la fiche de soi | **pour moitié** | `GET` et `PUT /me/self` existent, et `ecrireSoi` pose `isSelf: true`. Reste la reprise des comptes ouverts avant |
| **11** — la fiche d'un proche | **ouvert** | `person.service.ts:202` rend toujours sans ses détails |
| **12** — le nom sur la contribution | **ouvert** | `personDisplayName` absent de `submissionSchema` |

Les paragraphes ci-dessous gardent leur rédaction d'origine : ils disent ce
qu'on a vu, quand on l'a vu. Ce tableau dit ce qui en reste.

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

## 9. ~~L'établi du message n'est pas encore branché~~ — CLOS le 11 septembre

> **`admin/text-studio/:nature/…` existe depuis #176**, et il sert les TROIS
> natures de texte — `message`, `idees`, `portrait_brief` : lecture,
> historique, enregistrement, essais, publication, retour arrière. Ce que ce
> paragraphe demandait est fait, et plus largement qu'il ne le demandait.
>
> La réparation au démarrage (`45fd6fa`) avait déjà fermé les deux premiers
> points la veille. Le paragraphe est gardé tel quel : il dit ce qu'on a vu le
> 10, et pourquoi l'écran répondait 500.

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

> **Mise à jour du 11 septembre.** Les points 1 et 2 ci-dessous sont RÉGLÉS par
> `45fd6fa` — « une configuration devenue illisible se répare au démarrage, et
> se dit ». Le semis relit la tête de chaîne et la remplace si elle est
> illisible **et** portée par lui (`publishedByAdminId` nul) ; celle qu'un
> administrateur a publiée n'est jamais touchée, et le refus nommé dit alors ce
> qui se passe. La panne 500 rencontrée le 10 n'est plus atteignable par une
> ligne semée.
>
> **Le point 3 tient toujours**, et c'est le manque de fond — vérifié le 11 sur
> la table de routage réelle du serveur : les dix-sept routes de studio sont
> sous `admin/portrait-studio`, `etat()` lit `enService("portrait")`,
> `historique()` filtre `kind: "portrait"`, `trials` appelle `essayerPortrait`.
> `StudioEssaiService.essayer` — la seule fonction qui dépose un brouillon de
> message — n'est appelée de nulle part dans `src/` : son unique appelant est
> `apps/api/test/studio-essai.test.ts`.

**Trois choses manquaient, et c'est leur conjonction qui rendait la panne
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

Conséquence, telle qu'elle se présentait le 10 : sur toute installation dont la
table a été semée avant le découpage, **chaque `POST /me/generations` de nature
`wish_message` répondait 500**, et le seul recours était un `DELETE` en base
suivi d'un redémarrage — ce qu'il a fallu faire en local pour poursuivre la
recette. La réparation au démarrage a depuis fermé ce chemin.

**Ce qui reste** n'est pas un défaut mais un CHANTIER EN COURS, et il faut le
lire comme tel : le découpage message/portrait date du 31 août (#86), et
l'établi du portrait est arrivé le premier. Celui du message attend son
contrôleur.

Je le note ici parce que la recette l'a rencontré, pas pour le reprocher —
`StudioEssaiService.essayer` est écrite ET testée ; il lui manque une route.

En attendant, les orientations, les garde-fous et le modèle du message restent
ce que le code a semé : on ne peut pas les régler sans livrer.

**Un mot sur le nom, qui m'a fait douter de ma propre lecture** : la seule
section de studio s'appelle `admin/portrait-studio`, et elle porte aussi les
gabarits, les profils de simulation et les essais — qui ne sont pas propres au
portrait. Dire « le studio du message n'a pas d'administration » s'entend donc
facilement comme « le studio n'a pas d'administration », ce qui est faux. Le
jour où l'établi du message arrivera, la question du chemin se posera.

---

## 10. Le titulaire du compte n'a pas de fiche — RÉGLÉ POUR MOITIÉ le 11 septembre

> **`GET` et `PUT /me/self` existent**, et `ecrireSoi` pose bien `isSelf: true`
> à la création. Le point 3 du « ce qu'il faut » ci-dessous est donc tranché :
> c'est la fiche de soi qui porte la date de naissance, `PATCH /me/profile` n'y
> touche pas.
>
> **Restent les points 1 et 2**, et le 1 pèse plus que je ne l'avais écrit :
> `selfPersonSchema` **exige** `gender`, et l'énumération ne vaut que
> `female | male`. Aucun client ne peut donc poser une fiche en silence — la
> création réclame toujours une réponse humaine. Or `ecrireSoi` retombe déjà sur
> `"unspecified"` quand le champ n'est pas fourni : **créer la fiche à
> l'inscription, nommée depuis le pseudo, tient en quelques lignes** et
> dispenserait tout le monde de la question au mauvais moment.
>
> Le point 2 reste entier : les comptes ouverts avant n'ont aucune fiche, et
> rien ne la leur donne.
>
> Voir `design-fiche-de-soi-mobile-2026-09-11.md` §6 pour ce que le mobile
> attend, et §4 pour ce qu'il fait en attendant. Tant qu'ils ne passent pas par `PUT /me/self`, la
> wishlist datée et « Ma date d'anniversaire » restent hors d'atteinte pour
> eux.
>
> Côté mobile, c'est devenu du travail à faire : l'écran du profil peut
> maintenant porter la naissance, et le sélecteur « Pour qui » peut s'ouvrir à
> soi.

> **Ajout du 11 septembre au soir, après l'implémentation mobile.** Le mobile
> pose et lit désormais la fiche. Quatre constats en sont sortis, dont deux
> appellent une décision du serveur.
>
> **`/me/persons` rend la fiche de soi parmi les autres, et `total` la compte.**
> Le mobile l'écarte maintenant des trois écrans qui disent « mes proches », et
> la garde `apps/mobile/test/proches-sans-soi.test.ts` empêche l'oubli au
> prochain écran. Mais le filtre est côté client : `total` continue d'annoncer
> un proche de plus que la liste n'en porte, et la pagination a dû compter les
> fiches **reçues** plutôt que celles **retenues**, faute de quoi un
> enregistrement se dédouble à chaque page et le dernier ne vient jamais — la
> faute a été écrite puis trouvée en relecture, elle se reproduira ailleurs.
> Un `?includeSelf=false`, ou l'exclusion par défaut avec un `total` d'accord
> avec elle, dispenserait chaque client de refaire ce calcul et de rater ce
> piège.
>
> **`profile.displayName` est devenu vestigial.** L'en-tête de « Moi » prend
> celui de la fiche et retombe sur le pseudo ; plus personne ne lit celui du
> compte. Un champ qu'on écrit sans jamais le lire est un piège pour le
> suivant — à retirer, ou à dériver de la fiche.
>
> **`PUT /me/self` avec une `birthDate` ne crée aucune occurrence** — vérifié à
> l'appareil deux fois, `/me/occurrences` rend `[]`. **Ce n'est pas une
> demande** : `recalerAnniversaire` porte `if (!anniversaire) return;`, il
> recale un anniversaire existant sans en créer, et c'est déjà ainsi pour un
> proche. Naissance et anniversaire sont deux gestes délibérément distincts —
> on peut connaître la naissance de quelqu'un sans vouloir en être rappelé.
> Consigné ici pour que personne ne le reprenne pour un défaut.
>
> **`GET /me/self` rend 404 tant que la fiche n'existe pas.** Le mobile le
> traite comme un état et non comme une panne : la lecture est isolée dans son
> propre `try/catch` sur chacun des écrans qui la font, sans quoi un compte sans
> fiche verrait son écran entier retomber en erreur. C'est vivable, mais c'est
> un piège que chaque client devra éviter séparément, et qui ne se voit qu'à
> l'exécution. Le point 1 ci-dessous — créer la fiche à l'inscription — le fait
> disparaître pour tout le monde ; c'est un argument de plus pour lui.
>
> **L'échéance ne sait pas qu'elle est à soi.** Le sélecteur « Pour qui » dit
> désormais « Moi », et la date qu'on y pose part bien sur sa propre fiche. Mais
> l'occurrence qui en sort ressort ailleurs sous `personDisplayName`,
> c'est-à-dire sous votre vrai nom : sur Dates (`dates.tsx:163,320`) et sur
> l'Accueil (`accueil.tsx:340,383,393`). À `accueil.tsx:383`, l'accusé est
> `t.envoiFait(e.personDisplayName)` — **l'accueil propose donc d'envoyer un
> message d'anniversaire à soi-même, nommément, et confirme l'avoir fait.**
>
> `occurrenceSchema` porte `personId` mais **pas** `isSelf`
> (`packages/contracts/src/me-events.ts:223-240`). Aucun de ces écrans ne peut
> donc trancher sans un appel de plus — relire le carnet pour retrouver quelle
> `personId` est la sienne, sur chaque écran qui montre une échéance. Ce qu'il
> en coûte si rien ne bouge : chaque surface refera ce filtre, ou l'oubliera —
> et l'oubli est silencieux, comme il l'a été pour `/me/persons`. Un `isSelf`
> sur l'occurrence, à côté du `personDisplayName` qu'elle porte déjà, le règle
> une fois pour tous les clients.
>
> **Demande : un `PATCH /me/self`.** `PUT` est un remplacement, et
> `selfPersonSchema` exige `displayName` et `gender` : aucun écran ne peut donc
> corriger UN champ de la fiche sans l'avoir lue d'abord, et sans réémettre tout
> ce qu'il en a compris. C'est ce qui a fait retirer `language` de l'envoi du
> mobile — Mon profil n'a pas de sélecteur pour ce champ, et le renvoyer depuis
> `uiLanguage` faisait basculer la fiche comme effet de bord d'un geste sans
> rapport. Avec un `PATCH`, un écran envoie ce qu'il règle et rien d'autre ; les
> champs qu'il ne connaît pas ne sont plus son problème.

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

---

## 11. `GET /me/persons/{id}` rend toujours `nextOccurrence: null` et `notesCount: 0`

> **Toujours ouvert au 11 septembre**, vérifié dans le code.

Vu à l'appareil le 10 septembre 2026 : la LISTE des proches affiche « Awa —
Rien de noté encore · 10 sept. », et la FICHE du même proche, un écran plus
loin, n'affiche aucun sous-titre. La date est là, la fiche ne la dit pas.

```
// me/person.service.ts:200
async get(userId: string, id: string): Promise<Person> {
  return rendre(await this.depot.persons(userId).findOrThrow(id));
}
```

`rendre` prend un second paramètre `details` facultatif, et retombe sinon sur
des valeurs par défaut :

```
notesCount: details?.notesCount ?? 0,
nextOccurrence: details?.nextOccurrence ?? null,
```

Le commentaire qui le justifie dit vrai — « une fiche qui vient d'être créée n'a
ni note ni échéance, et le dire coûterait deux requêtes pour deux valeurs
connues d'avance » —, mais il parle de la CRÉATION. `get` emprunte le même
chemin, sur une fiche qui, elle, a des notes et des dates. Le contrat promet les
deux champs sans condition ; la lecture unitaire rend deux valeurs fausses.

**Ce que ça donne à l'écran** : la fiche d'un proche (§3.18) compose son
sous-titre depuis `nextOccurrence` — « anniversaire · 3 sept. ». Il ne paraît
jamais. `notesCount` y est aussi toujours nul, même si l'écran ne s'en sert pas
encore.

**Ce qu'il faut** : que `get` charge les mêmes détails que la liste — la
fonction existe déjà (`person.service.ts:59`), elle prend un tableau d'`ids` et
sert la liste. Un appel à un élément suffit.

Le mobile pourrait interroger `/me/occurrences?personId=` pour compenser, mais
ce serait une requête de plus pour une donnée que le contrat annonce déjà sur la
fiche — et une seconde vérité à tenir d'accord avec la première.

---

## 12. `submissionSchema` porte `personId` mais pas le nom de la fiche

> **Toujours ouvert au 11 septembre**, vérifié dans le code.

Petit, et de la même famille que le §11 : la contribution rendue au propriétaire
porte `personId`, jamais `personDisplayName`. L'écran du sas (§3.8) doit donc
charger le carnet entier pour intituler une carte — ce qu'il fait désormais,
mais c'est une requête pour un mot.

La page PUBLIQUE, elle, rend déjà `personDisplayName` sur le même objet
(`GET /public/collect/{token}`). La donnée est sous la main du serveur des deux
côtés ; seul le côté propriétaire ne la sert pas.

**Ce qu'il faut** : `personDisplayName` sur `submissionSchema`, nul quand le
lien est public et n'a pas encore produit sa fiche.

Sans lui, le mobile s'en sort — mais la carte s'intitulait « Pour Sans nom » sur
TOUTE contribution nominative, faute de quoi la nommer : `submitterName` n'est
accepté que sur un lien public, « sur un nominatif, le propriétaire sait déjà
qui il a invité ». Le seul champ que l'écran lisait était donc toujours nul là
où il servait.

# La fiche de soi sur mobile — conception

11 septembre 2026. Complète `brief-backend-mobile-2026-09-09.md` §10, que la
livraison de `GET`/`PUT /me/self` a réglé pour moitié.

## Pourquoi ce document

Le serveur vient de lever un verrou. Jusqu'au 11 septembre, `Person.isSelf` se
lisait à cinq endroits et ne s'écrivait nulle part : le titulaire d'un compte
n'avait aucune fiche, et trois écrans mentaient doucement.

`PUT /me/self` existe désormais, et `ecrireSoi` pose `isSelf: true`. Ce qui
était un mur est devenu du travail à faire — mais il pose une question que le
serveur ne tranche pas : **il y a maintenant deux fiches de la même personne.**

## Le problème

| | `/me/profile` — le compte | `/me/self` — la personne |
|---|---|---|
| propre à l'un | `username`, `email`, `emailVerified`, `theme`, `timezone`, `sendHour` | `callingName`, `register`, `birthDate`, `birthYearKnown`, `city`, `country`, `preferredChannel` |
| **en commun** | `displayName`, `avatarUrl`, `uiLanguage`, **`gender`** | `displayName`, `avatarUrl`, `language`, **`gender`** |

Quatre champs se recouvrent — `gender` compris, ce que j'avais manqué en
écrivant la première version de ce document : `profileSchema` le porte déjà,
`updateProfileSchema` le prend, et l'écran du profil le demande depuis
longtemps. Laissés tels quels, on obtient deux vérités sur la
même personne : on change son nom d'un côté, et l'autre continue de signer les
messages avec l'ancien. C'est ce que le dépôt refuse ailleurs — « deux vérités,
et celle de l'écran flatterait ».

**Le recouvrement est encore théorique**, et c'est ce qui rend la décision
possible maintenant : `profile.displayName` n'est lu qu'à un seul endroit,
l'en-tête de « Moi ». Le Mur compose son adresse depuis `username`. La fiche de
soi n'existant pas, personne ne lit son nom.

---

## 1. Un seul endroit : Mon profil

**Pas dans l'onglet Proches.** Que le serveur range le titulaire parmi les
`Person` est un détail de stockage. « Proches » désigne ceux dont on s'occupe ;
on n'est pas un proche de soi-même, et l'y mettre serait raisonner depuis la
base plutôt que depuis la personne qui regarde.

Mon profil absorbe donc la fiche. Un écran, trois sections — §3.

---

## 2. Un champ à l'écran, une source par champ

Pas de synchronisation entre les deux objets : **on choisit lequel porte quoi,
selon ce qu'il nourrit.** Deux écritures tenues d'accord finiraient par diverger
au premier envoi partiellement échoué.

### 2.1 Le nom appartient à la fiche

C'est lui qui alimentera les messages, le Mur et la dédicace d'un portrait.
`profile.displayName` **cesse d'être lu** — l'en-tête de « Moi » prend celui de
la fiche, et retombe sur `username` quand la fiche n'existe pas encore.

Il devient donc vestigial. À signaler au brief plutôt qu'à entretenir : un champ
qu'on écrit encore sans jamais le lire est un piège pour le suivant.

### 2.2 L'avatar appartient au compte

C'est lui qui a la machinerie : dépôt signé, recadrage, et la relecture des
octets qui retire les métadonnées — position géographique comprise. La fiche
porte bien un `avatarUrl`, mais rien pour le remplir.

**On ne duplique pas un tuyau pour respecter une symétrie.** L'écran lit et
écrit celui du compte ; celui de la fiche reste nul.

### 2.3 Le genre appartient au compte, et la fiche le recopie

**Correction du 11 septembre au soir.** J'avais écrit que le genre était propre
à la fiche et qu'il faudrait le demander. C'est faux : le compte le porte déjà,
l'écran le demande déjà, et le serveur s'en sert déjà.

Les deux ne sont pas la même chose, et pourtant si :

- `profile.gender` → **`genreDeLAuteur`** (`generation.service.ts:975`) — pour
  que **ce que vous signez** soit écrit correctement. C'est l'aide affichée.
- `person.gender` → **`genreDuProche`** — pour que ce qu'on écrit **à votre
  sujet** le soit.

Même notion, deux rôles. Pour le titulaire du compte, c'est la même personne
dans les deux rôles : la fiche prend donc le genre du compte, sans nouvelle
question.

**Ce que ça change, et c'est tout le dessin** : créer la fiche ne demande plus
rien de neuf. Le nom, l'avatar, la langue et le genre sont déjà à l'écran et
déjà saisis. **Le seul champ vraiment nouveau est la date de naissance.**

### 2.4 La langue n'est pas un recouvrement

C'est la seule bonne nouvelle du tableau : ce sont deux choses.

- `uiLanguage` — la langue de l'application **et des courriels**.
- `language` sur la fiche — celle dans laquelle on écrit **à votre sujet**.

Elles coïncident presque toujours. Une seule bascule à l'écran, qui écrit les
deux. Mais le jour où quelqu'un voudra l'application en anglais et ses vœux en
français, le contrat le permettra sans qu'on ait rien à défaire.

---

## 3. L'écran

### 3.1 Vous

L'avatar, le nom, le nom d'usage, le genre, la date de naissance.

**Trois de ces cinq sont déjà là** : l'avatar, le nom, le genre — avec son aide,
« Pour que ce que vous signez soit écrit correctement », qui fait tout le
travail. Rien à y toucher.

**Le nom d'usage** (`callingName`) s'ajoute : « comment on vous appelle ». La
génération s'en sert, et il a autant de sens pour soi que pour un proche.

**La date de naissance** est le seul champ vraiment neuf. Elle emploie le champ
déjà construit pour les proches —
`naissanceAEnvoyer` / `naissanceLue`, avec l'année facultative
(`birthYearKnown`). Rien à réécrire.

### 3.2 Votre adresse

Le pseudo et `lehno.io/<pseudo>`, l'e-mail et sa vérification. Ce qui appartient
au compte, pas à la personne.

### 3.3 L'application

La langue, le thème, l'heure d'envoi, le fuseau.

---

## 4. Quand la fiche se crée

**L'idéal est à l'inscription**, et ce n'est pas impossible : c'est le point 1
du §10 du brief, jamais fait. `ecrireSoi` retombe déjà sur `"unspecified"` quand
le genre n'est pas fourni — créer la fiche à l'inscription, nommée depuis le
pseudo, tient en quelques lignes côté serveur. **Re-signalé au brief.**

`selfPersonSchema` exige `gender`, et l'énumération ne vaut que `female | male`.
Mais **le compte le porte déjà** (§2.3) : la fiche le recopie, et aucune
nouvelle question ne se pose. Il ne manque qu'un nom, que le compte a aussi.

### 4.1 En enregistrant son profil

**C'est le cas ordinaire, et il ne demande rien.** Enregistrer Mon profil écrit
les deux : `PATCH /me/profile` comme aujourd'hui, puis `PUT /me/self` avec le
nom, le genre et la langue qu'on vient de poser, plus la naissance si elle est
saisie.

La fiche naît donc du premier enregistrement du profil, sans que personne ait
rien eu à comprendre.

**Si le genre du compte est nul** — un compte qui n'a jamais ouvert cet écran —
`PUT /me/self` ne peut pas partir. On n'insiste pas et on ne bloque rien : le
profil s'enregistre, la fiche attend le prochain passage. Le champ est à
l'écran, juste au-dessus.

### 4.2 En voulant une wishlist datée

**Avoir une fiche ne suffit pas : il faut une DATE**, et une date de naissance
n'en est pas une. Vérifié à l'appareil le 11 septembre : `PUT /me/self` avec
`birthDate` crée la fiche et **aucune occurrence** — `/me/occurrences` rend `[]`,
deux enregistrements de suite.

Ce n'est pas un défaut du serveur. `recalerAnniversaire` porte
`if (!anniversaire) return;` : il **recale** un anniversaire existant, il n'en
crée pas. Et c'est déjà ainsi pour un proche — `identite.tsx` pose la naissance,
l'anniversaire se crée par « Ajouter une date ». **Naissance et anniversaire
sont deux gestes**, délibérément : on peut connaître la naissance de quelqu'un
sans vouloir être rappelé de son anniversaire.

**Le vrai levier est donc le sélecteur « Pour qui »**, pas la naissance. La
chaîne complète :

```
fiche de soi          →  « Pour qui » s'ouvre à soi
  (Mon profil)             (Ajouter une date)
                        →  on pose sa date
                        →  la wishlist peut la viser
```

**On n'inline pas un second formulaire au milieu d'un autre geste.** L'écran de
création d'une liste dit pourquoi et renvoie — vers Mon profil s'il n'y a pas
de fiche, vers l'ajout d'une date s'il y en a une :

> « Pour ouvrir une liste sur une de vos dates, il faut d'abord une date à
> vous. »

Et le retour ramène là où l'on avait laissé son geste, jamais à l'accueil.

### 4.3 Ce dessin survit au correctif serveur

Le jour où la fiche naîtra à l'inscription, rien n'est à défaire : `ecrireSoi`
**met à jour** quand elle existe. Les deux chemins ci-dessus deviennent des
chemins de complétion au lieu de création, et se comportent pareil.

---

## 5. Ce que ça débloque

Quatre écrans mentent aujourd'hui, et la même fiche les règle :

| Écran | Ce qu'il dit | Ce qu'il pourra dire | Ce qu'il faut pour ça |
|---|---|---|---|
| Ajouter une date, « Pour qui » | ne liste que les proches | s'ouvre à soi | la fiche |
| Nouvelle wishlist | « Aucune date à vous pour l'instant » | vos dates | la fiche **et** une date posée |
| Mon Mur | « Ma date d'anniversaire » s'allume et n'expose rien | elle expose | la fiche, sa naissance, **et l'anniversaire posé** |
| Moi | le nom du compte, ou le pseudo | votre nom | la fiche |

**Deux d'entre eux demandent plus que la fiche**, et c'est ce que j'avais écrit
trop vite : la naissance ne fabrique pas d'échéance. Le sélecteur « Pour qui »
est le seul qui débloque vraiment, et c'est par lui que passent les deux
autres.

---

## 6. Ce qui est demandé au serveur

**§A — créer la fiche à l'inscription**, nommée depuis le pseudo, genre par
défaut. C'est le point 1 du §10 du brief, toujours ouvert. Sans lui, tout compte
existant reste sans fiche jusqu'à ce que son titulaire passe par l'un des deux
chemins du §4 — et les comptes ouverts avant le 11 septembre n'ont rien.

**§B — la reprise des comptes existants.** Même paragraphe, même constat : rien
ne la leur donnera après coup.

**§C — `profile.displayName` devient vestigial.** Dès que l'écran lit celui de
la fiche, plus personne ne lit celui du compte. Le laisser en écriture sans
lecture est un piège ; à retirer, ou à dériver de la fiche.

---

## 7. Hors sujet

- **`register`, `city`, `country`, `preferredChannel`** : la fiche les porte, la
  planche ne les demande pas pour soi. On ne pose pas un champ parce qu'il
  existe au contrat.
- **`callingName`** : gardé — « comment on vous appelle » a un sens pour soi
  comme pour un proche, et la génération s'en sert.
- **Le portrait de soi** : la génération vise un proche. Se faire son propre
  portrait est une question de produit, pas d'écran, et personne ne l'a posée.

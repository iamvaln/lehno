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
| propre à l'un | `username`, `email`, `emailVerified`, `uiLanguage`, `theme`, `timezone`, `sendHour` | `callingName`, `register`, `gender`, `birthDate`, `birthYearKnown`, `city`, `country`, `preferredChannel` |
| **en commun** | `displayName`, `avatarUrl`, `uiLanguage` | `displayName`, `avatarUrl`, `language` |

Trois champs se recouvrent. Laissés tels quels, on obtient deux vérités sur la
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

### 2.3 La langue n'est pas un recouvrement

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

**Le genre demande du soin.** Il est obligatoire au contrat
(`PERSON_GENDERS = ["female", "male"]`, pas d'optionnel), et il ne se justifie
pas par l'identité mais par la **grammaire** : « Pour que les messages soient
écrits correctement. » C'est l'aide que le kit prescrit déjà sur la fiche d'un
proche, et elle vaut mot pour mot ici.

Posé sans cette phrase, au milieu de réglages, il paraît intrusif. Avec elle, il
se comprend — et c'est la phrase qui fait tout le travail, pas la position du
champ.

**La date de naissance** emploie le champ déjà construit pour les proches —
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

**Le client ne peut pas le faire en silence** : `selfPersonSchema` exige
`gender`, et l'énumération ne vaut que `female | male`. Aucun `PUT /me/self` ne
part sans une réponse humaine.

La fiche se crée donc au premier des deux moments où la question se comprend.

### 4.1 En complétant ses informations

On est dans Mon profil. Le genre se range entre le nom et la date de naissance,
avec sa justification. Rien à inventer : c'est le formulaire.

### 4.2 En voulant une wishlist datée

**On n'inline pas un second formulaire au milieu d'un autre geste.** L'écran dit
pourquoi et renvoie :

> « Pour ouvrir une liste sur une de vos dates, il faut d'abord une date à
> vous. » → Mon profil → retour là où on était.

Un seul formulaire dans l'application, pas deux à tenir d'accord. Et le retour
ramène là où l'on avait laissé son geste, jamais à l'accueil.

### 4.3 Ce dessin survit au correctif serveur

Le jour où la fiche naîtra à l'inscription, rien n'est à défaire : `ecrireSoi`
**met à jour** quand elle existe. Les deux chemins ci-dessus deviennent des
chemins de complétion au lieu de création, et se comportent pareil.

---

## 5. Ce que ça débloque

Quatre écrans mentent aujourd'hui, et la même fiche les règle :

| Écran | Ce qu'il dit | Ce qu'il pourra dire |
|---|---|---|
| Nouvelle wishlist | « Aucune date à vous pour l'instant » | vos dates, et la liste s'y ouvre |
| Mon Mur | « Ma date d'anniversaire » s'allume et n'expose rien | elle expose |
| Ajouter une date, « Pour qui » | ne liste que les proches | s'ouvre à soi |
| Moi | le nom du compte, ou le pseudo | votre nom |

Aucun ne demande de travail propre : ils lisent ce qui existera.

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

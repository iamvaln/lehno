# Retours sur la passation de la page d'accueil

**Sur `Lehno Landing VF.zip` du 31 août.** Le prototype et les jetons n'appellent
aucune remarque : ils sont clairs, complets, et la copie se tient. Ce document ne
porte que sur le `README.md` de passation, et surtout sur sa section des
drapeaux — celle qui dit d'elle-même : « c'est la logique centrale de cette
page ».

Trois choses y sont fausses, et deux demandent un arbitrage.

---

## Ce qui est faux, et qu'un intégrateur suivrait

### 1. La forme de `/public/features`

Le document annonce un tableau nu :

```json
["credits", "topup.manual", "collect", "referral", "generation.message"]
```

L'appel rend un objet : `{ "features": ["…"] }`. Qui suit le document à la
lettre écrit un client qui ne lit rien — et l'erreur est silencieuse, puisqu'une
liste vide est un état légitime.

### 2. La forme de `/public/config`

Le document annonce :

```json
{ "credit_unit_price": 100, "credit_currency": "F", "signup_free_credits": 5 }
```

L'appel rend : `{ "signupFreeCredits": 5, "creditUnitPrice": 100, "currency": "XAF", "referralBonusInvited": 5 }`

Ni les noms, ni la casse, ni la devise ne correspondent — `"XAF"` et non `"F"`.
Le « F » du prototype est **un choix d'affichage**, pas une valeur reçue : il
faut le dire, sinon on affichera « 100 XAF ».

Il y a aussi un quatrième champ, `referralBonusInvited`, dont le document ne
parle pas — alors que la phrase de parrainage annonce « deux de plus », un
chiffre qui devrait sans doute venir de là plutôt que d'être écrit en dur.

### 3. `credits` n'existe plus

La clé a été retirée du registre : les actions payantes consomment toujours du
crédit, il n'y a donc rien à allumer. Elle apparaît pourtant deux fois — en tête
de la liste de repli, et dans la dernière ligne du tableau des effets.

---

## Ce qui demande votre arbitrage

### 4. La liste de repli contredit son propre principe

Le document écrit, à deux lignes d'intervalle :

> Une liste injoignable vaut la configuration du lancement, codée en dur côté
> client : `["credits", "topup.manual", "collect", "referral", "generation.message"]`.
> **Mieux vaut cacher ce qui existe que promettre ce qui n'existe pas.**

Or une liste codée en dur **promet** cinq fonctionnalités que rien ne confirme.
Si le serveur ne répond pas, c'est précisément le moment où l'on ne sait pas ce
qui est ouvert.

La page fait aujourd'hui l'inverse : serveur muet, **liste vide**, retour en
pré-lancement — on montre la capture d'adresse plutôt que de promettre une
application. C'est la lecture qui respecte la phrase que vous avez écrite.
Confirmez-vous le repli vide ?

### 7. Une ligne du tableau ne mène nulle part

La dernière ligne dit : « `credits`, `topup.manual`, `collect`, `reservation` —
**voir ci-dessous** ». Ci-dessous viennent les deux conséquences déduites, puis
la composition du tarif. `topup.manual` et `collect` n'y sont jamais repris, et
`reservation` n'apparaît que dans le calcul de l'onglet « Moi ».

Que commandent `topup.manual` et `collect` sur cette page ?

---

## Deux détails de la maquette

**L'onglet « Réglages ».** La formulation « cinq si l'onglet Moi est là, quatre
sinon » laisse croire que le cinquième onglet est « Moi ». Le prototype tranche
— `Réglages` reste dans les deux cas —, mais la phrase du document mériterait de
le dire.

**Le « F » du prix.** Voir le point 2 : préciser que c'est un libellé
d'affichage, et lequel employer en anglais.

---

## Ce qui ne se discute pas, et qui est bien vu

La règle « la page ne promet jamais ce que le serveur ne sert pas » est juste, et
elle est rare : la plupart des pages d'accueil annoncent la feuille de route.
Les conséquences déduites — l'onglet « Moi », le nombre de colonnes — sont
exactement le genre de détail qu'on découvre en production, une barre à cinq
colonnes dont une est vide.

Les trois erreurs de forme ci-dessus sont d'ailleurs sans gravité tant qu'on les
corrige dans le document : elles ne remettent en cause aucun dessin.

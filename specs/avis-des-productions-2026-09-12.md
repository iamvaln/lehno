# L'avis sur une production, et la version qui l'a produite

*12 septembre 2026. Répond au §6 de `brief-admin-studio-2026-09-11.md` —
« aucune production ne porte d'avis, et aucune ne dit sur quelle version elle a
été produite ». Le brief ajoute que c'est **ce qui donnerait son sens à tout
l'atelier**, et il a raison : aujourd'hui on publie sans jamais savoir si on a
amélioré quoi que ce soit.*

---

## 1. Ce qui existe, vérifié dans le code

| | Porte sa version | Porte un avis |
|---|---|---|
| **Portrait** | `studio_config_id`, **nullable** | `generated` · `approved` — on approuve, on ne rejette pas |
| **Message** | rien | `generated` · `edited` · `sent` — trois gestes, aucun jugement |
| **Idées de cadeau** | rien — elles vivent dans la sortie de l'`ActionRun`, sans table | — |

Seul le portrait sait d'où il vient, et aucune des trois ne sait ce qu'on en a
pensé.

**L'essai, lui, porte un verdict** (`kept` / `discarded`) depuis le premier jour.
C'est l'asymétrie qui coûte : on juge ce qu'on essaie à trente exemplaires, et
pas ce qu'on sert à de vrais gens.

---

## 2. Les deux manquent ENSEMBLE, et il les faut ensemble

Un pouce en bas sans savoir quelle version l'a produit ne mesure rien : on
apprend qu'une production a déplu, pas laquelle des consignes en est cause.

Une version publiée sans avis ne dit pas si elle vaut mieux que la précédente :
l'historique garde « qui a publié quoi, quand, avec quelle note », et la note
est une INTENTION — « consigne resserrée après un signalement » —, jamais un
résultat.

C'est pourquoi ce document ne propose pas de faire l'un sans l'autre.

---

## 3. L'avis n'est pas l'état, et les confondre serait une faute

`approved` est un **geste** : je garde ce portrait. Un avis est un
**jugement** : il était bon, ou il ne l'était pas.

Les deux se séparent dans la vraie vie. On approuve un portrait passable parce
qu'on a payé et qu'il faut bien en sortir un ; on peut trouver mauvais un
message qu'on a quand même envoyé, faute de temps pour en refaire un. Ranger le
jugement dans l'énumération d'état ferait perdre les deux : on ne saurait plus
distinguer « il n'a pas été approuvé » de « il a été jugé mauvais ».

**Donc une colonne à part, nullable.** Et `null` veut dire **« personne n'a
tranché »**, jamais « satisfait » : compter les non-jugés du bon côté ferait dire
à toute version qu'elle plaît — « zéro se prendrait pour un fait ».

---

## 4. Ce qu'on demande à l'utilisateur, et ce qu'on ne lui demande pas

**Un geste, pas un formulaire.** Un pouce en bas se donne d'un doigt ; exiger un
motif transforme un signal d'une seconde en un écran de plus, et le signal
meurt. La mesure ne vaut que si elle est donnée.

**Pas de motif obligatoire, donc.** Un champ libre facultatif pourra venir
ensuite, quand on saura quoi en faire — mais il ne conditionne rien.

**Le rejet et le « refaire » ne sont pas le même geste.** Refaire coûte un
crédit et produit autre chose ; rejeter ne coûte rien et dit quelque chose sur
ce qu'on vient de lire. Les fondre ferait manquer tous les avis de ceux qui ne
veulent pas repayer — c'est-à-dire précisément ceux qu'on a déçus.

---

## 5. Le lien vers la version

**Nullable, et pour de bon.** Les productions déjà en base n'en ont pas, et
aucune migration ne peut l'inventer : on ne sait pas ce qui tournait au moment
où elles ont été faites. Les exiger ferait échouer la migration ; leur donner la
version courante serait pire — ce serait une donnée fausse, et le panneau la
compterait.

**Le panneau doit donc savoir dire « avant le lien ».** Une ligne à part, et non
un silence : un total qui ne tombe pas juste fait douter du compte, pas des
données.

---

## 6. Ce que le panneau lit — et le piège du compte brut

> **Combien de pouces en bas par version, comparée à la précédente.**

Un **compte** ne se compare pas : une version qui a tourné un jour et une qui a
tourné trois semaines n'ont pas produit le même nombre de choses. Le brut ferait
conclure qu'une version publiée hier est excellente parce qu'elle a deux rejets.

Donc **un taux, et son dénominateur affiché** : « 4 rejets sur 120 productions
(3 %) · la précédente : 11 sur 150 (7 %) ». Sans le dénominateur, un taux tiré
de six productions se lirait comme un taux tiré de six cents.

**Et un seuil sous lequel on ne conclut pas.** En dessous d'une poignée de
productions, l'écran dit « trop tôt pour comparer » plutôt qu'un pourcentage —
sinon la première production rejetée d'une version neuve l'affiche à 100 %, et
quelqu'un reviendra en arrière sur un accident.

---

## 7. Ce que ce document ne tranche pas

1. **Le seuil** du §6 — dix productions ? vingt ? Il se règle en regardant les
   volumes réels, et il n'y en a pas encore.
2. **Où le geste vit sur mobile** : sous la production, ou dans le fil ? Le
   design tranche.
3. **Les idées de cadeau n'ont pas de table.** Leur donner un avis demande
   d'abord de décider si l'on juge la LISTE ou chaque idée — et le §7 du brief
   backend attend déjà une décision voisine sur leur quatrième position.

---

## 8. Ce qui en dépend

Le **second point du §7** du brief admin studio — les portraits refaits qui
s'accumulent dans le stockage — ne se purge pas sans ces avis. « Sans un rejet
explicite, on ne peut rien effacer sans risquer d'emporter ce que quelqu'un
gardait. » Ce document est donc aussi ce qui débloque le ménage.

---

## 9. La condition d'intégrité, posée avant tout le reste

**Un avis porté sur une version ne veut rien dire si la version peut changer
sous lui.** C'est tenu par construction — `settings` ne s'écrit qu'en `create`,
jamais en `update` — et rien ne l'éprouvait avant ce lot. Trois cas le fixent
désormais : l'édition qui suit une publication sans brouillon existant,
l'enregistrement direct, et le retour arrière.

C'est la première brique, et elle est posée.

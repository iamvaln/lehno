# L'avis sur une production, et la version qui l'a produite

*12 septembre 2026. Répond au §6 de `brief-admin-studio-2026-09-11.md` —
« aucune production ne porte d'avis, et aucune ne dit sur quelle version elle a
été produite ». Le brief ajoute que c'est **ce qui donnerait son sens à tout
l'atelier**, et il a raison : aujourd'hui on publie sans jamais savoir si on a
amélioré quoi que ce soit.*

---

## 1. Ce qui existe, vérifié dans le code

> **Corrigé le 12 au soir.** La première rédaction de ce tableau disait que les
> idées « vivent dans la sortie de l'`ActionRun`, sans table ». **C'est faux** :
> `GeneratedIdeaSet` et `GeneratedIdea` existent, une ligne par proposition — et
> elles portent déjà l'avis. La recherche portait sur « GiftIdea », un nom que le
> dépôt n'emploie pas.

| | Porte sa version | Porte un avis |
|---|---|---|
| **Portrait** | `studio_config_id`, **nullable** | `generated` · `approved` — on approuve, on ne rejette pas |
| **Message** | `studio_config_id` depuis #199 | `generated` · `edited` · `sent` — trois gestes, aucun jugement |
| **Idées de cadeau** | rien, sur `generated_idea_set` | **`feedback` (`up`/`down`) + `feedback_at`, par proposition** |

**Il n'y a donc pas de forme à inventer : il y en a une à étendre.** Les idées
tiennent déjà exactement ce que ce document réclamait — deux colonnes nullables,
nouées par une contrainte en base :

```sql
CHECK (("feedback" IS NULL) = ("feedback_at" IS NULL));
```

et son commentaire dit pourquoi : « un avis sans date ne se compare pas dans le
temps, une date sans avis ne désigne rien. Retirer son avis remet les deux à
nul. » Le portrait et le message reprennent cette forme telle quelle.

**L'essai, lui, porte un verdict** (`kept` / `discarded`) depuis le premier jour.
C'est l'asymétrie qui coûte : on juge ce qu'on essaie à trente exemplaires, et
la moitié de ce qu'on sert à de vrais gens.

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

## 6 bis. La lecture PAR MODÈLE, et non seulement par version

*Demandé le 12 : « les métriques liées à cette appréciation des modèles ».*

Une version fige un modèle (`reglages.modele`), mais **un modèle sert plusieurs
versions**, et les deux questions ne sont pas la même :

| Question | Dimension |
|---|---|
| « ma consigne resserrée a-t-elle aidé ? » | la **version** |
| « ce modèle vaut-il son prix ? » | le **modèle** |

La seconde appartient au registre des modèles, où vivent déjà l'interrupteur, le
tarif et la panne. Un tarif sans taux de rejet ne dit que la moitié : le modèle
le moins cher peut coûter le plus, en productions refaites.

**Le chemin existe** : une production porte son `action_run_id`, et `ai_usage`
porte `model_id`, `provider`, `model_key` pour ce même `action_run_id`.

> **LE PIÈGE : UN REPLI PRODUIT PLUSIEURS LIGNES D'USAGE.** « Le coût RÉEL,
> agrégé depuis les tentatives — un repli en produit plusieurs. » Attribuer un
> rejet à *tous* les modèles d'une exécution blâmerait celui qui a seulement
> échoué avant, et qui n'a rien écrit. **C'est le modèle de la tentative qui a
> abouti** qui compte, et lui seul.

---

## 7. Ce que ce document ne tranche pas

1. **Le seuil** du §6 — dix productions ? vingt ? Il se règle en regardant les
   volumes réels, et il n'y en a pas encore.
2. **Où le geste vit sur mobile** : sous la production, ou dans le fil ? Le
   design tranche.

*Tranché le 12 : l'avis vaut AUSSI pour les propositions d'idée, et par
proposition — ce qui est déjà le cas en base. Ce qui leur manque est le lien
vers la version, porté par le jeu et non par chaque idée : une génération
emploie une seule configuration, et le poser par idée ferait quatre fois la
même donnée avec quatre occasions de diverger.*

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

---

## 10. Deux axes, pas un — et ce qui manque encore au second

*Ajouté le 12 septembre, après arbitrage : ce document décrit l'AVIS, et il en
manquait la moitié du cadre.*

**Le statut et l'avis sont deux axes, et les confondre écraserait une
distinction qui compte.**

| | ce qu'il dit |
| --- | --- |
| le **statut** | ce qu'on fait de l'objet — composé, gardé, écarté |
| l'**avis** | ce qu'on en pense, et c'est **un pas de plus** |

**On peut garder sans jamais dire qu'on a aimé** — c'est même le cas ordinaire,
donner un avis est un geste qu'on ne franchit pas forcément. **Et on peut garder
sans aimer** : une image qu'on ne trouve pas réussie mais qu'on garde quand même
dit quelque chose de précis, que ni le statut seul ni l'avis seul ne
porteraient.

Le §8 ci-dessus dit donc *presque* juste : ce qui débloque le ménage du stockage
est le **statut** — « je ne garde pas celle-ci » —, pas l'avis. Un pouce en bas
sur une image qu'on garde n'autorise rien à effacer.

### Ce qui manque : la raison d'un avis négatif

**Un « je n'aime pas » sans raison ne dit pas quoi corriger.** C'est pourtant la
seule chose qu'on vient chercher : savoir qu'une version déplaît sans savoir en
quoi ne fait pas avancer la consigne suivante.

**Le flux n'est pas dessiné**, et la colonne attend qu'il le soit — parce que sa
forme dépend de lui, et se tromper coûte une migration :

- **des motifs fermés** (« hors sujet », « ton faux », « inexact », « fade ») se
  comptent, se comparent entre versions, et se lisent au panneau d'un coup
  d'œil. C'est ce qui sert à régler ;
- **un texte libre** dit ce qu'aucune liste n'avait prévu, et c'est précisément
  ce qu'on veut les premiers mois — mais il ne se compte pas, et personne ne
  relit trois cents phrases.

La réponse est probablement **les deux** : un motif obligatoire, un texte libre
facultatif. C'est la forme qu'a déjà le motif d'administration dans ce dépôt —
`audit_reason` avec son commentaire —, et elle y a fait ses preuves.

À trancher avant d'écrire la colonne.

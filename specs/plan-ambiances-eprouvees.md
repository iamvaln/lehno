# Lehno — une ambiance ne sert que si elle a été éprouvée, secours compris

**Ce qui déclenche ce document** : la garde de publication exige aujourd'hui
**un** essai réussi pour la configuration entière. Avec trois ambiances, deux
partent donc en service sans avoir jamais été essayées. Et il n'existe aucun
secours : une seule configuration est publiée à la fois.

---

## 1. Ce qu'on veut, et pourquoi les deux vont ensemble

**Une combinaison jamais éprouvée ne sert pas.** C'est la règle du §1 du brief,
et elle est déjà là — mal appliquée.

**Chaque ambiance a un principal et un secours, sur deux modèles différents.**
Sans quoi le secours n'en est pas un : c'est une promesse qu'on découvre fausse
le jour où le primaire tombe, sur un contenu déjà facturé.

Les deux règles ne se composent pas d'elles-mêmes : **si le secours doit servir,
il doit avoir été éprouvé lui aussi.** Un secours non essayé est le pire des
deux mondes — on croit être couvert, et on ne l'est que sur le papier.

---

## 2. Ce qui change : l'unité de publication

Aujourd'hui on publie **une configuration**. Demain on publie **une combinaison**.

Une combinaison, c'est :

| | |
|---|---|
| **une ambiance** | avec sa consigne — celle qui donne le ton |
| **un modèle** | celui qui l'exécute |
| **un rang** | principal, ou secours |

Trois ambiances × deux rangs = **six combinaisons en service**, chacune adossée
à son propre essai réussi.

**Ce que le rang garantit** : les deux rangs d'une même ambiance emploient des
**modèles différents**. Deux rangs sur le même modèle ne survivraient pas à une
panne de ce modèle — c'est le même avertissement que `fournisseur_repete` sur le
routage des tâches, sauf qu'ici il doit **refuser**, pas signaler : une ambiance
sans secours réel ne doit pas pouvoir se publier.

---

## 3. Le point dur : ce que le socle emporte avec lui

La consigne commune, les garde-fous, les motifs, les champs du proche retenus
sont **lus par le modèle** — donc ils entrent dans ce qu'une combinaison
éprouve.

**Conséquence, et elle est inconfortable** : changer un garde-fou invalide
**les six combinaisons**. Ce n'est pas une lourdeur qu'on pourrait supprimer,
c'est la vérité — on vient de modifier ce que chaque génération lit, donc plus
rien n'a été essayé dans cet état.

**Le contournement à ne PAS prendre** : publier le socle à part avec son propre
essai unique. Ça coûterait un essai au lieu de six, et ça mentirait — la paire
essayée ne correspondrait plus à ce qui tourne, et la garantie deviendrait un
tampon.

**Ce qui rend le coût tenable**, sans toucher à la règle :

- Le §3 du brief distingue déjà **ce que le modèle lit** de **ce que seule
  l'application lit**. Renommer une ambiance, la réordonner, la désactiver
  n'invalide rien.
- L'Atelier peut enchaîner les six essais d'un geste après un changement de
  socle, plutôt que de les faire relancer un par un.
- Et le nombre est petit **parce qu'on l'a voulu ainsi** : deux à trois
  ambiances, pas douze.

---

## 4. Ce que ça demande au modèle de données

**`StudioConfig` gagne l'ambiance et le rang.** L'unicité passe de « une seule
publiée » à « une seule publiée par (ambiance, rang) ».

**Le socle reste une ligne à part**, publiée seule. Il ne porte plus de modèle :
le modèle appartient à la combinaison.

**L'empreinte d'une combinaison** couvre le socle en service **et** la consigne
d'ambiance **et** le modèle. C'est elle que l'essai atteste, et c'est ce qui fait
qu'un changement de socle invalide tout — par construction, sans qu'aucune règle
n'ait à le dire.

**La garde de publication** cesse de compter « au moins un essai » : elle exige
un essai réussi **sur cette empreinte-là**.

---

## 5. Ce qui reste à décider, et qui n'est pas de moi

**Les trois noms.** La §7 de la spec portrait dit que les trois noms de style de
photo ne sont pas tranchés, et le contrat le note déjà — « un enum les aurait
gelés avant qu'on sache lesquels ». Ils vivent en base, donc rien ne bloque le
serveur ; mais l'écran ne peut pas s'ouvrir sans eux.

**Quel groupe porte les trois.** Les familles d'illustration (nature, animal,
abstrait) sont nommées par la spec ; les styles de photo ne le sont pas. Ce
document suppose que « nos trois » désigne les **styles de photo**.

**Le prix.** Il reste unique quelle que soit la combinaison — un secours coûte
plus cher à produire sans coûter davantage à l'utilisateur. Rien ne change.

---

## Le fil

C'est la même discipline que partout : **rendre le mauvais état impossible à
écrire plutôt que de compter sur la vigilance.** Une combinaison sans essai ne
se publie pas parce que la base la refuse ; un secours sur le même modèle que
son principal non plus. Personne n'a à s'en souvenir.

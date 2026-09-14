# Ce que coûte une opération d'IA

*14 septembre 2026 — état des mesures, et ce qu'on peut en conclure*

## En un mot

**On ne peut pas encore répondre avec des chiffres**, et la raison est nette :
la table des tarifs est vide.

```
ai_model    9 modèles · cost_input = NULL · cost_output = NULL    jamais renseignés
ai_usage    5 exécutions (locales) · cost = NULL sur les cinq     jamais calculé
```

L'instrument est construit — `ai_usage` enregistre le modèle, les jetons entrés
et sortis, la latence, l'origine et le client. Il n'est simplement **pas
étalonné** : sans `cost_input`/`cost_output`, la colonne `cost` reste nulle, et
aucune marge ne se calcule.

**Mais une conclusion tient sans aucun tarif**, et c'est la plus importante :
elle est au §3.

---

## 1. Ce qu'une opération rapporte

Les cinq paliers, tels qu'ils sont en base. **Une opération coûte un crédit** —
les trois, sans distinction (`premium_action.credit_cost = 1`).

**En dollars autant qu'en francs** : les fournisseurs facturent en USD, et une
marge ne se lit que si les deux côtés sont dans la même monnaie.

| crédits | prix XAF | prix USD | XAF/crédit | **USD/crédit** |
|---:|---:|---:|---:|---:|
| 5 | 500 | 0,88 | 100,0 | **0,1768** |
| 10 | 1 000 | 1,77 | 100,0 | **0,1768** |
| 22 | 2 000 | 3,54 | 90,9 | **0,1607** |
| 57 | 5 000 | 8,84 | 87,7 | **0,1551** |
| 120 | 10 000 | 17,68 | 83,3 | **0,1473** |

*Parité fixe 655,957 XAF = 1 € ; 1 € = 1,159763 USD (relevé du 14/09/2026),
soit 1 USD = 565,60 XAF. Le franc CFA étant arrimé à l'euro, seul le second
taux bouge — et il déplace la marge sans que personne ne touche à un prix.*

**Une opération rapporte entre 0,1473 et 0,1768 USD.** Le plancher est le seul
chiffre à retenir pour dimensionner : c'est ce que rapporte l'acheteur le plus
engagé, donc celui qui consomme le plus.

---

## 2. Ce qu'une opération consomme

Les quatre exécutions réussies enregistrées. **n = 1 par nature** : ce sont des
ordres de grandeur, pas des moyennes.

| nature | modèle | jetons entrée | jetons sortie | latence |
|---|---|---|---|---|
| `message` | claude-opus-5 | 775 | 168 | 4,5 s |
| `portrait_brief` | claude-opus-5 | 922 | 294 | 7,0 s |
| `portrait_brief` | claude-sonnet-5 | 922 | 128 | 3,5 s |
| `illustration` | gpt-image-2 | — | — | 18,3 s |

Deux choses s'y lisent déjà :

- **L'entrée est stable et modeste** — 775 à 922 jetons. C'est la fiche du
  proche et ses notes ; elle ne croîtra pas beaucoup.
- **L'image ne compte pas en jetons.** Elle se facture à l'unité, et sa latence
  — 18 secondes, soit quatre fois le brief — dit assez qu'elle n'est pas du même
  ordre.

---

## 2 bis. Ce qu'on a le droit de dépenser

À partir du revenu plancher (0,1473 USD) et des jetons **réellement mesurés**.
Ces seuils se comparent directement aux grilles publiées des fournisseurs.

| opération | jetons | 20 % du revenu | 30 % | 50 % |
|---|---:|---:|---:|---:|
| message — texte seul | 943 | 31,25 $/M | **46,87 $/M** | 78,12 $/M |
| portrait — brief Opus | 1 216 | 24,23 $/M | **36,35 $/M** | 60,58 $/M |
| portrait — brief Sonnet | 1 050 | 28,06 $/M | **42,10 $/M** | 70,16 $/M |

*$/M = dollars par million de jetons, entrée et sortie mélangées.*

**Pour le texte seul, c'est confortable** : aucun modèle de cette gamme
n'approche 46 $ par million.

**En valeur absolue, à 30 % visés : 0,0442 USD — soit 25,0 XAF par opération.**
Et pour le portrait, ce budget doit couvrir **le brief ET l'image** :

```
brief à 0,010 USD  →  il reste 0,0342 USD pour l'image   (19,3 XAF)
brief à 0,035 USD  →  il reste 0,0092 USD pour l'image   ( 5,2 XAF)
```

Une génération d'image descend rarement sous 0,01 USD et monte couramment à
0,04–0,19. **Le portrait à un crédit est donc très probablement sous l'eau au
palier le plus bas.** Et le modèle choisi pour le brief décide de ce qui reste
pour l'image — un arbitrage que personne n'a posé en ces termes.

---

## 3. L'asymétrie, et elle ne dépend d'aucun tarif

**Un « message » est UN appel de texte. Un « portrait » en est DEUX, dont une
image.**

```
wish_message  → message         → 1 appel texte
gift_ideas    → gift_ideas      → 1 appel texte
portrait      → portrait_brief  → 1 appel texte
              + illustration    → 1 appel IMAGE
```

Les trois coûtent **le même crédit**. Le portrait consomme donc, par
construction, le brief *plus* une image — et l'image est le poste le plus cher
de tout le dispositif chez tous les fournisseurs, sans exception connue.

C'est vrai quels que soient les tarifs qu'on inscrira. **C'est le seul résultat
de cette étude qui ne demande aucune mesure supplémentaire**, et c'est celui qui
appelle une décision :

- soit le portrait coûte **plus d'un crédit** ;
- soit son prix est assumé comme produit d'appel, et on le sait ;
- soit l'illustration passe sur un modèle moins cher — `ai_task_route` le permet
  déjà sans livrer de version, puisque la route se change en base.

Le brief lui-même mérite un regard : en repli, `portrait_brief` passe d'Opus à
Sonnet, et la sortie tombe de 294 à 128 jetons pour la même entrée. Le repli ne
coûte pas seulement moins cher — **il produit un texte deux fois plus court**.
Personne n'a décidé ça.

---

## 3 bis. Décidé : le portrait passe à deux crédits

Bornes aux tarifs publics affichés (Opus 15/75, Sonnet 3/15, DeepSeek-R
0,55/2,19, DeepSeek-chat 0,27/1,10, Grok-4.6 3/15 $/M ; images 0,02 et 0,04 $),
sur les jetons mesurés. **Coût max** = trois essais épuisés dans la politique la
plus coûteuse ; **facturé min** = palier 120 crédits. XAF par opération.

| opération | coût min | coût max | facturé | marge min | marge max |
|---|---:|---:|---:|---:|---:|
| Message | 0,4 | 41,1 | 83–100 | **+42,2** | 99,6 |
| Idées cadeaux | 0,3 | 10,9 | 83–100 | **+72,4** | 99,7 |
| Portrait — 1 crédit | 12,0 | 94,8 | 83–100 | **−11,5** | 88,0 |
| **Portrait — 2 crédits** | 12,0 | 94,8 | 167–200 | **+71,8** | 188,0 |

**Le portrait était le seul à passer sous zéro.** Il cumulait deux causes : il
part sur `claude-opus-5` — six fois le premier appel des idées — et il ajoute
une image, le poste le plus cher partout. Les deux se multiplient, pour un
crédit unique, le même qu'un appel de texte seul.

**Deux crédits le mettent hors de portée d'une perte**, quelle que soit la
chaîne, et sans toucher à aucun modèle.

**C'est un changement de DONNÉE, pas de code** — vérifié de bout en bout : le
serveur lit `action.creditCost` pour contrôler le solde, débiter et annoncer ;
le mobile ne l'écrit nulle part en dur. Le commentaire de `listes.tsx` porte la
règle : « rien ne se paie en silence ne vaut que si le montant montré est le
montant prélevé ».

**Un défaut d'ordonnancement trouvé au passage** : sur `gift_ideas`, le
troisième repli — `grok-4.6`, 3,6 XAF — coûte autant que le premier appel et
douze fois le deuxième (`deepseek-chat`, 0,3 XAF). La chaîne n'est pas rangée
par coût croissant : replier peut y coûter plus cher que réussir. Sur `message`
l'ordre est bon (13,7 → 2,7 → 0,4).

---

## 4. Six routes sur dix-neuf ne servent à rien

`ai_task_route` déclare dix-neuf routes. Deux tâches — **six routes** — n'ont
aucun appel dans le code :

| tâche | routes | état |
|---|---|---|
| `note_classification` | haiku-4.5, deepseek-chat, grok-4.6 | **morte** — le classement est heuristique et local (`note-classifier.ts`) |
| `sensitive_detection` | sonnet-5, haiku-4.5, deepseek-chat | **morte** — aucun appel |

Elles ne coûtent rien aujourd'hui. Elles coûtent quand même : quelqu'un qui lit
cette table croit que le classement passe par un modèle, et dimensionne en
conséquence. À retirer, ou à câbler.

---

## 5. Ce qu'il faut pour répondre vraiment

Trois gestes, dans cet ordre.

**a. Renseigner les neuf tarifs.** `cost_input` et `cost_output` sur `ai_model`,
en unité monétaire par million de jetons. C'est une écriture en base, pas une
livraison. Les modèles d'image n'ont pas de tarif au jeton : il leur faut un
prix **à l'unité**, que le schéma ne prévoit pas encore — c'est le seul
changement de code que cette étude réclame.

**b. Calculer `cost` à chaque appel.** La colonne existe et reste nulle. Une
fois les tarifs posés, elle se remplit seule :

```
cost = tokens_in × cost_input / 1e6 + tokens_out × cost_output / 1e6
```

**c. Laisser tourner une semaine.** Quatre exécutions ne font pas une moyenne.
Ce qu'on cherche à connaître n'est pas le coût d'un appel, c'est **sa
dispersion** — une fiche de proche bien remplie coûte-t-elle deux fois une fiche
vide ? `ai_usage` porte déjà `tokens_in`, il suffit de regarder.

Le panneau d'administration pourra alors rendre, par nature :

```
coût médian · coût au 90ᵉ centile · marge au palier le plus bas
```

Le 90ᵉ centile plutôt que la moyenne : ce qui menace une marge n'est pas le cas
courant, c'est la queue.

---

## 6. Ce que cette étude ne dit pas

- **Aucun coût réel**, faute de tarifs en base. Les chiffres consultables chez
  les fournisseurs n'ont pas été recopiés ici : les inscrire de mémoire
  produirait une étude fausse qui aurait l'air juste.
- **Rien sur les échecs.** Une exécution sur cinq a échoué — après 10,5 secondes,
  donc probablement facturée. `ai_usage` enregistre `status`, la question se
  traitera quand les tarifs seront là.
- **Rien sur les essais du studio.** `studio_trial` est vide des deux côtés :
  la mise au point des consignes consomme aussi, et n'est rattachée à aucun
  crédit.

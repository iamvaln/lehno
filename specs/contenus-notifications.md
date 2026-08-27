# Lehno — le contenu de ce que l'application envoie

À écrire et à dessiner : chaque notification, sur ses **deux surfaces** — le courrier et le centre de notifications (§3.13).

Ce document dit **quand ça part, ce que le serveur transmet, et ce que le message doit faire comprendre**. Il ne donne pas la copy définitive : elle s'écrit d'après `ton-et-ecriture-lehno.md`, et les exemples ici sont des intentions, pas des textes arrêtés.

---

## Ce qui contraint l'écriture, et qu'on ne peut pas contourner

**Le serveur n'envoie jamais une phrase.** Il transmet une **clé** et des **paramètres** (`titleKey`, `bodyParams`). Le texte vit dans les traductions du client. C'est ce qui rend l'application bilingue sans que le serveur connaisse la langue de qui la lit — et ce qui évite qu'une phrase figée reste dans la langue d'hier quand quelqu'un change de langue après coup.

**Conséquence directe pour l'écriture : une copy ne peut employer que les paramètres listés ci-dessous.** Si un texte a besoin d'une donnée qui n'y figure pas, il faut le dire — c'est une modification du serveur, pas un détail de rédaction.

**Le courrier, lui, est composé par le serveur** et a donc besoin de tout en clair — y compris le nom du proche. Voir « Ce qui manque » en fin de document.

**Deux surfaces, deux longueurs.** Le centre de notifications tient une ligne de titre et une ligne de corps. Le courrier a de la place, mais il n'en a pas besoin : ces messages annoncent un fait et proposent une action.

**Chaque entrée mène quelque part** (§3.13 : « chaque entrée renvoie directement vers l'écran qui permet d'agir »). La route est donnée pour chacune.

---

## 1. Rappel d'échéance — `event_reminder`

**Quand** : au délai d'anticipation réglé sur l'événement, ou sept jours à défaut. Plusieurs délais donnent plusieurs rappels — J-7 et J-1 sont deux messages, pas un doublon.

**Paramètres** : `days` (le délai), `date` (la date de l'échéance). **Il manque le nom du proche** — voir plus bas.

**Ce que ça doit faire comprendre** : une date approche, voici qui et quand, et on peut préparer maintenant.

**Ton** — §4.4 : on alerte sur des faits, jamais sur l'urgence. *« L'anniversaire de Célarine est dans sept jours. »* Jamais *« Ne manquez pas… »*.

**Mène à** : le détail de l'occasion (§3.21).

---

## 2. Le jour même — `event_day_of`

**Quand** : le matin du jour dit. Toujours — c'est le fait que l'application promet.

**Paramètres** : `date`. Même manque.

**Ce que ça doit faire comprendre** : c'est aujourd'hui, et il y a un geste à faire maintenant.

**Ton** — le seul message de la liste qui peut être chaleureux : c'est un jour heureux. Mais **jamais pour un événement de nature sensible** : l'événement porte sa `nature`, et le ton doit suivre. C'est le cas le plus facile à rater et le plus coûteux — un « Bonne fête ! » sur un anniversaire de décès est impardonnable.

**Mène à** : le détail de l'occasion.

---

## 3. Le carnet dort — `enrichment_nudge_global`

**Quand** : aucune note depuis un mois. Au plus une fois par mois, tant que le silence dure.

**Paramètres** : `silenceDays`.

**Ce que ça doit faire comprendre** : ce qu'on note aujourd'hui sert dans six mois. Et **quelqu'un est peut-être entré dans votre vie sans avoir encore de fiche** — c'est la raison d'être de cette relance, et le texte doit la porter.

**Ton** — §4.6 : dire le bénéfice, pas l'ordre. *« Une idée notée en mars sert en septembre. »* Jamais *« Vous n'avez rien noté depuis un mois »*, qui reproche.

**Mène à** : le carnet.

---

## 4. Une fiche muette dont l'échéance approche — `enrichment_nudge_person`

**Quand** : une échéance dans les trois semaines **et** rien de noté sur ce proche depuis un mois. Une seule fois par échéance.

**Paramètres** : aucun aujourd'hui. **Le nom du proche manque, et ici il est indispensable** — le message n'a aucun sens sans lui.

**Ce que ça doit faire comprendre** : la date approche, et il n'y a pas grand-chose à dire sur cette personne. Deux mots suffisent.

**Ton** — informer sans culpabiliser. La personne n'a rien fait de mal.

**Mène à** : la fiche du proche.

---

## 5 à 7. Les premiers pas — `activation_*`

**Quand** : dans les trois semaines après l'inscription, **deux fois au maximum**, et **seulement tant que le but n'est pas atteint**.

**Elles ne sont pas réglables dans l'application** — la fenêtre se refermerait avant que quiconque n'ouvre les réglages. **Chaque courrier porte donc un lien de désabonnement** qui les coupe toutes d'un clic, sans connexion. **Ce lien est obligatoire, et il faut une page pour l'accueillir.**

**Elles ne passent jamais par le téléphone.** Courrier et centre seulement.

**Paramètre commun** : `envoi` (1 ou 2) — le second peut se formuler autrement que le premier.

| Clé | Le but | Ce que le message doit faire comprendre |
|---|---|---|
| `activation_first_person` | Aucun proche | Sans une première fiche, l'application n'a rien à rappeler. Une seule suffit pour commencer. |
| `activation_first_note` | Aucune note | Ce qui est noté est ce qui servira le jour venu. Une phrase entendue au dîner suffit. |
| `activation_unused_credits` | Aucun crédit dépensé | **Les crédits offerts sont déjà là.** C'est le moment de voir ce que l'application sait faire — sans payer. |

**Deux clés déclarées mais pas encore émises** : `activation_collect_link` (le lien de collecte jamais partagé) et `activation_invite` (personne n'a été invité). À écrire aussi, elles arriveront.

**Ton** — §4.6, strictement. Le bénéfice, jamais l'ordre. Et **la deuxième relance ne doit pas insister** : elle dit autre chose, elle ne répète pas plus fort.

---

## Ce qui existe au modèle et reste à émettre

Ces natures ont leur place dans l'énumération mais rien ne les pose encore. Elles seront à écrire au moment où le serveur les émettra — inutile de les dessiner maintenant, sauf si le lot le permet.

`digest` (le récapitulatif, à la fréquence choisie) · `contribution_received` · `wish_received` · `generation_ready` · `payment_succeeded` · `payment_failed` · `credits_received` · `security` · `account`

Deux d'entre elles méritent d'être pensées tôt, parce qu'elles portent une excuse : **`generation_ready` en cas d'échec** et **`payment_failed`**. §4.5 en donne la forme — *ce qui s'est passé · ce qu'on a fait · ce qu'on peut faire maintenant*, dans cet ordre. Et c'est le seul endroit où « on » est indispensable : une excuse sans sujet n'est pas une excuse.

---

## Ce qui manque, et qui est de mon côté

**Le nom du proche ne voyage pas dans les paramètres.** Trois notifications sur sept en ont besoin — les deux rappels et la relance par personne —, et sans lui elles ne veulent rien dire. Je l'ajoute.

Deux précisions qui vont avec :

- **Dans le centre**, le client pourrait résoudre le nom lui-même depuis `personId`, qui voyage déjà. Mais le faire dépendre d'une lecture locale rendrait la notification illisible hors connexion, alors qu'elle est précisément ce qu'on lit en premier. Le nom voyagera.
- **Dans le courrier**, le nom transite forcément par le service d'envoi. C'est acceptable — c'est la donnée de l'utilisateur, envoyée à l'utilisateur. Ça reste distinct de la règle du plan de mesure, qui interdit les noms dans les **statistiques** : là il s'agit d'un tiers qui n'a rien demandé.

**Il n'y a aucun gabarit de courrier.** L'envoi transmet aujourd'hui la clé brute et les paramètres en JSON — ça marche, ça ne se lit pas. Les gabarits sont exactement ce que ce document doit produire.

**Il faut une page de désabonnement**, atteinte sans connexion depuis le lien d'un courrier d'activation. Un clic, un accusé, rien d'autre.

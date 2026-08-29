# Les motifs d'administration — un code derrière chaque geste

## Le défaut réparé

Les motifs vivaient dans le dictionnaire du back-office. C'étaient donc des
**libellés d'interface, bilingues**, et c'est le libellé qui partait au journal.

Le même geste s'y inscrivait `"Fraude suspectée"` ou `"Suspected fraud"` selon la
langue de l'administrateur au moment du clic. Deux textes pour un motif :
« combien de suspensions pour fraude » n'avait pas de réponse — non parce que la
donnée manquait, mais parce qu'elle existait en deux orthographes qu'aucune
requête ne rapproche.

Un menu déroulant **promet** une nomenclature. Il n'y en avait pas.

---

## La forme retenue

**Deux tables, normalisées.** `audit_reason` porte le code et un libellé par
langue ; `audit_reason_scope` dit à quels gestes il se propose.

Une table plate — une ligne par (geste, motif) — aurait été plus simple à écrire
et **aurait réintroduit le défaut** : le même code aurait fini par porter deux
libellés selon le geste. C'est précisément ce qu'on répare.

### La portée est le GESTE, pas l'action journalisée

Le vocabulaire du journal est plus **grossier** que celui des écrans :
`user_status_update` couvre la suspension *et* le rétablissement. Ranger les
motifs par action proposerait « Compte de test » au moment de suspendre
quelqu'un.

C'est aussi ce qui oblige les appelants à dire ce qu'ils font : un contrôleur qui
suspend et un qui rétablit journalisent la même action, mais déclarent deux
gestes différents.

### Ce qu'on enregistre : le code ET la phrase

`reason` porte ce que l'administrateur a écrit ; `reason_code` porte ce qu'on
peut **compter**. Les deux, et pas l'un ou l'autre — le code sans la phrase perd
la nuance, la phrase sans le code ne s'agrège pas.

---

## Les invariants, et pourquoi ils sont dans le code

**Un code ne se renomme pas.** `modificationMotifSchema` n'a pas de champ `code`.
Le renommer couperait en deux l'historique de tout ce qu'il a justifié : les
gestes d'hier garderaient l'ancien, ceux de demain le nouveau, et aucun comptage
ne les rapprocherait.

**Un motif ne s'efface pas, il se retire.** Aucune route `DELETE`. Le journal ne
porte **aucune clé étrangère** vers le code : l'effacer ne casserait rien, il
rendrait simplement illisibles tous les gestes qu'il a expliqués. Une suppression
qui réussit et détruit du sens en silence est le pire des deux mondes.

**Le code est contraint de forme** — `^[a-z][a-z0-9_]{2,47}$`. Sans cette règle,
quelqu'un collerait « Fraude suspectée » dans le champ du code, et on serait
revenu au point de départ.

**Un code retenu est vérifié contre le geste.** Trois refus, et le troisième est
le seul qui ne se verrait pas autrement : un code réel, actif, mais **emprunté à
un autre geste**. Sans lui, le comptage serait faux sans que rien ne le signale.

---

## La semence

**81 motifs, 86 portées, 25 gestes**, engendrés depuis le `dico.json` du kit
d'administration. Aucun libellé réécrit : ce sont ceux du designer, dans les deux
langues.

**Aucune collision** — un même libellé anglais avait toujours le même français,
ce qui dit quelque chose de la tenue du dictionnaire. Cinq motifs servent
plusieurs gestes : la normalisation gagne sa place dès la semence.

**Huit gestes n'ont aucun préréglage**, seulement une invitation à écrire
(« Pourquoi cette bascule maintenant »). Le designer avait déjà fait la
distinction ; le module la garde. Une liste vide n'est pas une panne.

---

## Les deux langues voyagent ensemble

`GET /admin/reasons?geste=…` rend `{ code, fr, en }`.

Ce n'est pas un défaut de négociation de langue : le back-office bascule depuis
le menu de compte, **sans recharger**. Rendre un seul libellé obligerait à
refaire l'appel à chaque bascule — et à rouvrir une fenêtre de confirmation en
cours de saisie.

*(Le brief de design du 29 août dit « déjà dans la bonne langue ». C'est faux, et
c'est corrigé ici.)*

---

## La règle du câblage, à appliquer geste par geste

- Le geste a des motifs proposés → **le code est exigé** ;
- il n'en a aucun → la phrase seule suffit ;
- `other` est accepté partout : c'est « aucun de ceux-là », et sa phrase reste
  obligatoire.

C'est le serveur qui tranche, à partir de la table — pas le schéma, qui ne peut
pas savoir. Un schéma qui rendrait le code obligatoire partout obligerait les
huit gestes sans liste à envoyer `other` pour rien.

---

## Ce qui reste

Le câblage des gestes qui portent des motifs : la suspension d'un compte,
l'ajustement de solde, la décision sur un paiement, les modèles d'IA, les accès
d'administration, l'effacement. **C'est là que « propre dès le départ » se gagne
ou se perd** — un geste non câblé continue d'écrire une phrase libre, et son
comptage restera muet.

Les gestes des réglages de paiement, eux, n'ont pas de liste : ils restent en
texte libre, et c'est le bon état.

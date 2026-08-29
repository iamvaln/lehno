# Application mobile — ce que les décisions du 29 août y changent

Quatre incidences. Trois touchent le paiement, une la suppression du compte.
L'historisation des configurations et le module de motifs n'y changent rien :
c'est de l'administration de bout en bout.

---

## 1. L'opérateur devient un choix, plus une frappe

**Décision** : une personne n'enregistre **qu'un seul numéro par opérateur**.

Le champ qui porte l'opérateur est aujourd'hui du **texte libre et facultatif**.
Il ne peut pas le rester : c'est lui qui devient la clé de la règle, et deux
personnes tapant *« MTN »* et *« MTN MoMo »* enregistreraient deux méthodes pour
le même opérateur. La règle ne mordrait jamais.

**À l'écran** : le champ de saisie devient une **liste de choix**, alimentée par
les canaux que le serveur sert déjà pour le pays de la personne. Rien à inventer.

---

## 2. Un refus neuf, et une phrase que l'écran doit à la personne

Enregistrer un second numéro chez le même opérateur échouera.

Or l'intention derrière ce geste est presque toujours **« je change de
numéro »**, pas « j'en ajoute un ». Refuser sèchement obligerait à supprimer puis
ré-enregistrer sans dire pourquoi. **Il faut proposer le remplacement.**

**Mais le remplacement n'est pas neutre.** La méthode repart à zéro : le **délai
de deux semaines** avant qu'elle puisse recevoir un remboursement **recommence**.
C'est voulu — hériter de l'ancienneté d'un numéro qu'on vient de changer viderait
la garde anti-fraude de son sens.

**L'écran doit l'annoncer avant le remplacement**, pas le laisser découvrir
après. C'est la seule chose que cette décision coûte à l'utilisateur, et elle se
dit en une phrase.

---

## 3. Le canal doit dire par où il passe

Le canal rend sa nature, son opérateur, son pays, son libellé et qui porte les
frais — **mais pas la voie**.

Dès que les canaux se dédoublent en **automatique** et **manuel** — en cours,
parce que le même opérateur n'a pas le même barème selon la voie —, la liste de
recharge montrera deux *« MTN Cameroun »* d'apparence identique menant à deux
parcours entièrement différents :

| Voie | Ce que la personne fait |
|---|---|
| Automatique | elle paie dans l'application, et c'est fini |
| Manuelle | elle verse depuis son téléphone, **puis revient déclarer** |

Deux promesses, pas deux lignes jumelles. **Au lancement, seule la voie manuelle
existe** — c'est donc ce parcours-là qui doit être le plus soigné, pas le
secondaire.

---

## 4. La suppression du compte — un état d'attente, et une question à trancher

**D'abord un fait qui n'est pas du design** : aucune route de suppression n'est
encore servie. Le parcours en trois temps attend une fusion.

Quand il arrivera, le remboursement des crédits achetés devient une **demande en
attente**, versée à la main — il n'y a pas de paiement automatique au lancement.
L'écran doit donc porter un état qu'il n'a pas : *« remboursement demandé, il
sera versé sur le numéro X »*.

**Et une question que personne n'a tranchée** :

> Que se passe-t-il si le délai de grâce expire **avant** que le remboursement
> ne soit versé ?

Les conditions promettent le remboursement ; l'effacement supprime le compte. Les
deux ne peuvent pas gagner.

- **L'effacement attend le versement** — le compte reste en sursis tant que
  l'argent n'est pas parti.
- **Le versement survit à l'effacement** — la demande reste due à quelqu'un qui
  n'a plus de compte.

Ma préférence va à la première : elle se raconte (*« votre compte sera supprimé
dès le remboursement versé »*), là où la seconde crée une créance sans titulaire.
Mais c'est une décision de produit, et l'écran en dépend.

---

## Ce qui ne change pas, et le seul contrôle à faire

**Le coût d'une action payante est déjà servi par le serveur** — le message, les
idées de cadeau, le portrait ont chacun leur prix, réglable en administration
sans livraison.

Rien à ajuster, à une condition : **que l'application ne le recopie nulle part.**
Un prix figé dans le client afficherait l'ancien tarif sur tout un parc jusqu'à
la mise à jour suivante. Même règle pour l'éligibilité au remboursement d'une
méthode : le serveur rend son verdict, le client ne le recalcule pas.

C'est le seul point à vérifier de ce côté, et il se vérifie en cherchant un
nombre écrit en dur.

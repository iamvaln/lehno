# L'effacement attend le versement

**Décision du 29 août.** Un compte dont un remboursement est en attente **n'est
pas effacé** tant que l'argent n'est pas parti. Il reste en sursis.

---

## Ce qu'elle écarte, et pourquoi

Le kit de back-office disait l'inverse — *« le remboursement se verse après
l'effacement »* — et ce n'était pas servable : `effacement.service.ts` fait
`paymentMethod.deleteMany`, donc après lui **il n'existe plus aucune coordonnée
où verser**, et personne ne peut en ajouter puisque le compte est vidé. La file
des remboursements aurait attendu pour toujours.

L'autre issue possible était de **garder le numéro** de la méthode visée. Elle a
été écartée : elle fait survivre à l'effacement la donnée que §9.11 désigne
comme la plus à protéger, pour un montant qui est souvent de quelques centaines
de francs.

Attendre le versement ne garde rien de plus que ce que le compte porte déjà, et
se raconte à l'utilisateur en une phrase : *« votre compte sera supprimé dès le
remboursement versé »*.

---

## Le risque qu'elle crée, et qui doit être tenu

**Un compte peut rester en sursis indéfiniment si personne ne verse.**

Ce n'est pas théorique : le versement est un geste manuel, il n'y a pas de
paiement automatique au lancement, et rien ne rappelle qu'une demande dort. Un
compte qui attend son remboursement depuis trois mois est un engagement non
tenu — et l'utilisateur, lui, croit avoir supprimé son compte.

Trois choses le tiennent, et aucune n'est facultative :

1. **L'écran des suppressions doit distinguer cet état.** « En attente de
   remboursement » n'est pas « délai de grâce en cours » : le premier attend un
   geste de NOTRE part, le second attend une date.
2. **Le tableau de bord doit compter les remboursements dus**, et le plus ancien.
   Une file qu'on ne voit pas est une file qui ne se draine pas.
3. **Une alerte au-delà d'un seuil.** Un remboursement qui dort depuis plus de
   quelques jours est un incident, pas un encours.

---

## Ce que ça change au serveur

`effacement.service.executer()` choisit aujourd'hui les comptes sur deux portes :
`status = 'deleted'`, ou `pending_deletion` avec un délai échu. Il lui faut une
**exclusion** : aucun paiement `direction = refund` et `status = pending` sur ce
compte.

L'exclusion vaut pour les DEUX portes, y compris l'effacement immédiat par
l'administration : un administrateur qui force l'effacement ne doit pas pouvoir
faire disparaître la coordonnée d'une dette par inadvertance. S'il veut vraiment
effacer, il règle le remboursement d'abord — et ce n'est pas une contrainte, c'est
l'ordre des choses.

**Rien de tout cela n'est encore écrit** : la chaîne du remboursement n'existe
pas, et aucune route utilisateur ne crée de demande. Cette décision fixe la
règle avant que le code ne la devine.

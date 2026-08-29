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

## Le versement a deux voies, choisies au moment de régler

L'administration ouvre la demande, et l'écran de confirmation montre **le montant
à verser et le numéro** qui le recevra. Puis elle choisit :

**Manuelle** — on paie depuis son téléphone, on enregistre la transaction au
niveau des paiements, on confirme avec la référence de l'opérateur. C'est le
miroir exact de ce que `admin/payments.controller.saisir` fait déjà pour l'argent
qui ENTRE, en sens inverse.

**Automatique** — le versement part chez le fournisseur. Quand le flux aboutit,
il met à jour l'état de la suppression **et** un courrier part au titulaire, avec
le détail de la suppression et du paiement qui l'a accompagnée.

### Ce que le serveur a, et ce qu'il n'a pas

**Rien pour la voie automatique.** `topup.provider` est un drapeau sans
implémentation, et le `providerRef` de la recharge est une référence que le
CLIENT déclare — aucune intégration fournisseur n'existe, ni en entrée ni en
sortie. La voie automatique est à écrire entièrement.

**La voie manuelle, elle, a son modèle** : `Payment` porte `direction: refund` et
`mode: manual`, et l'unicité partielle sur `credit_transaction.payment_id`
réserve depuis le début la place d'une reprise de crédits rattachée au même
paiement.

### L'ordre des trois gestes n'est pas indifférent

Le courrier part **avant** l'effacement, forcément : l'adresse est effacée avec
le compte. La séquence est donc versement abouti → courrier → effacement, et
elle doit être tenue explicitement. L'ordonnanceur d'effacement tourne de son
côté ; s'il passait entre le versement et l'envoi, le courrier n'aurait plus de
destinataire et le titulaire n'apprendrait jamais que son remboursement est
parti.

---

## Le risque qui subsiste

**Un compte peut rester en sursis si le versement n'aboutit pas.** La voie
automatique réduit le risque, elle ne l'annule pas : un numéro fermé, un
fournisseur en panne, un versement rejeté laissent la demande en attente.

Deux choses le tiennent :

1. **L'écran des suppressions distingue cet état.** « En attente de
   remboursement » n'est pas « délai de grâce en cours » : le premier attend un
   geste ou un flux, le second attend une date.
2. **Une alerte au-delà d'un seuil.** Un remboursement qui dort depuis plusieurs
   jours est un incident, pas un encours.

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

Le versement manuel s'écrit en miroir de la saisie d'un paiement entrant : mêmes
gardes, sens inverse. La voie automatique demande d'abord une intégration
fournisseur, qui n'existe pas — c'est le vrai coût de ce lot, et il est distinct
du reste.

**Rien de tout cela n'est encore écrit** : la chaîne du remboursement n'existe
pas, et aucune route utilisateur ne crée de demande. Cette décision fixe la
règle avant que le code ne la devine.

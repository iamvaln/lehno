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

**La voie automatique attend son intégration, et c'est une DÉCISION, pas un
manque.** Le registre des drapeaux le dit : *« Éteint, on encaisse par versement
manuel pendant que l'intégration opérateur attend »*. `topup.provider` ne dépend
de rien, précisément pour que le manuel tienne sans lui — « lancer en manuel
seul » est le profil retenu.

Elle est donc hors de ce lot. Il n'y a rien à rattraper, seulement une phase à
venir.

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

**Un compte reste en sursis tant que le versement n'a pas abouti**, et c'est le
comportement voulu. Ce qu'il faut, c'est qu'on le VOIE.

Les deux listes existent déjà — les demandes de suppression et les paiements —
et le blocage anti-fraude a son verdict rendu par le serveur. Il manque une
chose, et une seule : **l'écran des suppressions doit distinguer « en attente de
remboursement » de « délai de grâce en cours »**. Le premier attend un geste de
notre part, le second attend une date. Les confondre ferait passer pour patient
ce qui est en retard.

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
gardes, sens inverse. C'est tout le lot — la voie automatique viendra avec
l'intégration opérateur, quand elle viendra.

**Rien de tout cela n'est encore écrit** : la chaîne du remboursement n'existe
pas, et aucune route utilisateur ne crée de demande. Cette décision fixe la
règle avant que le code ne la devine.

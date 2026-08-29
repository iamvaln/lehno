# Lehno — savoir quelle configuration était en vigueur, et quand

Deux besoins arrivent ensemble, et le second est le plus lourd :

1. **Les canaux de paiement** — l'administration décide quels moyens sont
   proposés dans quel pays, voies manuelles comprises ; l'utilisateur enregistre
   **un numéro par méthode**.
2. **L'historisation** — toute configuration réglée en administration porte une
   période de validité, son auteur et sa raison ; et **les opérations pointent
   la version qui les a gouvernées**.

---

## Ce qui existe déjà, et ce qui manque vraiment

`AuditLog` enregistre **qui a changé quoi, quand, et pourquoi** — `actorId`,
`action`, `reason`, `targetType`, `targetId`, un `metadata` qui porte l'avant et
l'après. Ce n'est pas rien, et il ne faut pas le refaire.

Mais il répond à *« qu'est-ce qui a changé ? »*, pas à *« qu'est-ce qui était en
vigueur le 12 mars ? »*. Pour cette seconde question il faut **rejouer toutes
les entrées depuis l'origine** — et espérer qu'aucune ne manque, ce qu'aucun
journal alimenté par l'application ne peut garantir. Une **période de validité**
y répond par une seule ligne.

Les deux coexistent : le journal raconte l'intention, l'historique établit
l'état. Le journal est chronologique et couvre tout ; l'historique est
interrogeable par date et ne couvre que la configuration.

**Il y a déjà un précédent dans le dépôt, et il reste.** `Payment` recopie
`feeAmount` et `expectedAmount` au moment de l'aperçu, avec ce commentaire :
*« changer un taux ne doit pas fausser rétroactivement la comptabilité »*. La
recopie et le lien vers la version **ne font pas double emploi** :

- la **recopie** est le chiffre annoncé au client. Il vaut même si la lecture du
  barème avait un défaut ce jour-là — c'est ce qu'on lui a dit, et c'est ce qui
  l'engage ;
- le **lien** donne le reste de la configuration : qui l'avait posée, pour
  quelle raison, quels autres champs l'accompagnaient.

Sans la recopie, expliquer un paiement dépend d'une jointure. Sans le lien, on
voit trois nombres et rien autour.

---

## La décision qui porte tout le reste : l'historique vient de la base

Un historique alimenté par l'application est **contourné par tout ce qui n'est
pas l'application** : une graine, une migration, un `updateMany`, une session
`psql` un soir de panne. Et un historique contourné ne se contente pas d'être
incomplet — **il ment**. Il affirme qu'une configuration était en vigueur alors
qu'une autre l'était. C'est pire que de ne pas en avoir : on cesse de vérifier.

Donc **un déclencheur en base**, sur chaque table de configuration. Il ferme la
ligne ouverte et en insère une nouvelle, à chaque `INSERT`, `UPDATE` et
`DELETE`. Aucun chemin d'écriture ne lui échappe, y compris ceux qu'on n'a pas
écrits.

### L'auteur et la raison viennent de la transaction

Le déclencheur ne peut pas deviner qui écrit. L'application le lui dit, dans la
transaction :

```sql
SET LOCAL app.actor_id = '…';
SET LOCAL app.reason   = 'baisse du taux MTN au 1er septembre';
```

Et **le déclencheur refuse quand la raison manque**. C'est ce qui rend
« raison du changement » obligatoire au lieu de facultatif : ce n'est pas une
colonne qu'on remplit si on y pense, c'est une condition pour écrire.

Les migrations et les graines posent explicitement `app.reason = 'migration'`.
L'échappatoire est nommée, donc visible dans une revue.

### Une seule ligne ouverte, garantie par un index

```sql
CREATE UNIQUE INDEX … ON payment_channel_history (payment_channel_id)
  WHERE valid_to IS NULL;
```

Deux administrateurs qui modifient le même canal en même temps produiraient sans
cela deux lignes ouvertes — et « quelle configuration était en vigueur »
deviendrait indéterminé exactement là où on l'interroge. La base refuse la
seconde ; l'appel rejoue.

### Un gain qu'on n'attendait pas : effacer un canal cesse d'être un problème

Aujourd'hui `Payment.paymentChannel` est en `onDelete: Restrict` — on ne peut
pas effacer un canal qui a servi, sinon le paiement ne saurait plus d'où venait
son barème. Avec l'historique, **la ligne d'historique survit à l'entité**. Le
paiement garde son explication complète même si le canal disparaît.

---

## La forme, identique pour les sept tables

Pour chaque table `x` réglée en administration, une table `x_history` :

| colonne | rôle |
|---|---|
| `id` | la clé que les opérations citent |
| `x_id` | l'entité dont c'est une version |
| *(toutes les colonnes de `x`, dans le même ordre)* | l'état exact |
| `valid_from` / `valid_to` | la période. `valid_to IS NULL` = en vigueur |
| `changed_by` | l'administrateur, depuis `app.actor_id` |
| `reason` | depuis `app.reason`, jamais vide |

**Une seule fonction de déclencheur** sert les sept, par `format()` sur le nom
de table. Elle exige que l'ordre des colonnes de `x_history` reflète celui de
`x` — et c'est délibéré : **une colonne ajoutée à `x` sans l'être à
`x_history` fait échouer la première écriture**, bruyamment, au lieu de laisser
l'historique dériver en silence. Une divergence qu'on découvre à l'écriture
coûte dix minutes ; la même découverte deux ans plus tard coûte le litige.

### Les sept tables

`payment_channel` · `collection_account` · `credit_bundle` ·
`system_parameter` · `premium_action` · `ai_model` · `feature_flag`

`system_parameter` est celle qui compte le plus, et c'est la moins visible :
c'est elle qui porte `signup_free_credits`. Sans historique, « combien
offrait-on à l'inscription en mars ? » n'a pas de réponse.

### Ce que les opérations citent

- `payment` → `payment_channel_history_id`, `collection_account_history_id`,
  `credit_bundle_history_id`
- `credit_transaction` → `system_parameter_history_id` pour les octrois
  (inscription, parrainage, cadeau d'attente) et `credit_bundle_history_id` pour
  les achats

L'`id` de l'entité reste **en plus**, jamais remplacé : c'est lui qui répond à
« quel canal », l'autre répond à « dans quel réglage ».

---

## Les canaux de paiement, côté administration

### `mode` manque à `PaymentChannel`

La table porte `(operator, country, kind)` en clé unique. Or **le même opérateur
dans le même pays n'a pas le même barème selon la voie** : MTN par l'interface
du fournisseur prélève un pourcentage ; MTN par virement manuel n'en prélève
aucun. La clé actuelle **interdit d'exprimer les deux**.

`PaymentChannel` gagne donc `mode` (`provider` | `semi_manual` | `manual`), et
la clé devient `(operator, country, kind, mode)`. C'est ce qui permet à
l'administration de régler « les valeurs en paiement manuel » — elles ont
aujourd'hui une place qui les écraserait.

### `country` manque à `CollectionAccount`

L'administration répond à « quels moyens dans quel pays » à moitié : le canal
dit que MTN est disponible au Cameroun, mais le compte qui **reçoit** l'argent
ne dit pas quel pays il sert. Sur une voie manuelle, on afficherait au client un
compte d'un autre pays — un numéro qu'il ne peut pas créditer.

---

## Le numéro de l'utilisateur : un par méthode

`PaymentMethod` porte `kind` (`mobile_money` | `card`) et `msisdn`, mais **pas
l'opérateur** — seulement un `brand` libre. Or « une méthode » du point de vue
de qui l'emploie, c'est *MTN Money*, pas *mobile money* : « un seul numéro de
carte bancaire par personne » n'aurait aucun sens.

Donc `PaymentMethod` gagne `operator`, aligné sur `PaymentChannel.operator`, et
la contrainte :

```sql
CREATE UNIQUE INDEX … ON payment_method (user_id, operator)
  WHERE operator IS NOT NULL;
```

**Conséquence à noter** : le plafond de dix méthodes posé dans le service
devient décoratif — avec trois opérateurs, la contrainte mord bien avant. Il
reste comme garde-fou si un opérateur s'ajoute, mais ce n'est plus lui qui
borne.

---

## L'ordre, et ce qui bloque quoi

1. **La fonction de déclencheur et `payment_channel_history`** — un seul cas,
   éprouvé de bout en bout : le refus sans raison, la ligne fermée, la ligne
   ouverte unique.
2. **Les six autres tables** — mécanique une fois la première juste.
3. **`mode` sur le canal, `country` sur le compte de collecte** — migration à
   la main : la clé unique se remplace, elle ne s'ajoute pas.
4. **`operator` sur la méthode**, et l'unicité. Les lignes existantes ont
   `operator` nul et échappent à l'index partiel — c'est voulu, on ne peut pas
   deviner l'opérateur d'un numéro déjà enregistré.
5. **Les liens sur `payment` et `credit_transaction`**, et le passage de
   `Restrict` à `SetNull` sur le canal.

**Rien de tout ceci ne remplit l'historique du passé.** Les configurations
d'aujourd'hui entrent avec `valid_from` = date de la migration et
`reason = 'migration'`. Ce qui les précède est perdu, et le prétendre serait
exactement le mensonge que ce chantier existe pour empêcher.

---

## Le remboursement : rien à concevoir, tout à câbler

J'ai écrit que « personne ne paie le remboursement » comme s'il manquait une
décision. Il ne manque que du code : la chaîne est spécifiée en entier, et le
modèle la porte déjà.

**Un remboursement est un paiement manuel en sens inverse.** `Payment` a
`direction: refund` et `mode: manual`. Le geste de l'administrateur est celui
qu'il connaît — il verse par mobile money, puis il constate. C'est
`payments.controller.ts` en miroir, pas une mécanique nouvelle.

### Ce qui existe et n'attend que d'être appelé

- `PaymentDirection.refund` — **jamais écrit nulle part aujourd'hui.**
- L'unicité partielle sur `credit_transaction.payment_id` porte **là où `type`
  vaut `purchase`**, et le dictionnaire dit pourquoi : pour qu'un remboursement
  puisse citer **le même paiement** que l'achat qu'il annule. La place est
  gardée depuis le début.
- La reprise des crédits est une transaction de type `adjustment` qui **désigne
  l'achat** — sans quoi *« une ligne de −20 crédits ne se rattache à rien […] et
  un litige se règlerait à l'estime »*.

### Ce qui manque

1. **Rien ne crée la demande.** `effacement.service.ts` ne regarde pas le solde.
   La suppression avec un solde acheté doit poser un `Payment`
   `direction=refund, mode=manual, status=pending` — visible dans le panneau, au
   même endroit que les versements manuels à constater.
2. **Aucun geste ne la fait aboutir** : un `décider` en miroir, réservé au rôle
   `admin` et non `support` — le dictionnaire range explicitement les
   remboursements avec les paramètres globaux.
3. **Le montant remboursable n'est calculé nulle part.** Les crédits offerts ne
   se remboursent pas, et le registre porte la `source` de chaque ligne. La
   règle qui se tient sans suivi de lots : **le minimum entre le solde actuel et
   la somme des crédits acquis par achat**. Qui a acheté 100, reçu 20 et
   consommé 90 ne détient plus 100 crédits achetés ; qui a acheté 100, reçu 20
   et rien consommé n'en détient pas 120.

### Un défaut dans ce que je viens de livrer

`methodes.service.ts` porte `DELAI_AVANT_REMBOURSEMENT_MS = 14 jours` **en dur**.
Le dictionnaire est formel : *« Le délai est porté par un `SystemParameter`
(`refund_method_min_age_days`), réglable par l'`Admin` »*. Une constante
compilée n'est pas réglable — et c'est précisément une configuration
d'administration, donc l'une de celles que ce chantier doit historiser. À
corriger dans le même lot.

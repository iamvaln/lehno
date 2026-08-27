# Lehno — la recharge : le seul chemin d'argent qui manque

**Le constat** : les crédits s'affichent, les paliers existent en base, les canaux
et les comptes de collecte aussi, `topup.manual` est allumé — et **aucune route
ne permet de payer**. Six tables de paiement pour un seul chemin servi,
`/me/credits`, qui ne fait que lire un solde.

C'est le seul blocage de lancement. Tout le reste peut manquer d'une version à
l'autre.

---

## Ce qu'on livre, et ce qu'on ne livre pas

**Le semi-manuel seul.** `topup.provider` est éteint au lancement : il n'y a pas
d'intégration de prestataire, donc pas de paiement automatique. Le client choisit
un palier, voit sur quel compte verser et combien, verse depuis son application
d'opérateur, puis déclare son versement.

**Sans dépôt de fichier**, et c'est une décision, pas un oubli. `proof_key` est
« une référence sur le stockage » — or **il n'existe aucun stockage de fichiers
dans l'API**. Le construire est un chantier à part (il servira aussi aux photos
du portrait et aux avatars).

La spec tranche elle-même : *« le reçu ne prouve rien — un montage est facile :
c'est la réception sur le compte de l'opérateur qui fait foi »*. Le contrôle
réel est ailleurs, et il existe déjà : l'administrateur constate le montant reçu
sur le compte. Le reçu n'est qu'un confort de rapprochement.

Ce qui le remplace : **le numéro depuis lequel le client a versé**
(`payer_msisdn`), qui existe déjà au modèle. C'est ce qui permet de retrouver la
transaction sur le relevé de l'opérateur — plus utile qu'une capture d'écran.

---

## Les chemins, tels que la §5.6 les nomme

| Chemin | Méthode | Ce qu'il fait |
|---|---|---|
| `/me/credit-bundles` | GET | Les paliers actifs, dans leur ordre, avec leur remise |
| `/me/payment-channels` | GET | Les canaux actifs et leur barème |
| `/me/collection-accounts` | GET | Les comptes sur lesquels verser — **visibles ET actifs** |
| `/me/payments/preview` | POST | Les frais, le total à verser, le montant attendu |
| `/me/payments` | POST | Déclarer un versement ; le paiement naît `pending` |
| `/me/payments` | GET | L'historique, du plus récent au plus ancien |
| `/me/payments/{id}` | GET | Suivre une opération, puis son issue |

Tous gouvernés par `topup.manual`, donc **`404` quand il est éteint** — jamais
`403`, qui confirmerait que la fonctionnalité existe.

---

## Les cinq pièges

### 1. Les frais se figent à la création, jamais ne se relisent

`fee_amount` et `expected_amount` sont **écrits sur le paiement**. Un barème
change ; un paiement passé garde ce qui lui a été annoncé.

Relire le taux du jour pour expliquer un paiement d'il y a trois mois donnerait
un chiffre faux **sans que personne s'en aperçoive** — et c'est en litige qu'on
va le lire.

### 2. Qui supporte les frais décide du sens du calcul

Sur le mobile money, **le client paie les frais** : un palier à 1 000 fait verser
1 020, et il en arrive 1 000. Le montant attendu sur le compte est donc le prix
du palier, et **tout manque constaté est un vrai écart**.

La carte se comportera à l'inverse — le prestataire prélève sa part sur ce qu'il
reverse. D'où `fee_borne_by` sur le canal plutôt qu'une règle écrite en dur.

Se tromper de sens fait rejeter des paiements corrects, ou en accepter
d'incomplets.

### 3. L'aperçu et la création doivent calculer pareil

Deux calculs séparés divergeraient un jour, et le client verrait un montant à
l'aperçu et un autre sur sa demande. **Une seule fonction**, appelée par les
deux.

Le plancher et le plafond de frais s'appliquent après la part proportionnelle et
la part fixe, dans cet ordre.

### 4. Un compte invisible n'est pas un compte inactif

`is_visible_in_app` décide de ce que le client voit ; `is_active` de ce qui reste
employable. Un compte peut être actif pour l'administration et absent de
l'application.

**Le client ne voit que l'intersection**, et **la création refuse un compte hors
de cette intersection** — sinon un client qui garde son écran ouvert verserait
sur un compte qu'on vient de retirer.

### 5. Rien n'est cru sur parole

Le montant, les crédits et la devise viennent **du palier lu en base**, jamais du
corps de la requête. Le client envoie l'identifiant d'un palier ; le serveur
compose le reste.

Un palier retiré rend `422 resource_inactive` — la requête est bien formée,
c'est l'offre qui ne l'est plus.

---

## Ce qui n'est pas dans ce lot

- **Le dépôt d'un fichier** — attend un stockage, qui servira aussi aux photos
  du portrait et aux avatars. La référence de transaction le remplace, et elle
  fait mieux : elle empêche le doublon.
- **Le paiement automatique** — attend une intégration de prestataire.
- **`/me/payment-methods`** — sert le canal automatique ; sans lui, rien à
  enregistrer.
- **`/me/promo-codes`** — un chemin d'argent, mais pas celui qui bloque.

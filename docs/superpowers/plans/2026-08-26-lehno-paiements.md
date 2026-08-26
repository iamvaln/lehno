# Lehno — les paiements, du socle à l'administration

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE : employer superpowers:subagent-driven-development ou superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes emploient des cases à cocher (`- [ ]`).

**But :** poser le socle de données du paiement, puis les deux voies manuelles et leur administration — celles qui font entrer de l'argent tant qu'aucun prestataire n'est intégré.

**Architecture :** un seul registre. Les voies manuelles sont des `Payment` ordinaires, distinguées par leur `mode` — pas une entité à part. Une table parallèle obligerait à tenir deux historiques et deux chemins d'octroi, et une recharge manuelle n'apparaîtrait pas dans l'historique du client (dictionnaire, `ManualTopUp` — retirée).

**Pile :** NestJS 11, Prisma 6, PostgreSQL, Zod, Vitest + Testcontainers.

**Spécification :** `spec-technique-lehno.md` §5.6 et §9.14 · `ux-admin-lehno.md` §5.4 · dictionnaire : `Payment`, `PaymentStatusHistory`, `PaymentMethod`, `PaymentChannel`, `CollectionAccount`, `CreditBundle`, `CreditTransaction`.

---

## Périmètre

**Ce plan couvre** le socle de données, les points d'entrée d'administration, et les écrans du §5.4.

**Ce plan ne couvre pas** les chemins `/me/*` — paliers, aperçu, comptes de collecte, création d'un achat côté client. Ils appartiennent à la voie mobile, tenue par une autre session. Le socle qu'on pose ici est ce dont elle a besoin ; les deux se rejoignent sur le contrat publié, pas sur le code.

**Ce plan ne couvre pas non plus** l'intégration d'un prestataire : ni notification, ni interrogation de point d'état. Le `mode = provider` existe au modèle pour que la place soit tenue, sans être servi.

---

## Contraintes globales

- **Un seul registre.** `semi_manual` et `manual` sont des `Payment`. Aucun chemin d'écriture parallèle, aucun second historique.
- **Les crédits sont octroyés une seule fois**, au passage à `succeeded`, quelle que soit la voie qui l'a constaté. L'unicité porte sur `credit_transaction.payment_id`, par index partiel — pas sur une vérification en service, qui perdrait la course à deux appels concurrents.
- **Le reçu ne prouve rien.** L'administrateur vérifie la réception sur le compte de l'opérateur. L'écran doit porter ce rappel, et le fichier s'efface une fois la demande traitée.
- **Trois montants distincts, jamais confondus.** `amount` est le prix du palier ; `expected_amount` ce qu'on attend sur le compte, frais appliqués ; `received_amount` ce qui est arrivé. Sans le deuxième on ne sait pas si un écart vient du client ou du barème ; sans le troisième on ne sait pas qu'il y a écart.
- **Les frais sont figés sur le paiement.** Un barème change ; un paiement passé garde ce qui lui a été annoncé. Lire le taux du jour pour expliquer un paiement d'il y a trois mois donnerait un chiffre faux sans que personne s'en aperçoive.
- **Rien ne se supprime.** Canaux et comptes de collecte se désactivent : un paiement passé les référence, et les effacer le rendrait inexplicable.
- **Motif obligatoire** sur toute décision d'administration, et chaque passage d'état ouvre une ligne d'historique avec son origine et son auteur.
- **Une seule ligne d'historique ouverte par paiement** : `ended_at` nul ne concerne que l'état courant, et son `status` est toujours celui du `Payment`.
- **404, pas 403** sur la ressource d'autrui. **Le support lit, il ne tranche pas** : confirmer un paiement appartient au rôle `admin` (ux-admin §6).
- **TDD** : le test s'écrit d'abord, on le voit échouer, puis on le fait passer. Commit à chaque tâche, et les assertions qui portent une garantie sont éprouvées par mutation.
- Commentaires en français, identifiants et code en anglais. Messages de commit en français à l'impératif.

---

### Tâche 0 : L'adresse, là où elle sert

**Décision.** `LoginActivity` et `DeviceSignup` enregistrent l'adresse. Le dictionnaire la prévoit pour les deux — « conservée pour d'éventuelles investigations » — et aucune spécification ne s'y oppose. Un commentaire du dépôt affirmait le contraire en citant « spec technique §9 » ; cette section porte sur les droits d'accès et ne dit rien de l'adresse. La citation était fausse : on la retire.

**Décision.** `LoginActivity` gagne aussi sa **voie** — `otp`, `google`, `apple`. `ux-admin` §5.13 la demande, et sans elle on ne distingue pas une série d'échecs par code d'une série par fournisseur externe : c'est précisément l'usage que la section annonce.

- [ ] Migration : `login_activity.ip inet`, `login_activity.method login_method`, `device_signup.ip inet`
- [ ] Le service d'authentification les renseigne — un seul point d'écriture
- [ ] Test : une entrée par code note sa voie ; une entrée par fournisseur externe note la sienne
- [ ] Test : l'adresse est enregistrée, et n'est **pas** rendue par `/admin/login-activity` — elle sert aux investigations, pas à l'affichage courant
- [ ] Le commentaire fautif de `lectures.controller.ts` est retiré, et l'écart consigné dans `ecarts-a-reporter`

### Tâche 1 : Le socle de données

**Fichiers :** `prisma/schema.prisma`, une migration.

- [ ] Enums : `payment_mode`, `payment_status`, `payment_direction`, `payment_method_kind`, `fee_bearer`, `status_change_origin`
- [ ] `CreditBundle`, `PaymentChannel`, `CollectionAccount` — les trois tables réglées par l'administration
- [ ] `PaymentMethod`, `Payment`, `PaymentStatusHistory`
- [ ] `CreditTransaction.payment_id`, avec **index unique partiel** sur les valeurs présentes
- [ ] `Payment.provider_ref` : index unique **partiel**, sinon deux paiements en attente entreraient en collision sur une valeur nulle
- [ ] Unicité logique `(operator, country, kind)` sur `PaymentChannel` — un opérateur n'a qu'un barème par pays, deux lignes rendraient l'aperçu indéterminé
- [ ] Test de schéma : les contraintes existent en base, pas seulement dans le fichier Prisma
- [ ] Les cinq paliers de départ sont semés : 500 → 5 · 1 000 → 10 · 2 000 → 22 · 5 000 → 57 · 10 000 → 120

### Tâche 2 : Le calcul des frais, en fonction pure

**Décision.** Le barème vit dans un fichier sans base ni Nest, testable seul. C'est le morceau qui décide de ce qu'un client verse et de ce qu'on attend sur le compte : il changera souvent et doit se relire d'un coup d'œil.

- [ ] `fraisDe(canal, montant)` → `{ frais, aVerser, attenduSurLeCompte }`
- [ ] Test : `payer` — un palier à 1 000 fait verser 1 020, et il en arrive 1 000
- [ ] Test : `payee` — le client est débité de 1 000, le service en reçoit 980
- [ ] Test : plancher et plafond des frais s'appliquent, y compris ensemble
- [ ] Test : part fixe et part proportionnelle se cumulent
- [ ] Test : un canal à taux nul ne fabrique pas de frais

### Tâche 3 : Les trois tables réglées, côté administration

**Chemins :** `/admin/credit-bundles`, `/admin/payment-channels`, `/admin/collection-accounts` — lecture, création, modification. Réservés au rôle `admin`.

- [ ] Test : la modification d'un canal passe au journal d'audit, avec motif
- [ ] Test : un canal ne se supprime pas, il se désactive
- [ ] Test : deux canaux de même `(operator, country, kind)` sont refusés
- [ ] Test : `is_visible_in_app` et `is_active` se règlent séparément — un compte peut servir à l'administration sans paraître aux clients
- [ ] Test : le numéro d'un compte de collecte est rendu en entier à l'administration, qui doit le dicter

### Tâche 4 : La saisie manuelle d'un paiement

**Chemin :** `POST /admin/payments`. L'administrateur saisit tout : le client, le palier, le compte qui a reçu, la référence, le reçu.

- [ ] Test : le paiement naît `pending`, avec `mode = manual`
- [ ] Test : les frais et le montant attendu sont figés à la création, depuis le canal du jour
- [ ] Test : une ligne d'historique s'ouvre, `origin = 'admin'`, avec l'auteur et le motif
- [ ] Test : le support ne peut pas créer de paiement

### Tâche 5 : La décision, et l'octroi des crédits

**Chemin :** `POST /admin/payments/{id}/decision`. Le cœur du chantier.

- [ ] Test : confirmer exige **le montant réellement reçu**, même sans écart — c'est lui qui permet de constater qu'il n'y en a pas
- [ ] Test : confirmer octroie les crédits **une seule fois**, en `CreditTransaction` de type `purchase` portant `payment_id`
- [ ] Test : deux confirmations concurrentes n'octroient qu'une fois — la garantie tient à l'index, pas au service
- [ ] Test : rejeter exige un motif, et n'octroie rien
- [ ] Test : la ligne d'historique précédente se ferme, la nouvelle s'ouvre ; une seule reste ouverte
- [ ] Test : la décision rejoint le journal d'audit
- [ ] Test : un écart entre attendu et reçu ne bloque pas la décision — il se traite, il ne se devine pas
- [ ] Test : le reçu s'efface une fois la demande traitée
- [ ] Test : seul le rôle `admin` décide ; le support lit

### Tâche 6 : Les deux listes du §5.4

**Chemins :** `/admin/payments` et `/admin/credit-transactions`, à curseur, filtrables par état, période, utilisateur et moyen.

- [ ] Test : la fiche d'un paiement rend son historique d'états, chacun **avec sa durée**
- [ ] Test : une méthode de paiement n'est rendue que par ses éléments d'identification — opérateur et derniers chiffres. Le numéro complet ne sort pas, même pour un administrateur
- [ ] Test : les deux listes suivent le contrat publié, au champ près

### Tâche 7 : L'ajustement manuel d'un solde

**Chemin :** `POST /admin/users/{id}/credits`. « Ajuster manuellement le solde d'un utilisateur, avec motif obligatoire » (§5.4).

- [ ] Test : l'ajustement produit une `CreditTransaction` de type `adjustment`, source `admin_adjustment`
- [ ] Test : le motif est obligatoire, et rejoint le journal
- [ ] Test : un ajustement négatif ne peut pas rendre le solde négatif — ce serait une action payante lancée sans provision

### Tâche 8 : Les écrans

- [ ] Les deux listes, leur détail, et l'historique d'états avec ses durées
- [ ] La file des paiements en attente, avec le **rappel que le reçu ne prouve rien**
- [ ] Les trois écrans de réglage : paliers, canaux, comptes de collecte
- [ ] Test : la section entière est absente du menu d'un support pour ce qui relève d'Économie ; il voit les paiements en lecture (ux-admin §6)

---

## Ce que ce plan laisse ouvert

- **Le délai d'attente avant expiration**, et celui avant interrogation du prestataire — à caler sur chaque opérateur (brief backend §9).
- **Le chiffrement au repos des numéros mobile money**, et la rotation de sa clé.
- **Le stockage du reçu** : R2 n'est pas monté. Tant qu'il ne l'est pas, `proof_key` porte une référence qui ne mène nulle part — la tâche 5 efface la référence, le fichier viendra avec le stockage.

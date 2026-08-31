# Lehno — ce que les conditions promettent et que le code ne fait pas

Six engagements sont écrits dans les CGU ou la politique de confidentialité et
**ne sont tenus par rien**. Sans utilisateurs, c'est sans portée. Au lancement,
ce sont des promesses publiques non tenues.

À traiter **avant** l'ouverture, pas après.

> Les §4 à §6 ont été relevés pendant le chantier de la suppression de compte
> (août 2026). **Le §4 est le plus grave des six** : c'est le seul qui porte
> sur une obligation légale opposable, et non seulement contractuelle.

---

## 1. La réacceptation des conditions modifiées

**§14 dit** : *« Toute modification substantielle est notifiée au moins quinze
(15) jours avant son entrée en vigueur et **exige une nouvelle acceptation à la
connexion suivante**. Chaque acceptation est horodatée et conservée. »*

**Ce qui existe** : `User.acceptedTermsAt` et `User.acceptedTermsVersion`, écrits
**une seule fois**, à l'inscription — voir `signup.service.ts`.

**Ce qui manque** : rien ne compare la version acceptée à la version courante.
Aucune réacceptation n'est demandée, à personne, jamais. Le champ existe et ne
sert à rien après l'inscription.

**Ce qu'il faudrait** : la comparaison à la connexion, un moyen de dire au client
qu'une acceptation est due, et l'écriture de la nouvelle version quand il
accepte. Le piège à ne pas manquer : **la version se lit dans l'en-tête du
document**, et `LegalService.version()` échoue bruyamment si l'en-tête change de
forme — c'est voulu, une acceptation dont on ignore le texte ne vaut rien.

---

## 2. Le préavis de quinze jours

**§14** promet un délai de quinze jours entre la notification et l'entrée en
vigueur.

**Ce qui manque** : il n'existe aucun envoi groupé, ni aucune date d'entrée en
vigueur portée par un document. Publier une version nouvelle la rend
immédiatement courante.

**Ce qu'il faudrait** : une date d'effet distincte de la date de publication, et
l'envoi qui part quinze jours avant. Sans la première, le délai ne se vérifie
pas ; sans le second, il ne se respecte pas.

---

## 3. Le courriel avant un changement de tarif

**§6 dit** : *« Un changement de tarif vous est annoncé par courriel **avant**
qu'il ne prenne effet. »*

**Ce qui existe** : `PATCH /admin/credit-bundles/:id` change un palier
immédiatement, avec motif et trace au journal. Rien ne prévient personne.

**Ce qui manque** : l'envoi groupé, et un moyen de le lier au changement. Rien
n'empêche aujourd'hui un administrateur de modifier un prix sans que quiconque
soit prévenu — et l'engagement est public.

**Ce qu'il faudrait, au minimum** : que l'écran d'administration rappelle
l'obligation au moment de la bascule, et que l'envoi existe. Le mieux serait que
le changement **programme** l'annonce plutôt que de compter sur la mémoire de
celui qui clique — c'est la même discipline que partout ailleurs dans ce dépôt :
rendre le mauvais état difficile à écrire plutôt que de compter sur la rigueur.

---

---

## 4. L'effacement au terme du délai de grâce

**La politique de confidentialité §7 dit** : les fiches, notes et souhaits sont
*« effacés à la suppression du compte du propriétaire »*. **La spec technique
§9.11 dit** : *« Suppression réellement effective au terme du délai de grâce,
jusqu'aux fichiers stockés »*. **§15.4** inscrit une tâche quotidienne
« Effacement des comptes » et une « Avis de fin de grâce ».

**Ce qui existe** : le compte entre correctement en `pending_deletion`, avec sa
date de demande (`DELETE /me/account`). Le back-office le voit venir à échéance
(`GET /admin/deletions`), et `PATCH /admin/users/{id}` sait le rétablir.

**Ce qui manque** : **rien n'efface jamais rien.** Il n'existe aucune tâche
planifiée d'effacement — le seul `@Cron` du dépôt est l'ordonnanceur des
occurrences. Et le geste d'administration qui « efface » un compte se contente
de poser `status = 'deleted'` : aucune ligne ne part, aucun fichier R2 non
plus. Un compte supprimé conserve donc indéfiniment ses proches, ses notes, ses
souhaits, ses portraits et son adresse.

C'est le seul écart de ce document qui expose à autre chose qu'un reproche
contractuel : le droit à l'effacement est opposable, et sa promesse est
publiée.

**Ce qu'il faudrait**, et les pièges à ne pas manquer :

- une tâche quotidienne qui traite les comptes dont l'échéance est passée —
  l'échéance se **calcule** depuis `deletionRequestedAt` et le paramètre
  `account_grace_period_days`, elle n'est stockée nulle part, et c'est
  volontaire (voir `admin/deletions.controller.ts`) ;
- l'effacement des **fichiers stockés** en même temps que les lignes, sans
  quoi R2 garde des portraits que plus rien ne référence ;
- **l'anonymisation, et non la suppression**, des traces que §9.11 fait
  survivre : `LoginActivity`, `AuditLog` et surtout **`DeviceSignup`**. Ce
  dernier est le piège : son lien vers le compte se rompt (`on delete set
  null`), mais **la ligne doit rester**. Le plafond de comptes par appareil se
  compte sur `deviceSignup` ; s'il s'efface avec les comptes, il se contourne
  en créant puis en supprimant ;
- l'**avis de fin de grâce** quelques jours avant, que §15.4 prévoit.

---

## 5. Le remboursement du solde acheté

**Les CGU §6 disent** : *« À la suppression de votre compte, le solde des
crédits que vous avez achetés vous est remboursé sur demande, sur l'une de vos
méthodes de paiement enregistrées ; le montant et la destination vous sont
annoncés avant confirmation. »*

**Ce qui existe** — et c'est désormais l'essentiel du chemin :

- les deux conditions protectrices sont **calculées** et opposées à la demande
  (`apps/api/src/payments/remboursement.ts`) : méthode enregistrée depuis plus
  de deux semaines (paramètre `refund_method_min_age_days`) et ayant déjà servi
  à un paiement (`PaymentMethod.firstSuccessfulPaymentAt`, renseigné par la
  décision de paiement en back-office) ;
- la part **achetée** du solde est distinguée des crédits offerts, et le
  montant en argent est calculé au prix que la personne a réellement payé ;
- `DELETE /me/account` enregistre la demande comme un `Payment` sortant
  (`direction = 'refund'`, `status = 'pending'`), visible dans les listes de
  paiements du back-office.

**Ce qui manque** : **personne ne verse rien.** Aucun chemin — ni
administrateur, ni prestataire — ne fait passer un remboursement de `pending` à
`succeeded`. Le back-office sait décider d'un *encaissement* ; il n'a pas
d'écran pour constater un *versement sortant*.

Corollaire volontaire, mais qu'il faut connaître : **les crédits ne sont pas
débités** à la demande. Le débit accompagne l'argent qui part, pas la promesse
qu'il partira — un compte rétabli pendant la grâce doit retrouver son solde. Le
mouvement `CreditTransaction` de source `refund` reste donc à écrire au moment
où le versement est constaté, dans la même transaction que le passage à
`succeeded`.

**Ce qu'il faudrait** : un geste d'administration « remboursement versé », avec
motif et trace au journal comme les autres décisions de paiement, qui écrit les
deux choses ensemble.

---

## 6. L'écran des méthodes de paiement n'existe pas

**La maquette §3.25** décrit un écran « Méthodes de paiement », et **la spec
technique** lui donne `/me/payment-methods`. Le contrat commun déclare déjà
`paymentMethodSchema` avec son champ **`refundEligible`**, en promettant que
« le serveur rend son verdict, le client ne le recalcule pas ».

**Ce qui manque** : le chemin n'existe pas. Aucun contrôleur ne sert
`/me/payment-methods`, en lecture comme en écriture — on ne peut donc
enregistrer ni retirer une méthode depuis l'application.

C'est ce qui rend le §5 largement théorique aujourd'hui : le parcours de
suppression sait proposer les méthodes éligibles, mais il n'y en a aucune tant
qu'aucun écran ne permet d'en enregistrer une.

**Ce qu'il faudrait** : le contrôleur, et le calcul de `refundEligible` — qui
est **déjà écrit** et n'attend qu'à être appelé
(`methodeEligibleAuRemboursement`, dans `payments/remboursement.ts`). Il vit à
part précisément pour ça : deux implémentations de la même clause des CGU
finiraient par diverger, et c'est la clause qui se retrouverait fausse d'un
côté.

---

## Ce qui est déjà tenu, et qu'il ne faut pas casser

| La promesse | Ce qui la tient |
|---|---|
| Les crédits acquis gardent leur valeur | Le solde est un registre de mouvements ; aucun tarif ne le relit |
| Le coût d'une action est annoncé avant | Le prix est lu au lancement, pas après |
| Un achat garde ses conditions | `Payment` **recopie** montant, crédits, frais et attendu à la création |
| L'acceptation est horodatée et conservée | `acceptedTermsAt` et `acceptedTermsVersion`, à l'inscription |
| Les crédits offerts ne se remboursent pas | La part remboursable écarte `signup_grant`, `referral_bonus`, `waitlist_bonus`, `promo_code`, `gift` et `reward` |
| Les deux conditions protègent le remboursement | Ancienneté et premier paiement réussi, opposées à la demande et **revérifiées** à la confirmation |
| La suppression est possible depuis l'application | `DELETE /me/account`, en trois temps, avec pseudo et code à usage unique |
| Un compte en suppression ne peut plus agir | `AuthGuard` lit l'état à chaque requête : le jeton d'accès est autoportant, sa seule signature ne suffisait pas |

Ces huit-là sont vraies dans le code, pas seulement sur le papier. Les six
autres ne le sont pas encore.

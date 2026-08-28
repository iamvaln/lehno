# Lehno — ce que les conditions promettent et que le code ne fait pas

Trois engagements sont écrits dans les CGU et **ne sont tenus par rien**. Sans
utilisateurs, c'est sans portée. Au lancement, ce sont des promesses publiques
non tenues.

À traiter **avant** l'ouverture, pas après.

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

## Ce qui est déjà tenu, et qu'il ne faut pas casser

| La promesse | Ce qui la tient |
|---|---|
| Les crédits acquis gardent leur valeur | Le solde est un registre de mouvements ; aucun tarif ne le relit |
| Le coût d'une action est annoncé avant | Le prix est lu au lancement, pas après |
| Un achat garde ses conditions | `Payment` **recopie** montant, crédits, frais et attendu à la création |
| L'acceptation est horodatée et conservée | `acceptedTermsAt` et `acceptedTermsVersion`, à l'inscription |

Ces quatre-là sont vraies dans le code, pas seulement sur le papier. Les trois
autres ne le sont pas encore.

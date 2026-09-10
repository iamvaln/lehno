# Revue : la planche contre l'application mobile

Comparaison des **33 écrans** du kit mobile (handoff du 27 août, importé dans
`specs/ui_kits/app/`) avec ce que l'application porte réellement.

`StudioScreen` et `SurfacePubliqueScreen` sont exclus : ils appartiennent au
back-office et aux surfaces web publiques, pas à l'application.

## Comment cette revue a été faite

Par les **clés de copie**. Une clé que la planche emploie et que l'application
n'emploie nulle part est un état dessiné qui n'a pas été câblé — c'est un signal
mécanique, vérifiable, et qui ne dépend pas de mon jugement.

Il produit des faux positifs, et ils ont été éprouvés un par un : une clé peut
manquer parce que l'application dit la même chose autrement, mieux, ou parce
qu'elle ne peut pas la dire. Ces cas sont classés en **B** et **C**, pas en
défauts.

## Ce que la couverture dit

| Couverture | Écrans |
|---|---|
| 0–50 % | CadrageIdees (0), Portrait (11), Recharge (28), Collecte (38), MonMur (38), Souhait (38), Listes (42), Occasion (50) |
| 51–75 % | Note (57), Proche (64), Generation (65), Maintenance (66), Comptes (70), Parrainage (70), Notifications (71), Pseudo (75) |
| 76–100 % | Preparation (76), Accueil (80), Code (81), Connexion (81), Bienvenue (85), Reprises (87), Recherche (88), ReglagesHub (88), Evenement (90), Identite (90), Moi (90), Dates (92), Proches (94), AValider (100) |

La coupure est nette et elle ne dit pas ce qu'on croirait : le bas du tableau
n'est pas mal fait, il n'est **pas construit**. Ce sont des écrans dessinés dont
l'application ne porte que la liste ou la coquille.

---

## A. Défauts — la planche tranche, l'application diverge

### A1. Le code de parrainage ne se vérifie jamais à la saisie

`PseudoScreen` montre le champ avec un état de validité. L'application affiche
une aide fixe et ne dit rien de plus : on apprend que le code était mauvais
**après** l'inscription, sur l'écran de bienvenue, quand il est trop tard.

Trois faits qui convergent :

- la planche porte `valide` / `invalid` sur ce champ ;
- `parrainValide` et `parrainInvalide` sont **traduits dans l'application** et
  employés nulle part — de la copie morte ;
- `GET /public/invitations/{code}` existe et sa description dit précisément :
  « Sert aussi à valider un code de parrainage à la saisie, avant de le
  soumettre à `/auth/register` : un code inconnu rend 404. »

Ce n'est donc ni un choix natif ni une limite du contrat : un câblage oublié.
L'écran a déjà une vérification différée pour le pseudo — le parrain suivrait le
même chemin.

### A2. Corrigés en cours de revue

- **Le bouton non pleine largeur se collait à gauche.** `alignSelf: "flex-start"`
  l'emportait sur le centrage du parent, sur TOUS les états vides et sur le
  renvoi du code. Corrigé à la source.
- **Le renvoi du code était collé en bas** par `marginTop: "auto"` ; la planche
  le pose sous « Confirmer ».
- **L'écran de bienvenue avait été centré contre la planche.** Rétabli.

---

## B. Écarts délibérés — l'application dit mieux, ou dit autrement

Aucun n'est à corriger. Ils sont écrits ici pour ne pas être « redécouverts »
comme des défauts à la prochaine revue.

| Clé de la planche | Ce que l'application fait | Pourquoi c'est bon |
|---|---|---|
| `codeErreur`, `connexionErreur` | affiche **le message du serveur** | le serveur sait POURQUOI ; une phrase fixe l'écraserait |
| `bienvenueTexte` | `phraseDeBienvenue(actives, t)` | la phrase énumère ce qui est OUVERT ; fixe, elle promettrait au lancement deux choses sur trois |
| `decompte` | même composant `Countdown`, étiquette calculée ailleurs | différence de nommage, pas de fond |
| `lienOuvreDehors` | ouvre les documents DANS l'application (`legal.tsx`) | l'avertissement n'a plus d'objet |

---

## C. Empêché par le contrat — à signaler, pas à corriger ici

### C1. La photo de profil ne peut pas changer

`updateProfileSchema` ne porte pas `avatarUrl` et aucune route de téléversement
n'existe. `profilPhoto` et `photoMiseAJour` resteront morts tant que ce sera le
cas. L'écran le documente déjà.

### C2. `codeConnu` demanderait de divulguer l'existence d'un compte

La nouvelle planche ajoute un bandeau — « Ce compte existe déjà : le pseudo est
gardé. » — sur l'écran du code.

**`POST /auth/otp` ne rend que `{sent, retryAfterSeconds, expiresAt}`.** Il ne
dit pas si l'adresse est connue, et c'est délibéré : le dire ouvrirait
l'énumération de comptes — n'importe qui pourrait savoir, adresse par adresse,
qui a un compte chez nous.

L'application connaît la réponse seulement APRÈS vérification du code, et elle
s'en sert alors pour aiguiller (session, ou jeton d'inscription).

**C'est une question pour le design, pas un défaut de l'application.** Le
bandeau ne peut pas exister à cet endroit sans lever cette protection.

---

## D. Portée dessinée, non construite

Ce ne sont pas des défauts : ce sont des écrans qui n'ont pas été faits. Ils
sont listés pour que la distinction ne se perde pas — corriger et construire ne
se planifient pas de la même façon.

| Écran | Couverture | Ce qui manque, en substance |
|---|---|---|
| `CadrageIdeesScreen` | 0 % | le cadrage avant génération d'idées : budget, note, lancement |
| `PortraitScreen` | 11 % | tout le portrait : ambiance, voie photo/illustration, signature, approbation, mise au mur |
| `RechargeScreen` | 28 % | le parcours de recharge : récapitulatif, frais, attente, aboutissement, échec |
| `CollecteScreen` | 38 % | partage, aperçu, révocation, réactivation, mot d'accompagnement |
| `MonMurScreen` | 38 % | onglets mots/page, épinglage, adresse publique, états vides |
| `SouhaitScreen` | 38 % | le détail d'un souhait : prix, lien, photo, provenance, privé, candidats |
| `ListesScreen` | 42 % | création d'une liste, clôture, aperçu, recherche |
| `OccasionScreen` | 50 % | souhaits reçus, vœux, relance de préparation |

---

## E. À comparer à l'œil

Le diff de clés ne tranche pas : l'application emploie d'autres noms pour des
choses qui existent. Il faut ouvrir la planche à côté.

- **Rappels** — la planche dit `reglagesActiver/Autres/Comment/J1/Quand/Refus`,
  l'application `reglagesEmail/Heure/Heures/J/Jour/Muet/Push/Recap`
- **Moi** — `moiCreerListe`, `moiPublierMur`
- **ReglagesHub** — `moiDonneesValeur`, `moiLangue`
- **Preparation** — `prepDeja`, `prepRelancer`, `prepVoir`
- **Evenement** — `evtRappelDefaut`, `sensibleForm`
- **Identite** — `champLangueProche`, `ficheSupprimeeFait`
- **Accueil** — `accueilFaireListe`, `cartNoter`, `plusTard`
- **Comptes** — les réservations (`reservLiberer`, `reservOffert`…) et la
  sécurité (`securiteInhabituelle`, `securiteSupprimer`)

C'est possible depuis cette revue : la planche s'ouvre enfin, `components/`
ayant été importé. Il lui faut un serveur local — `file://` refuse les `fetch`
qu'elle fait pour charger les écrans.

---

## F. L'en-tête d'écran — trouvé à l'appareil, 10 septembre 2026

Le diff de clés ne pouvait pas l'attraper : le nom d'un écran ne vit pas dans
`copy.js`, mais dans le registre du prototype (`prototype.html`), où chaque
écran empilé porte `titre: { fr, en }`. Vingt-cinq écrans en ont un.

### Ce qui a été corrigé

**Huit écrans ne disaient pas où l'on était.** On y arrivait par une rangée des
réglages — « Sécurité et connexions », « Mes données », « Rappels et
notifications » — et l'écran s'ouvrait sur une flèche seule, puis directement
sur l'étiquette de son premier bloc, en petites capitales grises.

Vu à l'appareil sur `securite` et sur `reprises` ; les six autres écrivaient le
même en-tête, au caractère près : `profil`, `paiement`, `rappels`, `donnees`,
`aide`, `reservations`.

Ils emploient désormais `ScreenHeader` — flèche et nom sur la même ligne, comme
l'`AppHeader` de la planche —, avec les libellés du registre : « Sécurité »,
« Mon profil », « Paiement », « Rappels », « Mes données », « Aide »,
« Réservations », « En cours ». `entetes.test.ts` les tient.

### Ce qui reste à trancher

**Vingt-cinq écrans dessinent encore leur flèche à la main.** La planche n'a
qu'un `AppHeader`, porté par le châssis ; l'application n'a pas de châssis, et
chaque écran répète six lignes de `Pressable`. Deux conséquences :

- la cible tactile, le recul du bord et l'icône se recopient — c'est le genre de
  détail qu'une réécriture perd sans que rien ne le dise ;
- **la cloche n'existe que sur l'accueil.** La planche la pose sur tous les
  écrans empilés, à droite de l'en-tête. `ScreenHeader` a la fente (`fin`) ;
  personne ne l'emploie encore.

La plupart de ces écrans disent tout de même où l'on est, mais **par un grand
titre de page** — « Pour Awa », « Recharger », « Nouvelle date » — là où la
planche porte les deux : le nom court dans l'en-tête, et le titre de page
dessous quand il y en a un. Ce n'est pas un défaut ; c'est une décision à
prendre une fois pour toutes, écran par écran.

Restent ceux dont je n'ai pas pu établir à la lecture qu'ils portent un titre
nominal : `apercu`, `apercu-liste`, `listes`, `monmur`, `mouvements`,
`souhaits`, `valider`, `note`, `portrait`, `proches/recherche`. **À ouvrir à
l'appareil** avant de conclure — c'est ainsi que les huit précédents ont été
trouvés, et la lecture du code n'y suffisait pas.

---

## G. La wishlist sans occasion — trouvé à l'appareil, 10 septembre 2026

### Un cul-de-sac au premier geste

Un compte neuf n'a **aucune date à lui** : les premières dates qu'on saisit sont
celles de ses proches. « Nouvelle wishlist » s'ouvrait donc sur « L'occasion /
Aucune date à vous pour l'instant. », « Enregistrer » éteint, et rien d'autre —
pas un champ, pas un lien. L'accueil invitait pourtant à « Faire ma wishlist ».

Le contrat, lui, avait bougé (#160) : `occurrenceId` est facultative, `name`
existe, et la maquette porte les deux depuis le début — `listeNouvNom`,
`listeNouvSansOccasion`, `listeNouvSansOccasionAide` étaient **traduits dans
l'application et employés nulle part**. De la copie morte, comme `parrainValide`
au §A1.

Corrigé : le champ du nom, et « Sans occasion » en tête des choix.

### Trois défauts trouvés dans la foulée, sur le même écran

- **Le nom saisi ne s'affichait nulle part.** La carte composait toujours son
  titre depuis l'occasion ; une liste sans occasion s'intitulait « Autre ».
  `nomDeLaListe` préfère désormais `name`, et compose depuis l'occasion quand
  il est nul — ce que le contrat demande explicitement au client.
- **Le clavier cachait le pied**, qui porte les deux seuls gestes de l'écran. Et
  sans `keyboardShouldPersistTaps`, le premier appui hors du champ était mangé
  par le renvoi du clavier : on tapait sur « Sans occasion », rien ne se
  cochait, et il fallait taper deux fois sans comprendre pourquoi.
- **« Chercher des idées » menait à un écran rouge** sur une liste sans
  occasion : le geste ouvre §3.7, qui lit `/me/occurrences/{id}`, et il n'y avait
  pas d'`id` à passer.

### Les états d'erreur sans issue — corrigés partout

L'écran rouge ci-dessus n'avait **aucune flèche de retour** — il n'affichait que
« Cette demande n'est pas valide » et « Réessayer », qui réessaie la même demande
invalide. La seule issue visible était la barre d'onglets, qui fait perdre sa
place.

Le motif était général : **vingt-deux retours anticipés, sur douze écrans**,
rendaient leur panne ou leur chargement sans le moyen de revenir que porte leur
état nominal. Le geste système — balayage iOS, retour Android — marche encore,
donc ce n'était pas un piège ; c'était l'affordance qui disparaît au moment
précis où l'on en a le plus besoin.

La cause est toujours la même, et c'est la racine du §F : **il n'y a pas de
châssis d'écran.** La flèche est écrite dans la branche nominale, et les
branches anticipées sont écrites après, ailleurs, par quelqu'un qui regarde la
panne et pas la navigation.

Le correctif la hisse dans un `const retour` — ou un `const entete` quand
l'écran porte déjà un `ScreenHeader` — rendu dans les trois états. On la rend ou
on ne la rend pas, mais on ne la **réécrit** plus. `retours.test.ts` le vérifie,
et la sonde le montre : rejoué sur les sources d'avant, il nomme les
vingt-deux branches à la bonne ligne.

---

## H. Ce que la recette a trouvé et que le mobile ne peut pas corriger

### La fiche de soi n'existe pas

`Person.isSelf` ne s'écrit nulle part côté serveur — détaillé au §10 du brief
backend. Trois écrans en dépendent et trois écrans mentent doucement :

- **« Nouvelle wishlist »** ne peut pas viser une occasion : la garde du serveur
  exige une occurrence rattachée à une personne `isSelf`. Le §G ci-dessus ouvre
  la liste SANS occasion, ce qui débloque le parcours ; la liste datée reste
  hors d'atteinte.
- **« Ma date d'anniversaire »** sur Mon Mur s'allume et n'expose rien.
- **« Pour qui »**, dans l'ajout d'une date, ne liste que les proches. On ne peut
  donc pas inscrire sa propre date, et l'écran du profil n'a pas de champ de
  naissance — il n'existe que sur la fiche d'un proche.

Rien de tout cela ne se répare depuis le mobile : `POST /me/persons` ne porte
pas `isSelf`.

### Deux écrans sans nom, à trancher

`evenement` (« Nouvelle date » au registre de la planche) et `note`
(« Nouvelle note ») s'ouvrent encore sur une flèche seule. Les deux portent en
revanche un grand titre de page qui dit de quoi il s'agit — `evtTitreAnniv`,
et le champ de la note. C'est le cas « titre de page plutôt que nom d'écran »
du §F : à décider une fois pour toutes, pas à corriger à l'aveugle.

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

# UI kit — l'application Lehno

Les **27 écrans** de `uploads/ux-app-mobile-lehno.md`, dessinés et traversables
depuis leur point de découverte. Deux entrées :

| Fichier | Pour |
|---|---|
| `index.html` | **La planche de revue** — tous les écrans à plat, avec leurs états particuliers |
| `prototype.html` | **Le prototype cliquable** — les parcours se traversent vraiment |

Les deux portent les quatre mêmes bascules : **thème** (clair / sombre),
**langue** (FR / EN), **modèle** (SE / courant / grand) et **système**
(iOS / Android).

Le test qui compte : passez la planche en **EN + SE**. C'est là que les libellés
cassent, et un châssis plus haut que l'appareil réel signale un écran à reprendre
— sur la planche le cadre s'allonge jusqu'à son contenu, dans le prototype il
garde la hauteur de l'appareil pour que le défilement reste honnête.

## Les écrans

**L'entrée** — `SplashScreen` (ouverture, plein écran), `ConnexionScreen`,
`CodeScreen` (deux horloges : validité et renvoi), `PseudoScreen`,
`BienvenueScreen`.

**Les quatre onglets** — `AccueilScreen`, `DatesScreen` (vue calendrier par
défaut, vue liste au choix, bouton d'ajout), `ProchesScreen` (tri bidirectionnel,
bouton d'ajout), `MoiScreen` (hub en quatre sections).

**Depuis l'accueil** — `NotificationsScreen` (par la cloche), `AValiderScreen`
(le sas des contributions), `ReprisesScreen` (du plus urgent au moins urgent).

**Depuis une fiche** — `ProcheScreen`, `CollecteScreen` (lien à révoquer),
`IdentiteScreen` (le registre oriente la génération), `PortraitScreen`.

**Le chemin payant** — `PreparationScreen`, `CadrageIdeesScreen` (budget et note,
tous deux facultatifs), `CompositionScreen` (plage de notes, ton, longueur),
`GenerationScreen` (attente qu'on peut quitter, cinq idées choisissables, message).

**Le compte** — `RechargeScreen` (avec l'attente mobile money, qui ne s'annule
pas), `ParrainageScreen`, `MonMurScreen`, et `CompteScreens.jsx` qui porte les
six vues consultées deux fois par an : profil, rappels, sécurité, paiement, aide,
réservations.

**Le reste** — `NoteScreen`, `EvenementScreen`, `RechercheScreen`,
`SouhaitScreen`, `OccasionScreen`.

## Ce qui n'est pas réimplémenté ici

Aucun bouton, badge, carte ou bandeau : les écrans composent les primitives de
`components/`. Un rang de bouton qui existerait en double finirait par divergerticket.

## Le dictionnaire

Toute la copy FR / EN vit dans `copy.js` et descend par la prop `t`. **Aucune
chaîne dans un composant** : les règles de pluriel diffèrent d'une langue à
l'autre — le zéro prend le singulier en français, le pluriel en anglais — et une
chaîne écrite dans un composant ne peut pas atteindre le dictionnaire.

Il n'y a **aucun repli français** : sans lui, un appel qui oublie `t` plante au
lieu de s'afficher dans la mauvaise langue.

Le contrôle du genre est décrit dans `verifier-genre.md` — la règle « le genre du
tiers n'existe pas » s'est fait contourner trois fois par de la relecture, elle a
donc une vérification mécanique.

## Deux choses à savoir

**Le portrait existe en double.** `PortraitImage.jsx` (ici) et
`components/brand/PortraitComposition.jsx` (le design system) dessinent le même
objet. Le second est le canonique — props, ambiances, trois formats, planche
d'épreuve. Le premier attend d'être remplacé par lui.

**Le châssis n'est pas le produit.** `PhoneFrame` simule un écran, pas un système :
il n'y a ni conteneur de défilement, ni zone sûre, ni esquive du clavier. Ces
comportements sont natifs — voir `react-native/` pour le pilote de port et les
décisions qu'il reste à trancher.

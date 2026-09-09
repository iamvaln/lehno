# Ce qui reste — UI kit application

Les 27 écrans de la spec sont livrés. Ce fichier ne garde que le **reste**, et
chaque ligne dit qui décide.

## Ce qui attend une décision de votre part

**L'identité du back-office.** Conclusion prise — une police plus adaptée à une
surface d'exploitation, donc Karla partout et Fraunces qui sort. Les douze
sections attendent d'être construites sur cette base.

**Les polices en binaire.** Bloquant pour React Native, et pour lui seul : le web
charge Fraunces et Karla depuis Google Fonts, mais RN ne charge pas une police
par URL. Il faut des `.ttf` **statiques** — les axes de Fraunces (SOFT 40,
WONK 1) doivent être cuits dans le fichier, le support variable étant irrégulier
sur Android — et la licence autorisant l'embarquement dans une app publiée.

**Les décisions natives.** Elles n'ont pas d'équivalent dans une planche, et le
kit web ne peut pas les exprimer :

- ce qui **pousse** (chevron retour) et ce qui **monte en modale** — la
  préparation, la saisie de note, la feuille payante ;
- l'**en-tête au défilement** : fixe, ou titre qui se replie ;
- le **clavier** : ce qui remonte, où se pose le bouton plein quand il est ouvert
  (critique pour la note, le formulaire d'événement, le code) ;
- la **zone sûre** : ce qui passe sous l'encoche, ce qui passe sous la barre ;
- le **tirer-pour-rafraîchir** : sur quels écrans ;
- l'**attente de génération** — « quitter sans perdre » est un comportement, pas
  une image.

## Ce qui m'appartient

**Livrer `PortraitComposition` dans les archives.** Le composant est le portrait
canonique et deux écrans l'importent ; il manquait aux trois archives du design
system. Il est désormais dans l'export, avec sa planche d'épreuve.

**Répliquer le port React Native.** Le pilote — `tokens.js`, `Button.js`,
`EventCard.js`, `AccueilScreen.js` — établit la convention. Le reste est
mécanique : 274 `<div>`, 132 éléments de texte, 36 boutons, 51 grilles à repenser
en flex, 62 raccourcis `border` à séparer, 65 attributs `aria-*` à convertir,
et environ 190 propriétés sans effet à retirer. À lancer si la convention du
pilote vous convient.

## Le lot suivant, d'après la mise à jour du 25 août

La navigation à cinq onglets, l'accueil allégé et les primitives sont faits. Restent,
dans l'ordre où ils ont été retenus :

- **Mes listes de souhaits** (3.29) et **la liste partagée publique** (§3.6 des
  surfaces publiques), avec la distinction qui compte : on **réserve** sur ma liste,
  je **marque** ce qu'un proche m'a confié. Deux traitements visuels, pas deux vues.
- **Les douze drapeaux** : le trou que laisse une fonctionnalité éteinte doit rester
  habitable, et la planche doit pouvoir l'éteindre pour qu'on le voie.
- **Le studio en six temps** : le récapitulatif dont chaque ligne ramène à son
  réglage, et le résultat en deux temps — le texte d'abord, l'image ensuite.
- **Le paiement par paliers**, et le chemin manuel avec dépôt d'un justificatif.
- **`CategoryTag`** sur les sept catégories du modèle, en deux natures — durables
  sur la fiche, ponctuelles sur l'occasion — et `dislikes_nogo` traité comme la
  contrainte qu'il est.
- **Le bloc « à ranger »** sur la fiche, pour la note que le classement n'a pas su
  ranger. Ton neutre : elle sert déjà.

## Ce qui n'est pas dessiné, et pourquoi

**Le détail d'une notification.** La spec §3.13 est explicite : une notification
poussée « mène directement à l'écran concerné, **sans passer par la liste** ».
Elle est un chemin, pas une destination — un écran de détail ajouterait un clic
pour relire ce que la ligne dit déjà en entier.

**L'écran d'ouverture comme illustration.** Le brief le liste, mais « le signe
seul sur fond de marque » est l'actif existant : la pastille sur un aplat violet.
En dessiner une version séparée créerait un second signe à maintenir.

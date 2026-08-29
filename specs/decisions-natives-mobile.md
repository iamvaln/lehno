# Lehno mobile — les décisions que la planche ne peut pas prendre

Le handoff les nomme et s'arrête là, à juste titre :

> Ces choix sont natifs et n'ont pas d'équivalent dans une planche.

Ils nous reviennent. Écrits ici une fois, plutôt que découverts écran par
écran — c'est le genre de choix qui, pris six fois séparément, donne six
réponses différentes.

---

## 1. Ce qui pousse, et ce qui monte

**Pousse** (chevron retour, la pile grandit) : tout ce qui est une
**destination**. La fiche d'un proche, son identité, une occasion, la
préparation, ce que Lehno a écrit, les écrans de réglages.

**Monte en feuille** : tout ce qui est une **saisie qui revient d'où elle
vient**. La note, la feuille payante, la confirmation de suppression.

Le départage n'est pas la taille du contenu, c'est la question « où suis-je
après ? ». Une note s'écrit *à propos* de ce qu'on a sous les yeux : la feuille
laisse voir l'écran derrière, et le geste de fermeture est le même que celui
qui l'annule. Une destination, elle, remplace ce qu'on regardait.

Conséquence pour §3.5 : la saisie de note monte, y compris depuis la fiche et
depuis la carte d'échéance.

## 2. L'en-tête au défilement

**Fixe. Pas de titre qui se replie.**

Deux raisons. La première tient à la marque : le titre est en Fraunces, et un
titre qui rétrécit en défilant transforme une police de caractère en effet de
chrome. La seconde tient à la règle du lot des proches — *le nom se dit une
fois* : la fiche l'écrit en grand, la barre reste nue. Un en-tête qui se replie
la remplirait précisément de ce qu'on venait de décider de ne pas y mettre.

Les écrans qui défilent — Dates, Réglages — portent leur titre dans le flux, et
il s'en va avec lui.

## 3. Le clavier

**Le bouton plein monte avec le clavier.** Il ne reste pas collé au bas de
l'écran sous les touches, et il ne disparaît pas : il se pose juste au-dessus.
Un bouton qu'on ne voit plus oblige à fermer le clavier pour valider — deux
gestes là où il en faut un.

Sur iOS, `KeyboardAvoidingView` en `padding` ; sur Android, rien — le système
redimensionne déjà la fenêtre, et ajouter le nôtre décale deux fois. C'est ce
qui est déjà en place sur le parcours d'entrée.

**Critique pour trois écrans** : la note, le formulaire d'événement, le code.
Le code est fait.

## 4. La zone sûre

**Le haut appartient à l'écran, le bas appartient à la barre.**

Un écran ajoute l'inset du haut à son propre rembourrage. Il n'ajoute **jamais**
celui du bas quand il vit dans les onglets : c'est la barre qui le porte, et
qui peint dessous. Deux insets additionnés donnent le trou blanc au-dessus du
menu système qu'on voit dans tant d'applications.

Les écrans hors onglets — la connexion, la maintenance, une feuille — portent
les deux.

## 5. Le tirer-pour-rafraîchir

**Oui** sur l'accueil et sur Dates : ce qu'ils montrent change avec l'horloge,
et un décompte périmé est un mensonge sur la seule chose que le produit promet.

**Non** sur les formulaires — on ne rafraîchit pas ce qu'on est en train
d'écrire.

**Non** sur le carnet, la fiche et la recherche : ils rechargent déjà en
reprenant la main. Un second geste pour le même effet apprendrait à s'en méfier.

## 6. L'attente de génération

**« Quitter sans perdre » est un comportement, pas une image.**

La demande part au serveur ; l'écran n'est qu'un observateur. Quitter n'annule
donc rien, et le résultat se retrouve dans « Reprises en cours » (§3.16). C'est
ce qui rend l'attente supportable : elle n'enferme pas.

Trois conséquences :

- L'écran d'attente a **une sortie** — pas un bouton d'annulation qui mentirait
  sur ce qu'il annule, mais un retour ordinaire.
- **Rien ne se repaie.** Le crédit est débité à la demande, pas à l'affichage :
  revenir sur une génération en cours ne la redemande pas.
- La notification de fin **mène droit au résultat**, sans passer par la liste —
  la même règle que §3.13.

Le message étant allumé au lancement, ce n'est plus une décision qu'on peut
repousser.

---

## Ce qui reste ouvert

**Les transitions et `prefers-reduced-motion`.** Le handoff note qu'il n'est
traité que sur la maintenance, et qu'il faut l'étendre aux feuilles et au
calendrier. Sur mobile, la clé est `AccessibilityInfo.isReduceMotionEnabled()`,
et elle vaut aussi pour la présentation des feuilles — une feuille qui monte
d'un coup n'est pas la même chose qu'une feuille qui n'apparaît pas.

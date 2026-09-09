# Réponses au brief du port React Native

Les onze défauts du §4 sont corrigés dans le pilote. Le §6 était déjà fait. Ce
document répond au §2.4, au §2.5 et au §3.

---

## §2.4 — La licence

**Fraunces et Karla sont toutes deux sous SIL Open Font License 1.1.** L'OFL
autorise explicitement les deux choses dont le port a besoin :

- l'**embarquement** dans une application, y compris commerciale et publiée sur
  un magasin — le §1 de la licence traite les polices comme des logiciels dont la
  redistribution avec un logiciel est libre ;
- la **modification**, donc la production d'instances statiques depuis la source
  variable, à condition que la licence accompagne les fichiers dérivés.

**Un point à vérifier avant de nommer les fichiers.** L'OFL permet aux auteurs de
déclarer un *Reserved Font Name* : si le fichier `OFL.txt` de Fraunces ou de
Karla en déclare un, une instance modifiée **ne peut pas** porter ce nom. Il faut
donc ouvrir les deux `OFL.txt` et lire la ligne « with Reserved Font Name » :

- **absente** → les noms du §2.1 conviennent tels quels ;
- **présente** → l'instance se publie sous un nom propre. Dans ce cas je propose
  `LehnoDisplay-*` et `LehnoText-*` plutôt qu'un dérivé du nom d'origine : c'est
  plus clair pour l'équipe, et ça évite de laisser croire qu'il s'agit de la
  police amont non modifiée.

Je ne tranche pas à votre place sur ce point : c'est le seul du brief qui relève
du juridique et non du dessin.

## §2.5 — On prend la porte de sortie

**Oui.** Produire les huit instances à la main serait un travail manuel refait à
chaque évolution de la charte. Depuis les sources variables, la commande est
reproductible et vit dans le dépôt :

\`\`\`
fonttools varLib.instancer Fraunces[SOFT,WONK,opsz,wght].ttf \\
  SOFT=40 WONK=1 opsz=24 wght=500 \\
  -o Fraunces-Medium.ttf
\`\`\`

C'est la bonne façon : l'instance de marque — **SOFT 40, WONK 1** — est alors
cuite par le script, pas par une main, et une charte qui change se recompile.

Deux précisions sur vos chiffres, que je confirme :

- **`opsz` 24 pour une seule coupe** : juste. L'application emploie Fraunces
  entre 18 et 38 px, et 24 est au milieu de cette plage.
- **`opsz` 72 pour le portrait** : utile mais pas bloquant, et vous avez raison
  de le dire. Le portrait est le seul endroit où Fraunces dépasse 40 px — et il
  est composé en `cqw`, donc sa taille réelle dépend du format d'export.

**La graisse à ne pas fournir** : Karla 300 est bien déclarée sans être employée.
Je la retire des jetons plutôt que de la laisser traîner — un jeton inutilisé
finit par être utilisé.

---

## §3 — Les décisions natives

### 3.1 Pousser ou monter — **accepté tel quel**

Votre tableau est juste sur les neuf lignes. Le raisonnement qui les tient :
**ce qui se garde pousse, ce qui s'expédie monte.**

Deux précisions à inscrire quelque part :

**La génération quittable ressort vers l'accueil, pas vers le vide.** « Quitter
sans perdre » n'est tenu que si l'on atterrit quelque part et que le travail se
retrouve — c'est *Reprises* qui le porte, comme vous l'écrivez. Le bouton de
l'écran d'attente est déjà câblé ainsi dans le kit web.

**La feuille payante n'apparaît qu'à la génération.** Jamais au partage : le
texte est déjà produit et payé. Le kit web avait ce défaut, il est corrigé.

### 3.2 L'en-tête au défilement — **accepté, avec une exception**

Titre qui se replie sur les listes, fixe ailleurs : oui.

**L'exception : les trois écrans de saisie** — note, formulaire d'événement,
code. Leur en-tête reste fixe **et son titre ne se replie jamais**. Un titre qui
bouge pendant qu'on tape entre en concurrence avec le clavier, et l'écran perd
son seul point stable au moment où l'on en a le plus besoin.

### 3.3 Le clavier — **accepté**

Le contenu remonte, le bouton plein se colle au-dessus du clavier, et le clavier
s'ouvre seul sur l'écran de code.

**Une précision sur la note** : l'écran s'ouvre curseur dans la zone de texte
(spec 3.5), donc le clavier est là dès l'arrivée. Les champs de rattachement —
pour qui, quelle occasion — sont **sous** le clavier et se atteignent en
défilant. C'est voulu : on écrit d'abord, on range ensuite.

### 3.4 La zone sûre — **accepté**

`insets.top` consommé par l'en-tête, `insets.bottom` ajouté au contenu défilant
et sous la barre d'onglets.

**Un seul écran déborde volontairement : l'ouverture.** L'aplat violet monte
jusqu'au bord et la barre d'état passe en blanc — un écran d'ouverture précède
l'application, il n'a pas de marge de courtoisie.

**Pas le portrait.** Il est une image *dans* un écran, avec le rembourrage
normal ; c'est son **export** qui fait 1080 × 1080, et un fichier n'a pas de zone
sûre. Les confondre ferait déborder l'aperçu sans raison.

### 3.5 Le tirer-pour-rafraîchir — **accepté, plus un écran**

Oui sur accueil, dates, proches, à valider, notifications. Jamais sur un
formulaire.

**Ajoutez *Reprises*.** C'est de l'état serveur comme le reste, et c'est
justement l'écran où l'on vient vérifier que rien n'a été perdu — un geste qui
ne recharge pas y serait plus troublant qu'ailleurs.

### 3.6 La valeur tactile — **44, et le pilote avait tort**

`spacing.ts` a raison, mon commentaire était faux. La charte dit 44 comme
**plancher** — « jamais moins, même quand le fond visible est plus court » — et
le bouton mobile du web rend exactement 44. Le pilote en affichait 48 en
l'attribuant à la charte : c'était une valeur de confort déguisée en règle.

Corrigé à 44. Le `hitSlop` de 8 reste : il élargit la zone touchable sans
grossir le dessin, ce qui est la bonne façon d'être généreux.

---

## §5 — Sur le gris de mention, vous avez trouvé un défaut de la charte

Ce n'est pas une divergence de recopie : **c'est la charte qui avait tort.**
`--text-mention` était bien à `#9C97A8`, et votre mesure est exacte — 2,39:1 sur
le lilas, 2,84:1 sur le papier, pour le plus petit texte du produit.

J'ai corrigé à la source, et la correction a une conséquence qu'il faut
connaître : **il n'existe aucun gris plus clair que `#6B6579` qui passe 4,5:1 sur
le lilas.** La borne calculée est à Y = 0,147 quand `#6B6579` est à 0,138 — il
passe de justesse. Le troisième niveau de gris ne peut donc pas exister en thème
clair.

**La hiérarchie à trois niveaux devient typographique** : 15-16 px pour le
courant, 13,5 px pour le secondaire, 11,5 px pour la mention. Trois tailles, deux
couleurs. Le thème sombre garde ses trois couleurs — `#9A94A8` y mesure 6,24:1
sur le fond et 4,73:1 sur le lilas sombre. C'est une des façons dont le thème
sombre rejoue la palette au lieu de l'inverser.

**Le jeton a été supprimé**, des deux côtés. Le garder comme alias du gris de
texte en aurait fait un doublon — et c'est précisément la divergence que votre
§5 dénonçait : même nom, deux valeurs selon la plateforme. Les filets ont déjà
`--lehno-rule` et `--lehno-rule-strong` ; un troisième gris n'avait plus
d'emploi.

Et vous avez raison sur le reste : `tokens.js` est une **référence de forme**, pas
une source. Le fichier le dit maintenant en tête.

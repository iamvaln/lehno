L'image qu'on offre à un proche, et qui part avec un mot — le seul contenu du produit qui sort en portant la marque.

```jsx
<PortraitComposition
  nom="Karim"
  message="Tu refais le monde à minuit et tu nous ramènes au concret le lendemain. Cette année, tu as tenu tout le monde debout."
  signature="Valentine"
  ambiance="papier" voie="illustration" format="carre" base="../../" />
```

**Le message est le contenu principal** — deux à quatre phrases. Ce n'est pas une légende sous une image : c'est ce qui dit « voilà comment je te vois ».

**Une seule voie d'image à la fois** : `illustration`, `photo` ou `aucune`. Les mêler ferait une infographie, ce que le brief écarte. En format `lien` la voie tombe d'elle-même — le cadre est trop bas.

**Ne pas poser de tailles à la main.** Tout est en `cqw`, calculé depuis la longueur du nom et le nombre de mots du message — c'est ce qui fait tenir la composition de deux à quatre phrases, en français comme en anglais où la même phrase s'allonge d'un tiers.

**La marque ne se masque pas.** Il n'y a pas de prop pour ça : le portrait arrive chez des gens qui n'ont jamais entendu parler de Lehno.

**Éprouver avant de livrer**, comme le brief le demande : un nom de vingt caractères avec un message de quatre phrases et sans signature, puis la même composition à 200 px de large. Et le test qui tranche — imprimé, aurait-on envie de l'accrocher ?

Trois ambiances (`papier`, `lilas`, `encre`) : le fond change, la structure non. Le portrait n'a pas de thème clair et sombre — c'est une image fixe, et l'ambiance est un choix de l'utilisateur.

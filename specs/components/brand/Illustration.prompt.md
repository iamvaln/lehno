Les illustrations d'états vides — **une par écran, jamais deux**.

```jsx
<Illustration nom="carnet-neuf" largeur={160} />
```

En pratique on ne l'appelle presque jamais directement : `EmptyState` la prend par sa prop `illustration`.

Elles ne décorent pas l'application — elles occupent la place que le contenu n'occupe pas encore, sur les écrans où il n'y a rien à montrer. Ailleurs, l'interface reste en aplats nus.

Le thème est automatique : les formes lisent `--illus-mass`, `--illus-form` et `--illus-warm`, qui se rejouent en sombre. Il n'y a rien à basculer à l'appel.

**La silhouette prend toujours `--illus-mass`.** `--illus-form` est une couleur de
remplissage, pas une couleur de silhouette : elle ne mesure que 1,19:1 sur le papier et
1,30:1 sur le fond sombre. Elle ne vaut donc que pour ce qui est **enfermé dans une masse**
— le creux, l'intérieur vide, la page à l'intérieur du carnet. Une forme dessinée en
`--illus-form` sur le fond de page est invisible.

Trois couleurs au plus par image, aucun contour, aucune ombre, aucun texte — les libellés vivent dans l'interface, où ils se traduisent. Les personnes sont des silhouettes sans visage ni traits : le produit parle de gens, mais aucune image ne représente un type de personne plutôt qu'un autre.

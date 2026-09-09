Le bouton de Lehno : trois rangs, et un seul bouton plein par vue — celui qui fait avancer.

```jsx
<Button variant="primary" platform="mobile" full>Préparer</Button>
<Button variant="outline">Voir la liste</Button>
<Button variant="text">Plus tard</Button>
```

`platform="mobile"` monte la hauteur à 48 px et le rayon à 12 — l'écart suit la taille du doigt. Il n'y a **pas de bouton « succès »** : le succès est un état, pas une action ; utiliser un `Banner` `intent="success"`. Le focus clavier ne se supprime jamais (classe `lehno-focusable`).

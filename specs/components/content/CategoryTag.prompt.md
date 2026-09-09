Le classement d'une note — et le moyen de le corriger d'un appui.

```jsx
<CategoryTag categorie="idee" onReclasser={ouvrirChoix} />
<CategoryTag categorie="aclasser" onReclasser={ouvrirChoix} />
<CategoryTag categorie="gout" />   {/* lecture seule */}
```

Ne pas confondre avec `Tag` : `Tag` porte un contenu (un goût, un décompte), `CategoryTag` porte un **classement**, donc il se corrige. « À classer » est en pointillé — le produit n'a pas encore tranché, et il le montre plutôt que de deviner.

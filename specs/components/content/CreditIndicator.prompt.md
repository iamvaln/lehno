Ce qu'une action va coûter, **avant** de la lancer.

```jsx
<CreditIndicator cout={1} solde={4} />        {/* sous le bouton */}
<CreditIndicator solde={4} variant="solde" /> {/* le solde, en gros */}
```

La règle est stricte : **aucune action payante ne se déclenche sans que son coût ait été affiché**. Quand le solde ne suffit pas, l'indicateur passe en ambre — il constate, il ne réprimande pas. Pour une génération, préférer `PaidActionSheet`, qui montre aussi le résultat attendu.

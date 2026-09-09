Aucune génération ne se lance sans passer par là.

```jsx
<PaidActionSheet
  titre="Le portrait de Valery"
  resultat="Quelques lignes sur lui, écrites à partir de vos 9 notes."
  cout={1} solde={4}
  onConfirmer={lancer} onAnnuler={fermer} />
```

Trois informations, toujours les trois : **ce que ça donne**, **ce que ça coûte**, **ce qu'il vous reste**. Quand le solde ne suffit pas, l'action principale devient *Recharger* — on ne laisse pas un bouton qui échouerait. Le refus s'écrit « Pas maintenant », pas « Annuler » : rien n'a encore commencé.

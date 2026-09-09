Accusé d'une action déclenchée depuis une liste, une ligne ou un dialogue.

```jsx
<Toast action="Annuler" onAction={annuler} onDismiss={() => setAccuse(null)}>
  Solde de valentine ajusté de +2 crédits.
</Toast>
```

`Banner` décrit l'état d'une page et reste à l'écran ; le toast accuse un geste et
s'efface. Une erreur bloquante n'est pas un toast : elle reste sous les yeux.

**Il est en `position: fixed`** — un accusé s'épingle au viewport, pas au flux. Pour le montrer dans une vitrine ou un cadre de maquette, envelopper l'appel dans un conteneur portant `transform: translate(0)` (ou `contain: layout paint`) et une hauteur explicite : sans bloc conteneur, plusieurs toasts se superposent au même point de l'écran.

Le composant n'expose pas `style` : sa position est une décision du système, pas un réglage d'appel.

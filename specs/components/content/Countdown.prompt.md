Le décompte d'une échéance. Le texte vient du dictionnaire — le composant ne le fabrique pas.

```jsx
<Countdown label={t.decompte(3)} size="l" />
<Countdown label={t.aujourdhui} today />   {/* pilule abricot */}
```

La **notation n'est pas arrêtée** : `J−3` et « dans 3 jours » sont à l'essai, et le
dictionnaire porte les deux (`decompteBarre`, `decomptePhrase`). Un composant qui
composerait le texte figerait une décision qui doit sortir d'un test utilisateur.

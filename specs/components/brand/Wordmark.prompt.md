Le logotype. Toujours le fichier vectorisé — **jamais « Lehno » composé en texte**.

```jsx
<Wordmark height={24} />                       {/* fond clair */}
<Wordmark variant="blanc" height={24} />       {/* thème sombre */}
```

Ne pas confondre `blanc` et `inverse` : `inverse` embarque sa plaque de fond encre et laisse un rectangle visible sur une page sombre. `blanc` a un fond transparent et la même boîte 704 × 226 que `couleur`, donc la taille ne bouge pas au basculement.

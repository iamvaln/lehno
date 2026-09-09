Une icône Lucide aux règles de la charte — à utiliser partout où une icône est nécessaire, jamais un emoji ni un caractère Unicode.

```jsx
<Icon name="calendar" size={20} />
<Icon name="chevron-right" size={15} color="var(--text-mention)" />
```

Laisser `color` à `currentColor` : l'icône prend la couleur du texte qu'elle accompagne. Laisser `strokeWidth` par défaut — le composant applique 2 sous 16 px et pour les chevrons, 1,8 sinon. La page hôte doit charger `https://unpkg.com/lucide@0.417.0/dist/umd/lucide.js`.

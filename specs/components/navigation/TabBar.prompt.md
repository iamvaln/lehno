La barre d'onglets de l'application. De trois à cinq onglets, sans largeur figée.

```jsx
<TabBar active="accueil" onSelect={aller}
  tabs={[
    { id: "accueil", label: t.ongletAccueil, icon: "house" },
    { id: "dates", label: t.ongletDates, icon: "calendar" },
    { id: "proches", label: t.ongletProches, icon: "heart" },
    { id: "moi", label: t.ongletMoi, icon: "user" },
    { id: "reglages", label: t.ongletReglages, icon: "settings" }
  ]} />
```

**Les libellés viennent du dictionnaire**, jamais du composant. Une fonctionnalité
éteinte retire son onglet de la liste : la barre se redistribue, l'onglet d'ouverture
existe toujours.

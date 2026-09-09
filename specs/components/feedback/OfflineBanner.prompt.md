Le réseau est tombé. L'application ne l'est pas.

```jsx
<OfflineBanner />
<OfflineBanner enAttente={2} />
```

Il prend le **lilas**, pas l'ambre : perdre le réseau n'est pas une faute de l'utilisateur, et la consultation continue. Le bandeau dit ce qui **reste possible** (lire ses notes, ses dates) ou ce qui **repartira tout seul** — jamais « échec » ni « impossible ».

Il se place sous l'en-tête, pleine largeur, et disparaît de lui-même au retour du réseau.

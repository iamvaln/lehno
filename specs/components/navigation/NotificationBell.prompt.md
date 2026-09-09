La cloche — **toujours dans l'en-tête**, sur tous les écrans de l'application.

```jsx
<NotificationBell nonLus={2} onOuvrir={ouvrirCentre} />
```

La pastille porte le violet d'action, pas le rouge : des notifications ne sont pas une erreur. Le compte est dans le `aria-label`, pas seulement dans la pastille — un compteur qui n'existe qu'en couleur n'existe pas pour tout le monde.

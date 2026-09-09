L'attente. On ne fait jamais patienter sans dire sur quoi.

```jsx
<LoadingState variant="liste" lignes={3} />
<LoadingState variant="envoi" titre="Envoi en cours" />
<LoadingState variant="generation" onQuitter={fermer} />
```

La génération est le cas qui compte : elle dure, donc elle **se quitte sans rien perdre** — et le texte le dit, sinon la promesse n'existe pas. Toujours passer `onQuitter`.

L'ossature pulse, elle ne défile pas : rien ne traverse l'écran pendant une attente. Sous `prefers-reduced-motion`, le pouls et la rotation s'arrêtent — l'ossature reste, immobile.

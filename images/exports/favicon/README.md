# Lehno — favicon, web et mobile

Deux tracés : le dessin courant pour tout ce qui dépasse 100 px, le tracé épaissi (graisse 700, SOFT 0, empattements retirés) pour 16 à 64 px.

| Fichier | Emplacement |
|---|---|
| `favicon.svg` | Onglet, navigateurs modernes — s'affiche à toutes les tailles |
| `favicon.ico` | Onglet, historique — contient 16, 32 et 48 px |
| `favicon-16/32/48/64.png` | Onglet, raccourcis de bureau |
| `apple-touch-icon-180.png` | Écran d'accueil iOS |
| `icon-192.png`, `icon-512.png` | Manifeste — usage `any` |
| `maskable-192.png`, `maskable-512.png` | Manifeste — usage `maskable`, signe réduit à la zone sûre |
| `mstile-150.png` | Tuile Windows |
| `safari-pinned-tab.svg` | Onglet épinglé Safari, une encre |
| `site.webmanifest` | Manifeste prêt à servir |

## À poser dans le `<head>`

```html
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="mask-icon" href="/safari-pinned-tab.svg" color="#221F2B">
<meta name="theme-color" content="#7B6BB7">
```

Les fichiers sont pensés pour être servis à la racine du domaine. Si vous les rangez ailleurs, corrigez aussi les chemins dans `site.webmanifest`.

# Lehno — favicon, web et mobile

**Un seul tracé**, celui de `lehno-icone-512.svg` — la même source que le logotype.
Sous 128 px, seul le *trait* s'épaissit pour que la hampe reste visible ; les empattements
ne sont jamais retirés. **L'épaississement se déduit du canal** — l'espace entre la hampe et
la jambe droite — et ne lui prend jamais plus du quart de sa largeur : à 16 px ce canal ne
mesure que 1,77 px, et une lettre au canal fermé n'est plus une lettre. Chaque fichier est
sondé après génération pour vérifier qu'il reste ouvert. Une icône qui perd les empattements devient un autre `h`, et
c'est le premier signe qu'un visiteur voit du site.

À 16 px l'empattement tient dans moins d'un pixel : il y est suggéré par l'épaississement
plutôt que dessiné. C'est la limite basse assumée du système, pas une seconde lettre.

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

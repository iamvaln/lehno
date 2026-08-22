# Lehno — fichiers de marque

Piste retenue : **le `h` seul**. Couleurs : encre #221F2B · violet #7B6BB7 · violet profond #5A4B93 · lilas #EDEAF7 · abricot #F0CFB4.

## Contenu

| Fichier | Usage |
|---|---|
| `lehno-logotype-couleur.svg` | Le mot sur fond clair — usage courant |
| `lehno-logotype-inverse.svg` | Sur fond encre — le `h` passe à l'abricot |
| `lehno-logotype-une-encre.svg` | Une seule couleur (fax, gravure, tampon) |
| `lehno-icone-512.svg` | Icône d'application, carré violet |
| `lehno-icone-ronde-512.svg` | Avatar, photo de profil ronde |
| `lehno-icone-claire-512.svg` | Sur fond lilas |
| `lehno-icone-sombre-512.svg` | Sur fond encre |
| `lehno-icone-une-encre-512.svg` | Signe seul, sans pastille, une encre |
| `lehno-favicon-28.svg` | Favicon — tracé épaissi, empattements retirés |
| `lehno-verrouillage-horizontal.svg` | Signe + mot, en ligne |
| `lehno-verrouillage-empile.svg` | Signe + mot, empilé |
| `png/` | Exports matriciels — logotypes et verrouillages de 400 à 3200 px, icônes de 64 à 1024 px |
| `stores/` | App Store et Play Store : icônes de fiche, paliers de lanceur, icône adaptative, bandeau |
| `favicon/` | Favicon, écran d'accueil, manifeste — voir `favicon/README.md` |

## Deux points avant l'usage en production

1. **Le texte est vectorisé.** Chaque fichier ne contient que des courbes — aucune police n'est requise pour l'afficher, ni en ligne ni à l'impression. Le tracé provient de l'instance exacte de Fraunces retenue : graisse 500, SOFT 40, WONK 1, taille optique 144 pour le logotype ; chaque palier d'icône a la sienne (jusqu'à graisse 700, SOFT 0, opsz 9 pour le favicon). Reste la reprise à la main prévue au brief : hampe du `h` allongée, épaule resserrée, jonctions adoucies, interlettrage `e`/`h`.
2. **Les paliers se redessinent.** Le favicon fourni est déjà épaissi (poids 700, SOFT 0). Les paliers 64 et 40 demandent le même traitement intermédiaire ; ne réduisez pas le fichier 512.

## Recadrage

Chaque fichier est recadré au tracé : la boîte du SVG épouse exactement les courbes (le logotype fait 704 × 226,2, le verrouillage horizontal 519,75 × 168, l'empilé 309,75 × 309,5). Seul `lehno-logotype-inverse.svg` porte une plaque avec 60 unités de marge symétrique. Dans les icônes, le `h` est centré sur son encre et non sur sa boîte typographique. Placez les fichiers bord à bord sans compenser de vide.

## Rappels d'usage

Zone de protection = largeur de la hampe du `h`, tout autour. Taille minimale du signe : 28 px à l'écran, 8 mm à l'impression. Sur photographie, le signe se pose sur pastille blanche. Aucun dégradé, aucune ombre, aucun contour ajouté.

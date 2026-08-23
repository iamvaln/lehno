# Lehno — fichiers de marque

Importés depuis le projet Claude Design *Identité Lehno — finale*, planche `Identité Lehno - finale-print.dc.html`.

**Piste retenue : le `h` seul.** Le monogramme `LHO` du brief est écarté — le produit multiplie les surfaces où la marque paraît petite et sans son nom, et c'est là que la même lettre, vue partout, se retient le plus vite.

## Contenu

| Fichier | Usage |
|---|---|
| `svg/lehno-logotype-couleur.svg` | Le mot sur fond clair — usage courant |
| `svg/lehno-logotype-inverse.svg` | Sur plaque encre — le `h` passe à l'abricot |
| `svg/lehno-logotype-une-encre.svg` | Une seule couleur — gravure, tampon |
| `svg/lehno-icone-512.svg` | Icône d'application, carré violet (`rx` 113 sur 512) |
| `svg/lehno-icone-ronde-512.svg` | Avatar, photo de profil ronde |
| `svg/lehno-icone-claire-512.svg` | Plaque lilas, signe violet profond |
| `svg/lehno-icone-sombre-512.svg` | Plaque encre, signe blanc |
| `svg/lehno-icone-une-encre-512.svg` | Signe seul, sans plaque |
| `svg/lehno-favicon-28.svg` | Favicon — tracé propre, épaissi |
| `svg/lehno-verrouillage-horizontal.svg` | Signe + mot, en ligne |
| `svg/lehno-verrouillage-empile.svg` | Signe + mot, empilé |

## Ce qu'il faut savoir avant de s'en servir

**Le texte est vectorisé.** Chaque fichier ne contient que des courbes : aucune police n'est requise pour l'afficher. Le tracé vient de l'instance exacte de Fraunces — graisse 500, `SOFT` 40, `WONK` 1, taille optique 144 pour le logotype.

**Chaque palier est un dessin distinct, pas une réduction.** Le `h` du favicon (28 px), celui de l'icône (512 px) et celui des verrouillages (168 px) sont trois tracés différents : à mesure que la taille tombe, le trait s'épaissit et la taille optique descend, les empattements s'émoussent, le contrepoinçon s'ouvre. **Ne jamais produire un petit palier en réduisant un grand** — le résultat serait plus fin et plus fermé que le dessin prévu.

**Les fichiers sont recadrés au tracé.** La boîte du SVG épouse les courbes, sans marge résiduelle : le logotype fait 704 × 226,2, le verrouillage horizontal 519,75 × 168, l'empilé 309,75 × 309,5. Seul `lehno-logotype-inverse.svg` porte une plaque, avec 60 unités de marge symétrique. Les poser bord à bord, sans compenser de vide.

## Règles qui contraignent le code

- **Zone de protection** — la largeur de la hampe du `h`, tout autour. Rien n'y entre : ni texte, ni filet, ni bord de photographie.
- **Tailles minimales** — signe seul 28 px à l'écran et 8 mm à l'impression ; verrouillage horizontal 120 px ; logotype seul 96 px de large.
- **Fonds admis** — blanc (signe violet), lilas (signe violet profond), encre (signe blanc), photographie (signe sur pastille blanche).
- **Proscrits** — aucun dégradé, aucune ombre portée, aucun contour ajouté. Le violet ne se pose jamais sur l'encre, ni l'abricot sur le blanc. Le signe ne s'étire pas et ne se recolore pas hors palette. Le `h` du logotype ne prend jamais l'abricot sur fond clair : l'abricot est réservé aux moments heureux dans l'interface.

Cette dernière règle vaut aussi pour l'interface entière : **aucune ombre nulle part.** La profondeur vient des filets d'un pixel, jamais d'une ombre portée.

## Ce qui manque encore

- **Les PNG** (512, 128, 64, 40, favicon 28, logotype 1600). Ils vivent dans le projet Claude Design, sous `exports/png/`. Chaque palier étant redessiné, ils ne se régénèrent pas depuis les SVG : il faut les rapatrier tels quels, au moment de configurer les icônes d'application.
- **La reprise à la main du logotype**, prévue au brief et non encore faite sur les courbes livrées : hampe du `h` allongée de 4 %, épaule resserrée, jonctions adoucies, interlettrage `e`/`h` repris pour que la couleur ne creuse pas de trou dans le mot.
- **Masque circulaire et marge de recadrage** pour les magasins d'applications ; écran de lancement ; filigrane du portrait partagé.
- **L'animation d'ouverture** — le nom se trace lettre à lettre, puis le `h` passe de l'encre au violet. La partition est dans la planche *Logo animé Lehno* du projet ; elle vit en CSS et s'implante telle quelle. Une fois par session, jamais en boucle, jamais sous 120 px, état final identique au logo statique.

## Un écart assumé sur deux gris d'interface

Les fichiers ci-dessus sont livrés tels quels. En revanche, deux valeurs de la planche d'identité ont été corrigées **pour les textes d'interface uniquement**, après mesure : `#9C97A8` (2,84:1 sur blanc) devient `#777086` (4,72:1), et `#9A6238` sur abricot (3,42:1) devient `#835125` (4,51:1). Toutes deux portaient de petits textes — surtitres, indices, mentions — sous le seuil de lisibilité de 4,5:1. La couleur des paragraphes `#4A4556`, employée sur la landing sans figurer au nomenclateur, y entre sous le rôle *corps*.

L'écart ne touche ni le logotype, ni les icônes, ni aucun fichier de ce dossier.

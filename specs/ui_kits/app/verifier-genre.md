# Vérifier qu'aucune copy ne genre un tiers

La règle du projet — « le genre du tiers n'existe pas » — s'est fait contourner
trois fois de suite par de la relecture humaine. Voici le contrôle mécanique.

## La commande

Sur les chaînes de `copy.js` et des écrans :

```
grep -nE '"[^"]*\b([Ii]l|[Ee]lle|He|She|his|her|fier|fière)\b[^"]*"' ui_kits/app/*.jsx ui_kits/app/copy.js
```

## Ce qui est un vrai défaut

Toute occurrence qui désigne **un proche** : un pronom (`il`, `elle`, `he`,
`she`), un possessif (`son amitié`, `his friendship`, `chez elle`), ou un
**accord d'adjectif** — `plus fier` en porte autant qu'un pronom, et c'est
celui qui passe le plus facilement.

## Ce qui n'en est pas

- `Il vous reste deux essais` — « il » impersonnel.
- `pendant qu'elle est fraîche` — « elle » reprend *une idée*, pas une personne.
- `un anniversaire se suit sans elle` — reprend *l'année*.

## Les tournures qui remplacent

| À éviter | À écrire |
|---|---|
| « dont il a parlé en mars » | « repéré en mars » |
| « ce que son amitié a changé » | « ce que cette amitié a changé » |
| « le sien rend l'âme » | « le précédent rend l'âme » |
| « il travaille l'après-midi » | « l'après-midi, c'est le travail » |
| « plus fier que de son travail » | « tire plus de fierté que de son travail » |
| « près de chez elle » | « tout près d'ici » |

Fragments à verbe initial, nom propre, deuxième personne, substantif à la place
de l'adjectif : quatre façons de ne jamais avoir besoin du genre.

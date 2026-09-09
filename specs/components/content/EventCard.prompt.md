L'échéance, partout où elle apparaît — accueil, fiche d'un proche, résultats de recherche.

```jsx
{/* la plus proche : elle porte ses deux actions */}
<EventCard imminent nom="Célarine" jours={0} dateLabel="aujourd'hui" precision="36 ans"
  note="Un cours de céramique, tout près de chez Célarine."
  noteOrigine="noté" noteDate="en mars" onPreparer={…} onEnvoye={…} />

{/* les suivantes : des lignes calmes */}
<EventCard nom="Mathias & Rose" type="mariage" typeLabel="Mariage" jours={9} dateLabel="30 août" precision="5 ans" onOuvrir={…} />
```

**Une seule carte imminente par écran** — c'est elle qui porte les actions, les autres restent des lignes. C'est l'application de « un écran, une intention » : deux cartes à deux boutons, et plus rien ne se détache.

L'anniversaire ne porte pas de tag : c'est le cas courant, et signaler le courant revient à ne rien signaler.

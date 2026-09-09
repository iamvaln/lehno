Un écran sans contenu. Chez Lehno, c'est **du contenu**, pas un accident.

```jsx
{/* premier lancement */}
<EmptyState illustration="carnet-neuf"
  titre="Votre carnet est prêt"
  texte="Ajoutez un premier proche et sa date. Lehno s'occupe de vous le rappeler."
  action="Ajouter un proche" onAction={…} />

{/* aucune échéance proche */}
<EmptyState illustration="rien-approche"
  titre="Rien dans les semaines qui viennent"
  texte="Le bon moment pour noter une idée pendant qu'elle est fraîche."
  action="Laisser une note" onAction={…} />
```

**Les textes disent ce qui est possible, jamais ce qui manque.** Bannis : « aucun proche », « liste vide », « rien à faire », « vous n'avez pas encore… ». Le calme est une réponse — un écran qui n'a rien à signaler l'annonce sans s'excuser.

Une seule action, et c'est celle qui débloque la suite. Le texte dit le **bénéfice**, pas l'ordre : « Lehno s'occupe de vous le rappeler », pas « Commencez dès maintenant ».

Un carnet vide est un carnet neuf — c'est pourquoi ces écrans portent une illustration plutôt qu'une icône : elle occupe la place que le contenu n'occupe pas encore.

# Ce qui est éprouvé à l'appareil, et ce qui ne l'est pas

*14 septembre 2026 — tenu à jour au fil des passages.*

Ce document existe parce que les comptes rendus au fil de l'eau ne se
retrouvent plus. **Quarante-cinq écrans**, et jusqu'ici on ne savait plus dire
lesquels avaient été ouverts.

**Trois niveaux, et ils ne valent pas la même chose :**

- **Éprouvé** — le geste est fait et son effet vérifié, en base ou par l'API, pas
  seulement à l'écran. C'est le seul niveau qui prouve quelque chose.
- **Vu** — l'écran a été rendu et lu. Cela attrape la mise en page, les libellés
  et les états vides. Cela n'attrape aucun geste.
- **Jamais ouvert** — rien.

## Éprouvé — 16 écrans

| écran | ce qui a été fait |
| --- | --- |
| `portrait` | lancement, brief, approbation, composition, image ; verdicts dans les deux sens ; avis et motifs |
| `generation` | l'avis d'un message et ses motifs |
| `note` | écriture, **correction et effacement** (14 sept.) |
| `proches/[id]` | lecture de la fiche, ouverture d'une note en correction |
| `proches/recherche` | recherche à vide, geste « Ajouter ce proche » |
| `dates` | état vide, « Ajouter une date » suivi jusqu'au formulaire |
| `evenement` | formulaire ouvert, liste « pour qui » dépliée — **rien enregistré** |
| `(connexion)/*` | inscription complète sur la sandbox : adresse, code, pseudo, bienvenue |
| `collecte` | le squelette sans fin, puis sa fermeture après correctif |
| `proches/identite` | **création** d'Awa puis **modification** — sa date de naissance ; les deux enregistrées |
| `evenement` | un anniversaire posé pour de bon, repris depuis la date de naissance |
| `listes` | une wishlist créée |
| `souhaits` | un souhait ajouté, et les gestes de sa carte |
| `souhait` | le détail : état, visibilité, modification, retrait |
| `parrainage` | drapeau éteint par l'API d'administration : l'écran se ferme |
| `accueil` | les deux états vides, puis le régime nominal après la création |

## Vu — 8 écrans

`proches/index`, `notifications`, `mouvements`, `monmur` (deux onglets),
`reservations`, `valider`, `reprises`, `paiement`, `occasion` (une occasion
passée), `legal`.

Leurs états vides sont lus et jugés corrects. **Aucun de leurs gestes n'est
éprouvé** — ni « Nouvelle wishlist », ni « Aperçu de ma page », ni la
préparation d'un message depuis une occasion.

## Jamais ouvert — 15 écrans

`aide`, `apercu`, `apercu-liste`, `cadrage`, `donnees`, `fermeture`, `moi`,
`preparation`, `profil`, `rappels`, `recharge`, `reglages`, `securite`,
`(connexion)/ouverture`, `controle`, `maintenance`.

Parmi eux, deux pèsent plus que les autres :

- **`moi` et `profil`** — la fiche de soi, dont un lot entier est sorti le
  11 septembre.
- **`recharge`** — l'achat de crédits. Rien de ce qui touche à l'argent n'a été
  éprouvé.

## Ce qui empêche d'avancer

~~**Il faut des données.**~~ **Fait le 15 septembre** : Awa existe sur la
sandbox, avec sa date de naissance et son anniversaire au 4 mars, plus une
wishlist et un souhait. `preparation`, `occasion` et le portrait sont désormais
atteignables — ils restent à éprouver.

**Les idées restent hors de portée** : `generation.ideas` dépend de `GiftGiven`,
et rien ne le produit sur un compte neuf.

**La bannière de suggestion de mise à jour** ne se déclenche pas sur un build de
développement — la garde de version exempte les clients non reconnus et tout ce
qui n'est pas la production. Sa lecture a ses cas, son rendu a été vu par une
sonde ; la jonction ne se verra qu'en production.

## Ce que ces passages ont trouvé

Sept défauts, tous invisibles aux 1283 cas de la suite mobile :

1. **La feuille d'avis se montait dans la page** — son voile ne couvrait que sa
   propre boîte, et le « Refaire » de l'écran tombait sur son « Envoyer ». Un
   crédit dépensé pour avoir répondu à une question. (#245)
2. **Les verdicts débordaient** du cadre sur iPhone SE. (#248)
3. **L'accueil ne rétrécissait jamais** : 466 points de contenu dans 337
   disponibles, le bas passait sous la barre d'onglets, et rien ne défile. (#249)
4. **« Rien avant le 7 nov.. »** — un point de trop, sur onze mois douze. (#249)
5. **« J−−4 »** sur une date passée, dans un écran qui montre exprès le mois
   écoulé. (#252)
6. **Trois écrans tournaient à vide** sans leur paramètre. (#262)
7. **La garde de fermeture était posée sous le squelette** dans huit écrans :
   elle ne tirait jamais, et le test qui la vérifiait cherchait la ligne sans
   vérifier qu'elle était atteignable. (#262)

8. **Aucune élision devant les prénoms** — « La wishlist de Awa », « Le Mur de
   Awa », sur les deux pages qu'on envoie à ses proches. Six libellés, et la
   garde écrite pour les tenir ne détectait rien tant qu'elle n'a pas été
   éprouvée sur un échantillon. (#265)

Deux autres sont partis au serveur : le `resultId` du portrait (#244, corrigé),
et `hasPersons` qui compte la fiche de soi — donc l'écran de premier lancement
est inatteignable depuis que cette fiche existe.

**Le ratio est le vrai enseignement** : deux écrans ouverts le 13 septembre ont
rendu quatre défauts. Ce qui n'est pas ouvert n'est pas sain, il est inconnu.

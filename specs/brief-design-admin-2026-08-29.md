# Back-office — ce qu'il reste à ajuster

Après revue du lot du 29 août. Sept points, du plus structurant au plus petit.
Tout le reste tient : les drapeaux, le routage par tâche et le studio sont
alignés avec le serveur, parfois en avance sur lui.

---

## 1. Les motifs deviennent des données, et `ConfirmWithReason` change de contrat

**Décision prise.** Les 36 listes de motifs quittent `dico.json` pour une table
administrable côté serveur. Raison : ce sont aujourd'hui des **libellés
d'interface bilingues**, et c'est le libellé qui part au journal. Le même geste
s'y inscrit *« Fraude suspectée »* ou *« Suspected fraud »* selon la langue au
moment du clic — deux textes pour un motif, et « combien de suspensions pour
fraude » devient sans réponse.

Ce qui change pour le composant :

- **Les motifs arrivent du serveur**, sous la forme `{ code, libelle }`, déjà
  dans la bonne langue. Ils ne viennent plus du dictionnaire.
- **`onConfirmer` renvoie deux valeurs** : `onConfirmer(code, precision)`. Le
  code est ce qu'on compte, la précision est ce qu'on lit.
- **« Autre — préciser » reste**, avec le code `other`, et c'est le seul cas où
  le texte libre est **obligatoire**. Ailleurs il reste offert, pour la nuance.
- **Un geste peut n'avoir aucun motif préréglé.** Tu l'avais déjà distingué —
  huit gestes n'ont qu'une invitation à écrire (*« Pourquoi cette bascule
  maintenant »*). Cette forme reste, et c'est le serveur qui dira laquelle des
  deux s'applique. Les invitations, elles, restent au dictionnaire : c'est de la
  copy.

**Les libellés que tu as écrits sont repris tels quels**, dans les deux langues.
Rien à réécrire — ils deviennent la semence de la table.

---

## 2. Les paramètres système s'enregistrent sans motif

`EditPage` est le seul écran d'écriture sans `ConfirmWithReason` : deux boutons
« Enregistrer » qui valident directement.

C'est l'écran qui porte les crédits offerts à l'inscription et le plafond de
comptes par appareil. Modifier ce qu'on donne à chaque nouveau compte ne demande
aucune justification, quand désactiver un palier en demande une.

---

## 3. Les barèmes : trois champs manquent

`MoyensPaiementPage` tient le bon geste — quels moyens dans quels pays. Son
modèle est `{ pays, taux, fixe, plafond }`, et il lui manque :

- **La voie : automatique ou manuelle.** Le même opérateur dans le même pays n'a
  pas le même barème selon qu'on passe par son interface ou par un virement à la
  main. Un seul jeu de valeurs par pays ne peut pas porter les deux — et au
  lancement, c'est la voie manuelle qui sert.
- **Le plancher.** Tu as le plafond ; son symétrique existe côté serveur.
- **Qui porte les frais.** Absent partout, et c'est celui qui décide si le client
  **verse 1 020** pour un palier à 1 000, ou s'il est **débité de 1 000** pour
  n'en créditer que 980. Il paraît sur l'aperçu du client : il se règle ici.

---

## 4. Les suppressions ne montrent pas le solde, et le remboursement n'a qu'une porte

`SuppressionsPage` affiche pseudo, demande, fin, état, motif. **Une suppression
avec des crédits achetés ne se distingue d'aucune autre** — or c'est celle qui
demande un geste avant l'échéance.

Il manque la colonne du **solde acheté**, et la **file des remboursements à
verser**. Le remboursement existe dans le lot, mais il part d'une transaction
(*« Rembourser {ref} ? »*). Le second chemin — celui qui naît d'une suppression
et attend qu'on verse — n'a pas d'entrée. Ce sont deux files, pas deux vues de la
même.

---

## 5. Un même geste, deux listes de motifs différentes

L'ajustement de solde est atteignable depuis deux écrans, et propose deux listes :

| Depuis | Motifs |
|---|---|
| `detail.dialogueSolde` | Génération échouée non recréditée · Geste commercial · Correction d'un octroi |
| `transactions.dialogues.ajuster` | Génération échouée · Geste commercial · Correction d'une erreur · Litige de parrainage |

C'est le même geste. Avec la table de motifs, il n'en restera qu'une — je fais
l'union, et je garde ta formulation la plus précise quand deux se recouvrent.
**Rien à faire de ton côté**, sauf si tu veux trancher toi-même la liste retenue.

---

## 6. Une clé morte au dictionnaire

`routageTaches.taches` nomme **sept** tâches ; l'écran en liste **six**.
`portrait` n'a pas de tâche correspondante — ni à l'écran, ni au serveur, où les
six sont exactement les tiennes.

Soit c'est un reste, soit quelqu'un attendait une septième route distincte de
`photo`. À trancher avant que le branchement ne se fasse d'après le dictionnaire.

---

## 7. Les liens externes : un motif au retrait, pas à l'ajout

`LiensPage` écrit sans motif, avec pour argument *« des raccourcis, rien de
plus »*. C'est juste pour l'ajout. Ça l'est moins pour le **retrait** : un lien
supprimé un soir d'incident est un lien que personne ne retrouve.

Je ne demanderais rien à l'ajout, et un motif au retrait.

---

## Et une confirmation sur ta dernière question

**Oui, il faut dessiner les portraits réellement produits pour les
utilisateurs.** Tu l'as posé en « reste à faire » : la réponse est oui. Le support
reçoit des réclamations sur des générations réelles, et « Les essais » ne montre
que ce qui a été fait au Studio. Sans cet écran, une réclamation se traite en
lisant la base.

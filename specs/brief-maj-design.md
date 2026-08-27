# Lehno — Ce qui a changé, pour le design

Note de mise à jour. Elle recense ce qui a bougé depuis la livraison de l'identité visuelle et du kit, et ce que cela demande côté écrans.

Les documents de référence restent `ux-app-mobile-lehno.md`, `ux-surfaces-publiques-lehno.md` et `design-system-lehno.md`.

---

## 1. La navigation passe à cinq onglets

**Accueil · Dates · Proches · Moi · Réglages**

*Moi* s'est scindé en deux, parce qu'il portait deux natures de choses :

- **Moi** — ce que je montre de moi : mon Mur, mes listes de souhaits, mon lien de vœux, mes réservations. C'est du contenu, qu'on travaille et qu'on partage.
- **Réglages** — ce qui me concerne : profil, crédits et paiements, notifications, sécurité, données, aide. C'est de la configuration, qu'on ouvre rarement.

**Le motif.** Les deux moitiés du produit n'ont pas la même mécanique. *Célébrer les autres* est intime : ça se partage à quelques proches, ça retient. *Être célébré* est public : un Mur, une liste se partagent en un statut et atteignent des dizaines de personnes d'un coup — c'est ce qui fait entrer les gens. Ranger cette moitié dans les réglages revenait à mettre la porte d'entrée dans un placard.

**Ce que ça demande.** Les libellés tiennent en français comme en anglais (*Home · Dates · People · Me · Settings*), et la barre doit vivre **à trois comme à cinq** — voir §4.

---

## 2. Deux écrans nouveaux, et une surface publique

### Mes listes de souhaits (app, §3.29)

Une liste par occasion à moi — mon anniversaire, un mariage, une crémaillère. On y crée, on tient, on partage, on voit ce qui a été réservé.

C'est **la fonctionnalité la plus visible du produit vers l'extérieur**, et elle mérite un traitement à la hauteur : une liste se partage en un statut.

### La liste partagée (public, §3.6)

La page qu'ouvre le lien. Elle porte le prénom de celui qui partage, l'occasion, et les souhaits avec leur état — **un cadeau réservé apparaît comme tel, jamais par qui**.

En pied, **« Faire ma part »** : celui qui vient de réserver crée à son tour sa liste. C'est le geste qui referme la boucle.

### Une distinction à tenir dans le dessin

**Ma liste** et **la liste d'un proche** sont deux choses, pas deux vues d'une même :

| | Ma liste | Ce qu'un proche m'a demandé |
|---|---|---|
| Se partage | Oui, c'est sa raison d'être | Jamais |
| Qui voit | Le public | Moi seul |
| Action possible | On **réserve** | Je **marque** ce qui m'intéresse |

Le marquage n'est pas une réservation : il n'engage à rien, personne d'autre ne le voit, et il remonte le souhait en tête des suggestions à la préparation. Il lui faut donc un traitement **différent** de l'état « réservé ».

---

## 3. L'accueil s'est allégé

Les trois tuiles d'actions rapides ont disparu, ainsi que le bandeau de compteurs.

Il reste : **une phrase d'accueil** qui donne l'état des lieux (« Une date aujourd'hui, deux cette semaine »), **trois échéances** dont seule la plus imminente porte ses actions, et **un bouton unique** — *Laisser une note*.

S'y ajoute une invitation discrète **« Faire ma liste »**, présente tant qu'aucune liste n'existe.

**Les gestes rares vivent ailleurs** : créer une date dans l'onglet Dates, demander un complément depuis une fiche, valider les contributions par la cloche.

---

## 4. Les fonctionnalités s'allument une à une

Le produit se livre par morceaux. Treize drapeaux gouvernent ce qui est visible ; le socle — proches, notes, dates, rappels — reste toujours là.

**Ce que ça demande au dessin :** une fonctionnalité éteinte laisse un trou, et **le trou doit rester habitable**.

- **La barre d'onglets** tient à trois comme à cinq. Aucune largeur figée, et l'onglet d'ouverture existe toujours.
- **Les cartes à deux actions** savent vivre avec une seule. La carte d'échéance perd *Préparer* si la génération est éteinte : elle ne doit pas paraître amputée.
- **Les renvois disparaissent** plutôt que de mener à un écran vide. Une fiche ne propose pas un studio éteint.

C'est à prévisualiser : voir l'accueil sans génération, la fiche sans souhaits, le Mur éteint.

---

## 5. Le portrait : un studio, et une image

**Le portrait est une image**, pas une page publique. On l'enregistre et on l'envoie comme une photo, accompagnée d'un mot. Le pied de marque fait partie de l'image — c'est lui qui fait connaître l'application.

**Le studio** précède la génération, en quatre réglages : l'orientation du message (douze au choix), la voie d'image (**illustration**, **photo traitée** ou **aucune**), le détail de cette voie, et la plage de notes.

**Trois gabarits** en découlent, tous avec la bande basse portant le texte :
- **avec illustration** — elle occupe le haut, la bande porte le texte sur un motif voilé ;
- **avec photo traitée** — même structure ;
- **sans image** — le motif prend tout le fond.

**Les motifs.** La **trame de hampes** dans la bande (le seul qui accepte du texte par-dessus), les **registres** en fond plein du gabarit sans image. Jamais les deux sur un même portrait.

Le détail est dans `spec-portrait-lehno.md`.

---

## 6. Deux corrections de couleur

Elles viennent de mesures, pas de goût.

- **`faint`** : `#726E82` → **`#6B6579`**. L'ancienne valeur donnait 4,15 sur le panneau lilas, sous le seuil. La ligne de provenance vivant sur panneau, la combinaison est courante.
- **`on-apricot`** : `#8A5527` → **`#7A4A22`**. Même motif : 4,19 sur abricot, et c'est le texte de l'étiquette « aujourd'hui ».

**La règle qui en sort** : une paire posée sur autre chose que le fond se mesure pour elle-même, jamais par déduction. En clair comme en sombre.

---

## 7. Le topo, en tête de fiche

La fiche s'ouvre sur ce que les notes ont appris du proche : sa couleur, son animal, ce qu'il aime manger, sa taille, son métier, ses loisirs, ce qu'il faut éviter. **Le topo en un regard**, avant la liste des notes.

Rien ne se saisit : tout est extrait des notes au fil de l'eau, et chaque élément porte sa **ligne de provenance**.

**Ce qui manque ne paraît pas.** Une fiche neuve n'affiche aucun bloc — jamais une grille de cases vides qui attendraient d'être remplies.

**La composition doit tenir avec deux attributs comme avec dix.** C'est le même problème que la liste de souhaits : une grille pensée pour dix paraît vide à deux.

## 8. Un bloc nouveau sur la fiche

Une note que l'application n'a pas su classer **reste sans catégorie** — aucun repli sur une catégorie fourre-tout.

Elle paraît alors dans un bloc **« à ranger »**, en tête des notes de la fiche. Un appui suffit à choisir une catégorie, et le bloc disparaît une fois vidé.

Le ton compte ici : ce n'est ni une erreur ni une file d'attente. La note **sert déjà** — la préparation lit son contenu comme celui des autres. Le bloc propose un rangement, il ne réclame pas une correction.

## 9. L'écran des modèles d'IA — ce qu'il faut dessiner

Il est **livré et en service**, mais son dessin n'a jamais été fait : il tourne sur les primitives brutes.

**Un catalogue, puis une chaîne par tâche.** Le catalogue liste les modèles ; en dessous, six chaînes — une par tâche — qui disent dans quel ordre on les essaie.

**Trois états, jamais deux.** *En service* et *éteint* sont la décision d'un humain. *Momentanément injoignable* est le constat d'un disjoncteur automatique. Un modèle peut être **en service ET injoignable** — c'est même l'état où l'on cherche pourquoi rien ne sort. Les fondre en un seul « disponible » ferait attendre une reprise qui ne viendra pas : le premier attend qu'on le rallume, le second se rouvre seul.

**Le fournisseur se répète à chaque rang.** Redondant avec le catalogue, et c'est le but : il faut voir d'un coup d'œil qu'on vient d'aligner trois modèles du même hébergeur — une chaîne qu'une seule panne emporte en entier.

**Les avertissements ne sont pas des erreurs.** Une chaîne de moins de trois rangs est normale : deux fournisseurs seulement produisent des images. Le dessin doit les distinguer d'un refus — c'est une remarque, pas un blocage.

**« Non tarifé » n'est pas « 0 ».** Les tarifs sont vides au départ, volontairement. Un zéro dans un calcul de marge se prend pour un fait.

**Ce qui manque à l'écran** : où chaque modèle sert, pour qu'on voie ce qu'on casse avant de l'éteindre. Le serveur le rend déjà.

---

## 10. L'échec d'une génération — trois cas, trois gestes

Il n'existe nulle part dans le kit, et il arrivera : c'est un appel réseau à un tiers.

| Ce qui s'est passé | Ce qu'on propose |
|---|---|
| Le modèle n'a pas répondu — panne, débit, délai | Réessayer |
| Le modèle a **refusé** la demande | Réessayer ne sert à rien : c'est la demande qu'il faut reprendre |
| Le compte du fournisseur est **à sec** | Ni l'un ni l'autre — rien ne passera avant qu'on recharge |

Le troisième n'est pas théorique : deux des quatre fournisseurs y étaient encore ce matin.

**Ce que le message dit**, et l'ordre compte : ce qui s'est passé, ce qu'on a fait, ce qu'on peut faire maintenant. **Et que les crédits n'ont pas été débités** — c'est la première question de qui vient de voir échouer quelque chose qu'il a payé.

Jamais « une erreur est survenue » : rien n'a échoué du côté de l'utilisateur, et le dire l'enverrait chercher une faute qu'il n'a pas commise.

---

## 11. Deux écarts relevés dans le kit

**`CategoryTag` ne porte pas les catégories du modèle.** Le kit a *Goût, Idée cadeau, No-go, Souvenir, À classer*. Le modèle en compte sept, en deux natures :

- **Durables**, sur la fiche : `interests`, `dislikes_nogo`
- **Ponctuelles**, sur une occasion : `gift_ideas`, `message_ideas`, `facts`, `encouragements`, `challenges`

« À classer » n'existe pas au modèle, et la distinction durable/ponctuelle — qui décide de l'écran où la note vit — n'apparaît nulle part.

**Et une catégorie ne pèse pas comme les autres.** Six organisent l'affichage ; **`dislikes_nogo` contraint ce que le produit propose**. Se tromper de rangement ailleurs coûte un désordre ; se tromper ici fait proposer du vin à quelqu'un qui ne boit pas. Cela mérite peut-être un traitement visuel distinct — à toi de voir.

**Le décompte a une seconde raison de sortir du composant.** Au-delà de la règle de copy : **la notation n'est pas arrêtée**. Elle sera éprouvée par un test utilisateur, avec l'hypothèse d'une forme valable dans les deux langues. Un composant qui fabrique `J−3` fige une décision qui n'est pas prise.

---

## 12. Ce qui reste à produire

- **Seize illustrations** sur vingt-six : attentes et issues, entrée dans l'application, surfaces publiques, back-office. Les dix états vides sont validés.
- **Le portrait** : les trois gabarits, les trois styles de photo, la distribution des motifs.
- **Les écrans nouveaux** : mes listes de souhaits, la liste partagée publique, Réglages.

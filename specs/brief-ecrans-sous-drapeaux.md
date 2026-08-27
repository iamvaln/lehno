# Lehno — les écrans quand une fonctionnalité est éteinte

Pour le designer. Une seule question à trancher, écran par écran : **à quoi
ressemble cette page quand une partie n'est pas là ?**

Ce n'est pas un cas de bord. **Un déploiement neuf crée les quinze drapeaux
ÉTEINTS.** Le premier écran que verra le premier utilisateur est celui-là. En
développement tout est allumé, à dessein, pour qu'on puisse tout toucher — mais
c'est l'inverse qui partira.

---

## 1. Ce que le développement fait déjà, et ce qu'il ne peut pas faire

Le serveur rend **la liste de ce qui est ACTIF**, dépendances déjà résolues. Le
client masque, et ne décide de rien. Techniquement, retirer un bloc est une
ligne.

Ce qu'aucune ligne ne règle : **ce qui reste tient-il debout ?** Une page dont
on retire trois blocs sur cinq n'est pas la même page avec des trous. Elle a
son propre équilibre, ses propres priorités, et parfois son propre message.

C'est ce qu'il nous manque.

---

## 2. Trois façons de retirer, et elles ne se valent pas

**Le bloc disparaît, le reste se resserre.** Le bon défaut quand ce qui part
est un ajout. La fiche d'un proche sans « Portraits » reste une fiche.

**Le bloc disparaît et laisse un mot.** Quand l'absence se remarque et
s'expliquerait mal autrement. À employer avec parcimonie : une page qui
énumère ce qu'elle n'a pas parle de nous, pas du proche.

**L'écran entier ne s'ouvre pas.** Quand la fonctionnalité EST l'écran. Alors
son entrée disparaît aussi — un onglet qui mène à une page absente est pire
que pas d'onglet.

La troisième est facile à décider. Ce sont les deux premières qui demandent
votre œil.

---

## 3. Les endroits qui posent vraiment question

### La fiche d'un proche (§3.4)

Cinq sorties dessinées : **Préparer**, **Ajouter une note**, **Ajouter une
date**, **Faire compléter**, **Portraits**. Deux relèvent de drapeaux —
`collect` et `generation.portrait` —, et « Préparer » mène à la génération.

Tout éteint, il reste : les notes, les intérêts, et « Identité ». La rangée de
trois sorties en bas devient une seule. **Une rangée de trois où il n'en reste
qu'une n'est pas une rangée** — il faut savoir ce qu'elle devient.

### L'accueil (§3.2)

Il compose plusieurs blocs. Lesquels survivent au socle seul ? S'il ne reste
que les échéances qui approchent, l'accueil et la vue Dates disent-ils encore
deux choses différentes ?

### Les crédits (§3.9) — le cas le plus concret

**Au lancement, il n'y aura pas de paiement automatique.** `credits` allumé,
`topup.manual` allumé, `topup.provider` éteint.

Concrètement : pas d'écran de méthodes de paiement, pas d'attente opérateur.
**Le seul chemin est « verser sur le compte affiché, puis déposer son
reçu ».** L'écran doit donc être dessiné pour ce chemin-là comme chemin
principal, pas comme repli d'un autre.

Et si `credits` s'éteint, les deux canaux partent ensemble — mais **les
générations restent disponibles et gratuites** si leur propre drapeau est
allumé. Fermer le paiement ne ferme pas le produit. C'est un écran de crédits
sans achat : à quoi ressemble-t-il ?

### La barre d'onglets

Quels onglets survivent au socle seul ? Une barre qui passe de cinq à deux
change de proportion. Faut-il un autre dessin, ou la même barre plus courte ?

---

## 4. Une règle qui n'est PAS un drapeau, et qui vous concerne

Le formulaire d'événement (§3.6) propose « anniversaire » ou « autre type ».
Le second peut être fermé.

**Ce n'est pas un bloc qui disparaît, c'est un CHOIX qui n'est plus offert.**
Quand il n'en reste qu'un, le sélecteur de type a-t-il encore lieu d'être ? Ou
le formulaire devient-il « ajouter un anniversaire », sans choix à faire ?

**Ce qui existe déjà ne se masque jamais.** Un événement libre créé avant la
fermeture reste lisible, modifiable, et sa date tombe toujours. Le drapeau
ferme la création, pas le passé. La fiche montrera donc des événements d'un
type qu'on ne peut plus créer — c'est voulu, et ça doit se lire normalement.

---

## 5. Ce qu'on vous demande, concrètement

Pas trente maquettes. Pour chacun des quatre endroits du §3 :

1. **Quelle variante** des trois du §2, et pourquoi.
2. **Le dessin de l'état réduit** quand il diffère d'un simple retrait — la
   rangée de sorties, la barre d'onglets, l'écran de crédits sans achat.
3. **Le mot, s'il en faut un** — en français et en anglais, l'anglais étant le
   cas long.

Et une planche que nous n'avons pas : **le socle seul**. Le produit avec les
quinze drapeaux éteints, de bout en bout. C'est ce que verra la première
personne à installer l'application.

---

## 6. Ce que nous tenons déjà

Le côté développement est prêt et éprouvé : la liste vide est le repli de
départ, une clé inconnue vaut éteint, aucune dépendance ne se déduit côté
client, et le socle — proches, notes, dates, occasions, rappels, compte —
répond toujours présent. Les écrans du carnet sont branchés et fonctionnent
avec zéro drapeau.

Ce qui manque n'est pas du code. C'est de savoir si ce qui reste est encore
un produit, ou une page avec des trous. Votre handoff le dit mieux que nous :
**le trou doit rester habitable.**

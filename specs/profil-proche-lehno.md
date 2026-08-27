# Lehno — Ce qui a changé sur le profil d'un proche

Trois décisions prises ensemble, et ce qu'elles touchent. Tout le reste des spécifications est inchangé.

---

## 1. Le genre revient au contrat — mais ailleurs, et pour une autre raison

**On l'avait retiré.** Le motif d'alors : un signal faible, prêt aux clichés, qui ne tenait que par la retenue du client tant qu'il traversait l'interface.

**Ce qu'on avait mal séparé.** Deux besoins distincts se cachaient derrière le même mot :

- **L'accord grammatical.** En français, on n'écrit pas à quelqu'un sans le savoir : *je suis fier* ou *fière*, *tu es le meilleur* ou *la meilleure*. Ce n'est pas un signal, **c'est de la grammaire**. Sans lui, un message est soit fautif, soit contraint à des tournures neutres qui sonnent creux.
- **L'orientation des cadeaux.** Signal faible, celui-là — une note bien prise vaut mieux que lui.

Le retrait visait le second et emportait le premier.

**Il en faut deux.** Celui du proche, et **celui de l'utilisateur** : *je suis fière de toi* dépend de qui écrit, pas de qui reçoit. Toutes les orientations du studio parlent à la première personne.

**Il se demande au studio**, à la première génération pour un proche — « pour écrire correctement : fier ou fière ? ». Là où il sert, jamais dans le carnet. Un champ posé sans raison paraît intrusif ; posé à l'endroit où il sert, il ne l'est pas.

**`unspecified` reste une réponse légitime.** La génération emploie alors des tournures qui s'en passent — jamais un accord au hasard, jamais une double forme entre parenthèses.

**Où c'est écrit** — `dictionnaire` (`Person.gender`, `User.gender`) · `ux-app-mobile` §3.7 · `spec-technique` §5.4 · `spec-portrait` §4.1

---

## 2. Le topo d'un proche, extrait des notes

**Ce qu'on cherchait** — voir en un regard ce qui caractérise quelqu'un, plutôt que de lire une liste de notes rangées par catégorie.

**Ce qui a débloqué la question** : la passe qui **classe déjà chaque note en arrière-plan** peut en extraire au passage ce qui caractérise la personne. **Aucun appel de plus** — les mêmes valeurs de sortie, quelques champs supplémentaires.

C'est ce qui distingue cette synthèse du résumé qu'on avait écarté pour la carte d'accueil : là il fallait *composer* un texte, ici il n'y a qu'à *extraire*.

**Nouvelle entité `PersonAttribute`** — onze natures : couleur, animal, plat, boisson, taille de vêtement, pointure, parfum, style, loisir, **métier**, ce qu'il faut éviter.

**Trois règles**

- **Aucun formulaire ne les demande.** Ils naissent des notes ; corriger, c'est écrire une note nouvelle. La capture reste libre, la structure vient après.
- **Le plus récent l'emporte** — unicité sur (personne, nature). Une couleur mentionnée en mars puis une autre en septembre : c'est la seconde qui s'affiche, avec sa date.
- **Chaque attribut garde sa provenance** — la note d'où il vient, et sa date. Un appui y ramène.

**Côté écran** — un bloc en tête de fiche. **Ce qui manque ne paraît pas** : une fiche neuve n'affiche aucun bloc, jamais une grille de cases vides. Et la composition doit tenir **avec deux attributs comme avec dix**.

**La couleur préférée sert les idées de cadeaux, pas le portrait.** L'image se compose dans la palette de la marque ; une couleur personnelle qui la gouvernerait casserait ce qui rend un portrait reconnaissable.

**L'animal devient une valeur sûre.** Le brief d'illustration disait « un animal qu'il aime s'il figure dans les notes » — cela dépendait d'une extraction incertaine à chaque génération. C'est désormais un attribut.

**Où c'est écrit** — `dictionnaire` (`PersonAttribute`) · `ux-app-mobile` §3.4 · `spec-technique` §5.2 (`/me/persons/{id}/attributes`) · `spec-portrait` §4.2

---

## 3. La date de naissance appartient au proche

**Elle vit sur `Person`** (`birth_date`, `birth_year_known`), plus sur le planning de l'événement. **L'anniversaire s'en déduit.**

**Le motif** — `year_known` était accroché au mauvais objet. C'est la **naissance** dont on ignore l'année ; l'anniversaire, lui, a toujours lieu cette année.

**Deux conséquences**

- Elle se saisit **une seule fois**, dans le formulaire d'identité du proche. Le formulaire d'événement ne la redemande plus.
- L'**âge** devient une propriété de la personne, disponible pour orienter les idées de cadeaux, plutôt qu'une déduction depuis un événement.

**Où c'est écrit** — `dictionnaire` (`Person`, `Schedule`) · `ux-app-mobile` §3.6, §3.18 · `doc-fonctionnelle` (glossaire)

---

## 4. Ce que ça change par surface

| Surface | Ce qui bouge |
|---|---|
| **App — fiche d'un proche** | Le bloc du topo en tête. La date de naissance entre dans le formulaire d'identité |
| **App — ajout d'un événement** | L'année ne se saisit plus ici : elle vient de la fiche |
| **App — studio** | Une question posée une fois, à la première génération : de quoi accorder le texte |
| **Serveur — classement** | La même passe extrait les attributs. Nouveau point d'entrée `/me/persons/{id}/attributes` |
| **Serveur — génération** | Le serveur ajoute à la demande les deux genres et les attributs extraits |
| **Design** | Un bloc nouveau à composer, qui tient avec deux attributs comme avec dix |
| **Portrait** | Le message s'accorde ; l'illustration prend l'animal comme valeur sûre |

**Rien ne bouge** sur les surfaces publiques, le back-office, le paiement, les drapeaux, l'identité visuelle.

---

## 5. Deux précisions au passage

**L'unicité partielle sur `credit_transaction.payment_id`** porte **là où `type` vaut `purchase`** — sans cette condition, un remboursement rattaché au même paiement violerait la contrainte.

**Le brief du logo** parle désormais de « l'image d'un portrait (où le pied de marque s'inscrit) » plutôt que d'« une photographie quelconque » — le portrait étant devenu une image et non une page.

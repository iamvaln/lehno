# Lehno — Brief design : la liste de souhaits partagée

Deux surfaces, une même page : **le web public** (celui qui reçoit le lien et n'a pas l'application) et **l'application mobile** (celui qui l'a déjà). Le contenu est identique, le cadre diffère.

C'est la page la plus exigeante du produit. Elle est vue par des gens qui **ne connaissent pas Lehno**, souvent une seule fois, et c'est elle qui décide s'ils installent l'application.

---

## 1. Ce que la page doit provoquer

Trois choses, dans cet ordre — et si l'une manque, la page a échoué.

1. **Reconnaître la personne.** « C'est Awa qui m'envoie ça. »
2. **Trouver quoi offrir**, sans hésiter longtemps.
3. **Réserver**, en comprenant ce qu'on obtient : ce cadeau est à moi, personne d'autre ne l'offrira.

Et une quatrième, qui décide de la croissance : **avoir envie d'en faire autant.**

---

## 2. La personne d'abord, la liste ensuite

On arrive parce que **quelqu'un** nous a envoyé un lien — pas parce qu'on cherchait des idées de cadeaux.

L'en-tête doit donc accueillir **avant** de montrer des objets : la photo, le prénom, l'occasion et sa date. Le décompte s'il approche. Une page qui ouvre sur une grille de produits ressemble à un catalogue, et le lien n'était pas un catalogue.

**Le ton** — c'est la personne qui parle, à la première personne, comme sur le Mur : *« Voilà ce qui me ferait plaisir »*, jamais *« Liste de souhaits de Awa Diop »*.

---

## 3. Les souhaits sont des objets, pas des lignes

Chaque souhait porte une photo, un prix indicatif, des précisions (taille, couleur, où le trouver), parfois un lien. Une ligne de tableau ne rend pas ça.

**Ce qu'il faut donner à voir** — l'objet, son prix, et ce qui aide à décider. Ce qui est secondaire (les précisions, le lien) peut attendre un geste.

**Les listes ne se ressemblent pas.** Une liste de trois souhaits n'appelle pas la même mise en page qu'une de vingt. Trois cartes larges, vingt en grille. La composition doit s'adapter au nombre, plutôt que d'imposer une grille qui paraît vide à trois.

**Sans photo non plus.** Beaucoup de souhaits n'en auront pas. Un souhait sans image doit rester digne — pas un cadre gris avec une icône d'appareil photo. Le titre et le prix suffisent à faire un objet, si la composition les traite comme tels.

**L'ordre appartient au propriétaire.** Il a rangé sa liste ; la page respecte ce rangement.

---

## 4. Réserver, sans que ça fasse peur

C'est le geste que la page existe pour provoquer. Il demande une adresse e-mail et un code à saisir — deux frictions qu'il faut assumer sans les alourdir.

**Dire pourquoi.** L'adresse sert à **retenir le cadeau** et à reconnaître le visiteur s'il revient, pas à l'inscrire quelque part. Une phrase suffit, et elle évite l'abandon.

**Aucun compte demandé.** Il faut que ce soit évident **avant** de saisir quoi que ce soit, pas découvert après.

**Le choix de se faire connaître** est une case, pas une question. Par défaut la réservation reste anonyme aux yeux du propriétaire ; celui qui veut se nommer coche.

**Le code se saisit dans la page.** On ne quitte pas, on n'attend pas un lien à suivre. Cet écran d'attente courte mérite du soin : c'est le moment où l'on peut perdre quelqu'un qui était prêt à offrir.

**Ce qu'on obtient doit être clair.** Après confirmation, le visiteur voit que **son** cadeau est retenu — et le reconnaît s'il revient plus tard, depuis le même navigateur.

---

## 5. Ce qui est déjà pris

Un cadeau réservé **reste visible** — c'est ce qui évite les doublons, donc la raison d'être du mécanisme.

Il s'efface sans disparaître : plus discret, sans action, mais lisible. **Jamais barré comme une erreur.**

**Et jamais par qui.** Sauf si le réservant a choisi de se nommer, auquel cas seul le propriétaire le voit — pas les autres visiteurs.

**Le visiteur revenu retrouve les siens**, signalés à lui seul.

---

## 6. « Faire ma part »

C'est le vrai enjeu de la page, et **il ne doit pas ressembler à une publicité collée en pied**.

Le bon moment est **après le geste** : quelqu'un qui vient de réserver a compris à quoi ça sert. C'est là que l'invitation trouve sa place, plutôt qu'en bandeau permanent.

Le ton suit le reste — *« Faites la vôtre »*, pas *« Téléchargez l'application »*.

---

## 7. Les deux cadres

**Sur le web** — la page se lit d'abord sur un téléphone, puisque c'est par là qu'arrivent les liens partagés. Elle s'ajuste au grand écran sans s'étirer : le contenu garde une largeur de lecture confortable.

Elle porte l'**aperçu de lien** (1200 × 630) : le prénom de celui qui partage, l'occasion. C'est ce qu'on voit avant de cliquer, et ça décide du clic.

**Dans l'application** — même page, cadre plus fluide. Un utilisateur connecté est **reconnu** : il réserve en un geste, sans adresse ni code. Et s'il ouvre son propre lien, l'application le ramène à sa liste plutôt qu'à la vue publique.

**Les deux thèmes** s'appliquent : clair et sombre, rejoués comme le reste.

---

## 8. Les états

- **Liste vide** — le propriétaire a partagé avant d'avoir ajouté quoi que ce soit. Ça arrivera. La page doit rester accueillante et proposer de revenir.
- **Tout est réservé** — plus rien à offrir. Le dire simplement, sans que la page paraisse cassée.
- **Occasion passée** — la liste s'affiche, sans accepter de réservation.
- **Liste dépubliée, lien révoqué** — un message d'état, sans reproche.

---

## 9. Ce qu'il faut éviter

- **Le catalogue.** Cette page vend l'attention qu'on porte à quelqu'un, pas des produits.
- **La pression** — ni compte à rebours anxiogène, ni « plus que 2 disponibles ! ».
- **Le formulaire au premier plan.** On réserve un cadeau, on ne remplit pas un bon de commande.
- **Les prix mis en avant.** Ils informent, ils ne classent pas. Personne ne doit se sentir jugé sur ce qu'il peut offrir.

---

## 10. Comment juger

1. **En trois secondes** — sait-on de qui vient cette page et pourquoi on l'a reçue ?
2. **Avec trois souhaits, puis vingt** — la composition tient-elle dans les deux cas ?
3. **Sans aucune photo** — la page reste-t-elle belle ?
4. **Après avoir réservé** — a-t-on envie de faire la sienne ?

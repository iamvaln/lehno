# Lehno — Ce qu'il faut reprendre dans les lots livrés

Revue des cinq lots mobiles contre la spécification UX (§3.1 à §3.29), le contrat commun et le dictionnaire de données, au 26/08/2026.

**Les écrans sont bons.** Le rythme vertical, les 44 px partout, les états non nominaux dessinés plutôt que laissés à inventer, « aucun geste muet » : c'est du travail sérieux, et plusieurs décisions y sont meilleures que la spécification qu'elles remplacent. Cette note ne parle que de ce qui reste à reprendre.

Elle est classée par **conséquence**, pas par écran.

---

## 1. Un souhait de proche ne doit pas pouvoir devenir public

**Lot** : `mobile app.zip` — `SouhaitScreen.jsx`
**Gravité** : c'est une fuite de vie privée, pas un défaut d'ergonomie.

L'écran reçoit `{ t, etat, souhait, nouveau, onOpen, onRetour, onRetirer, onFait, onEnregistrer }`. **Rien ne lui dit de quel souhait il s'agit.** Or `ListesScreen` l'ouvre de la même façon — `onOpen("souhait", s)` — depuis ses deux modes : mes listes, et la liste d'un proche.

L'écran porte un interrupteur, que son propre commentaire décrit comme « le geste le plus conséquent de l'écran : il rend un souhait public » :

> **Visible sur la liste** — *Les personnes qui ont le lien le verront.*

Le contrat commun désigne ce point comme « le plus facile à implémenter de travers, des deux côtés » :

| | Souhait d'un proche | Mon souhait |
|---|---|---|
| Ce que c'est | Ce qu'un proche m'a confié | Mon souhait, sur ma liste |
| Visibilité | **Privé — moi seul** | Public, c'est sa raison d'être |
| Action | Je **marque** — un repère personnel | On **réserve** |
| Partage | **Jamais** | Oui |

Un souhait de proche est ce qu'il m'a dit. Le marquer le remonte en tête de mes suggestions à la préparation ; **personne d'autre ne le voit, et ça n'engage à rien**. L'interrupteur actuel, avec cette phrase, le publierait.

**À reprendre**
- L'écran prend un mode explicite — le souhait est le mien, ou celui d'un proche.
- Deux copys, pas une. « Visible sur la liste · les personnes qui ont le lien le verront » d'un côté ; de l'autre quelque chose comme « Retenu · pour vous seul, remonte en tête à la préparation ».
- Sur un souhait de proche, **aucun chemin de partage**. Ni interrupteur public, ni bouton.

**Pourquoi ça ne se rattrapera pas au développement** : c'est le même contrôle, au même endroit, avec la même phrase, pour deux sens opposés. Rien dans le code ne dira lequel est en train de s'afficher.

---

## 2. La suppression du compte manque presque entièrement

**Lot** : `mobile app.zip` — `CompteScreens.jsx`, écran *Mes données*
**Gravité** : un engagement d'argent et une protection contre l'irréversible.

L'écran porte trois phrases :

> « Supprimer mon compte » · « Vos fiches, vos notes et votre Mur partent avec. » · « Un e-mail confirme la suppression. »

§3.24 en demande **trois temps**, et chacun protège quelque chose de précis.

**Premier temps — ce qui disparaît.** La liste, sans détour : les fiches et leurs notes, les dates, les souhaits, les portraits et messages produits, le Mur et les vœux reçus. Et deux phrases que la version actuelle ne dit pas : **les liens publics partagés cessent de répondre**, et **ce qui a déjà été envoyé à d'autres ne revient pas**.

**Deuxième temps — le solde et la raison du départ.** S'il reste des crédits **achetés**, leur **remboursement est proposé** sur une méthode enregistrée. Deux conditions le protègent : la méthode doit avoir été enregistrée **depuis plus de deux semaines** et avoir **déjà servi à un paiement**. Quand aucune ne les réunit, l'écran l'explique et oriente vers l'assistance — la suppression peut se poursuivre ou attendre. Les crédits **offerts** ne se remboursent pas.

L'écran demande aussi, **facultativement**, la raison du départ : quelques motifs et un champ libre, qu'on passe d'un geste.

**Troisième temps — confirmer.** Saisir **son pseudo**, puis **un code à usage unique reçu par e-mail**.

**Et le délai de grâce de trente jours.** La suppression confirmée, le compte est *désactivé* : plus de connexion, les surfaces publiques cessent de répondre, les rappels s'arrêtent. Les données sont conservées **trente jours**, puis effacées. Pendant ce délai un retour reste possible en écrivant à l'assistance — **l'écran de confirmation et l'e-mail doivent tous deux donner l'adresse**.

**Ce que l'absence coûte, concrètement**
- Sans le pseudo et le code, une suppression part d'un appui.
- Sans la mention des trente jours, l'utilisateur croit l'effacement immédiat et définitif — et n'écrit pas à l'assistance qui aurait pu le rendre.
- Sans le remboursement, on garde l'argent de crédits achetés et jamais consommés.

**Un choix de rangement à trancher.** Le lot déplace la suppression de *Sécurité* vers *Mes données* — « la suppression du compte vit avec les données, pas avec les identifiants ». Le raisonnement se défend et la spécification suivra. Mais §3.24 tenait ensemble la suppression, le remboursement et les moyens de connexion : si la suppression déménage, **le remboursement déménage avec elle**, pas ailleurs.

---

## 3. L'écran du code n'a pas son état « compte existant »

**Lot** : `Onboarding Lehno App.zip` — `CodeScreen.jsx`
**Gravité** : deux lots se contredisent, et c'est le plus ancien qui est livré.

Le lot onboarding enchaîne cinq écrans dans l'ordre : Ouverture · Connexion · Code · **Pseudo** · Bienvenue. Le code a trois états : nominal, erreur, code expiré.

Le lot `mobile app.zip`, plus récent, annonce dans ses corrections :

> **Le pseudo est sorti du chemin de connexion** : l'écran du code a un état « compte existant » qui mène droit à l'accueil.

Cet état n'est dessiné nulle part.

**Le serveur fait déjà exactement ce que le lot récent décrit** : la vérification du code répond soit « session ouverte » pour un compte existant — donc droit à l'accueil —, soit « à inscrire » pour un nouveau, qui seul passe par le pseudo. Il n'y a rien à changer côté API ; il manque un état d'écran.

**À reprendre** : le quatrième état de `CodeScreen`, et le mot du README qui dit que le pseudo n'est plus sur le chemin de tout le monde.

---

## 4. Les rappels ne règlent qu'une nature sur cinq

**Lot** : `mobile app.zip` — `CompteScreens.jsx`, écran *Rappels*

L'écran règle **quand** (J-7, J-1, le jour même) et **comment** (notification, e-mail). Le refus système y est parfaitement traité — bandeau d'emblée, ce qui prend le relais, bouton pour réactiver. C'est mieux que ce que la spécification décrivait.

Mais §3.11 demande un réglage **par nature**, chacune avec son canal :

| Nature | Ce qu'elle règle |
|---|---|
| Rappel d'échéance | ✅ dessiné |
| **Récapitulatif** | ❌ manque — avec sa **fréquence** : chaque mois, chaque semaine, ou jamais |
| **Contributions à valider** | ❌ manque — un proche a répondu, un vœu est arrivé |
| **Relances** | ❌ manque — une fiche gagnerait à être enrichie ; désactivable |
| **Vie du compte** | ❌ manque — crédits, parrainage, sécurité |

Deux règles vont avec :
- **Les messages de sécurité arrivent toujours**, quel que soit le réglage. L'écran doit le dire, sinon on croit pouvoir les couper.
- **Tous les canaux d'une nature coupés** : l'écran signale que ces messages ne parviendront plus. C'est l'état qu'on oublie et qui laisse quelqu'un sans rappel sans le savoir.

**Il manque aussi l'heure d'envoi.** « L'utilisateur choisit à quel moment de la journée les rappels lui parviennent, dans son fuseau horaire. » Le champ existe déjà côté serveur ; l'écran ne l'expose pas.

**Un point où le dessin gagne, et où c'est le modèle qui suivra.** Les trois cases J-7 · J-1 · jour même valent mieux que le « délai d'anticipation » unique de §3.6 et §3.11 — on veut plusieurs rappels, pas un seul plus tôt. Mais le modèle de données ne tient qu'un délai. **Ne changez rien** : c'est au serveur de porter un ensemble. Signalé pour que personne ne « corrige » le dessin en croyant l'aligner.

---

## 5. Deux écrans que le lot déclare lui-même manquants

Le lot `mobile app.zip` les nomme dans son README, ils sont repris ici pour mémoire.

- **Créer une wishlist** — nom, occasion, date de clôture. La liste s'ouvre et s'allonge, mais rien ne la crée. §3.29 : « Aucune occasion à moi (l'écran propose d'en créer une). »
- **Modifier un souhait existant** — l'édition réutilise le formulaire de création ; l'écran avec ses valeurs en place reste à faire.

---

## 6. L'écran de maintenance : un lien sans destination

**Lot** : `maintenance_mobile.zip`

L'écran est juste — l'attente est un mois qui se remplit plutôt qu'un sablier, le mouvement se coupe sans casser la mise en page, « Réessayer » reste en contour parce que le résultat ne dépend pas de l'utilisateur. Et il ne se confond pas avec l'absence de réseau, ce qui est précisément le piège.

Deux points :

- **« Voir l'état du service » ne mène nulle part.** Il n'y a pas de page d'état. Soit on en ouvre une, soit le lien disparaît — un lien mort sur l'écran qui dit « le service est en panne » est le pire endroit possible.
- **L'heure de retour** : côté serveur, je ne sais aujourd'hui rendre qu'un délai avant de réessayer, jamais une heure annoncée. **C'est mon travail, pas le vôtre** — l'écran a raison de prévoir les deux états, et je pose le champ qui manque. Gardez « sans heure de retour » : « pas de "bientôt", pas d'estimation inventée » est la bonne règle.

---

## 7. La numérotation des sections a divergé

`ux-app-mobile-lehno.md` s'arrête à **§3.29** (Mes listes de souhaits).

- Le lot `mobile app.zip` annonce « §3.6, 3.9 à **3.31** » — §3.30 et §3.31 n'existent pas dans la spécification écrite.
- Le lot maintenance cite « **(3.29)** » pour son écran — ce numéro désigne les wishlists.

Ce n'est pas cosmétique : le mobile et le serveur naviguent par ces numéros. J'ai lu « 3.29 » en croyant lire les listes de souhaits.

**À faire** : dire quelles sections ont été ajoutées côté design, pour qu'elles soient écrites dans la spécification avec leur vrai numéro — la maintenance en premier, qui n'a **aucune** section aujourd'hui.

---

## Ce que je ne demande pas de changer

Ces points divergent de la spécification, **et c'est le dessin qui a raison**. Ils sont listés pour que la documentation soit mise à jour, pas les écrans.

- **La ligne de l'annuaire.** §3.3 demande un tag du type d'échéance sur toutes les lignes, plus la date et le décompte. Le lot montre le décompte de notes, la date, et le décompte **seulement s'il presse**. La raison donnée est juste : « sans quoi cette liste redirait l'onglet Dates avec d'autres pixels ». Le serveur suit déjà le dessin.
- **Les deux vues de Dates.** §3.14 décrit une liste plafonnée à cinq avec un « voir plus » sous le calendrier. Le lot en fait deux vues pleines, la liste groupée par mois. Meilleur.
- **La langue quitte le profil** pour la ligne des Réglages ; **l'anniversaire et les goûts quittent le Mur** pour le profil. §3.23 et §3.10 disent encore l'inverse.
- **La suppression déménage** de Sécurité vers Mes données (voir le point 2).

---

## Et ce qui est remarquable

À signaler parce que ça n'arrive pas tout seul.

- **Le contrôle du genre est mécanique**, pas humain — « la règle s'est fait contourner trois fois de suite par de la relecture ». Les cinq lots ne contiennent le mot que dans le commentaire qui l'interdit. Le serveur a pris la même décision de son côté, sans concertation : le champ est sorti du contrat, il n'est plus seulement « non demandé », il est inécrivable.
- **Aucune chaîne hors du dictionnaire, et aucun repli français** — « un appel qui oublie `t` plante au lieu de s'afficher dans la mauvaise langue ». C'est le pendant exact de la règle serveur : des codes d'erreur, jamais des phrases.
- **L'expiration d'un paiement** est dessinée. C'est l'état que tout le monde oublie, et sans lui une somme reste inexpliquée.
- **Le lien de vœux porte son état fermé.** Hors fenêtre, il n'accepte plus de messages, et l'écran le dit.

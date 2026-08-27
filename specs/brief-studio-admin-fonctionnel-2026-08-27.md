# Lehno — Le Studio d'administration : ce qu'il fait

Pour qui l'implémentera. Le dessin des écrans vit dans `brief-studio-design-2026-08-27.md` ; ce document dit les règles.

> **Deux choses s'appellent « studio » dans ce dépôt, et ce n'est pas la même.**
>
> - Le **studio de l'utilisateur** — `spec-portrait-lehno.md` §2 : ce qu'un utilisateur règle avant de lancer sa génération.
> - Le **Studio d'administration** — `ux-admin-lehno.md` §5.9 : ce qu'un administrateur règle pour tout le monde. **C'est celui-ci.**
>
> Le premier consomme ce que le second publie. C'est leur seul lien, et il passe par `/me/studio/options`.

Ses règles existaient, éparpillées entre `ux-admin-lehno.md` §5.9, le dictionnaire de données et le brief de design. Aucune ne disait ce que le Studio **fait**. Ce document les rassemble et tranche ce qui manquait.

---

## 1. Le principe, et sa conséquence sur le modèle

**Prévisualiser est le geste qui enregistre.** Tant qu'on n'a pas généré, rien n'est retenu.

La conséquence n'est pas cosmétique : **un brouillon ne se modifie pas, il se rejoue.**

Chaque prévisualisation crée une **nouvelle** `StudioConfig` en `draft`, et fait passer la précédente à `superseded`. On ne mute jamais une ligne existante.

> **Pourquoi ça compte.** Si le brouillon était une ligne mutable, un essai lancé avant une modification resterait rattaché à la même ligne après. La règle « rien ne se publie sans essai » serait alors satisfaite par un essai qui ne parle plus de rien — on publierait sur la foi d'un résultat obtenu avec une autre consigne. Le contournement n'aurait besoin d'aucune mauvaise intention.
>
> En chaînant, chaque ligne est un état que quelqu'un a vu tourner. La règle devient vraie par construction, et l'historique des tentatives existe sans qu'on l'écrive.

**Ajustement à reporter au dictionnaire.** `StudioConfig.version` y est décrit comme s'incrémentant « à chaque publication ». Avec le chaînage, une ligne `draft` naît sans version : le numéro s'attribue **à la publication**, et lui seul est unique. Une ligne jamais publiée n'en porte pas.

---

## 2. Les états d'une configuration

| État | Ce qu'il signifie |
|---|---|
| `draft` | Le dernier état prévisualisé. **Au plus un à la fois** par studio |
| `published` | En service. **Exactement un** — index unique partiel |
| `superseded` | A été `draft` ou `published`, ne l'est plus. Conservé |

**Rien ne se supprime.** Un état dépassé reste : c'est ce qui permet le retour arrière et ce qui explique, trois semaines plus tard, pourquoi les productions d'une semaine valaient mieux que celles de la suivante.

---

## 3. Deux familles de paramètres

`settings` se lit en deux parties, et elles n'obéissent pas à la même règle.

| Partie | Contenu | Règle |
|---|---|---|
| **Lue par le modèle** | Consigne, garde-fous, motif identitaire, modèle appelé par production, champs du proche retenus, gabarits | **Passe par une prévisualisation** |
| **Lue par l'application seule** | Libellés dans les deux langues, ordre des orientations, activation d'une orientation ou d'une ambiance | Enregistrement direct |

> **Pourquoi l'exception.** Régénérer pour enregistrer un ordre d'affichage produirait une image identique à la précédente. On demanderait de valider un résultat qui ne prouve rien — et une validation qui ne prouve rien s'apprend très vite à cliquer sans regarder. La règle s'userait par son propre excès de zèle, et le jour où elle protège vraiment, personne ne la lirait plus.

**Conséquence sur le contrôle de publication** : il ne porte pas sur `settings` entier, mais sur **l'empreinte de la partie lue par le modèle**. Un changement de libellé crée bien une nouvelle ligne, mais celle-ci hérite de la couverture d'essai de la précédente, puisque l'empreinte n'a pas bougé.

---

## 4. L'essai

Un `StudioTrial` porte `studio_config_id` : **il est lié à un état précis**, jamais au studio en général.

Il sert la décision et jamais un utilisateur. Il ne consomme aucun crédit, ne touche aucun compte réel, et son profil ne correspond à personne.

**La règle de publication, énoncée exactement :**

> Une configuration se publie s'il existe au moins un `StudioTrial` en `status = success` sur une configuration dont **l'empreinte de la partie lue par le modèle** est identique à la sienne.

Trois précisions que « rien ne se publie sans essai » laissait ouvertes :

- **Un essai en échec ne compte pas.** Un `error` ou un `timeout` ne prouve rien sur ce que le réglage produit.
- **Un essai sur n'importe quel profil compte.** Exiger un profil sensible serait défendable — voir §9, ce n'est pas tranché.
- **L'essai peut venir d'un état antérieur**, à empreinte identique. C'est ce qui rend §3 praticable.

---

## 5. La publication

Elle se fait depuis l'établi, jamais depuis un écran de lecture : on publie après avoir vu un résultat, pas après avoir tapé un texte.

Ce qu'elle fait, en une transaction :

1. La configuration publiée en service passe à `superseded`.
2. Le `draft` courant passe à `published`, reçoit son `version`, son `published_at`, son `published_by_admin_id`.
3. Il n'y a **plus de brouillon** ensuite. Le suivant naîtra de la prochaine prévisualisation.

L'ordre compte : l'index unique partiel n'admet qu'une seule ligne `published`, et refuserait l'insertion dans l'ordre inverse.

**`note` est obligatoire** — « ce que cette publication change, en une ligne ». Une publication sans note rend l'historique illisible au bout de dix versions, et c'est précisément à ce moment qu'on en a besoin.

---

## 6. Le retour arrière

**Il republie une version antérieure sans la reconstruire.** Une ligne `superseded` redevient `published` ; celle qui l'était passe à `superseded`.

Ce que la spec laissait ouvert, et qui est tranché ici :

- **Il ne vise que des états ayant été publiés.** Revenir sur un brouillon abandonné n'a pas de sens : il n'a jamais servi personne.
- **Il ne crée pas de nouvelle version.** C'est la même qui revient, avec son numéro. L'historique l'enregistre comme un **événement**, pas comme une version de plus — sinon le numéro de version cesse de désigner un contenu.
- **Il ne touche pas au brouillon en cours.** Un administrateur qui revient en arrière pendant que quelqu'un compose ne doit pas effacer son travail.
- **Il exige un motif**, comme toute action sensible (§6 de `ux-admin-lehno.md`).

---

## 7. Ce qui est journalisé

| Geste | Journal d'audit | Motif exigé |
|---|---|---|
| Publication | oui | oui — c'est la `note` |
| Retour arrière | oui | oui |
| Prévisualisation *(essai)* | non | non |

**Un essai n'est pas une action sensible.** Il ne change rien pour personne : ni compte, ni solde, ni contenu public. Lui imposer un motif ferait taper une phrase à chaque tour d'une boucle qui en compte trente, et la phrase serait vide.

Il laisse trace ailleurs, et c'est suffisant :

- Une ligne `StudioTrial` — son état, son coût réel, son auteur, son profil.
- Une ligne `AIUsage` avec `origin = studio_trial` et `action_run_id` nul.
- L'événement de mesure `studio_trial.run` ; la publication émet `studio_config.published`.

C'est ce qui permet de lire, après coup : *jeudi, adminA — six appels pour la configuration du studio, trois sur un modèle, deux sur un autre, un sur un troisième*, puis l'agrégat du mois.

---

## 8. Le lien avec l'application

`/me/studio/options` rend **ce que la configuration en service expose** : orientations et ambiances actives, valeurs par défaut, prix.

Trois règles :

- **Un brouillon n'atteint jamais un utilisateur.** La route ne lit que l'état `published`.
- **Désactiver une orientation la fait disparaître de l'application sans livraison.** C'est tout l'intérêt du catalogue en base.
- **Une génération en cours garde la configuration avec laquelle elle a commencé.**

Le troisième point est le seul de ce document qui puisse produire un défaut visible par un client, et il n'était écrit nulle part. Si une publication tombe pendant qu'une génération tourne, changer de configuration en vol produirait un portrait qui ne correspond ni à l'ancienne ni à la nouvelle — un message écrit sous une consigne, une image sous une autre. La production retient donc son `studio_config_id` au démarrage, comme elle retient déjà son `prompt_template_id`.

---

## 9. Ce qui reste à trancher

**Le plafond quotidien d'essais.** Le dictionnaire prévoit `SystemParameter` `studio_trial_daily_cap`. Le brief de design retire tout compteur de l'écran — la dépense se lit ailleurs, après coup. Reste à décider si le plafond **bloque** encore côté serveur, sans être affiché. Je recommande de le garder : ne pas montrer une dépense n'est pas la même chose que ne pas la borner, et un appel en boucle par erreur coûte de l'argent réel.

**L'essai sur un cas sensible.** `StudioProfile.is_sensitive` existe, et la couverture exigée par le dictionnaire nomme « au moins un cas sensible » — parce que c'est celui qui révèle si un gabarit dérape. Faut-il durcir la règle de publication en *« au moins un essai réussi sur un profil sensible »* ? Un essai sur une fiche riche et sympathique ne prouve rien de ce qu'on craint. Non tranché.

---

## 10. Ce que ce document change

| Où | Ce qui était écrit | Ce qui vaut désormais |
|---|---|---|
| `ux-admin-lehno.md` §5.9 | Trois entrées — réglages, composition, banc d'essai | **Deux écrans** : lecture de ce qui tourne, et l'établi |
| Dictionnaire, `StudioTrial` | « L'écran affiche son coût et le cumul du jour » | **Aucun compteur à l'écran.** Le prix estimé reste, comme fiche technique du modèle |
| Dictionnaire, `StudioConfig` | `version` s'incrémente à chaque publication | Une ligne `draft` naît **sans version** ; le numéro s'attribue à la publication |
| Dictionnaire, `StudioConfig` | « Un brouillon se modifie librement » | Un brouillon **se rejoue** : chaque prévisualisation en crée un et dépasse le précédent |
| — | « Rien ne se publie sans essai » | Énoncé exactement : essai **réussi**, sur l'**empreinte de la partie lue par le modèle** |

# Lehno — Spécification UX : application mobile

## Introduction

Lehno est un assistant personnel des dates qui comptent : les anniversaires et les événements importants de nos proches. Il poursuit trois objectifs d'égale importance — ne pas oublier le jour J, ne pas oublier d'envoyer un mot, et aider à bien célébrer.

Ce document décrit l'expérience de l'**application mobile**, qui est l'outil privé de la personne qui tient ses dates (désignée ici par « l'utilisateur »). Il couvre le parti pris de conception, puis, écran par écran, le rôle de chaque vue, son contenu, les actions possibles et les états particuliers, ainsi que les grands parcours. Le détail du dessin (palette, caractères, tracés) relève de la planche d'identité visuelle ; l'implémentation, de la spécification technique.

Les surfaces web (page d'accueil publique, formulaires de collecte, mur public, portrait partageable) font l'objet d'un document distinct. Le modèle de données et les règles métier sont détaillés dans la documentation fonctionnelle et le dictionnaire de données.

## Glossaire

Ces termes reviennent tout au long du document.

- **Utilisateur** — la personne qui possède un compte Lehno et s'en sert pour suivre les dates de ses proches.
- **Fiche** — la page dédiée à un proche : ce que l'utilisateur sait de lui et prépare pour lui.
- **Note** — une information en texte libre saisie sur un proche (une idée, un goût, un souvenir). Les notes sont rangées automatiquement dans des **catégories** : idées de cadeaux, faits marquants, centres d'intérêt, choses à éviter, etc.
- **Événement** — une occasion rattachée à un proche : un anniversaire (qui revient chaque année) ou un autre événement daté.
- **Échéance** — une date précise à venir. Pour un anniversaire, c'est l'édition de l'année en cours : l'anniversaire 2026 est distinct de celui de 2027, et chaque édition regroupe ce qui la concerne cette année-là (souhaits, message, vœux reçus).
- **Événement sensible** — une occasion solennelle (par exemple l'anniversaire d'un décès) : Lehno en adapte le ton et ne propose pas d'idée de cadeau.
- **Rappel** — une alerte envoyée avant une échéance (par e-mail et par notification), pour ne pas l'oublier.
- **Relance** — une invitation discrète à enrichir une fiche peu remplie, ou à préparer une échéance qui approche.
- **Collecte** — le fait d'inviter un proche, via un lien, à compléter une fiche (sa date, ses souhaits, un mot). Ce qui est reçu passe toujours par une **validation** de l'utilisateur avant d'entrer dans la fiche.
- **Mur** — la page publique et personnelle de l'utilisateur (« Mon Mur ») : il y expose, s'il le souhaite, ses goûts et ses souhaits, et ses proches peuvent y laisser des messages d'anniversaire.
- **Vœu reçu** — un message d'anniversaire laissé par un tiers sur le Mur de l'utilisateur.
- **Génération** — les contenus produits à l'aide de l'intelligence artificielle : un portrait du proche, des idées de cadeaux, un brouillon de message. Ce sont les actions payantes de l'application.
- **Crédits** — la monnaie interne : chaque action payante coûte des crédits, que l'utilisateur reçoit à l'inscription ou achète ensuite.
- **Registre** — le niveau de familiarité du langage adapté à un proche (familier, amical, formel), qui oriente le ton des messages générés.
- **Utilisateur dormant** — une personne qui a installé l'application et y a déjà fait quelques actions (consulter un Mur, répondre à une collecte), mais n'a pas encore créé de compte. L'un des enjeux de l'application est de la convertir en utilisateur actif.

*Correspondance avec le modèle de données* (pour les équipes techniques) : fiche = `Person`, échéance = `EventOccurrence`, souhait = `WishlistItem`, vœu reçu = `ReceivedWish`, soumission de collecte = `Submission`. Le détail figure dans le dictionnaire de données.

## 1. Périmètre et principes

L'application a un **utilisateur principal** : la personne qui tient à ne rien oublier des dates importantes de ses proches et à bien les célébrer — celle pour qui Lehno est d'abord conçu. Pour elle, une fois connectée, l'application est un **espace privé** : ses fiches, ses notes, la validation des contributions et la génération n'existent que pour elle. L'application accueille néanmoins d'autres personnes : les proches qui complètent une fiche ou déposent un vœu, et celles qui l'ont installée sans avoir encore créé de compte — un public que l'application cherche justement à convertir (voir plus bas).

Mais l'application ne se limite pas à ce rôle privé : elle **affiche aussi les surfaces publiques** — le Mur d'un proche, un formulaire de collecte ou de dépôt de vœux — directement en son sein. Ces surfaces existent en deux versions, alimentées par les mêmes données : une version **web**, pour les personnes qui n'ont pas encore l'application, et une version **dans l'application**, pour celles qui l'ont. Quand une personne équipée de l'application ouvre un lien public, celui-ci s'ouvre dans l'application plutôt que dans le navigateur, pour une expérience plus fluide.

Ce choix sert aussi l'**activation**. Une personne peut installer l'application, consulter le Mur d'un proche ou répondre à une collecte **sans avoir encore créé de compte**, puis être invitée, au bon moment, à créer le sien. On convertit ainsi une installation *dormante* — quelqu'un qui a l'application et a déjà agi, mais n'a pas de compte — en utilisateur actif.

Principes directeurs :

- **La date d'abord.** L'application existe pour ne rien oublier : l'écran d'accueil met en avant ce qui approche, et non une liste figée de contacts.
- **Une capture sans effort.** Noter une idée, un goût ou un souvenir doit prendre quelques secondes ; le rangement en catégories est automatique et silencieux, et reste corrigeable ensuite.
- **Un ton positif.** Rappels et relances aident, ils ne culpabilisent pas. Le vocabulaire reste chaleureux.
- **Une génération sous le contrôle de l'utilisateur.** L'utilisateur déclenche l'action, relit le résultat, l'ajuste, et l'envoie lui-même. Il garde la main à chaque étape.
- **Un coût toujours visible.** Chaque action payante annonce son coût en crédits et le solde disponible avant de s'exécuter. Le solde ne réserve pas de mauvaise surprise.
- **L'anniversaire en priorité, le reste accessible.** Le parcours met l'anniversaire au premier plan ; les autres types d'événements existent par un chemin secondaire, sans alourdir l'entrée dans l'application.
- **Un pont vers le compte.** La consultation des surfaces publiques reste ouverte à tous ; l'application saisit les bons moments pour inviter la personne à créer son propre espace.
- **Bilingue par conception.** L'interface existe en français et en anglais ; la personne choisit sa langue, et chaque libellé est pensé pour tenir dans les deux. Cette langue d'interface est distincte de la langue de communication propre à chaque proche, qui oriente les messages générés.

### Parti pris de conception

L'application vise le **minimalisme élégant** : peu d'éléments, chacun à sa place, beaucoup de blanc. Le produit promet de libérer l'esprit — l'interface doit le montrer, pas seulement le dire. Un écran chargé donnerait l'impression qu'il reste du travail à faire.

**Un écran, une intention.** Chaque écran répond à une question et lui consacre sa place. L'accueil dit ce qui approche ; la fiche dit qui est ce proche ; l'occasion prépare une célébration. Les gestes qui relèvent d'une autre intention rejoignent l'écran qui leur correspond, même si cela demande un pas de plus.

**Une seule action mise en avant.** Un écran comporte au plus un bouton plein. Le reste attend en retrait — bordure simple, ou lien. Là où plusieurs actions se valent, aucune ne s'impose visuellement.

**Ce qui est rare vit ailleurs.** Un geste qu'on fait quelques fois par an ne prend pas la place d'un geste quotidien. Ajouter un proche, demander un complément, régler ses préférences : autant d'actions qui vivent dans leur écran plutôt qu'à l'accueil.

**La couleur guide, elle n'habille pas.** En thème clair, le fond reste blanc et le texte sombre. Le violet marque ce qui agit ; le lilas met en avant l'élément qui compte à l'instant. L'abricot se réserve aux moments heureux — le jour même, un crédit reçu —, ce qui le maintient rare.

**Deux thèmes, une même identité.** L'application suit le **thème du système** — clair ou sombre — et laisse aussi choisir explicitement l'un des deux dans les réglages (3.11). En thème sombre, les rôles restent identiques : le fond profond remplace le blanc, le texte s'éclaircit, le violet s'ajuste pour garder son contraste sur fond foncé, et l'abricot conserve sa fonction d'accent rare. Les couleurs se définissent donc par **rôle** — fond, texte, action, mise en avant, accent — plutôt que par valeur fixe, chaque rôle portant sa déclinaison dans les deux thèmes. Les images et les portraits générés gardent leur rendu propre dans les deux cas.

**Une mise en page qui s'adapte.** L'application se dessine d'abord pour un téléphone tenu à une main, puis s'ajuste sans se réinventer :
- **Petits écrans** — les libellés restent lisibles, les zones tactiles atteignent la taille minimale recommandée, et les textes longs passent à la ligne plutôt que de se tronquer.
- **Grands téléphones et tablettes** — le contenu garde une largeur de lecture confortable plutôt que de s'étirer ; les listes gagnent en respiration, pas en colonnes.
- **Orientation paysage** — les écrans restent utilisables, la barre d'onglets et les actions demeurant atteignables.
- **Réglages du système** — l'application respecte la taille de texte choisie par la personne, jusqu'aux plus grandes valeurs, ainsi que la réduction des animations. Les mises en page tiennent quand le texte grandit.
- **Zones sûres** — encoches, barres système et indicateurs d'accueil sont pris en compte ; aucune action ne se loge dessous.

**Une interface bilingue par construction.** Chaque écran existe en français et en anglais (voir le principe bilingue ci-dessus), ce qui impose trois choses au dessin :
- **Les libellés respirent.** Une même phrase peut s'allonger d'un tiers d'une langue à l'autre : les boutons et les onglets prévoient cette marge plutôt que de tronquer.
- **Les textes se composent, ils ne s'assemblent pas.** Une phrase comme « Une date aujourd'hui, deux cette semaine » s'écrit **entièrement** dans chaque langue, avec ses variantes de singulier et de pluriel, plutôt que d'être recollée à partir de morceaux — l'ordre des mots et les accords diffèrent d'une langue à l'autre.
- **Dates, nombres et décomptes suivent la langue.** Le format d'une date, la place du nombre et la notation du décompte (J−3 en français, 3 days en anglais) appartiennent à chaque version.

**La chaleur vient de la typographie.** Les noms, les titres et les décomptes se composent dans un caractère à empattements souples ; le texte courant reste net et discret. C'est l'écart entre les deux qui donne le ton, plutôt qu'un aplat de couleur.

**Le texte parle, l'ornement se tait.** Une phrase juste vaut mieux qu'un compteur : « Une date aujourd'hui, deux cette semaine » remplace trois cartes de chiffres. Les illustrations et les icônes décoratives restent l'exception.

**Le calme est une réponse.** Un écran sans rien à traiter le dit sereinement, plutôt que de se remplir. L'absence d'échéance est une bonne nouvelle, pas un vide à combler.

## 2. Architecture de navigation

La navigation principale se fait par onglets, en bas de l'écran, pensés pour l'usage quotidien :

1. **Accueil** — ce qui approche, et de quoi noter une idée.
2. **Dates** — les dates à venir, organisées par le temps (voir 3.14).
3. **Proches** — l'annuaire, organisé par personne.
4. **Moi** — le hub personnel : le Mur, les crédits, le compte, l'aide (voir 3.17).

Une **cloche de notifications** (le centre de notifications, voir 3.13) reste présente dans l'en-tête et affiche une pastille dès qu'un élément demande l'attention. La validation des contributions reçues se fait depuis ce centre, qui en indique le nombre et ouvre l'écran de validation (3.8). Chaque geste vit dans l'écran qui lui correspond : **laisser une note** depuis l'accueil (3.2), **créer une date** depuis l'onglet Dates (3.14) ou une fiche (3.4), **faire compléter une fiche** depuis celle du proche concerné (3.20).

## 3. Écran par écran

### 3.1 Inscription et connexion

**Rôle.** Créer le compte et poser le strict nécessaire pour démarrer.

**Usage avant compte.** L'application peut être utilisée sans compte pour tout ce qui relève du public : consulter le Mur d'un proche, répondre à une collecte, laisser un vœu (voir 3.12). La création de compte est proposée au moment où elle prend du sens — pour enregistrer ses propres proches, obtenir son propre espace, tenir ses dates — la consultation, elle, reste ouverte à tout moment.

**Principe.** Les trois voies mènent au **même compte** : si l'adresse correspond à un compte existant, la connexion s'y rattache plutôt que d'en créer un second.

**Parcours d'entrée.**
1. **Écran d'ouverture** — le temps que l'application démarre. Si une session est déjà ouverte, on arrive directement sur l'accueil.
2. **Écran de connexion** — une seule porte, trois voies : **Google**, **Apple**, ou **son adresse e-mail**. Les deux premières ouvrent l'application en un geste ; la troisième envoie un code.
3. **Écran du code** — la saisie du code à usage unique reçu par e-mail, avec la possibilité d'en redemander un. Cet écran ne concerne que la voie e-mail.
4. **Choix du pseudo** — **à la première connexion seulement**, quelle que soit la voie empruntée. L'écran explique à quoi sert ce pseudo (il forme l'adresse de son Mur) et vérifie sa disponibilité. Il porte aussi un **champ facultatif de code de parrainage** (« si quelqu'un vous a invité, renseignez son code »), **prérempli** lorsque l'arrivée s'est faite par un lien d'invitation. Le code est vérifié à la saisie et l'écran dit s'il est valide. L'acceptation des conditions d'utilisation et de la politique de confidentialité s'y rattache.
5. **Bienvenue** — un écran qui accueille le nouvel utilisateur et annonce les **crédits offerts pour démarrer**. Lorsqu'un code de parrainage valide a été renseigné, il indique en plus le **bonus obtenu grâce à l'invitation**, et par qui l'invitation est venue. Un geste mène à l'accueil.
6. **Accueil** — l'application est ouverte. Son état vide oriente de lui-même : il invite à ajouter un premier proche (3.2).

**Retour d'un utilisateur connu.** La session persiste : on retrouve l'accueil directement. Après une déconnexion, seule l'étape 2 (et 3 si la voie e-mail est choisie) se rejoue — le pseudo, le code de parrainage et la bienvenue appartiennent à la première connexion.

**Arrivée par un lien d'invitation.** Le lien porte le code de parrainage. Ouvert sur un téléphone qui a déjà l'application, il mène directement à la création de compte, code prérempli. Ouvert sans l'application, il présente d'abord la page d'invitation (voir la spécification des surfaces publiques), puis l'installation ; le code est conservé jusqu'à la création du compte.

**États particuliers.** Code erroné (nombre de tentatives limité), code expiré (possibilité d'en renvoyer un), e-mail non reçu (renvoyer ou vérifier l'adresse), connexion externe interrompue ou refusée (retour à l'écran, les autres voies restant disponibles), pseudo déjà pris (proposition d'une variante), code de parrainage inconnu ou expiré (l'écran le signale et laisse poursuivre, le champ étant facultatif), code correspondant à son propre compte (signalé de même), plafond de comptes atteint sur cet appareil (la création est refusée, avec le moyen de joindre l'assistance), arrivée par un lien public sans compte (la surface publique s'ouvre directement, l'entrée dans l'application venant plus tard — voir 3.12).

### 3.2 Accueil

**Rôle.** Répondre en un coup d'œil à « qu'est-ce qui arrive, et que puis-je faire tout de suite ? ». L'accueil montre ce qui approche et le seul geste vraiment fréquent — noter une idée. Tout le reste vit ailleurs : la création d'une date dans l'onglet Dates, la demande de complément dans une fiche, les signalements dans la cloche (3.13).

**Contenu, de haut en bas.**
- **Une phrase d'accueil** — le prénom, puis l'état des lieux en une ligne : « Une date aujourd'hui, deux cette semaine. » Elle répond avant même qu'on lise les cartes, et remplace tout compteur.
- **Les prochaines échéances** — les trois plus proches. La plus imminente porte un fond teinté et ses **deux actions visibles** (*préparer*, *marquer envoyé*) ; les suivantes restent des lignes calmes, avec leur décompte à droite. Chaque carte ouvre le détail de l'occasion (3.21).
- **Laisser une note** — un bouton unique, à portée de pouce, en bas de l'écran.

**Ce que l'accueil ne porte pas.** Les gestes rares — ajouter un anniversaire, faire compléter une fiche — occupaient auparavant le haut de l'écran pour un usage de quelques fois par an. Ils rejoignent les endroits où ils ont du sens : l'onglet Dates pour créer une date, la fiche d'un proche pour lui demander de la compléter. Les contributions à valider passent par la cloche, qui en porte le compteur : elles attendent sans se périmer dans la journée.

**La phrase d'accueil.** Elle se compose selon la situation et reste juste dans tous les cas : aucune date à l'horizon, une seule aujourd'hui, plusieurs dans la semaine, rien avant plusieurs semaines. Les variantes s'écrivent une à une, dans les deux langues — le singulier et le pluriel diffèrent d'une langue à l'autre.

**Le décompte.** Il s'écrit dans le caractère de titre, en violet : **J−3** en français, **3 days** en anglais. La notation française porte le nom du produit dans sa forme ; l'anglaise, faute d'équivalent au « jour J », dit simplement les jours.

**Où mènent les éléments.**
- **Cloche** (en-tête) → centre de notifications (3.13), d'où part la validation des contributions (3.8).
- **Une carte d'échéance** → détail de l'occasion (3.21).
- ***Préparer*** → préparation et génération (3.7) ; ***marquer envoyé*** met à jour l'état sur place.
- ***Laisser une note*** → écran de saisie (3.5).

**États vides.** Deux situations, deux traitements.

- **Premier lancement** — le carnet est neuf. L'écran ne poursuit qu'un but : conduire au premier ajout. Un mot d'accueil (« Votre carnet est prêt · Ajoutez un premier proche et sa date. Lehno s'occupe de vous le rappeler. ») et un bouton principal *Ajouter un anniversaire*, qui prend ici la place de *Laisser une note* — il n'y a personne à propos de qui écrire.
- **Aucune échéance proche** — le carnet est rempli, mais rien n'arrive dans les semaines qui viennent. La phrase d'accueil le dit sereinement, les cartes cèdent la place à un bloc calme (« Rien dans les semaines qui viennent · Le bon moment pour noter une idée pendant qu'elle est fraîche. »), et le bouton *Laisser une note* demeure.

Les textes annoncent **ce qui est possible** plutôt que ce qui manque : ils évitent « aucun proche », « vide » ou « rien à faire ».

### 3.3 Proches — l'annuaire

**Rôle.** Retrouver un proche et voir d'un coup d'œil qui a une date qui approche.

**Contenu.** L'annuaire des proches, une ligne par personne. Chaque ligne porte l'initiale ou la photo, le nom, un **tag** nommant le type de la prochaine échéance, et sa date avec son décompte (par exemple « 24 août · J-3 »). Le tag est présent sur **toutes** les lignes, par cohérence : celui de l'anniversaire reste discret (couleur neutre, puisque c'est le cas le plus courant), tandis que les autres types (fête, jalon, mariage…) se distinguent par une couleur propre. Le tri par défaut est **par date à venir** (les échéances les plus proches en tête), avec un tri **alphabétique** en second choix. Une barre de recherche filtre la liste.

**Actions.** Ouvrir une fiche (3.4) · ajouter un proche · changer le tri.

**Où mènent les éléments.**
- Une ligne de proche → sa fiche (3.4).
- Ajouter un proche → formulaire d'événement (3.6), qui crée la fiche (3.4).
- Le tri → réordonne la liste sur place.

**États particuliers.** Annuaire vide (invitation à ajouter un premier proche) ; proche sans aucune date encore renseignée (la ligne le signale et invite à compléter).

### 3.4 Fiche d'un proche

**Rôle.** Le cœur de l'application : la mémoire d'un proche (ce que l'utilisateur sait de lui) et la préparation de sa prochaine occasion. La fiche suit le rythme des dates — à l'approche d'une échéance, la préparation passe au premier plan ; le reste du temps, la fiche est une page calme qui dit qui est ce proche.

**En-tête.**
- Photo ou initiale, et nom.
- La **prochaine échéance** : son type, sa date et le décompte (« Anniversaire · 24 août · J-3 »).
- Le registre et la langue de communication, s'ils sont renseignés.
- L'accès à la modification de l'identité et aux actions de la fiche (ajouter une note, partager un lien de collecte propre à cette fiche).

**Préparer la prochaine occasion.** Un bloc mis en avant à l'approche de la date, et discret le reste de l'année. Il réunit :
- La **liste de souhaits** de l'occasion à venir : chaque souhait avec son état (disponible, réservé, déjà offert) et sa provenance (exprimé par le proche, idée retenue, ajout personnel), et un geste pour en ajouter un.
- La **préparation assistée** : générer des idées de cadeaux et un brouillon de message. Chaque action annonce son coût en crédits (voir 3.7). Le portrait, lui, se génère à tout moment depuis le bloc *Ses portraits* ci-dessous.
Loin de toute échéance, ce bloc se réduit à un rappel serein de la prochaine date, la préparation restant accessible d'un geste.

**Ce qu'on sait du proche** (la mémoire). Les notes rangées par catégories : centres d'intérêt, choses à éviter, faits marquants, idées de cadeaux, etc. Les catégories durables (centres d'intérêt, choses à éviter) valent d'une année sur l'autre ; les autres s'enrichissent au fil du temps. Un geste ajoute une note (rangée automatiquement, voir 3.5), et sa catégorie reste corrigeable.

**Ses portraits.** Les portraits déjà produits pour ce proche, du plus récent au plus ancien, chacun indiquant sa date et la plage de notes retenue. Un geste en génère un nouveau, à tout moment (3.7). Un portrait s'ouvre pour être revu, approuvé ou partagé.

**Événements et historique.** La liste des événements du proche (anniversaire et autres) : chacun ouvre l'occasion à venir (3.21) et donne accès à sa modification (3.6). En dessous, l'historique par année, replié : chaque occasion passée ouvre son détail (3.21) — message envoyé, vœux reçus, **et ce qui a été offert cette année-là**.

**Ce qu'on a déjà offert.** La fiche tient la liste des cadeaux offerts, année par année. Elle s'alimente de trois façons : marquer un souhait comme offert, retenir une idée proposée à la préparation, ou saisir librement un cadeau trouvé ailleurs. **La génération d'idées lit cette liste et écarte ce qui a déjà servi** — c'est ce qui empêche de proposer cette année le cadeau de l'an dernier.

**Actions.** Ajouter une note · ajouter un souhait · ajouter ou modifier un événement · générer (portrait, idées, message) · partager un lien de collecte propre à la fiche · modifier l'identité.

**Où mènent les éléments.**
- Prochaine échéance / bloc *préparer* → préparation de la célébration et génération (3.7).
- Un souhait → son détail (3.19) ; *ajouter un souhait* → saisie d'un souhait (3.19).
- *Générer un portrait* (à tout moment), ou *générer* depuis la préparation → l'écran de génération correspondant (3.7).
- Un portrait de la collection → son aperçu (3.22), pour le revoir, l'approuver ou le partager.
- *Ajouter une note* → saisie d'une note (3.5).
- *Ajouter / modifier un événement* → formulaire d'événement (3.6).
- *Partager* (en-tête) → partage du lien de collecte nominatif (3.20).
- *Modifier* (en-tête) → modification de l'identité du proche (3.18).
- Un événement, ou une occasion passée de l'historique → le détail de l'occasion (3.21).

**États particuliers.** Fiche récente et peu remplie (invitation à l'enrichir, ou à partager un lien de collecte pour que le proche la complète) ; événement sensible (le ton s'adapte et la préparation se concentre sur le message) ; aucune date encore renseignée (invitation à ajouter une première date).

### 3.5 Saisie d'une note

**Rôle.** Enregistrer une information en un seul geste.

**Un seul écran, la saisie d'abord.** Une idée surgit au milieu d'une conversation : on ouvre, on écrit, on désigne. L'écran s'ouvre donc **curseur dans la zone de texte**, les champs de rattachement dessous.

1. **La note** — une zone de texte libre, au premier plan.
2. **Pour qui** — un champ de recherche à autocomplétion : on tape quelques lettres, on choisit dans les suggestions. **Plusieurs proches** peuvent être désignés. Lorsqu'aucune fiche ne correspond, l'écran propose d'en **créer une avec le nom saisi** — un nom suffit.
3. **À quelle occasion** *(facultatif)* — les occasions à venir des proches désignés, en suggestion. **Vide par défaut** : la note rejoint alors la fiche et vaut d'une année sur l'autre. La renseigner en fait une note de circonstance, rattachée à cette célébration.

**Plusieurs proches, plusieurs notes.** Désigner deux personnes crée **une note pour chacune**, indépendantes ensuite : les corriger, les compléter ou les supprimer se fait séparément.

**Classement.** L'application **range automatiquement** la note dans une ou plusieurs catégories, **sans rien demander** ; une confirmation légère permet, d'un simple appui, de **corriger la catégorie**.

**Depuis une fiche ou une occasion.** Le rattachement est déjà connu : les champs sont préremplis, il reste à écrire.

**À vérifier à l'usage.** Le champ occasion est vide par défaut, une note prise à la volée décrivant plus souvent le proche lui-même qu'une célébration précise. Les mesures d'usage diront si ce défaut tient.

**Rattachement.** Sans occasion renseignée, la note décrit le proche et vaut d'une année sur l'autre (3.4) ; avec une occasion, elle appartient à cette célébration — idée de cadeau pour ce mariage, tenue à prévoir (3.21).

**Principe.** La saisie prime : l'application range d'abord, et laisse corriger ensuite.

**Où mènent les éléments.**
- *Créer un proche* depuis l'autocomplétion → la fiche est créée sur-le-champ et le champ se remplit, sans quitter la saisie.
- *Enregistrer* → retour à l'écran d'où l'on venait, la note visible sur la fiche (3.4) ou l'occasion (3.21) selon son rattachement.
- *Corriger la catégorie* → sélection parmi les catégories existantes.

**États particuliers.** Aucun proche encore enregistré (l'écran invite à en créer un à la volée) ; texte saisi sans proche désigné (l'enregistrement attend cette désignation) ; proche sans occasion à venir (le champ occasion reste vide, la note rejoint la fiche) ; catégorie mal devinée (correction en un appui).

### 3.6 Ajout ou modification d'un événement

**Rôle.** Créer ou modifier une occasion. Un événement appartient toujours à un proche : la création passe donc par le choix de la personne concernée.

**Parcours d'ajout.**
1. **Type** — anniversaire (mis en avant) ou autre événement (chemin secondaire).
2. **Pour qui** — chercher un proche existant, ou **en créer un** au passage : son nom suffit, la fiche s'enrichira ensuite.
3. **La date** — jour et mois ; pour un anniversaire, l'année reste facultative, l'écran indiquant qu'elle permet de proposer des cadeaux qui vont avec l'âge. Pour un autre événement, un intitulé libre le nomme (« Mariage de Sarah »).
4. **Détails**, repliés par défaut — nature, répétition, délai d'anticipation du rappel (voir ci-dessous).
5. **Enregistrer** — l'occasion à venir est créée, et l'application ouvre sa page (3.21), d'où l'on enchaîne : ajouter un souhait, une note, préparer.
6. **Proposition de partage** — lorsque l'étape 2 a créé une nouvelle fiche, l'application propose dans la foulée d'envoyer à ce proche son lien de collecte, pour qu'il la complète lui-même (3.20). Cette proposition se décline d'un geste.

**Contenu du formulaire.**
- **Type** : anniversaire (mis en avant) ou autre événement (chemin secondaire).
- **Proche concerné** : une fiche existante, ou une nouvelle créée à la volée.
- **Date de référence** ; si l'année de naissance est inconnue, l'indiquer (un anniversaire peut être suivi sans connaître l'année).
- **Nature** : joyeux ou sensible. La nature sensible est proposée automatiquement lorsqu'elle est détectée, et reste corrigeable ; elle adapte le ton et concentre la préparation sur le message.
- **Répétition** : chaque année pour un anniversaire ; à échéances multiples pour un événement qui en compte plusieurs (par exemple un mois puis trois mois après une date). Les réglages avancés sont repliés par défaut.
- **Délai d'anticipation du rappel**, si l'utilisateur souhaite le personnaliser.

**Où mènent les éléments.**
- *Enregistrer* → la page de l'occasion créée (3.21).
- *Proposition de partage* (nouvelle fiche) → partage du lien de collecte (3.20).
- Le proche choisi → sa fiche (3.4).

**États particuliers.** Détection d'un événement sensible : bascule en douceur vers un ton adapté. Proche déjà porteur d'un anniversaire : l'application le signale plutôt que d'en créer un second. Date déjà passée cette année : l'occasion créée vise l'année suivante.

### 3.7 Génération (actions payantes)

**Rôle.** Produire un portrait, des idées de cadeaux ou un message. C'est le cœur de la valeur payante de l'application.

**Principes communs.**
- La génération part des **paramètres de la fiche** — le registre (ton) et la langue configurés pour ce proche, qui servent de valeurs par défaut et se modifient au moment de générer. Elle s'appuie aussi sur ce que la fiche dit du proche : le **nom d'usage** (celui par lequel le message s'adresse à lui), le **lien** avec lui, sa **ville**, son **âge** si l'année de naissance est connue, le **canal** par lequel on lui écrit (qui règle la longueur), et **ce qui lui a déjà été offert**, que les idées écartent. Enfin, elle s'appuie sur **l'ensemble de la fiche** : les notes durables qui décrivent le proche, les notes de circonstance propres à l'occasion, la liste de souhaits, et le contexte de l'échéance visée.
- **Deux temps distincts.** Le **portrait** se génère depuis la fiche du proche, quand l'utilisateur le souhaite (3.4). La **préparation d'une occasion** propose les **idées de cadeaux** et le **message** (3.21) ; une occasion sensible se concentre sur le message.
- Chaque génération produit **un seul résultat**, dans le ton et la langue par défaut, plutôt qu'un éventail d'options : c'est un choix d'économie de ressources.
- Chaque **génération consomme un crédit**. Pour un autre ton, une autre langue ou une autre orientation, l'utilisateur **régénère** — un nouveau résultat, un nouveau crédit. Le coût et le solde disponible sont annoncés avant de démarrer.
- Le résultat est présenté pour être **relu et ajusté** ; l'envoi et la publication restent des gestes de l'utilisateur.
- Le **bonus offert à l'inscription** permet d'essayer les trois features. Lorsqu'il s'épuise, une demande de génération mène à la recharge (3.9) : le paiement se présente à cet instant précis, au moment du besoin, plutôt qu'en amont.

**Portrait.** Une **image** qu'on compose pour un proche et qu'on lui envoie, accompagnée d'un mot : une illustration de ce qu'on veut lui exprimer à ce moment-là, fondée sur la relation qu'on a avec lui. Il appartient au **proche** et se génère **à tout moment** depuis sa fiche ; plusieurs portraits coexistent dans le temps et donnent à voir l'évolution de la relation.

**Le studio.** Avant de lancer la production, l'utilisateur règle quatre choses.

- **L'orientation** — ce qu'il veut dire. Notre relation · tes progrès · nos progrès · une motivation · un soutien · ce qui te caractérise · ma fierté · mon affection · ma gratitude · ce que tu m'as appris · un vœu · un hommage. C'est le premier choix, et il commande le texte comme l'image. **L'hommage est à part** : registre sobre, aucun accent chaud, aucune illustration joyeuse.
- **L'image** — une **illustration**, une **photo traitée**, ou **aucune**. Une seule voie à la fois : deux images sur un portrait le surchargent.
- **Le détail de l'image** — pour une illustration, la famille (nature, animal, abstrait) et quelques mots libres sur ce qu'il faut savoir du proche pour le dessiner ; pour une photo, le style parmi ceux que propose la marque. Une photo n'est jamais laissée telle quelle.
- **La matière** — la plage de notes retenue : tout l'historique (par défaut), les douze derniers mois, depuis le dernier portrait, ou des dates fixées.

**Ce que la composition porte.** Le **nom** du proche, le **message** produit selon l'orientation, une **note de l'expéditeur** courte et discrète (« Fait avec soin par Valentine »), et un **pied de marque** — lehno.app et les identifiants sociaux — assez discret pour ne pas voler la place, assez présent pour faire connaître l'application. Le tout dans une bande basse lorsqu'il y a une image ; sur toute la surface lorsqu'il n'y en a pas.

**Le portrait s'approuve** — l'image se compose alors —, puis **s'enregistre et s'envoie** comme n'importe quelle photo. Il ne s'expose à aucune adresse publique : c'est le pied de marque, inscrit dans l'image, qui fait connaître l'application.

*La composition détaillée, les gabarits et les briefs de génération figurent dans `spec-portrait-lehno.md`.*

**Parcours du portrait.**
1. **Entrée** — depuis la fiche du proche (3.4), à tout moment ; ou depuis la préparation d'un anniversaire (3.21).
2. **Composition** — l'écran rappelle ce sur quoi il s'appuie (les mots-clés tirés des notes), laisse choisir la **plage de notes** retenue (tout l'historique par défaut, les douze derniers mois, depuis le dernier portrait, ou des dates fixées), offre un champ « quelques mots » pour orienter le rendu, laisse régler la signature (formule et nom, ou aucune), et propose le **ton** et la **langue** hérités de la fiche, l'un et l'autre modifiables pour cette génération. Le coût en crédits et le solde restent visibles.
3. **Génération** — une attente soignée pendant la production. Elle prend le temps qu'il faut : l'écran laisse **quitter sans perdre** ce qui se prépare, et prévient dès que le résultat est prêt. Le portrait en cours se retrouve dans les reprises (3.16).
4. **Aperçu** — le portrait s'affiche en pleine page (3.22).
5. **Affiner** — ajuster les mots, le ton ou la signature et **régénérer** (nouveau crédit), ou **garder** en l'état.
6. **Garder** — le portrait rejoint la collection de portraits du proche, sur sa fiche.
7. **Partager** — dans l'application (le Mur) ou à l'extérieur (adresse publique et aperçu pour les réseaux), via la feuille de partage du téléphone (3.22).

**Idées de cadeaux.** Une génération produit une **liste de pistes** concrètes, réparties du gratuit au plus onéreux, à partir des centres d'intérêt et en tenant compte des choses à éviter. Chaque idée porte une courte justification et un ordre de prix. L'utilisateur **retient** celles qui lui plaisent — elles rejoignent la liste de souhaits du proche, marquées « idée retenue » — et **régénère** une nouvelle liste (nouveau crédit) si besoin d'autres pistes. Parcours : entrée depuis le bloc « préparer » → composition (intérêts et choses à éviter rappelés ; quelques mots facultatifs, par exemple un budget ou un angle) → génération → liste → sélection vers la liste de souhaits.

**Message.** Rédige un brouillon de vœux dans le registre et la langue du proche, en tenant compte des choses à éviter. Un seul brouillon est produit ; l'utilisateur l'**édite directement** dans le texte, ou **régénère** pour un autre ton (nouveau crédit). Une fois retenu, il l'**envoie** via la feuille de partage du téléphone — le canal reste son choix — puis le message est marqué comme envoyé et conservé dans l'historique de l'occasion. Parcours : entrée depuis le bloc « préparer » → composition (occasion rappelée ; ton et langue proposés d'après la fiche et modifiables ; quelques mots facultatifs pour orienter) → génération → aperçu et ajustement → envoi.

**États particuliers.** Génération en cours (attente, que l'on peut quitter — le résultat attend dans les reprises) ; échec (le crédit est rendu, message clair) ; solde insuffisant (renvoi vers la recharge) ; relance d'une même demande (elle rejoint la génération en cours plutôt que d'en lancer une seconde).

**Où mènent les éléments.**
- *Garder* un portrait → il rejoint la collection de portraits du proche (3.4) ; son aperçu et son partage se font en 3.22.
- Une idée *retenue* → la liste de souhaits du proche (3.4).
- *Envoyer* un message → feuille de partage du téléphone ; l'état passe à « envoyé ».
- Solde insuffisant → recharge (3.9).

### 3.8 À valider (les contributions reçues)

**Rôle.** Traiter les contributions venues de l'extérieur avant qu'elles n'entrent dans les fiches. C'est la garantie « rien d'externe n'est enregistré sans validation ».

**Deux flux distincts.**

- **Soumissions de collecte.** Ce qu'un proche a envoyé via un lien de collecte : une date, un ou plusieurs souhaits, un mot, et — pour un lien public — son nom et un indice de la relation (« on se connaît d'où »). Chaque contribution se présente sous forme de fiche, champs déjà séparés. L'utilisateur traite **chaque souhait** un à un — le **retenir** (il rejoint la liste de souhaits) ou l'**écarter** — et **valide** le reste (la date devient un événement, le mot devient une note) ; il peut aussi **corriger** ou **rejeter** l'ensemble. Le statut retenu/écarté de chaque souhait est ce que le répondant retrouve à la réouverture de son lien nominatif. Une contribution issue d'un lien public peut donner lieu à la **création d'une nouvelle fiche**. Si le répondant a laissé un e-mail ou un pseudo, ils sont affichés (l'e-mail pour pouvoir le recontacter au sujet de sa contribution, le pseudo pour relier la contribution à son compte s'il est utilisateur de Lehno).

- **Vœux reçus.** Les messages d'anniversaire déposés via le lien de vœux. L'utilisateur les **approuve** ou les **rejette** (protection contre les messages indésirables). Un vœu approuvé rejoint les mots reçus de son Mur (3.10), où il reste privé.

**Accès et contenu.** On ouvre cet écran depuis la cloche de notifications, qui indique le nombre de contributions en attente. La liste est classée par date d'arrivée, chaque élément indiquant le proche et l'échéance concernés.

**États particuliers.** Liste vide (rien à valider) ; contribution ambiguë (l'utilisateur la corrige avant de la valider).

**Où mènent les éléments.**
- L'entrée s'ouvre depuis la cloche (3.13).
- *Valider* → répartit le contenu dans la fiche du proche (3.4) ; une contribution publique peut créer une nouvelle fiche.
- Un vœu approuvé → il rejoint les mots reçus du Mur (3.10).

### 3.9 Crédits et recharge

**Rôle.** Rendre les actions payantes claires et fluides.

**Contenu, de haut en bas.**
- **Le solde**, mis en avant : c'est ce qu'on vient voir.
- **Recharger**, l'action principale, juste sous le solde.
- **Les mouvements** — les entrées et les sorties du solde, la plus récente en tête. Chaque ligne nomme **ce à quoi le crédit a servi** (« message pour Karim », « portrait de Karim ») plutôt qu'une dépense abstraite, et les entrées disent leur origine (recharge, crédits de bienvenue, parrainage). Un lien ouvre l'historique complet.
- **Mes paiements** — les achats réglés, chacun avec son reçu ; également accessible depuis Moi (3.17).
- **Méthodes de paiement** — celles qui sont enregistrées, la plus récemment utilisée en tête (3.25).
- **Inviter un ami** — le parrainage, avec ce que chacun y gagne.

**Quand la recharge est proposée.** Au moment où le besoin se fait sentir (solde à zéro alors qu'une génération est demandée, ou échéance qui approche sans crédits disponibles), et de façon anticipée (une alerte discrète avant de se retrouver à court). Le rechargement reste toujours une action volontaire de l'utilisateur.

**Leviers de croissance (phase ultérieure).** Saisie d'un **code promotionnel** ; partage de son **code de parrainage** (le filleul et le parrain reçoivent alors des crédits). Ces entrées apparaissent discrètement lorsque la fonctionnalité est active.

**Principes.** Le solde est rappelé partout où une action payante est proposée. Le prix d'un crédit est unique et fixé par l'administrateur.

**Parcours d'achat.**
1. **Choisir un montant** — quelques paliers de crédits, avec le prix correspondant. Le solde après achat est annoncé.
2. **Méthode de paiement** — le comportement dépend de ce qui est déjà connu.
   - **Premier achat**, aucune méthode enregistrée : l'écran d'ajout s'ouvre dans la foulée (opérateur et numéro, ou carte — voir 3.25). La méthode est **enregistrée au passage** et l'achat se poursuit sans revenir en arrière.
   - **Achats suivants** : la méthode **utilisée le plus récemment** est proposée d'emblée. Un geste permet d'en **choisir une autre** parmi celles enregistrées, ou d'en **ajouter une nouvelle** — auquel cas elle est enregistrée et devient celle qui sera proposée la fois suivante.
3. **Confirmer** — le récapitulatif rappelle le nombre de crédits, le montant et la méthode.
4. **Validation chez l'opérateur** — pour un compte mobile money, la demande part vers le téléphone : l'utilisateur reçoit une sollicitation de son opérateur et saisit son code chez lui. L'écran de Lehno l'explique et **attend**, en montrant que l'opération est en cours et ce qui reste à faire. 
5. **Issue** — en cas de succès, les crédits sont immédiatement disponibles et l'utilisateur revient à l'action qu'il voulait mener ; en cas de refus, rien n'est débité et la raison est expliquée, avec la possibilité de réessayer ou de changer de méthode.

**Pendant l'attente.** L'opération se conclut chez l'opérateur, à son rythme : l'écran l'assume plutôt que de faire mine d'avancer. Il indique l'état en cours, laisse **quitter sans annuler** (l'achat se poursuit), et prévient dès qu'il aboutit — par une notification si l'utilisateur est parti ailleurs. Revenir dans l'application ramène à cet écran tant que l'opération n'est pas résolue.

**Achat sans réponse.** Lorsque la validation n'arrive pas (sollicitation ignorée, code jamais saisi), l'achat **expire** au terme du délai de l'opérateur : l'écran le dit clairement, aucun crédit n'est octroyé, et l'utilisateur peut relancer. Un achat en attente reste visible dans l'historique des paiements (3.9) avec son état, pour qu'aucune somme ne demeure inexpliquée.

**Une opération à la fois.** Confirmer deux fois ne lance qu'un seul achat : la seconde demande rejoint l'opération en cours plutôt que d'en créer une autre.

**Où mènent les éléments.**
- *Recharger* → parcours d'achat ci-dessus.
- *Méthodes de paiement* → gestion des méthodes enregistrées (3.25).
- *Historique des paiements* → également accessible depuis Moi (3.17). Un paiement s'ouvre pour afficher son reçu.
- Parrainage → feuille de partage du téléphone ; code promotionnel → saisie sur place.

### 3.10 Mon Mur

**Rôle.** Tenir sa page personnelle : ce qu'on dit de soi, ce que les autres y ont laissé, et l'invitation à venir y déposer un mot. Sa version publique s'affiche sur le web, et dans l'application pour ceux qui l'ont (3.12).

**Ce qu'on y trouve.**
- **Mes informations** — ce que l'utilisateur renseigne sur lui-même : sa date d'anniversaire, ses centres d'intérêt, ses souhaits. Chaque élément s'ajoute et se modifie ici, et porte un réglage de visibilité : **exposé sur le Mur** ou gardé pour soi. Rien n'est public sans ce geste.
- **Les mots reçus** — les vœux qu'on lui a adressés, pour l'occasion en cours ou les précédentes. Ils restent **privés** : ils se lisent ici, sans jamais s'afficher sur la page publique. La modération de ce qui arrive se fait dans la validation (3.8).
- **L'invitation à laisser un mot** — le lien de dépôt de vœux de l'occasion en cours, à partager pour que les proches viennent écrire. Il vaut pour la célébration à venir, et se renouvelle chaque année.

**Réglages du Mur.** Activer ou désactiver la page ; son adresse publique, dérivée du pseudo (3.23) ; un **mot d'accueil personnel**, facultatif, qui s'affiche sous le message d'accueil du produit — quelques lignes pour donner sa couleur à la page ; la prévisualisation telle que le public la voit ; le partage du lien.

**Où mènent les éléments.**
- *Prévisualiser* → le Mur en version publique (3.12).
- *Partager mon Mur* ou *partager l'invitation* → feuille de partage du téléphone.
- Un souhait → son détail (3.19).
- Un vœu en attente → la validation (3.8).

**États particuliers.** Mur désactivé (rien n'est public, l'écran reste consultable) ; rien encore exposé (invitation à choisir quelques éléments) ; aucune date d'anniversaire renseignée (le lien de dépôt de vœux n'a pas d'occasion à viser — l'écran invite à renseigner sa date) ; hors de la fenêtre de vœux (le lien n'accepte plus de messages, ce qui est indiqué).

### 3.11 Réglages

**Rôle.** Paramétrer ce que l'application envoie et gérer ses données.

**Préférences de notification.** Chaque nature de message se règle séparément, et pour chacune l'utilisateur choisit son canal : notification sur le téléphone, e-mail, les deux, ou aucun.
- **Rappel d'échéance** — une date approche. C'est le cœur du service ; le **délai d'anticipation** se règle ici (par exemple une semaine avant), et reste ajustable événement par événement (3.6).
- **Récapitulatif** — la vue d'ensemble de ce qui arrive, à la fréquence choisie (chaque mois, chaque semaine, ou jamais).
- **Contributions à valider** — un proche a répondu, un vœu est arrivé.
- **Relances** — l'invitation à enrichir une fiche restée peu remplie ; peut être désactivée.
- **Vie du compte** — crédits, parrainage, sécurité. Les messages de sécurité arrivent toujours, quel que soit le réglage.

**Heure d'envoi.** L'utilisateur choisit à quel moment de la journée les rappels lui parviennent, dans son fuseau horaire.

**Apparence.** Le thème suit celui du système par défaut ; l'utilisateur peut imposer le clair ou le sombre.

**Mes données.** Export de ses données personnelles ; suppression du compte (3.24).

**Où mènent les éléments.**
- *Sécurité et connexions* → 3.24.
- *Exporter mes données* → préparation du fichier, envoyé par e-mail quand il est prêt.

**États particuliers.** Notifications refusées au niveau du système : l'écran l'indique, invite à les réactiver, et les rappels continuent par e-mail entre-temps. Tous les canaux d'une nature désactivés : l'écran signale que ces messages ne parviendront plus.

### 3.12 Surfaces publiques dans l'application et usage sans compte

**Rôle.** Afficher, au sein de l'application, les surfaces normalement servies sur le web, pour les personnes qui ont déjà l'application — et en faire un levier d'activation.

**Ce qui s'ouvre dans l'application.** Lorsqu'une personne équipée de l'application ouvre un lien public, il s'affiche dans l'application plutôt que dans le navigateur :
- le **Mur d'un proche** (ses goûts, ses souhaits, ses vœux publiés) ;
- un **formulaire de collecte** (compléter la fiche d'un proche) ou de **dépôt de vœux** (laisser un message d'anniversaire) ;

Le contenu et le comportement de ces surfaces sont décrits dans la spécification des surfaces publiques ; l'application les présente simplement dans un cadre plus fluide. Un avantage concret : une personne connectée qui répond à une collecte est reconnue automatiquement, son pseudo étant déjà connu.

**Invitation à créer un compte.** Ces consultations sont accessibles sans compte. Au fil de l'usage — après avoir consulté un Mur, répondu à une collecte, ou voulu conserver quelque chose pour soi — l'application propose, avec tact, de créer son propre espace. C'est le chemin qui convertit une installation dormante en utilisateur actif.

**États particuliers.** Lien invalide ou révoqué, échéance de vœux fermée, Mur non publié : mêmes messages que sur le web, présentés dans l'application. Personne connectée qui ouvre son propre lien : l'application la ramène à l'écran correspondant de son espace plutôt qu'à la vue publique.

### 3.13 Centre de notifications

**Rôle.** Rassembler en un seul endroit tout ce que l'application signale à l'utilisateur, en complément des notifications poussées sur le téléphone. On y accède par la cloche, présente en permanence ; une pastille indique les éléments non lus.

**Ce qu'on y trouve.** Chaque entrée renvoie directement vers l'écran qui permet d'agir :
- **Contributions à valider** — une soumission de collecte ou un vœu reçu attend une décision (ouvre l'écran de validation, 3.8).
- **Relances** — une fiche gagnerait à être enrichie, ou une échéance approche et mérite d'être préparée.
- **Rappel d'échéance** — un anniversaire approche ; l'entrée ouvre directement la page de préparation de cette échéance.
- **Récapitulatif du mois** — la vue d'ensemble de ce qui tombe dans les semaines à venir.
- **Vie du compte** — crédits offerts, résultat d'un parrainage, information de sécurité (une nouvelle connexion).

**Lien avec les notifications poussées.** Les mêmes signalements peuvent arriver en notification sur le téléphone (selon les préférences de l'utilisateur) et se retrouvent toujours dans ce centre. Les préférences de canal et de fréquence se règlent dans les réglages (3.11).

**États particuliers.** Centre vide (message d'accueil serein) ; ouverture d'une notification poussée qui mène directement à l'écran concerné, sans passer par la liste.

### 3.14 Dates

**Rôle.** Offrir la vue des dates **par le temps**, là où l'onglet Proches donne la vue **par personne**. On y répond à « qu'est-ce qui m'attend dans les semaines et les mois à venir ? », tous proches confondus.

**Contenu.**
- Un **calendrier mensuel** : les jours porteurs d'une échéance sont marqués (un point, coloré selon le type), on navigue de mois en mois, et le jour courant est mis en avant.
- Sélectionner un jour affiche ses échéances sous la grille ; sinon, la liste montre les échéances à venir **du mois**, plafonnée à **cinq** avec un lien **voir plus**. Chaque échéance indique le proche, le type et le décompte, et **ouvre le détail de l'occasion** (3.21).
- Le calendrier donne une vue d'ensemble : il laisse repérer d'un coup d'œil les périodes chargées et les dates proches les unes des autres (utile pour préparer plusieurs célébrations ensemble).
- L'écran se concentre sur ce qui vient ; les occasions passées se consultent depuis l'historique de chaque fiche (3.4).
- Cette vue **par le temps** complète l'annuaire **par personne** de l'onglet Proches — deux angles sur les mêmes dates.

**Lien avec l'accueil.** L'accueil montre les trois échéances les plus proches ; l'onglet Dates en est la vue complète, atteinte aussi par le lien « voir tout » de l'accueil.

**Créer depuis l'onglet Dates.** Un bouton d'ajout propose de créer un **anniversaire** ou un **autre type d'événement** (fête, jalon, date à échéances), et ouvre le formulaire d'événement (3.6). C'est le point d'entrée principal pour les événements qui ne sont pas des anniversaires.

**Où mènent les éléments.**
- Une échéance de la liste → le détail de l'occasion (3.21), d'où l'on prépare et génère (3.7).
- *Voir plus* → déplie le reste des échéances du mois.
- Bouton d'ajout (+) → formulaire d'événement (3.6).

**États particuliers.** Aucune date à l'horizon (message serein, invitation à ajouter un anniversaire) ; période très chargée (le calendrier montre d'un coup d'œil les jours concernés, et la liste sous la grille détaille).

### 3.15 Recherche

**Rôle.** Retrouver un proche en quelques lettres depuis l'annuaire (3.3). La recherche porte sur les **noms de proches** : c'est le besoin courant, et celui qui justifie de sortir le clavier sur un téléphone.

**Parcours.** Un appui sur la barre de recherche de l'annuaire (3.3) ouvre l'écran, clavier déjà levé. Les résultats se rafraîchissent **au fil de la frappe**, sans validation. Un appui sur un résultat ouvre la fiche du proche (3.4).

**Contenu.**
- Les proches dont le nom correspond, classés par proximité de leur prochaine échéance.
- Chaque ligne reprend la présentation de l'annuaire : initiale ou photo, nom, tag du type d'échéance, date et décompte — de quoi reconnaître la bonne personne sans ouvrir.
- Un bouton d'effacement vide le champ d'un geste.

**Où mènent les éléments.**
- Un résultat → la fiche du proche (3.4).
- *Ajouter ce proche* (aucun résultat) → formulaire d'événement (3.6), le nom saisi étant repris.

**États particuliers.** Champ vide (l'écran reste sobre, sans liste) ; aucune correspondance (proposition d'ajouter un proche portant ce nom) ; annuaire vide (invitation à créer une première fiche).

### 3.16 Reprises en cours

**Rôle.** Regrouper le travail commencé et laissé en plan, au-delà des trois éléments montrés sur l'accueil. Rien ne se perd : ce qu'on a lancé se retrouve ici.

**Ce qu'on y trouve.** Deux natures d'éléments :
- **Brouillons de message** — un mot généré ou commencé pour une occasion, pas encore envoyé. La ligne indique le proche, l'occasion et son décompte.
- **Portraits à finir** — un portrait produit mais pas encore approuvé, ou approuvé sans avoir été partagé. La ligne indique le proche et la date du portrait.

**Présentation.** Les éléments sont classés par **urgence** : ceux liés à une échéance proche viennent en tête, puis les plus récents. Chaque ligne porte l'état où en est l'élément (brouillon, à approuver, à partager) et un geste pour le reprendre.

**Où mènent les éléments.**
- Un brouillon de message → l'écran du message, à l'endroit où il a été laissé (3.7).
- Un portrait → son aperçu (3.22), pour l'approuver ou le partager.
- Le proche mentionné → sa fiche (3.4).

**Actions.** Reprendre un élément · l'abandonner (le brouillon est supprimé ; le crédit dépensé reste consommé, ce que l'écran indique avant confirmation).

**États particuliers.** Liste vide (message serein : tout est traité) ; élément dont l'occasion est passée (il reste accessible, avec la mention que la date est dépassée).

### 3.17 Moi

**Rôle.** Le hub personnel : tout ce qui touche au compte et à la présence publique de l'utilisateur, regroupé en sections claires (à la manière d'un écran de réglages). On y consulte peu souvent, mais on y trouve tout.

**Contenu, en sections.**
- **En-tête de profil** : pseudo et e-mail, avec accès à leur modification.
- **Ma vitrine** : le Mur (activer, choisir ce qui s'expose, prévisualiser, partager — voir 3.10).
- **Mes réservations** : les cadeaux qu'on s'est réservés sur le Mur de proches (3.27).
- **Crédits** : le solde, l'historique des crédits (offerts, achetés, dépensés) et l'**historique des paiements** (les achats réglés, avec leur reçu), la recharge (3.9), et le parrainage (partager son code, voir les crédits gagnés).
- **Compte** : préférences de notification et données personnelles (3.11), sécurité et connexions (3.24).
- **Aide** : aide et support, à propos (version, pages légales), donner un avis (3.26).

**Où mènent les éléments.**
- En-tête de profil → mon profil (3.23).
- Ma vitrine → gestion du Mur (3.10).
- Mes réservations → 3.27.
- Crédits → crédits et recharge (3.9).
- Compte → réglages (3.11) ; *sécurité et connexions* → 3.24.
- Aide → 3.26.

**Note.** Ce hub réunit ce qui relève de « mon compte ». Les gestes de **création** (ajouter un proche, un événement, une note) vivent ailleurs — sur l'accueil, l'onglet Dates ou une fiche.

### 3.18 Modifier l'identité d'un proche

**Rôle.** Ajuster ce qui définit le proche et oriente la génération.

**Contenu du formulaire.** Deux groupes, l'essentiel d'abord.

*Qui c'est* — photo ou initiale · nom affiché · **nom d'usage**, la façon dont on l'appelle dans un message (« Karim », « Maman », « mon vieux ») · **lien** avec ce proche (famille proche, famille étendue, ami, partenaire, collègue, relation professionnelle, connaissance) · un éventuel indice de relation en toutes lettres (« on se connaît d'où »).

*Ce qui oriente la préparation* — registre de communication (familier, amical, formel) · langue de communication · ville et pays, qui permettent de suggérer des adresses et des sorties · **canal habituel** par lequel on lui écrit, qui oriente la longueur du message produit.

**Le genre, en dernier et facultatif.** Il vient après tout le reste, avec une option « je préfère ne pas préciser » retenue par défaut. L'écran dit à quoi il sert : orienter des idées de cadeaux **lorsqu'on ne sait encore presque rien** du proche. Une seule note bien prise vaut mieux que lui.

**Ce qui sert à la génération.** Le nom d'usage, le lien, le registre et la langue en sont les valeurs par défaut (3.7) ; la ville nourrit les suggestions de lieux ; le canal règle la longueur.

**États particuliers.** Fiche née d'une collecte publique : l'indice de relation renseigné par le répondant est repris, et peut proposer un lien que le propriétaire confirme. Nom d'usage absent : le nom affiché en tient lieu.

### 3.19 Détail et gestion d'un souhait

**Rôle.** Consulter et tenir à jour un souhait de l'occasion.

**Contenu.** Intitulé · **photo** de l'objet, facultative · précisions libres (taille, couleur, où le trouver) · lien éventuel · prix indicatif · état (disponible, réservé, déjà offert) · provenance (exprimé par le proche, idée retenue, ajout personnel — en lecture) · exposition sur le Mur.

**Actions.** Ajouter un souhait · modifier · ajouter ou remplacer la photo · changer l'état · exposer sur le Mur ou en retirer · retirer.

**Réservations.** Lorsqu'un souhait exposé sur le Mur a été réservé par un proche, l'état le montre. Le **nom du réservant** apparaît s'il a choisi de se faire connaître ; sinon la réservation reste anonyme. Le propriétaire garde la main sur l'état — il peut marquer un souhait déjà offert quoi qu'il arrive.

**États particuliers.** Souhait venu d'une collecte : il apparaît une fois retenu à la validation (3.8).

### 3.20 Partage d'un lien de collecte

**Rôle.** Inviter un proche à compléter lui-même sa fiche.

**Contenu.** Un aperçu du lien nominatif propre à ce proche, un rappel de ce qu'il pourra renseigner (sa date, ses souhaits, un mot), et le partage via la feuille du téléphone. Le lien reste ouvert et réutilisable, et peut être révoqué.

**Où mènent les éléments.** Partager → feuille de partage du téléphone. Les contributions reçues arrivent dans la validation (3.8).

**États particuliers.** Lien révoqué (réactivable) ; fiche sans date encore renseignée (le lien sert justement à la recueillir).

### 3.21 Détail d'une occasion

**Rôle.** La vue d'un événement daté précis — l'occasion d'une année pour un proche. On y ouvre tout ce qui la concerne, qu'elle soit à venir ou passée. C'est ce qu'ouvre une échéance depuis les Dates (3.14), l'accueil (3.2) ou la liste d'événements d'une fiche (3.4).

**En-tête.** Le proche, le type d'événement, la date et le décompte (ou la mention « passée »).

**Occasion à venir → préparer.** La liste de souhaits de l'occasion (état, provenance, ajout) et la préparation assistée (3.7) : générer des **idées de cadeaux** et un **message**. Une occasion sensible se concentre sur le message. Le portrait, lui, appartient au proche et se génère depuis sa fiche (3.4).

**Notes de l'occasion.** Les notes propres à cette célébration — une idée de cadeau pour ce mariage, la tenue à prévoir, un détail d'organisation — s'affichent ici, et un geste en ajoute une (3.5). Elles se distinguent des notes durables du proche (centres d'intérêt, choses à éviter), qui vivent dans sa fiche (3.4) et valent d'une année sur l'autre ; les deux nourrissent la génération.

**Notes pour cette occasion.** Les notes propres à cette célébration — une idée de cadeau, une tenue à prévoir, un détail d'organisation — avec un geste pour en ajouter (3.5). Elles vivent ici, là où elles servent, et nourrissent la génération de cette occasion. Ce qui décrit le proche lui-même (centres d'intérêt, choses à éviter) reste sur sa fiche (3.4).

**Occasion passée → revoir.** Ce qui s'y rattache, en lecture : le message envoyé et les vœux reçus. Les portraits, eux, appartiennent au proche et se retrouvent sur sa fiche (3.4).

**Où mènent les éléments.**
- *Ajouter une note pour cette occasion* → saisie d'une note (3.5), rattachée à l'occasion.
- Un souhait → son détail (3.19).
- *Générer* → l'écran de génération correspondant (3.7).
- *Modifier l'événement* → formulaire d'événement (3.6).
- Le proche (en-tête) → sa fiche (3.4).

**États particuliers.** Occasion à venir sans souhait encore listé (invitation à en ajouter ou à partager un lien de collecte) ; occasion passée sans contenu (mention sobre) ; événement sensible (ton adapté, préparation centrée sur le message).

### 3.22 Aperçu et partage d'un portrait

**Rôle.** Voir un portrait en grand, décider de le garder, et le diffuser. On y arrive juste après une génération, ou depuis la collection de portraits d'une fiche (3.4).

**Contenu.** Le portrait en pleine page, avec sa date et la plage de notes retenue. En dessous, ce qui reste modifiable : la courte phrase et la signature (facultative). **Le pied de marque Lehno fait partie de l'image** — c'est ce qui fait connaître l'application quand le portrait circule.

**Actions.**
- **Approuver** — le portrait passe de produit à validé, et rejoint la collection du proche.
- **Régénérer** — relancer avec d'autres mots, une autre plage ou un autre ton (nouveau crédit, voir 3.7).
- **Partager** — l'application ouvre la feuille de partage du téléphone avec **l'image**, accompagnée d'un mot que l'utilisateur ajuste. Elle part par sa messagerie, comme n'importe quelle photo.
- **Enregistrer l'image** sur le téléphone.

**Où mènent les éléments.**
- *Régénérer* → composition du portrait (3.7).
- *Partager* / *enregistrer* → feuille de partage du téléphone.
- Le proche (en-tête) → sa fiche (3.4).

**États particuliers.** Portrait encore à valider (l'approbation est mise en avant ; l'image se compose à ce moment-là) ; signature retirée (le portrait s'affiche sans nom d'expéditeur).

### 3.23 Mon profil

**Rôle.** Tenir à jour ce qui identifie l'utilisateur dans l'application et sur ses surfaces publiques.

**Contenu.**
- **Photo de profil** — choisie depuis le téléphone (galerie ou appareil), recadrable, remplaçable ou retirable ; une initiale prend le relais à défaut. Elle apparaît sur le Mur et auprès de la signature d'un portrait.
- **Pseudo** — l'identifiant public, unique. Il figure dans l'adresse du Mur et permet à un proche déjà utilisateur de rattacher ses contributions. Le changer modifie l'adresse publique du Mur : l'écran le signale avant de valider.
- **Nom d'affichage** — le nom qui apparaît dans les signatures et sur le Mur, libre et modifiable à volonté.
- **Adresse e-mail** — l'identifiant de connexion, affiché en lecture avec son état de vérification.
- **Langue de l'interface** — français ou anglais.

**Édition.** Chaque champ se modifie sur place : on appuie, on saisit, on valide. Le pseudo passe par un contrôle de disponibilité.

**Où mènent les éléments.**
- *Photo* → sélection depuis la galerie ou l'appareil photo, puis recadrage.
- *Voir mon Mur* → gestion du Mur (3.10).

**États particuliers.** Pseudo déjà pris (proposition d'une variante) ; photo lourde ou au mauvais format (recadrage et compression automatiques) ; changement de langue (l'interface bascule immédiatement).

### 3.24 Sécurité et connexions

**Rôle.** Garder un œil sur les accès au compte, et en sortir — définitivement s'il le faut.

**Contenu.**
- **Moyens de connexion** — la connexion par e-mail et code, toujours active ; les comptes Google ou Apple rattachés, avec la date de dernière utilisation. Chacun se rattache ou se détache, la connexion par code restant l'accès de secours.
- **Connexions récentes** — les dernières ouvertures de session : date, appareil, lieu approximatif. De quoi repérer un accès inhabituel.
- **Déconnexion** — quitter la session sur cet appareil ; les données restent en ligne, on retrouve tout à la prochaine connexion.
- **Suppression du compte** — effacer le compte et tout ce qu'il contient.

**Déconnexion.** Une confirmation courte, qui rassure : les données restent en ligne et se retrouvent intactes à la prochaine connexion. Puis retour à l'écran de connexion (3.1).

**Suppression du compte, en trois temps.**
1. **Ce qui disparaît** — la liste, sans détour : les fiches et leurs notes, les dates, les souhaits, les portraits et messages produits, le Mur et les vœux reçus. Les liens publics partagés cessent de répondre. Ce qui a déjà été envoyé à d'autres (un message, une image de portrait) ne revient pas.
2. **Le solde et la raison du départ** — s'il reste des crédits achetés, leur remboursement est proposé (voir ci-dessous). L'écran demande aussi, **facultativement**, la raison du départ : quelques motifs à choisir et un champ libre, qu'on peut passer d'un geste.
3. **Confirmer** — saisir son pseudo, puis un code à usage unique reçu par e-mail.

**Délai de grâce de trente jours.** La suppression confirmée, le compte est **désactivé** : plus de connexion possible, les surfaces publiques cessent de répondre, les rappels s'arrêtent. Les données sont conservées **trente jours**, puis effacées définitivement. Pendant ce délai, un retour reste possible en écrivant à l'assistance ; l'écran de confirmation et l'e-mail récapitulatif indiquent l'adresse à contacter.

**Remboursement du solde.** Si des crédits achetés subsistent, le parcours propose leur **remboursement** sur l'une des méthodes enregistrées (3.25) ; le montant et la destination sont annoncés avant confirmation. Deux conditions protègent l'opération : la méthode retenue doit avoir été enregistrée **depuis plus de deux semaines** et avoir **déjà servi à un paiement** sur l'application. Lorsqu'aucune méthode ne les réunit, l'écran l'explique et oriente vers l'assistance, la suppression pouvant se poursuivre ou attendre. Les crédits offerts ne donnent pas lieu à remboursement.

**Où mènent les éléments.**
- *Rattacher Google ou Apple* → l'écran du fournisseur, puis retour.
- *Se déconnecter* → écran de connexion (3.1).
- *Supprimer mon compte* → confirmation, puis écran de connexion.

**États particuliers.** Dernier moyen de connexion externe détaché (la connexion par code prend le relais, l'écran le rappelle) ; connexion inhabituelle signalée ; suppression demandée alors qu'un solde de crédits subsiste (le remboursement est proposé, sous les conditions ci-dessus).

### 3.25 Méthodes de paiement

**Rôle.** Enregistrer et tenir à jour les moyens par lesquels l'utilisateur règle ses recharges de crédits, et vers lesquels un remboursement éventuel est renvoyé.

**Contenu.** Les méthodes enregistrées, la plus récemment utilisée en tête, chacune présentée par ses éléments identifiants : pour un compte **mobile money**, l'opérateur et le numéro partiellement masqué ; pour une **carte**, le réseau, les derniers chiffres et l'échéance. S'y ajoutent la date de son enregistrement et l'indication qu'elle a déjà servi ou non à un paiement — les deux éléments qui conditionnent un remboursement (3.24). Le numéro d'un compte mobile money est conservé de façon protégée, car il sert à lancer les paiements et à recevoir un remboursement ; il s'affiche toujours partiellement masqué. Les informations d'une carte, elles, restent chez le prestataire de paiement, qui en renvoie une référence.

**Ajouter une méthode.** Le **mobile money** vient en premier, le marché visé le réglant ainsi le plus souvent : on choisit l'opérateur, on saisit le numéro, et la confirmation se fait sur le téléphone au premier paiement. La **carte bancaire** reste proposée en second choix, sa saisie ayant lieu chez le prestataire.

**Plusieurs méthodes.** Un utilisateur peut en enregistrer plusieurs — un compte mobile money et une carte, ou deux opérateurs différents. Celle qui a servi en dernier est proposée par défaut au moment de payer ; les autres restent à un geste.

**Actions.** Ajouter une méthode · en retirer une · choisir celle qui sert par défaut.

**Où mènent les éléments.**
- *Ajouter* ou *remplacer* → saisie sécurisée chez le prestataire de paiement, puis retour à l'écran.
- *Retirer* → confirmation ; si c'était la dernière, le prochain achat commencera par un enregistrement.

**États particuliers.** Aucune méthode enregistrée (l'écran invite à en ajouter une, sans insistance : l'enregistrement se fait naturellement au premier achat) ; méthode expirée ou refusée (signalée, avec la proposition d'en ajouter une autre) ; méthode récemment ajoutée (l'écran indique depuis quand, car cela conditionne les remboursements — voir 3.24).

### 3.26 Aide

**Rôle.** Répondre aux questions, permettre de joindre quelqu'un, et donner son avis.

**Contenu.**
- **Aide et support** — les questions fréquentes, et un moyen d'écrire à l'équipe (le message part avec la version de l'application et le type d'appareil, pour éviter de les demander).
- **À propos** — la version installée, et les pages légales : conditions d'utilisation, politique de confidentialité, mentions légales.
- **Donner un avis** — noter l'application sur son magasin, ou envoyer un retour directement.

**Où mènent les éléments.**
- *Écrire à l'équipe* → rédaction d'un message, envoyé depuis l'application.
- *Pages légales* → leur version publique sur le web.
- *Noter l'application* → la fiche de l'application sur son magasin.

### 3.27 Mes réservations

**Rôle.** Retrouver les cadeaux qu'on s'est réservés sur le Mur de proches, pour savoir ce qu'on doit offrir et à qui.

**Contenu.** Une ligne par réservation : le souhait, la personne dont c'est le Mur, la date de son occasion et le décompte, et la mention de savoir si l'on s'est fait connaître d'elle. Les occasions les plus proches en tête.

**Comment elles arrivent ici.** Réserver un souhait depuis le Mur d'un proche, alors qu'on est connecté à Lehno, rattache la réservation au compte — sans code à saisir, l'adresse étant déjà vérifiée. Les réservations faites sans compte, avant de s'inscrire, rejoignent cet écran dès que l'adresse coïncide.

**Où mènent les éléments.** Une réservation → le Mur public du proche concerné (3.12).

**États particuliers.** Aucune réservation (message sobre, sans injonction) ; souhait retiré par son propriétaire depuis la réservation (la ligne le signale) ; occasion passée (la réservation reste visible un temps, puis s'archive).

## 4. Parcours clés

- **Ne pas oublier.** Un rappel (notification ou e-mail) ouvre l'accueil, où l'échéance est en tête ; l'utilisateur prépare la célébration, génère, ajuste, envoie, puis marque le message comme envoyé.
- **Capturer sur le vif.** Le bouton de capture rapide ouvre une saisie libre ; la note est rangée automatiquement, la catégorie restant corrigeable. L'affaire de quelques secondes.
- **Enrichir sans tout saisir.** Depuis une fiche peu remplie, l'utilisateur partage un lien de collecte ; le proche le complète sur le web ; la contribution arrive dans la file à valider, signalée par la cloche ; l'utilisateur la valide et la fiche se remplit.
- **Recevoir des vœux.** Le lien de vœux recueille des messages ; ils arrivent dans la file à valider, signalés par la cloche ; l'utilisateur les approuve et les conserve dans les mots reçus de son Mur, à sa seule vue.
- **Célébrer.** À l'approche d'une échéance, l'utilisateur génère un portrait et un message ; il envoie le message, puis rend le portrait partageable et le diffuse sur les réseaux.
- **Manquer de crédits.** Une action payante demandée sans solde suffisant déclenche une proposition de recharge immédiate, puis ramène l'utilisateur à son action.
- **Activer une installation dormante.** Une personne reçoit un lien (Mur, collecte, portrait), l'ouvre dans l'application qu'elle a déjà installée, consulte ou contribue sans compte, puis se voit proposer — au bon moment — de créer le sien, et devient utilisatrice active.

## 5. Composants transverses

Ces éléments reviennent sur plusieurs écrans et gagnent à être conçus une fois pour toutes :

- **Cloche de notifications** — toujours accessible ; ouvre le centre de notifications (3.13) et signale par une pastille les éléments non lus.
- **Indicateur de crédits** — présent à chaque action payante ; le coût est toujours affiché avant de lancer.
- **Carte d'échéance** — la brique réutilisée à l'accueil et sur les fiches : proche, date, décompte. La plus imminente porte ses actions ; les autres restent des lignes calmes.
- **Étiquette de catégorie** — sur chaque note ; un appui permet de la reclasser.
- **Bandeau « sensible »** — sur les événements sensibles : ton adapté, pas de cadeau.
- **Fenêtre de confirmation d'action payante** — rappelle le coût, le solde et le résultat attendu avant toute génération.

## 6. États transverses et cas particuliers

**États vides.** Chaque écran prévoit un état vide, sobre et tourné vers l'action :
- Accueil au premier lancement, et accueil sans échéance proche.
- Annuaire des proches vide ; onglet Dates sans échéance à l'horizon.
- Centre de notifications vide ; liste des reprises vide.
- Résultats de recherche sans correspondance.
- Historique d'une année sans contenu.
- Solde de crédits à zéro ; Mur sans élément exposé ; liste de souhaits vide.

**Chargement et progression.** Un indicateur accompagne les attentes :
- Génération en cours (portrait, idées, message) : attente soignée, résultat affiché dès qu'il est prêt.
- Chargement des listes (proches, Dates, notifications) et d'une fiche.
- Envoi ou partage en cours (message, portrait, lien).

**Avis hors connexion.** Un bandeau signale l'absence de réseau :
- La consultation des fiches et des écrans déjà chargés reste possible (cache local).
- La génération, la validation et le partage attendent le réseau ; l'action est mise en attente et reprend au retour.

**Pages d'état.** Un lien qui ne mène plus à son contenu affiche une page d'état claire :
- Lien de collecte invalide ou révoqué.
- Fenêtre de dépôt de vœux fermée.
- Mur non publié.
- Portrait dont le partage a été retiré.
- Erreur générique, avec un chemin de retour vers un écran utile.

**Autres cas particuliers.**
- **Échec d'une génération.** Le crédit est rendu au solde ; l'application propose de réessayer.
- **Solde insuffisant.** L'action payante est suspendue, une recharge est proposée, et le contexte de l'action est conservé.
- **Notifications refusées par le système.** L'application se rabat sur l'e-mail pour les rappels et invite, avec tact, à réactiver les notifications.
- **Événement sensible.** Le ton est ajusté partout, y compris dans les contenus générés, et la préparation se concentre sur le message.
- **Fiche ou échéance supprimée.** Ce qui en dépend suit les règles du modèle de données ; l'application ramène toujours l'utilisateur vers un écran utile.
- **Contribution douteuse à valider.** L'utilisateur peut la corriger ou la rejeter ; rien n'entre dans une fiche sans son geste.
- **Ouverture d'un lien public avec l'application installée.** Le lien s'ouvre dans l'application et mène directement à la surface concernée ; sans l'application, il s'ouvre sur le web.

## 7. Rattachement aux phases de construction

Le découpage suit le phasage général du projet :

- **Phase 1 — Le carnet.** Inscription et connexion, accueil, proches, Dates, saisie de notes, événements, liste de souhaits personnelle, rappels (par e-mail puis par notification). C'est le socle, utilisable seul.
- **Phase 2 — Nourrir les fiches.** L'écran de validation (accessible depuis la cloche) pour les soumissions de collecte, le partage des liens de collecte, et les relances.
- **Phase 3 — La génération.** L'écran de génération (portrait, idées, message) et les crédits (solde, historique, dépense).
- **Phase 4 — Ouverture et monétisation.** La gestion du Mur, la validation des vœux reçus, et la recharge de crédits.
- **Phase 5 — Croissance.** Le parrainage et les codes promotionnels dans l'écran des crédits, et des rappels mieux adaptés au rythme de chaque relation.

L'application se construit ainsi par tranches successives, chacune s'appuyant sur les interfaces de programmation (API) livrées au préalable.

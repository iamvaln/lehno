# Lehno — Spec UX : surfaces publiques

Périmètre : l'application **Next.js** (SSR) qui porte toutes les pages publiques. Document de conception d'expérience — écrans, contenus, actions, états et parcours. Ne présume pas de l'implémentation visuelle.

Références : `doc-fonctionnelle-assistant-anniversaires.md` (le modèle et les intentions), `dictionnaire-donnees-lehno.md` (les attributs).

## 1. Périmètre & principes

Les surfaces publiques regroupent tout ce qu'un **tiers** (répondant, visiteur) ou un **prospect** voit sans compte. Toutes vivent dans une seule app Next.js, en rendu serveur, pour le SEO et les aperçus de partage.

Principes directeurs :

- **Sans compte.** Aucune de ces pages ne demande de créer un compte pour contribuer. Le compte, c'est pour le propriétaire, ailleurs (mobile).
- **Rendu serveur.** SEO pour la landing et les Murs ; balises Open Graph pour un aperçu riche quand on partage l'adresse d'un Mur ou d'une invitation.
- **Mobile-first.** Les répondants ouvrent ces liens depuis leur téléphone, souvent depuis une messagerie ou un réseau.
- **Acquisition partout.** Chaque page publique porte le CTA discret « obtenir son propre espace » (voir composants transverses). C'est le moteur de croissance.
- **Rien ne s'expose sans opt-in.** Le Mur ne montre que ce que le propriétaire a rendu public ; la collecte n'expose jamais de données existantes.
- **Tout contenu entrant est modéré.** Aucune contribution externe n'apparaît ou n'entre dans une fiche sans validation du propriétaire (côté mobile).

## 2. Inventaire des pages

1. **Landing** — présentation du produit, acquisition.
2. **Collecte — lien nominatif** — un proche enrichit une fiche existante.
3. **Collecte — lien public** — n'importe qui contribue à une fiche.
4. **Mur public** — la vitrine d'un utilisateur (« Mon Mur »).
5. **Dépôt de vœux** — laisser un message d'anniversaire (via `WishCollectionLink`).
6. **Liste de souhaits partagée** — la page d'une liste qu'un utilisateur partage, où l'on réserve.
7. **Invitation au parrainage** — la page d'un lien d'invitation, qui présente Lehno et mène à l'installation.
8. **Pages légales** — conditions d'utilisation, politique de confidentialité.
9. **Pages d'état** — lien révoqué, hors fenêtre, occurrence close, introuvable.

**Le portrait ne figure pas dans cette liste.** Il ne s'expose sur aucune page : c'est une **image** que l'utilisateur enregistre et envoie lui-même, accompagnée d'un mot. Il porte le pied de marque, ce qui en fait un vecteur d'acquisition — mais il circule dans les conversations, pas sur le web.

## 3. Écran par écran

### 3.1 Landing

**Rôle.** Expliquer Lehno, donner envie, convertir vers l'inscription (qui se fait dans l'app mobile — la landing pousse au téléchargement).

**Contenu.** Les textes ci-dessous forment la version française de référence. L'application étant bilingue, la version anglaise s'**écrit** plutôt qu'elle ne se traduit.

**En-tête**
> **Soyez là le jour J**
> Lehno retient les dates qui comptent et ce que vous savez de vos proches. Le moment venu, vous avez déjà tout pour bien faire.
> *[Commencer]*

**Comment ça marche** — trois temps, dans l'ordre de l'usage réel.
> **Notez quand ça vous vient.** Une idée de cadeau au détour d'une conversation, un détail qui vous marque. Vous ouvrez, vous écrivez, c'est rangé.
> **Lehno vous rappelle.** Quelques jours avant la date, l'application vous prévient — et vous remet sous les yeux tout ce que vous aviez noté.
> **Offrez quelque chose de juste.** Une idée de cadeau qui lui ressemble, un mot dans votre ton à vous. Vous choisissez, vous envoyez.

**Ce que l'application contient**
> **Vos proches, dans un carnet qui se souvient** — Une fiche par personne : sa date, ses goûts, ce qu'elle a laissé entendre. Ça s'enrichit au fil de l'année, sans effort. Et ça ressert chaque année.
> **Toutes vos dates, au même endroit** — Anniversaires, mariages, retraites, six mois d'une histoire : tout ce qui mérite d'être marqué tient dans le même calendrier.
> **Un mot qui vient de vous** — Lehno vous propose une base, écrite à partir de ce que vous savez d'elle. Vous ajustez, vous signez, vous envoyez depuis votre messagerie.
> **Votre page à vous** — Vos proches veulent bien faire aussi. Partagez votre Mur : ils y trouvent ce qui vous ferait plaisir, et peuvent vous laisser un mot.

**Clôture**
> **Faites de chaque jour J un moment qui leur ressemble.**
> *[Commencer]*

**Autres éléments.** Un aperçu des écrans ; des exemples de portrait et d'idées de cadeaux, fictifs ; la mention du modèle — le carnet et les rappels sont gratuits, les contenus générés se paient en crédits.

**Phrase de marque.** *« Chaque date qui compte, bien célébrée. »* — elle sert de signature courte : pied de page, aperçu de partage, fiches des magasins d'applications, pied de marque des portraits.

**Actions.**
- CTA principal : obtenir l'app (liens store, ou capture d'e-mail si pré-lancement / waitlist).
- CTA secondaire : voir un exemple de Mur (démo).

**États.** Pré-lancement (waitlist, capture d'e-mail) vs lancé (liens store). Un seul drapeau bascule l'affichage.

### 3.2 Collecte — lien nominatif

**Rôle.** Un proche, invité par le propriétaire, enrichit **une fiche précise** (la sienne, telle que vue par le propriétaire).

**Entrée.** URL avec `token`. Le lien **n'expire pas** et est **réutilisable** : la même personne peut revenir plusieurs fois. S'il a été révoqué → page d'état (3.7).

**Contenu / formulaire à champs séparés** (la séparation guide et évite le remplissage paresseux) :
- **Date d'anniversaire** (au minimum) — **pré-remplie** si le propriétaire l'a déjà renseignée, à confirmer ou corriger.
- **Souhait(s)** — un ou plusieurs (cadeaux désirés), champ répétable.
- **Un mot** — texte personnel libre.
- **E-mail** (facultatif) — pour que le propriétaire de la fiche puisse recontacter le répondant s'il a besoin d'une précision sur ce qu'il a soumis. Simple champ de contact, pas un abonnement : aucune case à cocher.
- **Nom d'utilisateur Lehno** (facultatif) — s'il a déjà l'app ; permet de rattacher sa contribution à son compte (renseigne l'`author_user_id` de ce qui est créé).

*Note.* Le nom d'utilisateur est **auto-déclaré** (le formulaire est public, sans connexion) : c'est un rattachement souple, à confirmer, pas une authentification. À terme, ouvrir le lien depuis l'app (deep link) permettrait d'identifier automatiquement un répondant déjà utilisateur, sans qu'il tape son pseudo.

**Actions.** Envoyer. Confirmation claire (« c'est transmis »). Le formulaire indique que le **lien reste ouvert** : le proche peut revenir quand il veut ajouter un souhait ou un mot.

**À la réouverture.** Le proche retrouve ses souhaits déjà soumis avec leur **statut** — *retenu* ou *écarté* par le propriétaire — et peut en ajouter d'autres. (Côté modèle, cela suppose un statut de review porté par le souhait soumis et visible du répondant — à caler dans le dictionnaire.)

**Après envoi.** Génère une `Submission` en file de review. CTA transverse « obtenir son propre espace » + CTA discret « visiter le mur de [propriétaire] » (seulement ici, sur la collecte — pas ailleurs).

### 3.3 Collecte — lien public

**Rôle.** Partage large (statut sur un réseau). N'importe qui contribue ; peut créer une nouvelle fiche côté propriétaire après validation.

**Différences avec le nominatif.** Le formulaire recueille en plus :
- **Nom** du répondant ;
- **« On se connaît d'où »** (indice de relation, pour le tri ultérieur).

Le reste est identique (date, souhait(s), mot, mêmes champs séparés, même passage en review).

**Anti-spam.** Le propriétaire modère tout en review ; côté public, protection légère (rate-limit, éventuel challenge anti-bot au besoin).

### 3.4 Mur public (« Mon Mur »)

**Rôle.** Le lieu d'accueil d'un utilisateur : on y fait sa connaissance, on y découvre ce qui lui ferait plaisir, et on peut lui laisser un mot. L'anniversaire y figure sans en être le sujet unique.

**Entrée.** URL avec `slug`. Actif seulement si le propriétaire l'a publié (`is_enabled`), sinon page d'état.

**Contenu (strictement opt-in), dans cet ordre.**
- **Un accueil en deux couches.** La page ouvre toujours sur un **message produit**, composé à partir du prénom du propriétaire (« Salut, bienvenue chez [prénom] ») : rien à remplir, tout Mur publié en dispose. S'y ajoute, lorsque le propriétaire l'a écrit, son **mot d'accueil personnel** — une phrase à lui, qui donne sa couleur à la page (« Ravie de te voir passer. Voilà quelques petites choses sur moi. »). Facultatif, il se rédige depuis la gestion du Mur. C'est un lieu où l'on reçoit, avant d'être une page d'anniversaire.
- **Intérêts / goûts** marqués publics — ce qu'il y a à savoir sur la personne.
- **Date d'anniversaire** (si le propriétaire l'expose) — présente, mais en simple mention : elle ne fait pas la une.
- **Une invitation à découvrir la liste de souhaits** — les `WishlistItem` publics s'ouvrent **d'un geste** plutôt que de s'étaler d'emblée : un visiteur venu dire bonjour n'a pas à tomber sur une liste de cadeaux. Chaque souhait montre son intitulé, sa photo si elle existe, ses précisions (taille, couleur, où le trouver), un lien et un prix indicatif éventuels, et son statut — un cadeau déjà réservé apparaît comme tel, **sans jamais dire par qui**.

**Réserver un souhait.** Un visiteur peut se réserver un cadeau, pour que deux proches n'offrent pas la même chose. Le parcours tient en trois temps :
1. **Il choisit le souhait** et donne son **adresse e-mail** — aucun compte n'est demandé.
2. **Il décide de se nommer ou non** : une case indique s'il souhaite que le propriétaire voie son nom. Par défaut, la réservation reste anonyme à ses yeux.
3. **Il saisit le code reçu par e-mail**, sans quitter la page. La réservation ne tient qu'une fois ce code vérifié : tant qu'elle est en attente, le souhait demeure disponible pour un autre — sans quoi une adresse inventée suffirait à bloquer un cadeau. Si quelqu'un d'autre confirme entre-temps, la demande en attente est signalée comme caduque.

**Revenir sur le Mur.** Une fois confirmé, le visiteur est reconnu à ses prochaines visites depuis le même navigateur : **ses propres réservations lui sont signalées**, et celles-là seulement.

**Protections.** Le nombre de demandes est limité par adresse destinataire autant que par origine ; les adresses jetables sont refusées ; et l'énumération d'une même boîte par suffixes est détectée.

**Ce que chacun voit.**
- *Un visiteur quelconque* : les souhaits, et lesquels sont réservés. Jamais par qui.
- *Le visiteur déjà confirmé* : les mêmes, plus le repérage de ce qu'il a lui-même réservé.
- *Le propriétaire, dans l'application* : l'état de chaque souhait, et le nom du réservant lorsque celui-ci l'a autorisé.

**Actions.**
- **Laisser un message d'anniversaire** → mène au dépôt de vœux (3.5), si la fenêtre de l'occurrence courante est ouverte.
- CTA « avoir mon Mur ». Le Mur étant lui-même une page de Lehno, servie à l'adresse du propriétaire, il ne porte pas de mention « créé avec » : la marque est déjà là, seule l'invitation compte.

**Note.** Le Mur porte le point d'entrée des vœux mais reste sans réciprocité imposée : le visiteur n'est jamais tenu de donner ses propres infos.

**Voix.** Le Mur est la page de son propriétaire et s'adresse directement au visiteur : la rédaction est à la **première personne** (« Mon anniversaire, c'est le… », « Ce que j'aime », « Laisse-moi un mot »). Cette voix vaut pour tous les libellés de la page. Elle exclut les formules qui supposent un « vous » collectif : le visiteur est une personne.

**Les vœux reçus restent privés.** Ils arrivent au propriétaire et ne s'affichent jamais sur le Mur : la page n'a pas de livre d'or.

### 3.5 Dépôt de vœux (WishCollectionLink)

**Rôle.** Laisser un **message d'anniversaire** pour une année précise. Distinct de la collecte de fiche (ce n'est pas une idée cadeau, c'est un message).

**Entrée.** URL `wish?occurrence=<refocc>` : le lien porte l'**occurrence** cible. Le Mur expose le lien de l'**occurrence courante**.

**Condition d'ouverture.** N'accepte les messages que pendant la **fenêtre de vœux** de l'occurrence (par défaut J-7 → J+30). Hors fenêtre → page d'état (3.7).

**Contenu / formulaire.**
- **Message** (texte).
- **Nom** de l'auteur (ou signature libre) ; facultatif si non connecté.

**Après envoi.** Crée un `ReceivedWish` en statut `pending`. Le propriétaire le modère, puis décide — ou non — de l'afficher sur son Mur (privé par défaut), et, s'il l'affiche, de montrer ou non le nom de l'auteur. Confirmation à l'auteur : « ton message est transmis à [nom] ». CTA transverse « obtenir son propre espace ».

### 3.6 Liste de souhaits partagée

**Rôle.** La page qu'ouvre le lien d'une liste partagée par un utilisateur. C'est la surface la plus virale du produit : elle se partage en un statut et atteint d'un coup des dizaines de personnes.

**Contenu.** Le prénom de celui qui partage, l'occasion et sa date, puis les souhaits — intitulé, photo, précisions, lien et prix indicatifs. Chaque souhait porte son état : un cadeau **déjà réservé** apparaît comme tel, **sans jamais dire par qui**.

**Réserver.** Le parcours décrit en 3.4 : adresse e-mail, choix de se faire connaître ou non, code à saisir dans la page. Un utilisateur connecté réserve en un geste.

**Faire ma part.** Un appel présent en pied de page : celui qui vient de réserver — ou qui a simplement regardé — peut à son tour créer sa liste. C'est le geste qui referme la boucle et fait entrer de nouveaux utilisateurs.

**États particuliers.** Liste dont l'occasion est passée (elle s'affiche, sans accepter de réservation) ; liste dépubliée par son propriétaire ; lien révoqué.

### 3.7 Invitation au parrainage

**Rôle.** La page qu'ouvre le lien d'invitation partagé par un utilisateur. Elle présente Lehno à la personne invitée, annonce ce qu'elle y gagne, et la mène à l'installation.

**Adresse.** Le lien porte le **code de parrainage** de celui qui invite (par exemple `lehno.io/i/<code>`).

**Contenu.**
- **Qui invite** — le prénom ou le pseudo du parrain, avec sa photo s'il en a une : l'invitation vient de quelqu'un, pas de la marque.
- **Ce qu'est Lehno**, en quelques lignes — la même promesse que la landing, resserrée.
- **Ce que l'invité y gagne** — les crédits offerts pour démarrer, augmentés du bonus d'invitation. Les montants viennent de la configuration.
- **Installer l'application** — vers le magasin correspondant à l'appareil.

**Report du code.** Le code accompagne l'invité jusqu'à la création de son compte : préremplissage du champ de parrainage à l'inscription, dans l'application. Une personne qui a reçu le code autrement (à l'oral, par message) peut le saisir elle-même à ce moment.

**États particuliers.** Code inconnu, expiré ou désactivé : la page présente Lehno et l'installation, en indiquant que l'invitation n'est plus valable. Visiteur qui possède déjà un compte : l'invitation ne s'applique pas, la page le mentionne et mène à l'application.

### 3.8 Pages légales

**Rôle.** Cadre juridique de l'usage du service — obligatoire dès qu'il y a collecte de données personnelles, contributions de tiers et paiement (crédits).

**Pages.**
- **Conditions générales d'utilisation** — règles d'usage, compte, crédits et achats, contenu généré, contenu soumis par des tiers, responsabilité, résiliation.
- **Politique de confidentialité** — données collectées (fiches, contributions, usage), finalités, base légale, durée de conservation, partage avec les sous-traitants (fournisseurs d'IA, hébergeur, e-mail/push), droits des personnes (accès, rectification, suppression), et **cas particulier des données de tiers** (les proches renseignés qui ne sont pas utilisateurs).
- **Mentions légales** — éditeur, hébergeur, contact.
- (Optionnel) **Politique cookies** — si le bandeau de consentement renvoie vers un détail.

**Accès.** Liées en pied de toutes les pages publiques ; présentées à l'inscription (acceptation) côté app ; référencées depuis le bandeau de consentement.

**Rendu.** Pages SSR simples, indexables, stables dans le temps ; contenu fourni par l'éditeur (hors périmètre de conception UX pure, mais l'emplacement et l'accès en font partie).

### 3.9 Pages d'état

Un gabarit commun, décliné selon le cas, toujours avec le CTA d'acquisition :
- **Lien révoqué / inactif** — « ce lien n'est plus actif ».
- **Hors fenêtre de vœux** — « les vœux pour cet anniversaire ne sont pas ouverts en ce moment » (± indiquer quand, si pertinent).
- **Mur non publié / introuvable** — neutre.
- **Occurrence / ressource introuvable** — 404 douce.

Aucune de ces pages ne révèle d'information sur le propriétaire au-delà du strict nécessaire.

## 4. Parcours clés

- **Proche invité (nominatif).** Reçoit le lien → ouvre → remplit date/souhait/mot → confirmation → (option) revient plus tard ajouter un souhait. → alimente la review du propriétaire.
- **Partage large (public).** Voit un statut → ouvre le lien public → renseigne nom + « on se connaît d'où » + infos → review (peut créer une fiche).
- **Visiteur du Mur → vœux.** Arrive sur le Mur → « laisser un message » → dépôt de vœux (si fenêtre ouverte) → message en attente de modération.
- **Découverte par le portrait.** Quelqu'un reçoit un portrait dans une conversation ou le voit passer sur un réseau. L'image porte le pied de marque : il retient le nom, cherche Lehno, arrive sur la landing. Le portrait ne renvoie vers aucune page — c'est la marque qu'il transporte, pas un lien.

## 5. Composants transverses

**Mise en page adaptative.** Les pages se lisent d'abord sur un téléphone — c'est par là qu'arrivent les liens partagés — puis s'ajustent à l'écran plus large : le contenu garde une largeur de lecture confortable, les images se redimensionnent, et les actions restent atteignables au pouce. Les réglages du système (taille de texte, réduction des animations) sont respectés.

**Deux thèmes.** Les pages suivent le thème du navigateur, clair ou sombre. Les rôles de couleur restent les mêmes dans les deux : fond, texte, action, mise en avant, accent. Un portrait est une image fixe : son rendu ne dépend d'aucun thème.

**Langue.** Chaque page existe en français et en anglais. Elle choisit sa langue ainsi : le paramètre porté par l'adresse s'il existe, puis la langue du navigateur, puis celle du propriétaire de la page — car elle s'adresse d'abord à ses proches. Un moyen de changer de langue reste accessible.

- **CTA « obtenir son propre espace ».** Présent sur **toutes** les pages publiques. Discret mais constant. C'est le moteur d'acquisition.
- **CTA « visiter le mur ».** Discret, **uniquement** sur les surfaces de collecte, et seulement si le propriétaire a un Mur publié.
- **Bandeau / signature Lehno.** Léger, en pied des pages publiques. Le pied porte aussi les liens vers les **pages légales** (CGU, confidentialité, mentions légales).
- **Confirmation de contribution.** Message clair après tout envoi : transmis + sera validé par le propriétaire.
- **Bandeau de consentement.** Choix le plus respectueux par défaut (refus des non-essentiels).

## 6. Cas limites & erreurs

- Lien nominatif **révoqué** entre deux visites → page d'état, pas d'erreur brute.
- Dépôt de vœux **hors fenêtre** → refus expliqué, jamais un formulaire qui échoue en silence.
- Message très tardif (après la fermeture de la fenêtre de vœux) → non accepté ; message clair.
- Double soumission (même répondant, même contenu) → tolérée côté public (la review dédoublonne) ; éviter les envois accidentels par un état de bouton.
- Contenu indésirable / spam sur lien public → absorbé par la review + protections légères.

## 7. Rattachement au phasage

- **Phase 0** — Landing (présence, waitlist / stores). Base de l'app Next.js.
- **Phase 2** — Collecte nominative et publique (formulaires + confirmation). Les Murs et vœux viennent après.
- **Phase 4** — Mur public et dépôt de vœux (ouverture publique, `WishCollectionLink`).

L'app publique se construit donc par tranches, au rythme des phases, mais dans une seule base Next.js.

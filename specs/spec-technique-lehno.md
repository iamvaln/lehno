# Lehno — Spécification technique

Périmètre : le contrat d'interface entre le serveur et ses clients, les règles de sécurité qui l'encadrent, et les exigences de performance à tenir. Ce document dit **ce que le serveur expose et garantit** ; il laisse à l'implémentation le choix des moyens.

Références : `doc-fonctionnelle-assistant-anniversaires.md` (le modèle et les intentions), `dictionnaire-donnees-lehno.md` (les attributs et les énumérations), et les trois spécifications d'expérience (`ux-app-mobile-lehno.md`, `ux-surfaces-publiques-lehno.md`, `ux-admin-lehno.md`) dont ce contrat découle.

## 1. La pile technique

Un rappel de ce sur quoi le service repose, rassemblé en un endroit.

**Ce qui s'exécute**

| Élément | Choix | Notes |
|---|---|---|
| Dépôt | Monorepo TypeScript | Le modèle et les types se partagent entre le serveur et les clients |
| Serveur | NestJS | Expose les trois surfaces décrites plus loin |
| Base de données | PostgreSQL | Les types et contraintes sont fixés par le dictionnaire de données |
| Application mobile | React Native | iOS et Android |
| Surfaces publiques | Next.js, rendu au serveur | Mur, collecte, dépôt de vœux, portraits partagés, invitations, pages légales |
| Back-office | React (Vite) | Application interne, sur ordinateur |

**Ce sur quoi on s'appuie**

| Besoin | Service | État |
|---|---|---|
| Notifications poussées | OneSignal | Retenu, à l'essai |
| Envoi d'e-mails | Mailgun | Retenu, à l'essai |
| Génération de contenus | Anthropic, DeepSeek, Grok — avec routage et repli entre eux | Retenus ; ordre de priorité à caler |
| Paiement | MTN Mobile Money et Orange Money, en intégration directe | Retenus |
| Hébergement | VPS | Retenu |
| Stockage des fichiers | Cloudflare R2, plan gratuit | Retenu |
| Sauvegardes | Stockage distant chiffré | |
| Supervision et suivi des erreurs | Sentry | Retenu |
| Mesure d'usage | PostHog, version infogérée gratuite | Retenu |

**Ce que les choix impliquent.** Le rendu au serveur des surfaces publiques sert l'aperçu sur les réseaux et le référencement d'un Mur partagé. Le monorepo évite que les types du modèle divergent entre le serveur et les clients. Les services tiers passent par une couche d'abstraction interne, de sorte qu'un changement se limite à son adaptateur.

**L'hébergement en particulier.** Un VPS donne la maîtrise et un coût prévisible, en contrepartie de quoi l'exploitation nous revient : mises à jour du système, certificats, sauvegardes vérifiées, surveillance de l'espace disque et de la mémoire. La montée en charge s'y fait d'abord en grossissant la machine ; les traitements programmés et les envois en masse sont donc étalés (voir 14.1), ce qui compte davantage sur une machine unique.

## 2. Principes

- **L'interface sert les écrans.** Chaque ressource et chaque champ existe parce qu'une surface en a besoin. Les écrans ont été arrêtés d'abord ; le contrat en découle.
- **Le serveur décide.** Cloisonnement, droits, solde de crédits, états : tout se vérifie côté serveur à chaque appel. Le client affiche, il ne tranche pas.
- **Synchrone par défaut.** Un appel rend son résultat. Deux opérations font exception, car elles dépendent d'un tiers : la **génération** (temps de calcul) et le **paiement** (validation chez l'opérateur). Elles s'initient par un appel et se résolvent ensuite.
- **Rejouer sans dupliquer.** Toute opération qui engage de l'argent ou un crédit est idempotente : la répéter donne le même résultat qu'une seule exécution.
- **Le contrat est stable.** L'interface est versionnée ; une application installée continue de fonctionner après une évolution du serveur.

## 3. Organisation de l'interface

Trois surfaces distinctes, aux règles différentes. Elles partagent le même serveur et le même modèle, mais **jamais leurs autorisations**.

| Surface | Préfixe | Qui appelle | Comment on s'identifie |
|---|---|---|---|
| **Espace privé** | `/v1/me` | L'application mobile, pour son propriétaire | Jeton de session |
| **Surfaces publiques** | `/v1/public` | Le web public et l'application sans compte | Jeton porté par le lien |
| **Administration** | `/v1/admin` | Le back-office | Jeton de session d'administration |

**Style.** Interface REST orientée ressources : un chemin désigne une chose, la méthode dit ce qu'on en fait. Les identifiants sont des UUID. Les dates sont en ISO 8601 avec fuseau. Les corps de requête et de réponse sont en JSON.

**Le contrat publié fait autorité.** `docs/api/openapi.json` est **engendré depuis les schémas de validation**, jamais écrit à la main, et un test échoue s'il est périmé. C'est l'artefact de référence des intégrateurs : en cas d'écart avec ce document, il l'emporte, puisque lui vient du code.

**Le préfixe `/v1` vit dans les serveurs**, non dans les chemins du contrat.

**Versionnement.** Le préfixe `/v1` fige le contrat. Une évolution compatible (champ ajouté, valeur d'énumération nouvelle) reste dans `v1` ; une rupture ouvre `v2`, les deux coexistant le temps que le parc se renouvelle. Les clients ignorent les champs qu'ils ne connaissent pas.

## 4. Conventions communes

**Pagination.** Les listes se parcourent **par curseur** — plus sûr qu'un numéro de page quand les données bougent. La requête porte `limit` (borné) et `cursor` ; la réponse rend les éléments et le curseur suivant, vide lorsqu'on a tout lu.

**Tri et filtres.** Chaque liste documente les tris et les filtres qu'elle accepte. Un paramètre inconnu est une erreur, plutôt qu'un silence qui masquerait un défaut d'appel.

**Erreurs.** Une seule forme, quel que soit le cas :
- un **code** stable, lisible par la machine (par exemple `insufficient_credits`) ;
- un **message** destiné au journal, en anglais ;
- des **détails** éventuels (le champ fautif, la valeur attendue).

Le client n'affiche jamais le message brut : il traduit le code dans la langue de l'utilisateur. C'est ce qui rend l'application bilingue sans dépendre du serveur.

**Statuts.** `200` succès · **`201`** création rendant une ressource nouvelle, le client apprenant son identifiant · **`204`** suppression, rien à rendre · `400` requête mal formée · `401` identification manquante ou invalide · `403` droit refusé · `404` ressource absente, hors de son périmètre, **ou gouvernée par un drapeau éteint** · `409` conflit d'état · `422` règle métier non satisfaite · `429` trop de requêtes · **`503`** arrêt pour intervention, avec `retryAfterSeconds` · `5xx` incident serveur.

**Les `POST` qui ne créent rien gardent `200`** : `/auth/otp` envoie un code, `/public/waitlist` est idempotent à dessein, une décision de validation modifie un état.

**Idempotence.** Les créations qui engagent quelque chose (achat, génération) acceptent une **clé d'idempotence** fournie par le client. Une même clé rend la même réponse sans réexécuter. Elle vaut pour une durée limitée.

## 5. Espace privé (`/v1/me`)

L'application mobile du propriétaire. Toutes les ressources sont **cloisonnées** : le serveur ne rend que ce qui appartient au porteur du jeton, et l'identifiant du propriétaire ne circule jamais dans les paramètres.

### 5.1 Identité et session

| Chemin | Méthode | Rôle |
|---|---|---|
| `/auth/otp` | POST | Demander un code à usage unique pour une adresse e-mail |
| `/auth/otp/verify` | POST | Échanger le code contre une session |
| `/auth/federated` | POST | Ouvrir une session depuis Google ou Apple |
| `/auth/session` | DELETE | Se déconnecter |
| `/auth/refresh` | POST | Renouveler la session |
| `/me/profile` | GET, PATCH | Pseudo, nom d'affichage, photo, langue, thème |
| `/me/profile/username-available` | GET | Vérifier la disponibilité d'un pseudo |
| `/me/account` | DELETE | Demander la suppression (entre dans le délai de grâce) |
| `/me/sessions` | GET | Connexions récentes |
| `/me/identities` | GET, POST, DELETE | Rattacher ou détacher Google et Apple |

**Création de compte.** La première ouverture de session crée le compte. Elle accepte un **code de parrainage facultatif** et l'**identifiant d'appareil**. Le serveur vérifie le plafond de comptes par appareil avant de créer quoi que ce soit, valide le code s'il est fourni, puis octroie les crédits — bonus d'inscription, et bonus d'invitation le cas échéant.

### 5.2 Proches, événements, occasions

| Chemin | Méthode | Rôle |
|---|---|---|
| `/me/persons` | GET, POST | L'annuaire ; création d'un proche |
| `/me/persons/{id}` | GET, PATCH, DELETE | La fiche : identité, registre, langue |
| `/me/notes` | POST | Créer une note pour un ou plusieurs proches, avec une occasion facultative |
| `/me/persons/{id}/notes` | GET, POST | Les notes durables du proche |
| `/me/persons/{id}/portraits` | GET | Sa collection de portraits |
| `/me/persons/{id}/attributes` | GET | Ce que les notes ont appris du proche : couleur, animal, métier, taille… |
| `/me/persons/{id}/gifts` | GET, POST | Ce qui lui a été offert, année par année ; en ajouter |
| `/me/gifts/{id}` | PATCH, DELETE | Corriger ou retirer une entrée |
| `/me/events` | GET, POST | Les événements ; création (anniversaire ou autre) |
| `/me/events/{id}` | GET, PATCH, DELETE | Un événement et sa récurrence |
| `/me/occurrences` | GET | Les échéances à venir — la vue Dates et l'accueil |
| `/me/occurrences/{id}` | GET | Le détail d'une occasion |
| `/me/occurrences/{id}/notes` | GET, POST | Les notes de circonstance |
| `/me/occurrences/{id}/wishes` | GET, POST | La liste de souhaits de l'occasion |
| `/me/wishes/{id}` | PATCH, DELETE | Un souhait de proche : état, repère personnel |
| `/me/wishlists` | GET, POST | **Mes** listes, une par occasion à moi |
| `/me/wishlists/{id}/wishes` | GET, POST | Les souhaits d'une de mes listes |
| `/me/wishlists/{id}/share` | GET | L'adresse publique de la liste, à partager |
| `/me/owner-wishes/{id}` | PATCH, DELETE | Un de mes souhaits |

**Listes d'échéances.** `/me/occurrences` accepte une fenêtre de dates et un plafond : l'accueil en demande trois, l'écran Dates un mois. C'est le même appel, paramétré — les deux surfaces ne divergent pas.

**Classement des notes.** La création rend la note **aussitôt enregistrée**, sans attendre son classement : celui-ci se fait **en arrière-plan**. Le client n'attend pas, et **un échec de classement n'est ni montré ni bloquant** — la note existe et sert. Il n'est silencieux que pour l'utilisateur : journaux et alertes le rapportent.

**La même passe extrait les attributs.** En classant une note, le serveur en tire au passage ce qui caractérise le proche — couleur, animal, plat, taille, métier, loisir, ce qu'il faut éviter. **Aucun appel de plus** : les mêmes valeurs de sortie, quelques champs supplémentaires. Le plus récent remplace l'ancien, et chaque attribut garde la note d'où il vient.

**Une note peut n'avoir aucune catégorie.** Aucun repli sur une catégorie fourre-tout : `NoteCategory` est une association, et zéro ligne est un état valide. La génération lit le **contenu** des notes, rangées ou non.

**Une note pour plusieurs proches.** Un point d'entrée dédié, `/me/notes`, accepte un texte, **une liste de proches** et une occasion facultative. Il crée **une note par proche**, indépendantes ensuite, et les rend toutes avec leur classement. Sans occasion, chaque note rejoint la fiche de son proche ; avec, elle appartient à cette célébration. La liste des proches est vérifiée avant toute écriture : un identifiant qui ne désigne pas un proche du demandeur fait échouer l'appel entier, sans rien créer.

### 5.3 Contributions reçues

| Chemin | Méthode | Rôle |
|---|---|---|
| `/me/collection-links` | GET, POST | Les liens de collecte ; en créer un pour une fiche |
| `/me/collection-links/{id}` | DELETE | Révoquer un lien |
| `/me/submissions` | GET | Les contributions à valider |
| `/me/submissions/{id}` | GET | Le détail d'une contribution |
| `/me/submissions/{id}/decision` | POST | Valider, corriger ou rejeter — souhait par souhait |
| `/me/received-wishes` | GET | Les vœux reçus |
| `/me/received-wishes/{id}/decision` | POST | Approuver ou rejeter |

**Validation.** La décision porte sur l'ensemble : ce qu'on retient de la date, du mot, et **le sort de chaque souhait soumis**. Le serveur applique la répartition dans la fiche en une seule transaction.

### 5.4 Génération

| Chemin | Méthode | Rôle |
|---|---|---|
| `/me/features` | GET | Les fonctionnalités actives pour le demandeur |
| `/me/studio/options` | GET | Ce que le studio propose : orientations et ambiances actives, valeurs par défaut, prix |
| `/me/generations` | POST | Lancer une génération (portrait, idées, message) |
| `/me/generations/{id}` | GET | Suivre son avancement, puis lire le résultat |
| `/me/generations` | GET | Les générations en cours et récentes — les reprises |
| `/me/portraits/{id}` | PATCH | Approuver, modifier le message ou la note de l'expéditeur |
| `/me/portraits/{id}/image` | GET | L'image composée du portrait, à enregistrer ou à partager |
| `/me/messages/{id}` | PATCH | Ajuster un brouillon, le marquer envoyé |

**Déroulé.** Le lancement **débite le crédit et rend aussitôt** un identifiant, sans attendre la production. Le client **interroge** ensuite l'avancement jusqu'au résultat. En cas d'échec, le crédit est **rendu au solde** et la raison portée par la réponse.

**Paramètres de la demande.** Le lancement porte la cible, le type de contenu, et les paramètres effectifs — ton, langue, plage de notes, mots d'orientation. Ceux qui sont absents prennent la valeur de la fiche. Un **portrait** porte en plus ce que le studio a réglé : l'orientation, la voie d'image, la famille d'illustration ou le style de photo, et la note de l'expéditeur (voir `spec-portrait-lehno.md`).

**Ce que le serveur ajoute.** Il complète la demande avec ce que la fiche sait du proche : nom d'usage, lien, ville, âge lorsque l'année de naissance est connue, **le genre du proche et celui de l'utilisateur** — l'accord grammatical en dépend —, les **attributs extraits** des notes, canal habituel, et **la liste des cadeaux déjà offerts**, que les idées écartent. Le client n'a pas à les transmettre — ils appartiennent au serveur, qui les tient à jour.

**Ce que le studio charge.** L'écran de production s'ouvre déjà réglé : `/me/studio/options` rend les orientations et les ambiances **actives** — celles que la configuration en service expose —, leurs valeurs par défaut, et le **prix**. Le client n'a rien à deviner, et une orientation désactivée disparaît de l'application sans livraison.

**Le prix est unique.** Un portrait coûte le même nombre de crédits quelle que soit la dépense réelle qu'il engage — un traitement de photo coûte davantage à produire qu'un message, sans coûter davantage à l'utilisateur. C'est un choix assumé : le prix est un réglage d'administration, pas un calcul.

**Le coût réel est enregistré à part.** Chaque production consigne ce qu'elle a réellement coûté (`AIUsage.cost`) en face de ce qui a été facturé (`ActionRun.credits_spent`). **Les opérations d'administration ne facturent rien** — essais du studio, régénérations offertes, classement des notes — mais leur coût compte tout autant. C'est cet écart, tenu dans le temps, qui dit si le prix du crédit couvre l'exploitation.

**Les gabarits vivent en base.** Ce qu'on demande au modèle — consignes et garde-fous — se règle depuis le back-office, jamais dans le code. Chaque production retient **la version exacte du gabarit** qui l'a produite (`ActionRun.prompt_template_id`), sans quoi un écart de qualité reste inexplicable.

**Sans doublon.** Une même demande relancée (même cible, même paramètres, même clé d'idempotence) rejoint la génération en cours plutôt que d'en créer une seconde — et ne débite qu'une fois.

### 5.5 Mur

| Chemin | Méthode | Rôle |
|---|---|---|
| `/me/wall` | GET, PATCH | Activer, régler ce qui est exposé, écrire le mot d'accueil |
| `/me/wall/preview` | GET | Le Mur tel que le public le voit |
| `/me/wall/wish-link` | GET | Le lien de dépôt de vœux de l'occasion en cours |

### 5.6 Crédits et paiements

| Chemin | Méthode | Rôle |
|---|---|---|
| `/me/credits` | GET | Solde et mouvements |
| `/me/credit-bundles` | GET | Les paliers d'achat proposés, avec leur remise |
| `/me/payments` | GET, POST | L'historique ; lancer un achat sur un palier |
| `/me/payment-channels` | GET | Les canaux proposés et leurs frais : opérateur, pays, barème |
| `/me/payments/preview` | POST | Ce qu'un achat coûtera : les frais, et le montant attendu sur le compte |
| `/me/collection-accounts` | GET | Les comptes sur lesquels verser — ceux que l'administration rend visibles |
| `/me/payments/{id}` | GET | Suivre une opération, puis son issue |
| `/me/payment-methods` | GET, POST | Les méthodes enregistrées, la plus récemment utilisée en tête ; en ajouter une |
| `/me/payment-methods/{id}` | DELETE | En retirer une |
| `/me/reservations` | GET | Les souhaits qu'on s'est réservés sur le Mur de proches |
| `/me/referral` | GET | Son code, ses filleuls, les crédits gagnés |
| `/me/promo-codes` | POST | Saisir un code promotionnel |

**Achat par palier.** Un achat porte **un palier** (`/me/credit-bundles`), jamais un montant libre : le plus petit palier fixe le minimum. Les paliers, leurs crédits et leurs remises se règlent depuis l'administration.

**Le paiement manuel, deux voies.** Tant que l'intégration d'un prestataire n'existe pas, un achat se règle par virement mobile et se confirme à la main. Ce sont des `Payment` ordinaires, distingués par leur `mode` — pas une entité à part, sous peine de tenir deux registres et de laisser une recharge manuelle hors de l'historique des paiements du client.

- **Semi-manuel.** Le client choisit son palier, `/me/collection-accounts` lui rend les comptes sur lesquels verser, il effectue le dépôt, puis `POST /me/payments` porte le palier, le compte visé, **le numéro qu'il a employé** et son reçu. Le paiement naît `pending`.
- **Manuel.** Un administrateur saisit tout depuis `/admin/payments` : le client, le palier, le compte qui a reçu, la référence, le reçu. Le paiement naît `pending` puis se confirme du même geste.

**L'aperçu avant de payer.** `/me/payments/preview` prend un **montant** (ou un palier), un **canal** et un **pays**, et rend les frais, le total à verser, et le **montant attendu sur le compte**. Le client sait donc combien envoyer avant d'ouvrir son application d'opérateur — et l'administrateur, combien il devrait voir arriver.

**Sur le mobile money, le client paie les frais** : un palier à 1 000 F fait verser **1 020 F**, et il en arrive **1 000**. Le montant attendu sur le compte est donc le prix du palier, et tout manque constaté est un vrai écart — pas le fonctionnement de l'opérateur. La carte se comportera à l'inverse le jour où elle arrivera : le prestataire prélève sa part sur ce qu'il reverse, d'où le champ `fee_borne_by` sur le canal plutôt qu'une règle écrite en dur.

**Les frais annoncés sont figés sur le paiement** (`fee_amount`, `expected_amount`). Le barème d'un canal change ; un paiement passé garde ce qui lui a été annoncé. Lire le taux du jour pour expliquer un paiement d'il y a trois mois donnerait un chiffre faux, sans que personne s'en aperçoive.

**La confirmation appartient à l'administration.** `/admin/payments/{id}/decision` consigne **la référence de la transaction et le montant réellement reçu**, puis confirme ou rejette avec motif. Le montant reçu se renseigne **toujours**, même sans écart : c'est lui qui permet de constater qu'il n'y en a pas. Le reçu ne prouve rien — un montage est facile : c'est la réception **sur le compte de l'opérateur** qui fait foi.

À la confirmation, les crédits sont octroyés **une seule fois** — l'unicité porte sur `credit_transaction.payment_id` — et le client est prévenu par courriel et par poussée. Chaque passage d'état ouvre une ligne d'historique avec `origin = 'admin'`, l'identifiant de l'administrateur et un **motif obligatoire**.

**Les comptes de collecte se gèrent au back-office** : nom affiché, opérateur, numéro, et un état qui décide s'ils paraissent dans l'application. Un compte ne se supprime pas — un paiement passé le référence —, il se désactive.

**Méthode.** La création d'un achat accepte soit l'identifiant d'une méthode enregistrée, soit les éléments d'une **nouvelle méthode à enregistrer au passage** — le cas du premier achat. Sans indication, le serveur retient la méthode utilisée le plus récemment.

**Achat.** La création rend un paiement **en attente**. Selon la méthode, la validation se joue chez l'opérateur (mobile money) ou chez le prestataire (carte). Le client **interroge** l'état de l'opération pour tenir son écran à jour.

**Comment une opération en attente se résout.** Trois voies, dans cet ordre :
1. **La notification du prestataire.** C'est la voie normale : il annonce l'issue dès qu'elle est connue.
2. **L'interrogation du prestataire.** Passé le **délai d'attente de la notification**, le serveur appelle le point d'état du fournisseur pour connaître le sort de l'opération. Cette interrogation se répète jusqu'à la résolution ou l'expiration.
3. **La confirmation manuelle.** Depuis le back-office, un administrateur peut trancher une opération restée en attente — le cas d'un paiement visiblement abouti chez l'opérateur que ni la notification ni l'interrogation n'ont rapporté. Elle exige un motif et rejoint le journal d'audit.

**Les crédits sont octroyés une seule fois**, au passage au succès, quelle que soit la voie qui l'a constaté. Une opération qu'aucune des trois voies ne résout **expire** au terme du délai configuré.

**Notification du prestataire.** Un point d'entrée dédié reçoit les avis du prestataire de paiement, hors des trois surfaces. Il vérifie la signature, ignore les rejeux, et se contente de faire progresser l'état du paiement.

### 5.7 Réglages et notifications

| Chemin | Méthode | Rôle |
|---|---|---|
| `/me/notification-preferences` | GET, PATCH | Canaux par nature de message, heure d'envoi |
| `/me/notifications` | GET | Le centre de notifications |
| `/me/notifications/read` | POST | Marquer comme lues |
| `/me/devices` | POST, DELETE | Enregistrer ou retirer un jeton de notification |
| `/me/data-export` | POST | Demander l'export de ses données |

### 5.8 Accueil, recherche et reprises

| Chemin | Méthode | Rôle |
|---|---|---|
| `/me/home` | GET | Ce que l'accueil affiche en un appel : les prochaines échéances, et les décomptes qui composent la phrase d'accueil |
| `/me/search` | GET | Recherche par nom de proche, au fil de la frappe |
| `/me/resumables` | GET | Les reprises : brouillons de message et portraits à finir, classés par urgence |

**Un appel pour l'accueil.** L'accueil tient en deux éléments — une phrase qui donne l'état des lieux, et les **sept** échéances les plus proches (voir 3.2 de la spécification mobile : trois cartes, puis quatre rangs). *Ce document disait trois ; le kit en demande sept, et le design tranche. À trois, il n'y a jamais de rang, jamais de reste, et l'état « Voir plus » est inatteignable.* Les échéances viennent de `/me/occurrences`, mais la phrase demande des **décomptes** que cette liste plafonnée ne donne pas : combien de dates aujourd'hui, combien dans la semaine. `/me/home` rend les deux ensemble, ce qui évite un aller-retour au démarrage et laisse le serveur composer la phrase à partir de ses propres chiffres.

Il rend aussi **`remainingOccurrences`**, le « n restants » du bouton « Voir plus ». Le client ne peut pas le calculer : la liste s'arrête à sept, et les décomptes s'arrêtent à la semaine. Il porte sur **douze mois** — sans borne, il compterait les échéances déroulées d'avance (l'ordonnanceur en ouvre trois par événement) et dirait la profondeur de déroulement, un détail interne, plutôt que ce qu'une personne reconnaît de son année.

**Ce qu'il ne porte plus.** Les contributions en attente et les reprises ont quitté l'accueil : les premières se comptent dans la cloche, les secondes se retrouvent depuis l'occasion concernée. Le décompte de la cloche accompagne néanmoins la réponse, puisque l'en-tête l'affiche dès l'ouverture.

### 5.9 Aide et retours

| Chemin | Méthode | Rôle |
|---|---|---|
| `/me/support-requests` | POST | Écrire à l'équipe ; la version de l'application et le type d'appareil accompagnent le message |
| `/me/feedback` | POST | Envoyer un avis depuis l'application |

## 6. Les drapeaux de fonctionnalité

Le produit se livre **par morceaux**. Les proches, les notes, les dates et les rappels forment le socle ; tout le reste s'allume quand il est prêt.

### 6.1 Le registre et l'état

**Le registre vit dans le code**, l'**état vit en base**. Les deux ne portent pas la même chose :

- **En code** — les clés existantes, ce que chacune gouverne, sa portée (application ou surface publique), ses dépendances, et **la liste des points d'entrée et des écrans qu'elle couvre**. Ajouter un drapeau demande un déploiement ; en échange, une clé mal orthographiée ne compile pas.
- **En base** — l'état seul : `key`, `enabled`, `updated_at`, et qui a basculé. Une ligne absente vaut **éteint**.

**Réconciliation au démarrage** : les clés du registre absentes de la base y sont créées éteintes ; un état déjà réglé n'est jamais touché.

**Le back-office lit le registre par l'API** — c'est ce qui lui permet d'annoncer les conséquences d'une bascule et de montrer ce que chaque drapeau couvre, sans dupliquer l'information.

### 6.2 Le mécanisme

- **Le client demande la liste résolue pour lui** — `/me/features` pour l'application, `/public/features` pour les surfaces sans compte. Le serveur rend *ce qui est actif*, jamais l'état brut des drapeaux : le jour où l'activation deviendra sélective, rien ne changera côté client.
- **L'appel se fait au démarrage**, et se rafraîchit ensuite. Une **valeur de repli** est embarquée dans le client : si l'appel échoue, l'application s'ouvre sur le socle plutôt que vide.
- **Un drapeau inconnu vaut éteint.** Le parc ne se met pas à jour d'un bloc.
- **La vérité est côté serveur.** Le client masque, le serveur **refuse** : un appel visant une fonctionnalité éteinte rend **`404`**, et rien n'est débité. Un `403` distinguerait « éteinte » de « non authentifiée » et révélerait ainsi l'existence de la fonctionnalité — c'est la même règle que pour la ressource d'autrui.
- **Le garde passe avant l'authentification.** Autrement, le statut trahirait ce qu'on cherche à taire.
- **Éteint par défaut.** Un drapeau s'allume ; il ne s'oublie pas allumé.

### 6.3 La liste

**Le socle, sans drapeau** — proches, notes, dates, occasions, rappels et notifications, compte. Si ce socle s'éteint, il n'y a plus d'application.

**Un drapeau par capacité, non par route.** Ce que l'utilisateur perçoit comme une seule chose s'éteint d'un bloc.

| Drapeau | Ce qu'il gouverne | Ce qu'il couvre |
|---|---|---|
| `wishlist` | Les souhaits notés sur la fiche d'un proche | Écrans 3.19 · `/me/occurrences/{id}/wishes`, `/me/wishes/{id}` |
| `wishlist.own` | Mes propres listes, leur partage et leur réservation | Écrans 3.29, public 3.6 · `/me/wishlists*`, `/me/owner-wishes/{id}`, `/public/wishlists/{token}` |
| `wall` | Le Mur, sa gestion et sa page publique | Écrans 3.10, public 3.4 · `/me/wall*`, `/public/walls/{username}` |
| `collect` | Les liens de collecte et la validation des contributions | Écrans 3.8, 3.20, public 3.2 et 3.3 · `/me/collection-links*`, `/me/submissions*`, `/public/collect/{token}` |
| `wishes` | Le dépôt de vœux et les vœux reçus | Public 3.5 · `/me/wall/wish-link`, `/me/received-wishes*`, `/public/wishes/{token}` |
| `reservation` | La réservation d'un souhait par un visiteur | Écran 3.27 · `/me/reservations`, `/public/owner-wishes/{id}/reserve*` |
| `generation.message` | Le message généré | Écran 3.7 (message) · `/me/generations` (type message), `/me/messages/{id}` |
| `generation.ideas` | Les idées de cadeaux | Écran 3.7 (idées) · `/me/generations` (type idées) |
| `generation.portrait` | Le studio et le portrait | Écrans 3.22 et le studio · `/me/studio/options`, `/me/generations` (type portrait), `/me/portraits/*` |
| `credits` | L'achat de crédits dans l'application | Écran 3.9 (achat), 3.25 · `/me/credit-bundles`, `/me/payments`, `/me/payment-methods*` |
| `topup.manual` | Le versement manuel : verser sur un compte affiché, puis déposer son reçu | Écran 3.9 (autre chemin) · `/me/collection-accounts`, `/me/payments` en mode semi-manuel |
| `referral` | Le parrainage et la page d'invitation | Écran 3.9 (inviter), public 3.7 · `/me/referral`, `/public/invitations/{code}` |
| `launch.live` | Sur la landing : les liens vers les magasins, ou le formulaire de liste d'attente | Public 3.1 · `/public/waitlist` |

**`launch.live` se lit à l'exécution**, par `/public/config` — ce n'était autrefois qu'une variable de construction cuite dans l'image. Trois conséquences : basculer est un **geste d'administration**, plus un redéploiement ; la bascule met jusqu'à **cinq minutes** à paraître, le temps du cache de page ; et **une API injoignable ou incomplète vaut pré-lancement**. C'est une décision : mieux vaut afficher la capture d'adresse que promettre une application indisponible.

**Cette couverture vit dans le registre**, et le back-office l'affiche : un administrateur doit voir **ce qu'il éteint** avant de basculer, sans lire le code.

### 6.4 Les dépendances

Certaines extinctions en emportent d'autres. Le serveur les résout **avant** de rendre la liste, pour que le client n'ait aucune règle à connaître.

- `wall` éteint emporte `wishes` et `reservation` — le dépôt de vœux et la réservation passent par le Mur.
- `wishlist.own` éteint emporte `reservation` — il n'y a plus de liste partagée à réserver.
- `credits` éteint : les générations restent **disponibles et gratuites** si leur propre drapeau est allumé. Éteindre l'achat ne doit pas éteindre le produit ; c'est `topup.manual` qui prend le relais pour les recharges.

### 6.5 L'arrêt pour intervention n'est pas un drapeau

**Les confondre casserait l'application.**

| | Drapeau éteint | Arrêt pour intervention |
|---|---|---|
| Statut | `404` | **`503`**, code `maintenance` |
| Ce que ça dit | « cette surface n'existe pas » | « reviens, voici le délai » |
| Ce que le client fait | masque l'écran | **écran d'attente, ne masque rien** |
| Portée | une surface | toutes |
| Quand | lu au démarrage | tombe au milieu d'une session |

Un arrêt traité comme un drapeau ferait lire une fenêtre de deux heures comme une suppression définitive : l'écran disparaîtrait, et ne reviendrait qu'à la réinstallation.

**Le `503` porte `details.retryAfterSeconds`.** Le client attend **ce délai-là**, jamais un délai à lui : il vient du serveur pour que tout le parc applique la même règle, et pour qu'on puisse l'allonger si l'intervention dure.

**Puis il interroge `/public/maintenance`** plutôt que de rejouer l'appel d'origine.

**Aucune déconnexion, aucun cache vidé.** Un arrêt n'est pas une invalidation de session.

**Deux chemins répondent pendant un arrêt** : `/v1/admin*` et `/public/maintenance`. Tous les autres rendent `503`, **y compris `/public/config` et `/auth/*`** — l'écran d'attente doit donc exister **avant** l'entrée dans l'application, pas seulement après.

### 6.6 Ce que l'extinction demande au dessin

Une fonctionnalité éteinte laisse un trou, et **le trou doit rester habitable**. Trois endroits l'exigent :

- **La barre d'onglets** tient à trois comme à quatre ; aucune largeur n'est figée, et l'onglet d'ouverture existe toujours.
- **Les cartes à deux actions** savent vivre avec une seule — la carte d'échéance perd *préparer* si la génération est éteinte, et ne doit pas paraître amputée.
- **Les renvois disparaissent** plutôt que de mener à un écran vide : une fiche ne propose pas un studio éteint, une occasion ne propose pas une préparation indisponible.

## 7. Surfaces publiques (`/v1/public`)

Ces appels se font **sans compte**. L'autorisation tient au **jeton porté par le lien** : il désigne la ressource et vaut permission, rien d'autre.

| Chemin | Méthode | Rôle |
|---|---|---|
| `/public/walls/{username}` | GET | Un Mur publié |
| `/public/wishlists/{token}` | GET | Une liste partagée et l'état de ses souhaits ; les réservations du visiteur y sont signalées s'il présente son jeton |
| `/public/owner-wishes/{id}/reserve` | POST | Réserver un souhait : nom facultatif et choix de se faire connaître ; un visiteur sans compte y ajoute son adresse, un utilisateur connecté réserve en un geste |
| `/public/owner-wishes/{id}/reserve/verify` | POST | Saisir le code reçu ; la réservation devient effective et un jeton de session est remis |
| `/public/collect/{token}` | GET, POST | Le formulaire de collecte ; envoyer une contribution |
| `/public/collect/{token}/submissions` | GET | Ce que ce répondant a déjà envoyé, avec le sort de ses souhaits |
| `/public/wishes/{token}` | GET, POST | Le dépôt de vœux d'une occasion |
| `/public/invitations/{code}` | GET | Une invitation au parrainage : qui invite, ce que l'invité y gagne |
| `/public/features` | GET | Les fonctionnalités actives sur les surfaces sans compte |
| `/public/maintenance` | GET | L'état d'un arrêt pour intervention, et le délai avant de réessayer |
| `/public/config` | GET | Les valeurs publiques d'affichage : crédits offerts à l'inscription, bonus d'invitation, prix du crédit |
| `/public/legal/{document}` | GET | Conditions d'utilisation, politique de confidentialité, mentions légales |
| `/public/waitlist` | POST | Déposer son adresse sur la liste d'attente, tant que la landing est en pré-lancement |

**Configuration publique.** La page d'invitation et la landing annoncent des montants qui se règlent côté administration. Elles les lisent ici plutôt que de les figer dans le code du site.

**Liens universels.** Le domaine sert les fichiers d'association attendus par les deux systèmes mobiles, et l'application déclare les chemins qu'elle prend en charge — Murs, collectes, dépôts de vœux, invitations. Un lien ouvre alors l'application lorsqu'elle est installée, le navigateur sinon. Un chemin inconnu d'une version installée s'ouvre dans le navigateur plutôt que d'échouer : **le parc ne se met pas à jour d'un bloc**.

**Ce qui sort d'ici.** Uniquement ce que le propriétaire a rendu public. Les notes, les fiches des proches, les souhaits privés et les vœux ne franchissent jamais cette frontière — la règle vit dans la requête, pas dans le client.

**Réponses d'état.** Un lien révoqué, une fenêtre de vœux fermée, un Mur dépublié : le serveur rend un état explicite que la page traduit en message, plutôt qu'une absence sèche.

## 8. Administration (`/v1/admin`)

Réservée aux comptes d'administration, avec les deux rôles du modèle.

| Chemin | Méthode | Rôle |
|---|---|---|
| `/admin/dashboard` | GET | Les indicateurs et les files à traiter |
| `/admin/users` | GET | Rechercher et filtrer les comptes |
| `/admin/users/{id}` | GET, PATCH | Le détail ; suspendre, rétablir, restaurer |
| `/admin/users/{id}/credits` | POST | Ajuster un solde, avec motif |
| `/admin/payments` | GET, POST | Paiements et remboursements ; **en saisir un de bout en bout** (voie manuelle) |
| `/admin/payments/{id}/decision` | POST | Confirmer ou rejeter : référence de la transaction, montant constaté, motif |
| `/admin/payments/{id}/refund` | POST | Déclencher un remboursement |
| `/admin/collection-accounts` | GET, POST, PATCH | Les comptes de collecte : nom, opérateur, numéro, visibilité dans l'application |
| `/admin/payment-channels` | GET, POST, PATCH | Les canaux et **leurs barèmes de frais** : part proportionnelle, part fixe, plancher, plafond, qui les supporte |
| `/admin/moderation` | GET | Les contenus à examiner |
| `/admin/moderation/{id}/decision` | POST | Masquer, révoquer, désactiver, classer |
| `/admin/parameters` | GET, PATCH | La configuration globale |
| `/admin/feature-flags` | GET, PATCH | Allumer et éteindre les fonctionnalités ; la lecture rend **ce que chaque drapeau couvre** — écrans et points d'entrée — d'après le registre |
| `/admin/maintenance` | GET, POST, DELETE | Déclencher un arrêt pour intervention avec sa durée, le prolonger, le lever |
| `/admin/credit-bundles` | GET, POST, PATCH | Les paliers d'achat et leurs remises |
| `/admin/ai-models` | GET, PATCH | Catalogue et routage |
| `/admin/portrait-studio/candidates` | GET | Les valeurs candidates : modèles, orientations, ambiances, motifs, gabarits |
| `/admin/portrait-studio/config` | GET, PATCH | La configuration en service et le brouillon en cours |
| `/admin/portrait-studio/config/publish` | POST | Mettre le brouillon en service |
| `/admin/portrait-studio/config/rollback` | POST | Republier une version antérieure |
| `/admin/portrait-studio/config/history` | GET | Les publications, leur auteur et leur date |
| `/admin/portrait-studio/profiles` | GET, POST, PATCH, DELETE | Les profils de simulation |
| `/admin/portrait-studio/trials` | GET, POST | Essayer une combinaison sur un profil ; relire les essais |
| `/admin/portrait-studio/templates` | GET, POST | Les gabarits de production et leurs versions |
| `/admin/portrait-studio/templates/{id}` | GET, PATCH | Un gabarit, son historique, le retour à une version antérieure |
| `/admin/promo-codes` | GET, POST, PATCH | Les codes promotionnels |
| `/admin/metrics` | GET | L'usage détaillé |
| `/admin/audit-log` | GET | Le journal des actions sensibles |
| `/admin/login-activity` | GET | Les tentatives de connexion |
| `/admin/auth/otp` | POST | Demander un code de connexion au back-office |
| `/admin/auth/otp/verify` | POST | Échanger le code contre une session d'administration |
| `/admin/auth/session` | DELETE | Se déconnecter du back-office |
| `/admin/users/{id}/device-limit` | POST | Lever le plafond de comptes d'un appareil, avec motif |
| `/admin/payments/{id}/retry` | POST | Relancer une opération restée en suspens |
| `/admin/payments/{id}/confirm` | POST | Trancher manuellement une opération en attente, avec motif |
| `/admin/payments/{id}/refund-override` | POST | Lever le blocage anti-fraude d'un remboursement, avec motif |
| `/admin/referrals` | GET, PATCH | Les parrainages et la correction d'un octroi |
| `/admin/admins` | GET, POST, PATCH, DELETE | Les comptes d'administration et leur rôle |
| `/admin/external-links` | GET, POST, PATCH, DELETE | Les raccourcis vers les plateformes tierces |
| `/admin/exports` | POST | Demander l'export d'une liste filtrée |

**Le studio, deux règles.** La **publication est refusée** tant qu'aucun essai n'a tourné sur le brouillon en cours. Et un essai **coûte en argent réel** sans consommer de crédit : il s'enregistre dans le suivi de consommation, avec un plafond quotidien.

**Motif obligatoire.** Les appels qui modifient l'état d'un compte, un solde ou un contenu **exigent un motif** dans leur corps. Sans lui, la requête échoue — c'est ce qui garantit que le journal d'audit dit quelque chose.

**Droits.** Le rôle se vérifie à chaque appel. Le back-office masque ce qu'un rôle ne peut pas faire, mais c'est le serveur qui refuse.

## 9. Droits d'accès

Chaque point d'entrée porte une **exigence d'accès explicite**, vérifiée avant tout traitement. Rien n'est ouvert par omission : un chemin sans règle déclarée est refusé.

### 8.1 Les quatre niveaux

| Niveau | Ce qu'il faut présenter | Ce qu'il ouvre |
|---|---|---|
| **Ouvert** | Rien | `/v1/public/config`, `/v1/public/legal/*`, la demande de code de connexion |
| **Jeton de lien** | Le jeton porté par l'adresse | La ressource que ce jeton désigne, et elle seule |
| **Propriétaire** | Un jeton de session valide | Ce qui appartient au porteur du jeton, dans `/v1/me` |
| **Administration** | Un jeton d'administration, plus le rôle requis | `/v1/admin`, selon le rôle |

### 8.2 Le rôle sur les chemins d'administration

Les deux rôles du modèle se traduisent chemin par chemin. Le **support** couvre l'assistance quotidienne ; l'**administrateur** ajoute ce qui engage l'économie du service.

| Chemin | Support | Administrateur |
|---|---|---|
| `/admin/dashboard` | Lecture | Lecture |
| `/admin/users`, `/admin/users/{id}` | Lecture, suspension, rétablissement, restauration pendant la grâce | Idem, plus l'effacement immédiat |
| `/admin/users/{id}/credits` | — | Ajustement, avec motif |
| `/admin/users/{id}/device-limit` | Levée, avec motif | Levée, avec motif |
| `/admin/payments` | Lecture | Lecture, et **saisie d'un paiement manuel** |
| `/admin/payments/{id}/retry` | Relance | Relance |
| `/admin/payments/{id}/decision` | — | **Confirmation ou rejet**, avec la référence de la transaction, le montant constaté et un motif |
| `/admin/collection-accounts` | Lecture | Gestion complète : ouvrir, renommer, rendre visible ou non |
| `/admin/payment-channels` | Lecture | Gestion complète, **barèmes compris** — un taux touche tous les achats à venir |
| `/admin/payments/{id}/refund` | — | Déclenchement |
| `/admin/payments/{id}/refund-override` | — | Levée, avec motif |
| `/admin/moderation`, `/admin/moderation/{id}/decision` | Lecture et décision | Lecture et décision |
| `/admin/parameters` | Lecture | Lecture et modification |
| `/admin/ai-models` | — | Lecture et modification |
| `/admin/promo-codes`, `/admin/referrals` | — | Gestion complète |
| `/admin/metrics`, `/admin/login-activity`, `/admin/external-links` | Lecture | Lecture (et gestion des liens) |
| `/admin/audit-log` | — | Lecture |
| `/admin/admins` | — | Gestion complète |

Un rôle insuffisant rend **`403`** — ici, l'existence du chemin est déjà connue de l'équipe, la dissimuler n'apporterait rien.

### 8.3 Ce que le rôle ne remplace pas

- Le **motif** reste exigé sur les actions sensibles, quel que soit le rôle qui les exerce.
- Le **cloisonnement** s'applique aussi en administration : consulter le compte d'un utilisateur donne accès à son état, ses volumétries et ses mouvements — le contenu de ses fiches et de ses notes demeure hors de portée.
- Le **journal d'audit** enregistre l'auteur réel, y compris lorsqu'un administrateur agit pour le compte de quelqu'un.

## 10. Sécurité

### 9.1 Sessions

- **L'accès par code ou par fournisseur d'identité.** L'entrée repose sur le code à usage unique, Google ou Apple : l'utilisateur garde en mémoire sa seule adresse, et le serveur détient un secret de moins.
- **Jetons de courte durée**, renouvelés par un jeton de rafraîchissement de plus longue vie, stocké dans le coffre sécurisé de l'appareil.
- **Le rafraîchissement fait tourner le jeton** : réutiliser un jeton déjà consommé signale un vol et invalide la lignée entière.
- **La déconnexion invalide côté serveur**, pas seulement dans le client.

### 9.2 Code à usage unique

- Conservé **haché**, jamais en clair, avec une durée de vie courte. Le hachage est un **HMAC-SHA-256 sous clé tenue dans l'environnement** : un code à six chiffres ne compte qu'un million de valeurs, qu'une lecture de la base suffirait à énumérer si le condensé se calculait sans secret. La comparaison se fait en temps constant. Aucun mot de passe n'existe dans le produit — l'entrée repose sur le code et les fournisseurs d'identité —, donc aucune fonction de hachage lente (bcrypt, argon2, scrypt) n'a d'emploi ici : elle n'ajouterait rien à la défense et offrirait un levier de saturation sur un point d'entrée ouvert sans compte.
- **Nombre de tentatives borné** par code ; au-delà, il est brûlé.
- **Fréquence de demande limitée par adresse destinataire** autant que par origine : un point d'entrée qui envoie un courrier à une adresse fournie par l'appelant sert autrement à arroser un tiers.
- **Le délai entre deux demandes croît** — cinq secondes, puis vingt-cinq, puis cent vingt-cinq. Il est **rendu par le serveur** dans `retryAfterSeconds` : le client l'attend sans le recalculer, faute de quoi deux versions du parc appliqueraient deux règles et celle du serveur resterait la seule qui compte.
- **Réponse uniforme** : demander un code pour une adresse inconnue rend la même réponse que pour une adresse connue. La liste des comptes reste ainsi hors de portée.

### 9.3 Cloisonnement

- L'appartenance se vérifie **à chaque requête**, à partir du jeton — jamais d'un paramètre.
- Une ressource d'autrui rend **`404`**, pas `403` : répondre « interdit » confirmerait son existence.
- Les identifiants sont des **UUID**, sans suite devinable.

### 9.4 Jetons de liens publics

- **Longs et imprévisibles**, tirés au hasard.
- **Révocables** à tout instant, par le propriétaire comme par la modération.
- Les pages qu'ils servent sont **exclues de l'indexation** par les moteurs.
- Le jeton donne accès à **une seule ressource**, jamais à un ensemble.

### 9.5 Entrées

- **Tout ce qui arrive est validé** avant traitement : type, format, bornes, valeurs d'énumération. Un champ inattendu fait échouer la requête, plutôt que de passer inaperçu.
- **Les identifiants sont vérifiés comme des UUID**, et leur appartenance contrôlée séparément : reconnaître la forme ne vaut pas autorisation.
- **Les contenus saisis sont stockés tels quels** et **échappés à l'affichage**, selon le contexte de sortie. La protection vit au rendu, là où le risque se matérialise.
- **Les requêtes en base passent par des paramètres liés**, la valeur restant toujours distincte de l'instruction.
- **La taille des corps de requête est bornée**, ainsi que la longueur de chaque champ de texte.

### 9.6 Fichiers reçus

Une photo de profil est un fichier venu de l'extérieur ; il mérite le même soin qu'un formulaire.

- **Type réel vérifié** à partir du contenu lui-même, l'extension et le type déclaré étant traités comme de simples indications.
- **Poids et dimensions bornés**, l'image étant **recomposée** au format voulu — ce qui écarte au passage tout contenu greffé dans le fichier d'origine.
- **Métadonnées retirées**, notamment la position géographique qu'un téléphone y inscrit.
- **Servis depuis un domaine distinct** de l'application, avec un nom tiré au hasard.

### 9.7 Le stockage des fichiers

**Cloudflare R2**, compatible S3, sert les portraits, les photos de profil et les photos de souhaits. Le plan gratuit couvre **10 Go de stockage, un million d'écritures et dix millions de lectures par mois, sans frais de sortie** — les opérations ne seront jamais contraignantes, le stockage l'est.

**L'accès passe par des URL signées à durée courte.** Le serveur produit le fichier, le dépose, et rend une adresse temporaire ; le client la télécharge directement. L'application redemande une adresse lorsqu'elle a besoin d'afficher — la base garde la **référence de l'objet**, jamais l'URL signée. Le nom du fichier est tiré au hasard : un portrait est un contenu intime, son adresse ne se devine pas.

**Trois mesures tiennent les 10 Go.**

- **Redimensionner à l'enregistrement.** Un portrait servi en 1080 pixels n'est pas conservé plus grand ; une photo de profil encore moins. Rien n'est stocké à une taille qui ne sert pas.
- **Effacer ce qui est jetable.** La **photo source** d'un portrait est retirée dès le traitement terminé : seule l'image produite compte. Les fichiers qu'aucun contenu ne référence plus partent au nettoyage hebdomadaire (voir 15.4). Les exports de données expirent avec leur lien.
- **Surveiller l'occupation.** Le tableau de bord du back-office affiche l'espace occupé et sa progression ; une alerte se déclenche bien avant le plafond, pas lorsqu'il est atteint.

Au-delà du plan gratuit, le passage au payant est indolore et sans frais de sortie.

### 9.8 Liens saisis par des tiers

Un souhait porte une adresse, et cette adresse peut venir d'un proche via un lien de collecte.

- **Schéma restreint** aux adresses web ordinaires.
- **Ouverts en isolation** : la page d'origine reste ignorée du site visité, qui n'a aucune prise sur l'onglet appelant.
- **Affichés en clair** sur les surfaces publiques, pour que le visiteur voie où il va avant de cliquer.

### 9.9 Surfaces web publiques

- **En-têtes de sécurité** : politique de contenu restreignant les sources, transport strictement chiffré, refus de l'encadrement par un site tiers, type de contenu respecté.
- **Origines autorisées** déclarées explicitement pour les appels depuis le navigateur — une **liste fermée**, jamais `*`.
- **Relais de confiance** : le nombre de relais placés devant l'API se déclare, sans quoi l'adresse d'origine lue est celle du relais. Le plafond « par origine » deviendrait alors **un compteur unique partagé par tous les visiteurs**, et la limitation ne limiterait plus rien.
- **Cookies** — s'il en faut : inaccessibles au script, restreints au domaine et à la navigation propre au site.
- **Formulaires publics protégés** contre l'envoi automatisé, par une épreuve légère qui se déclenche à la suspicion plutôt qu'à chaque visite.

### 9.10 Abus

- **Débit limité** là où l'on peut appeler sans compte : envoi d'une contribution via un lien de collecte, dépôt d'un vœu, **réservation d'un souhait**, et **demande d'un code de connexion** (`/auth/otp`) — cette dernière bornée **par adresse destinataire** autant que par origine, comme le détaille 10.2. Borner la seule origine laisserait ces points d'entrée servir à arroser la boîte d'un tiers.
- **Plafond de comptes par appareil** vérifié avant toute création, l'adresse étant conservée pour les investigations.
- **Taille des contenus bornée** en entrée ; les images sont vérifiées et recompressées avant stockage.
- **Coût de la génération protégé.** Chaque appel d'IA se paie en argent réel : le crédit est **débité avant** l'appel, une même demande relancée rejoint celle en cours, et un plafond d'appels par compte et par heure contient l'emballement, qu'il vienne d'un défaut du client ou d'une intention.
- **Réservations protégées.** Les adresses jetables sont refusées, et l'énumération d'une même boîte par suffixes (`a+1@`, `a+2@`) est détectée : la partie qui suit le `+` est ignorée pour le décompte des demandes.
- **Codes promotionnels et parrainage bornés** : usage unique par compte, plafond global par code, et octroi du bonus d'invitation à la seule création de compte.

### 9.11 Données

- **Deux natures de moyens de paiement, deux traitements.** Une **carte** reste chez le prestataire, qui nous rend une référence opaque : rien de bancaire ne descend jusqu'à nous. Un **compte mobile money**, lui, s'identifie par son **numéro de téléphone** : nous le conservons en base, puisqu'il est nécessaire pour initier une transaction et pour verser un remboursement.
- **Le numéro conservé est protégé en conséquence** : chiffré au repos, sorti en clair pour la seule communication avec le prestataire, et **masqué à l'affichage** dans l'application comme dans le back-office (opérateur et derniers chiffres). Il ne paraît dans aucun journal.
- **Chiffrement en transit** partout ; sauvegardes chiffrées.
- **Suppression réellement effective** au terme du délai de grâce, jusqu'aux fichiers stockés.
- **Les traces de sécurité** (connexions, audit, créations de compte par appareil) survivent à la suppression sous une forme anonymisée : leur lien vers le compte est rompu, la ligne demeure. Elles font foi, et certaines fondent une protection — un plafond dont les traces s'effacent avec les comptes se contourne en créant puis supprimant.

### 9.12 Secrets et accès à l'infrastructure

- **Les secrets vivent hors du code** : clés de fournisseurs, jetons de signature et accès à la base sont fournis par l'environnement, et l'historique du dépôt en reste exempt.
- **Rotation possible sans redéploiement**, et rotation effective après tout départ de l'équipe ou tout soupçon de fuite.
- **Accès aux consoles tierces nominatif**, avec double facteur — la section des liens externes du back-office ne fait qu'y mener, chaque plateforme gardant sa propre authentification.
- **Accès à la base de production réservé** et tracé ; les environnements de travail utilisent des données anonymisées.

### 9.13 Dépendances et livraison

- **Dépendances figées** par un verrou de version, et vérifiées automatiquement contre les vulnérabilités connues.
- **Mises à jour de sécurité traitées en priorité**, à rythme régulier.
- **Analyse du code à chaque contribution**, avec relecture obligatoire avant fusion.
- **Secrets recherchés dans l'historique** à chaque contribution, pour attraper l'oubli avant qu'il ne parte.

### 9.14 Notification du prestataire de paiement

- **Signature vérifiée** avant tout traitement.
- **Rejeu ignoré** : une notification déjà traitée ne produit rien de plus.
- **Le montant confirmé à la source** : le serveur vérifie l'opération auprès du prestataire avant d'octroyer les crédits, la notification servant de déclencheur.

## 11. Performance

### 10.1 Budgets

Mesurés au neuvième dixième des appels, hors réseau du client :

| Type d'appel | Budget |
|---|---|
| Lecture d'une liste (échéances, annuaire, notifications) | 300 ms |
| Lecture d'un détail (fiche, occasion) | 300 ms |
| Écriture simple (note, souhait, réglage) | 500 ms |
| Page publique (Mur, collecte) rendue au serveur | 800 ms |
| Lancement d'une génération (le débit et l'accusé) | 500 ms |
| Production d'une génération (bout en bout) | 30 s |
| Lancement d'un achat | 1 s |

Les deux dernières lignes échappent au client : elles dépendent du modèle et de l'opérateur. C'est précisément pourquoi l'écran les traite comme des attentes, et non comme des lenteurs.

### 10.2 Volumétrie

Une fiche compte des dizaines de notes, un compte quelques dizaines de proches. **Les listes restent donc courtes** — mais le Mur d'une personne peut être ouvert par des centaines de visiteurs le même jour, et les rappels partent en masse au petit matin. C'est là que se situe la charge, pas dans l'espace privé.

### 10.3 Ce qui tient les budgets

- **Index** sur les accès quotidiens : les occurrences par date, les notes par proche, les paiements par utilisateur.
- **Une requête par écran** : les listes rendent d'emblée ce que la surface affiche (le proche et son décompte sur une échéance), plutôt que d'obliger le client à réclamer chaque pièce.
- **Cache court sur les pages publiques**, invalidé dès que le propriétaire change ce qu'il expose.
- **Images servies redimensionnées** depuis le stockage, jamais retaillées à la demande.
- **Envois en masse étalés** : les rappels du matin se répartissent plutôt que de partir à la même seconde.

### 10.4 Charge de l'IA

- **Le coût réel de chaque appel est enregistré** et rapporté aux revenus des crédits — c'est ce qui dit si le prix tient.
- **Repli entre fournisseurs** : l'indisponibilité de l'un bascule sur le suivant, selon la priorité de routage réglée depuis le back-office. Disposer de trois fournisseurs distincts protège autant de la panne que de la hausse tarifaire.
- **Délai maximal** par appel ; au-delà, la génération échoue proprement et le crédit revient.

### 10.5 Hors connexion

L'application garde de quoi consulter ce qui a déjà été chargé — les fiches, les échéances à venir. Les actions qui écrivent attendent le réseau, et l'écran le dit.

## 12. Multilingue

L'application existe en français et en anglais, et cette dualité traverse le contrat. Trois langues distinctes cohabitent, qu'il faut garder séparées.

### 11.1 Trois langues, trois usages

| Langue | Où elle vit | Ce qu'elle décide |
|---|---|---|
| **Langue de l'interface** | `user.ui_language` | Ce que l'utilisateur lit dans l'application et reçoit par e-mail |
| **Langue de communication** | `person.language` | La langue des contenus générés pour ce proche |
| **Langue du visiteur** | L'en-tête de la requête | Ce qu'affiche une surface publique à quelqu'un qui n'a pas de compte |

### 11.2 Ce que le serveur rend

- **Des codes, pas des phrases.** Les erreurs, les états et les catégories voyagent sous forme de **codes stables** ; le client les traduit. Le serveur reste ainsi indifférent à la langue de celui qui l'appelle.
- **Les libellés d'énumération** (catégories de notes, états de souhait, natures d'événement) suivent la même règle : le code circule, le libellé vit dans les ressources de traduction du client.
- **Le contenu saisi voyage tel quel.** Un intitulé d'événement, une note, un souhait sont écrits par quelqu'un : ils ne se traduisent pas.

### 11.3 Ce que le serveur produit lui-même

Trois familles de textes naissent côté serveur et doivent donc porter leur langue :

- **Les e-mails** (code de connexion, rappels, récapitulatif, reçus) suivent la **langue de l'interface** du destinataire.
- **Les notifications poussées** suivent la même règle.
- **Les contenus générés** suivent la **langue de communication du proche** visé, indépendamment de celle de l'utilisateur. Une personne dont l'interface est en anglais peut ainsi préparer un message en français pour sa mère.

**Une valeur par proche, modifiable au moment de générer.** La langue de communication est un paramètre de la fiche (`person.language`) : elle sert de **défaut**, ce qui évite de la choisir à chaque fois. L'écran de composition la rappelle et laisse la **remplacer pour cette génération**, exactement comme le registre. La demande de génération porte donc la langue effective ; à défaut, le serveur retient celle de la fiche. Comme tout changement de paramètre, en choisir une autre **relance une génération** et consomme un crédit.

**La langue de production est conservée** sur chaque contenu généré : un message reste dans sa langue même si la préférence du proche change ensuite.

### 11.4 Surfaces publiques

Une page publique est lue par des visiteurs dont on ignore tout. Elle choisit sa langue dans cet ordre : le paramètre porté par l'adresse s'il existe, puis l'en-tête de langue du navigateur, puis la langue de l'interface du propriétaire — car sa page s'adresse d'abord à ses proches.

### 11.5 Dates, nombres et monnaie

- Les dates circulent en **format normalisé avec fuseau** ; leur mise en forme appartient au client.
- Les **décomptes de jours** se calculent dans le fuseau de l'utilisateur, que le client transmet — sans quoi « aujourd'hui » désignerait autre chose selon l'endroit.
- Les **montants** portent toujours leur devise ; l'affichage suit la langue.

## 13. Journalisation et supervision

### 12.1 Trois registres distincts

Ils répondent à des questions différentes et se conservent séparément.

| Registre | Ce qu'il enregistre | Qui le consulte | Combien de temps |
|---|---|---|---|
| **Journal d'audit** (`AuditLog`) | Les actions sensibles des administrateurs, avec auteur, cible et motif | Les administrateurs, dans le back-office | Longue durée — il fait foi |
| **Traces de connexion** (`LoginActivity`) | Les tentatives d'accès, réussies comme échouées | Les administrateurs | Durée bornée, définie par la politique de conservation |
| **Journaux techniques** | Requêtes, erreurs, latences, appels aux tiers | L'équipe, dans Sentry | Courte durée |

Les deux premiers sont des **données métier**, stockées en base. Le troisième vit dans l'infrastructure d'observation et n'entre pas au modèle.

### 12.2 Ce que porte une trace technique

Chaque requête traitée laisse : un **identifiant de corrélation** (qui suit l'appel à travers les services), le chemin et la méthode, le statut rendu, la durée, la surface d'origine, et — lorsqu'il y a une session — l'**identifiant du compte**, jamais son adresse e-mail. Les incidents remontent dans Sentry avec ce même identifiant de corrélation, de sorte qu'une erreur signalée se relie à la requête qui l'a produite.

**Ce qui n'entre jamais dans un journal technique** : le contenu des notes, des souhaits et des messages ; les codes à usage unique ; les jetons de session ou de lien ; les numéros de compte mobile money et les références de carte. Les champs sensibles sont masqués à l'écriture, pas après coup.

### 12.3 Ce qu'on surveille

- **Santé** — taux d'erreur par surface, latence au neuvième dixième, disponibilité des points d'entrée.
- **Ressources de la machine** — espace disque, mémoire, charge du processeur, connexions ouvertes à la base. Sur un VPS, l'épuisement d'une ressource arrête tout : la surveiller vaut mieux que la découvrir.
- **Occupation du stockage de fichiers** — l'espace employé sur R2 et sa progression, rapportés au plafond du plan.
- **Files d'attente** — générations en attente, paiements restés en suspens, notifications à envoyer : leur âge dit plus que leur nombre.
- **Tiers** — disponibilité et latence d'Anthropic, DeepSeek et Grok, du prestataire de paiement, de Mailgun et de OneSignal ; taux de rebond des e-mails et taux de jetons d'appareil invalides.
- **Économie** — coût réel des appels d'IA rapporté aux revenus des crédits, suivi en continu plutôt qu'en fin de mois. Y compris les appels **non facturés** : essais du studio, classement des notes, détection du sensible.
- **Abus** — séries d'échecs de connexion, créations de comptes rapprochées sur un même appareil, envois massifs sur les surfaces publiques.

### 12.4 Ce qui déclenche une alerte

Une alerte se justifie lorsqu'une personne doit agir. Le seuil compte moins que la certitude qu'il appelle un geste.

- Taux d'erreur serveur au-dessus de son ordinaire sur une surface.
- Paiements en attente qui s'accumulent au-delà du délai de l'opérateur — le signe qu'une notification se perd.
- Générations en échec en série — le signe qu'un fournisseur d'IA défaille.
- Rappels du matin partis en retard : c'est la promesse du produit qui est en jeu.
- Coût d'IA par crédit qui dépasse le prix du crédit.
- Espace disque ou mémoire proches de la saturation, et échec d'une sauvegarde quotidienne.
- **Occupation du stockage de fichiers au-delà de 70 % du plafond** — le seuil laisse le temps de décider, plutôt que d'agir dans l'urgence.

### 12.5 Suivre une opération de bout en bout

L'identifiant de corrélation accompagne une action depuis l'appel initial jusqu'à sa résolution — y compris à travers une attente. Un paiement lancé le matin et confirmé une heure plus tard par le prestataire se relit ainsi d'un seul tenant : l'initiation, l'attente, la notification reçue, l'octroi des crédits.

Au-delà de cette durée de conservation courte, la vie d'un paiement se relit dans `PaymentStatusHistory` : c'est une donnée métier, conservée en base et présentée dans le back-office.

## 14. Notifications

### 13.1 Principes

- **Une nature, un réglage.** Chaque famille de message se règle indépendamment, avec son canal (notification sur le téléphone, e-mail, les deux, aucun). Les préférences vivent dans `/me/notification-preferences`.
- **Toute notification laisse une trace.** L'entité `Notification` enregistre ce qui est parti : sa nature, sa cible, son canal, son horodatage, son état. Elle sert à trois choses — éviter les doublons, alimenter le centre de notifications, et mesurer.
- **Le centre in-app reçoit tout.** Ce qui part en notification poussée s'y retrouve toujours ; l'inverse est vrai aussi — un message peut n'exister que dans le centre.
- **Chaque message mène quelque part.** Une notification ouvre l'écran qui permet d'agir, jamais l'accueil : un rappel d'échéance ouvre la préparation, une contribution ouvre la validation.
- **La sécurité passe outre les réglages.** Nouvelle connexion, suppression de compte demandée, paiement litigieux : ces messages partent quel que soit le paramétrage.

### 13.2 Le catalogue

| Nature | Ce qui la déclenche | Canaux | Quand |
|---|---|---|---|
| **Rappel d'échéance** | Une occasion approche, au délai d'anticipation réglé | Poussée, e-mail | À l'heure d'envoi choisie, le jour venu |
| **Le jour même** | L'occasion a lieu aujourd'hui | Poussée, e-mail | À l'heure d'envoi |
| **Récapitulatif** | La période choisie s'achève | E-mail surtout | Selon la fréquence réglée |
| **Contribution reçue** | Un proche a répondu à un lien de collecte | Poussée, e-mail | À l'arrivée |
| **Vœu reçu** | Un message est déposé pendant la fenêtre | Poussée | À l'arrivée, groupé si plusieurs se suivent |
| **Relance d'enrichissement** | Une fiche reste peu remplie | Poussée, e-mail | Cadence réglée, désactivable |
| **Génération prête** | Un portrait ou un message est produit | Poussée | À la fin de la production, si l'utilisateur a quitté l'écran |
| **Paiement abouti** | Un achat est confirmé | Poussée | À la confirmation, si l'utilisateur a quitté l'écran |
| **Paiement échoué ou expiré** | L'opération se solde sans succès | Poussée, e-mail | À la résolution |
| **Crédits reçus** | Parrainage abouti, code promotionnel, geste d'un administrateur | Poussée | À l'octroi |
| **Code de connexion** | Une demande de connexion | E-mail | Immédiat |
| **Sécurité** | Nouvelle connexion, suppression demandée, méthode de paiement modifiée | E-mail | Immédiat, hors réglages |
| **Compte** | Fin du délai de grâce approchant, export prêt | E-mail | Selon l'échéance |

### 13.3 Ce qui évite le harcèlement

- **Un rappel par occasion et par échéance** : le registre empêche qu'un incident de traitement le renvoie deux fois.
- **Les vœux se groupent** : plusieurs messages reçus dans la même heure donnent une notification, pas cinq.
- **L'heure d'envoi est respectée**, dans le fuseau de l'utilisateur — un rappel ne réveille personne.
- **Les relances se raréfient** lorsqu'elles restent sans effet, plutôt que de revenir à cadence fixe.

### 13.4 Les services d'acheminement

- **Notifications poussées : OneSignal**, qui couvre les deux magasins d'applications. L'application enregistre son jeton d'appareil (`/me/devices`) ; le serveur adresse ses envois par identifiant d'utilisateur.
- **E-mails : Mailgun.** Le domaine expéditeur est authentifié (signature du courrier, politique d'expédition déclarée), pour que les rappels arrivent en boîte de réception plutôt qu'en indésirables — la promesse du produit en dépend.
- **Les deux sont interchangeables.** L'envoi passe par une couche d'abstraction interne : changer de service demande d'en réécrire l'adaptateur, non de toucher au reste.
- **Les échecs d'acheminement remontent** : une adresse qui rebondit ou un jeton d'appareil devenu invalide sont enregistrés, et l'envoi cesse vers une destination durablement injoignable.

### 13.5 Langue et contenu

Les e-mails et les notifications suivent la **langue de l'interface** du destinataire (voir 12.3). Leur contenu se compose de gabarits par nature et par langue, alimentés par les données du moment — jamais de texte assemblé à la volée.

## 15. Traitements programmés

### 14.1 Règles communes

- **Rejouables sans dommage.** Un traitement relancé après un incident produit le même résultat qu'une exécution unique. C'est le registre `Notification`, les états en base et les clés d'idempotence qui le garantissent.
- **Rattrapage plutôt qu'abandon.** Après une interruption, un traitement reprend ce qu'il a manqué : les rappels du matin partent en retard plutôt que de sauter un jour.
- **Selon le fuseau de chacun.** Tout ce qui concerne une heure locale (rappels, récapitulatifs) s'exécute selon le fuseau de chaque utilisateur.
- **Étalés.** Les envois de masse se répartissent sur une plage plutôt que de partir à la même seconde.
- **Observés.** Chaque traitement rend son compte : durée, volume traité, échecs. Leur âge et leur retard nourrissent les alertes (13.4).

### 14.2 Le rythme quotidien

| Traitement | Cadence | Ce qu'il fait |
|---|---|---|
| **Rappels d'échéance** | Chaque heure | Repère les occasions dont le délai d'anticipation échoit, pour les utilisateurs dont l'heure d'envoi est atteinte, et déclenche les notifications |
| **Bascule des occasions** | Chaque jour | À la fermeture de la fenêtre d'une occasion, ouvre celle de l'année suivante et rattache le nouveau lien de vœux |
| **Ouverture et fermeture des fenêtres de vœux** | Chaque jour | Fait passer les occasions d'un état à l'autre selon leur date et les délais configurés |
| **Réconciliation des paiements** | Toutes les quelques minutes | Interroge le point d'état du prestataire sur les opérations en attente **dont le délai de notification est dépassé** |
| **Expiration des paiements** | Chaque heure | Clôt les opérations qu'aucune validation n'est venue confirmer au terme du délai de l'opérateur |
| **Générations en souffrance** | Chaque quart d'heure | Repère les productions qui dépassent leur délai, les solde en échec et **rend le crédit** |

### 14.3 Le rythme plus lent

| Traitement | Cadence | Ce qu'il fait |
|---|---|---|
| **Récapitulatif** | Selon la préférence de chacun | Compose et envoie la vue d'ensemble des échéances à venir |
| **Relances d'enrichissement** | Selon la cadence configurée | Repère les fiches peu remplies et propose de les compléter |
| **Effacement des comptes** | Chaque jour | Supprime définitivement les comptes dont le délai de grâce est échu, jusqu'aux fichiers stockés |
| **Avis de fin de grâce** | Chaque jour | Prévient quelques jours avant l'effacement définitif |
| **Exports de données** | À la demande | Compose le fichier et prévient quand il est prêt |
| **Agrégation des métriques** | Chaque nuit | Consolide l'usage, les coûts d'IA et les revenus pour le tableau de bord |

### 14.4 L'entretien

| Traitement | Cadence | Ce qu'il fait |
|---|---|---|
| **Purge des codes à usage unique** | Chaque heure | Retire les codes expirés ou consommés |
| **Purge des traces de connexion** | Chaque jour | Applique la durée de conservation définie |
| **Purge des journaux techniques** | Chaque jour | Applique la rétention courte de l'infrastructure d'observation |
| **Nettoyage des fichiers orphelins** | Chaque semaine | Retire du stockage les images qu'aucun contenu ne référence plus |
| **Retrait des photos sources** | Chaque heure | Efface les photos déposées dont le portrait est produit — seule l'image composée demeure |
| **Sauvegarde de la base** | Chaque jour | Copie chiffrée vers un stockage distant, hors du VPS |
| **Vérification de restauration** | Chaque mois | Restaure une sauvegarde sur un environnement de contrôle — une sauvegarde jamais restaurée ne vaut rien |

### 14.5 Ce qui reste hors des traitements programmés

La **génération** et le **paiement** se lancent à la demande, et chacun se résout à sa façon. La **génération** est suivie par **interrogation** : le client demande où en est la production jusqu'à ce qu'elle aboutisse. Le **paiement** attend d'abord la **notification du prestataire**, puis, ce délai passé, l'**interrogation de son point d'état** ; un administrateur peut trancher en dernier ressort (5.6). Les traitements ci-dessus leur servent de **filet** : solder une génération qui dépasse son délai, réconcilier un paiement resté en attente.

## 16. Tracking plan

### 16.1 Ce à quoi il doit répondre

Un tracking plan vaut par les questions qu'il permet de trancher. Celles-ci, d'abord :

- **La capture prend-elle ?** Combien de notes par utilisateur et par mois, prises quand — au fil de l'eau, ou seulement à l'approche d'une date ?
- **Le rappel fait-il agir ?** Quelle part des rappels mène à ouvrir l'application, puis à préparer, puis à marquer un message envoyé ?
- **La matière sert-elle ?** À la préparation, y a-t-il des notes à montrer, et combien ?
- **Où s'arrête-t-on ?** Dans la création de compte, dans le premier ajout de proche, dans l'achat de crédits.
- **Les défauts tiennent-ils ?** Le ton, la langue, la plage de notes, le champ occasion vide : les gens les changent-ils, et à quelle fréquence ?
- **Qu'est-ce qui fait revenir ?** Rétention à sept, trente, quatre-vingt-dix jours, et ce qui distingue ceux qui restent.
- **La boucle se referme-t-elle ?** Une liste partagée fait-elle entrer des gens, et combien en font une à leur tour ? C'est la mécanique de croissance du produit.
- **Le studio sert-il tout ce qu'il propose ?** Quelles orientations sont choisies, quelle voie d'image, quel style — et lesquelles ne servent jamais.
- **Le classement automatique est-il juste ?** Quelle part des notes reste sans catégorie, et quelle part se corrige à la main.

### 16.2 Conventions

- **Nom** : `domaine.objet_action`, au passé, en minuscules — `note.created`, `payment.succeeded`.
- **Un événement par fait**, jamais par écran affiché : les vues ne s'instrumentent qu'aux étapes d'un parcours qu'on cherche à mesurer.
- **Propriétés communes** à tout événement : identifiant de compte (jamais l'adresse e-mail), surface (application, web public, back-office), version de l'application, langue de l'interface, thème, horodatage, identifiant de session.
- **Les drapeaux actifs accompagnent chaque événement.** Une mesure prise pendant qu'une fonctionnalité était éteinte ne se compare pas à une mesure prise après son allumage : sans cette propriété, une courbe qui monte le jour d'une bascule reste inexplicable.
- **Les propriétés sont des faits, jamais du contenu** : on compte les caractères d'une note, on ne transporte pas son texte.

### 16.3 Les événements

**Entrée**
`signup.started` (voie : code, Google, Apple) · `signup.completed` (parrainé ou non) · `signin.completed` · `onboarding.username_set` · `person.first_created` — le premier proche, le vrai passage à l'usage.

**Capture — le cœur**
`note.created` (nombre de proches désignés, occasion renseignée ou non, catégories attribuées, longueur, origine : accueil, fiche, occasion) · `note.category_corrected` (l'écart entre le classement proposé et le bon) · `person.created` (origine : saisie, création à la volée depuis une note, contribution publique) · `event.created` (type, jalons multiples ou non) · `wish.added` (provenance).

**Rappels**
`reminder.sent` (nature, canal, délai d'anticipation) · `reminder.opened` · `reminder.led_to_preparation` · `occasion.prepared` · `message.marked_sent`. Cette suite mesure la promesse du produit de bout en bout.

**Génération**
`generation.started` (type, paramètres modifiés par rapport aux défauts : ton, langue, plage ; pour un portrait : orientation, voie d'image, famille ou style) · `generation.succeeded` (durée, fournisseur retenu, coût) · `generation.failed` (raison) · `generation.regenerated` (ce qui a été changé) · `portrait.approved` · `portrait.shared` (destination) · `idea.retained` · `gift.recorded` (origine : souhait marqué offert, idée retenue, saisie libre).

**Collecte et surfaces publiques**
`collection_link.shared` (nominatif ou public) · `collection_form.opened` · `submission.sent` (champs renseignés) · `submission.reviewed` (validée, corrigée, rejetée ; souhaits retenus et écartés) · `wall.viewed` (visiteur avec ou sans compte) · `wish_message.sent` · `invitation.opened` · `invitation.converted`.

**Crédits et paiement**
`credits.exhausted` — le moment où l'on bute sur le solde · `purchase.started` (palier, remise) · `payment.submitted` (mode, palier — le client a déposé son reçu) · `payment.decided` (mode, issue, délai de traitement, écart éventuel entre le montant annoncé et le montant constaté) · `payment_method.added` (nature) · `payment.succeeded` / `.failed` / `.expired` (durée d'attente, voie de résolution) · `referral.completed`.

**Mes listes — la boucle virale**
`wishlist.created` (occasion) · `wishlist.wish_added` (avec photo ou non, prix renseigné ou non) · `wishlist.shared` (destination) · `shared_list.viewed` (visiteur avec ou sans compte, provenance) · `reservation.started` · `reservation.confirmed` (délai entre les deux, identité révélée ou non) · `reservation.abandoned` (à quelle étape) · `make_mine.clicked` — **le geste qui referme la boucle**.

Cette suite se lit d'un bout à l'autre : combien de vues par liste partagée, combien de réservations par vue, combien d'installations par réservation.

**Le studio du portrait**
`studio.opened` · `studio.setting_changed` (quel réglage, quelle valeur) · `studio.summary_viewed` · `studio.confirmed` (orientation, voie d'image, famille ou style, texte libre renseigné ou non) · `studio.abandoned` (à quelle étape). Avec le `generation.regenerated` existant, c'est ce qui dira si douze orientations servent ou si trois suffisent.

**Le classement des notes**
`note.classified` (catégories attribuées, ou aucune) · `note.classification_failed` · `note.filed_manually` (depuis le bloc « à ranger », catégorie choisie). La part de notes qui restent sans catégorie mesure la qualité du classement mieux qu'un taux de succès technique.

**Réglages**
`notification_preference.changed` (nature, canal) · `wall.enabled` / `.disabled` · `ui_language.changed` · `theme.changed`.

**Administration**
`feature_flag.toggled` (clé, nouvel état) · `studio_config.published` (ce qui change) · `studio_trial.run` (coût). Ces trois-là expliquent les ruptures de courbe que rien d'autre n'explique.

### 16.4 Ce qui reste hors du tracking

Le contenu des notes, des souhaits, des messages et des portraits ; les noms des proches ; les adresses e-mail et les numéros de téléphone ; le contenu des contributions reçues. Un événement décrit **ce qui s'est passé**, en laissant de côté ce qui a été écrit.

Les surfaces publiques ne suivent que l'usage strictement nécessaire, sans traceur publicitaire ni traceur tiers — ce qui vaut aussi de ne rien avoir à demander au visiteur.

### 16.5 Collecte

Les événements partent du **serveur** dès lors que le fait s'y produit — une note créée, un paiement abouti, une génération terminée : la mesure est ainsi fidèle même si le client se ferme. Le **client** n'émet que ce que le serveur ignore : l'ouverture d'un rappel, l'abandon d'un parcours, l'écran atteint.

**PostHog**, dans sa version infogérée gratuite. Elle couvre ce dont le tracking plan a besoin — événements nommés avec leurs propriétés, entonnoirs, cohortes de rétention — et laisse le VPS à l'application. Deux conséquences à garder en tête : le palier gratuit borne le volume mensuel d'événements, ce qui invite à mesurer ce qui sert plutôt que tout ; et les données résident chez l'éditeur, dont la région d'hébergement se choisit à la création du projet.

L'envoi passe par une **couche d'abstraction interne**, comme les autres services tiers : le code émet un événement nommé, l'adaptateur s'occupe du reste. Changer d'outil, ou rapatrier PostHog sur le VPS le jour où le volume le justifie, se limite alors à cet adaptateur.

### 16.6 Ce que le back-office en montre

La section Métriques s'appuie sur ces événements pour rendre les vues promises : usage par fonctionnalité, exécutions des actions payantes et leur issue, rétention, conversion vers l'achat, volumes de contributions.

S'y ajoutent deux vues que les événements nouveaux permettent : **la boucle des listes** — vues par liste partagée, réservations par vue, installations par réservation — et **l'emploi du studio**, orientation par orientation, avec le taux de régénération de chacune.

## 17. Couverture des écrans

Chaque écran des trois spécifications trouve ici ses points d'entrée. Cette table sert de contrôle : un écran sans ligne signale un manque.

**Application mobile.** Inscription et connexion → `/auth/*`, `/public/invitations/{code}` · Accueil → `/me/home` · Proches → `/me/persons` · Fiche d'un proche → `/me/persons/{id}`, `/notes`, `/portraits`, `/gifts` · Saisie d'une note → `/me/notes`, `/me/persons/{id}/notes`, `/me/occurrences/{id}/notes` · Ajout d'un événement → `/me/events` · Génération → `/me/generations` · À valider → `/me/submissions`, `/me/received-wishes` · Crédits et recharge → `/me/credits`, `/me/payments` · Mon Mur → `/me/wall` · Réglages → `/me/notification-preferences`, `/me/data-export` · Surfaces publiques dans l'application → `/v1/public/*` · Centre de notifications → `/me/notifications` · Dates → `/me/occurrences` · Recherche → `/me/search` · Reprises → `/me/resumables` · Moi → agrégat des précédents · Modifier l'identité → `/me/persons/{id}` · Détail d'un souhait → `/me/wishes/{id}` · Partage d'un lien de collecte → `/me/collection-links` · Détail d'une occasion → `/me/occurrences/{id}` · Aperçu d'un portrait → `/me/portraits/{id}`, `/image` · Mon profil → `/me/profile` · Mes réservations → `/me/reservations` · Sécurité et connexions → `/me/sessions`, `/me/identities`, `/me/account` · Méthode de paiement → `/me/payment-methods` · Aide → `/me/support-requests`, `/me/feedback`, `/public/legal/*`.

**Surfaces publiques.** Landing → `/public/config`, `/public/waitlist` (pré-lancement) · Collecte nominatif et public → `/public/collect/{token}` · Mur public → `/public/walls/{username}` · Dépôt de vœux → `/public/wishes/{token}` · Invitation au parrainage → `/public/invitations/{code}` · Pages légales → `/public/legal/{document}` · Pages d'état → rendues par les réponses d'état des chemins ci-dessus.

**Back-office.** Connexion → `/admin/auth/*` · Tableau de bord → `/admin/dashboard` · Comptes → `/admin/users` · Crédits et paiements → `/admin/payments`, `/admin/users/{id}/credits` · Modération → `/admin/moderation` · Paramètres → `/admin/parameters` · Modèles d'IA → `/admin/ai-models` · Offres et croissance → `/admin/promo-codes`, `/admin/referrals` · Métriques → `/admin/metrics` · Journal d'audit → `/admin/audit-log` · Connexions → `/admin/login-activity` · Liens externes → `/admin/external-links`.

## 18. Ce qui reste à décider

- L'**ordre de routage** entre Anthropic, DeepSeek et Grok, et le modèle retenu chez chacun — à caler sur le coût réel et la qualité observée.
- Le **délai d'attente de la notification** du prestataire, avant de basculer sur l'interrogation, et le **délai d'expiration** d'un paiement en attente — l'un et l'autre à caler sur les usages de l'opérateur.
- La **durée de vie** des jetons de session et de rafraîchissement.
- Le **mécanisme de chiffrement au repos** des numéros de compte mobile money, et la rotation de sa clé.
- Le **détail des schémas** de requête et de réponse, ressource par ressource, à produire au moment de l'implémentation.
- Les **cadences exactes** des relances et du récapitulatif, ainsi que les **durées de conservation** des traces de connexion et des journaux techniques.

# Lehno — Spec UX : back-office d'administration

Périmètre : l'application **React (Vite)** réservée à l'équipe qui exploite Lehno. Document de cadrage : il décrit la structure de l'outil, ses sections, ce que chacune permet et qui y a droit. Il se tient au niveau des fonctionnalités ; le détail de chaque écran relève de la conception d'interface.

Références : `doc-fonctionnelle-assistant-anniversaires.md` (le modèle et les intentions), `dictionnaire-donnees-lehno.md` (les attributs), `ux-app-mobile-lehno.md` et `ux-surfaces-publiques-lehno.md` (les surfaces qu'administre cet outil).

## 1. Périmètre & principes

Le back-office sert à **exploiter** le service : répondre à un utilisateur, régler un cas, ajuster les leviers économiques, surveiller la santé du système. C'est un outil interne, dont l'accès est réservé aux comptes d'administration.

Principes directeurs :

- **Un poste de travail.** L'outil s'utilise sur ordinateur, en séances de travail : densité d'information assumée, listes riches, recherche partout.
- **Régler un cas d'abord.** L'organisation suit l'usage réel : on ouvre l'administration pour traiter une situation, puis pour ajuster un réglage, enfin pour observer.
- **Toute action sensible laisse une trace.** Ajuster des crédits, suspendre un compte, révoquer un lien, modérer un contenu : chaque geste est journalisé avec son auteur et son motif.
- **Le nécessaire pour aider.** L'administration donne accès aux éléments utiles à la résolution d'un cas : état du compte, volumétrie, mouvements, contenus publics. Le contenu privé des fiches reste chez son propriétaire, et les moyens de paiement s'y affichent masqués.
- **La configuration pilote le produit.** Les valeurs qui gouvernent l'économie et le rythme du service se règlent depuis cet outil, et prennent effet immédiatement.

## 2. Organisation de la navigation

L'accès passe par une **connexion** (5.1). L'entrée est ensuite un **tableau de bord**. La navigation latérale regroupe les sections en trois familles, par ordre de valeur d'usage, suivies des outils.

**Tableau de bord** *(page d'entrée)*

**Exploitation** — le quotidien
1. Comptes
2. Crédits et paiements
3. Modération

**Économie** — les leviers
4. Paramètres
5. Fonctionnalités
6. Modèles d'IA
7. Studio du portrait — *réglages en service · composition · banc d'essai*
8. Offres et croissance

**Supervision** — l'observation
9. Métriques
10. Journal d'audit
11. Connexions

**Outils** — les plateformes tierces
12. Liens externes

## 3. Glossaire

Les termes du produit employés dans ce document.

- **Fiche (ou proche)** — la page qu'un utilisateur tient sur une personne de son entourage : son identité, ses dates, ce qu'il sait d'elle.
- **Occasion** — un événement daté précis : l'anniversaire d'une année donnée, un mariage, un jalon.
- **Note** — une information libre qu'un utilisateur consigne sur un proche ou sur une occasion.
- **Souhait** — un élément de la liste de cadeaux rattachée à une occasion.
- **Mur** — la page publique d'un utilisateur, où il accueille ses proches et expose ce qu'il choisit de montrer.
- **Portrait** — un contenu généré qui décrit la relation entre un utilisateur et un proche, à partir des notes accumulées ; il peut être partagé publiquement.
- **Contribution** — ce qu'un tiers envoie via un lien de collecte ou de dépôt de vœux, et que le propriétaire valide avant qu'il rejoigne sa fiche.
- **Crédit** — l'unité qui donne droit à une génération. L'utilisateur en reçoit à l'inscription et en achète ensuite.
- **Délai de grâce** — la période qui suit une demande de suppression de compte : les données y sont conservées avant l'effacement définitif.
- **Règle anti-fraude du remboursement** — les conditions d'ancienneté et d'usage qu'une méthode de paiement doit remplir pour recevoir un remboursement.

## 4. Modèle commun des sections

Chaque section suit le même modèle, ce qui rend l'outil prévisible.

**Page de liste.** Un tableau paginé, avec :
- une **recherche** sur les champs identifiants de la section ;
- des **filtres** propres au domaine (état, période, type) et un tri par colonne ;
- des **colonnes** limitées à ce qui permet de reconnaître et de trier une ligne ;
- des **actions rapides** sur une ligne, pour traiter les gestes courants depuis la liste elle-même ;
- un **export** du résultat filtré, quand la section s'y prête.

**Page de détail.** Ouverte depuis une ligne, elle présente :
- un **en-tête** d'identification (qui, quoi, état actuel, dates clés) ;
- les **informations** de l'objet, regroupées par nature ;
- ses **objets liés**, en listes courtes menant à leur propre détail ;
- les **actions** possibles, les actions sensibles demandant une confirmation et un motif ;
- l'**historique** de ce qui a été fait sur cet objet.

**Formulaires.** Réservés aux sections de configuration (paramètres, modèles, offres). Validation à la saisie, valeur précédente rappelée, enregistrement explicite.

## 5. Sections

### 5.1 Connexion

**Rôle.** L'entrée dans le back-office, réservée aux comptes d'administration.

**Écran de connexion.** Un champ d'adresse e-mail et l'envoi d'un code à usage unique — le même mécanisme que l'application. La connexion par code est **l'unique voie d'accès** : l'entrée dans l'outil dépend ainsi de la seule liste des comptes d'administration, tenue par l'équipe.

**Écran du code.** La saisie du code reçu, avec la possibilité d'en redemander un. Le nombre de tentatives est limité.

**Après connexion.** L'administrateur arrive sur le tableau de bord. La navigation n'affiche que les sections auxquelles son rôle donne accès.

**Traçabilité.** Chaque tentative, réussie ou non, est enregistrée avec son horodatage, son origine et son appareil — et se consulte dans la section Connexions.

**États particuliers.** Adresse inconnue ou compte désactivé : l'écran affiche le même message que pour un code envoyé, et l'envoi s'arrête là — cette réponse uniforme protège la liste des administrateurs. Code erroné ou expiré (nouvelle demande possible). Session expirée (retour à la connexion, avec la page demandée en mémoire). Accès à une section hors de ses droits (redirection vers le tableau de bord).

### 5.2 Tableau de bord

**Rôle.** Donner l'état du système en un écran, et signaler ce qui demande une intervention.

**Contenu.**
- **Activité** — comptes actifs, nouvelles inscriptions, échéances traitées, contributions reçues, sur la période choisie.
- **Économie** — crédits vendus et consommés, revenus, coûts d'IA réels, marge qui en résulte.
- **À traiter** — les files qui attendent : contenus signalés, suppressions de compte en cours, paiements échoués, remboursements bloqués par la règle anti-fraude.
- **Tendances** — l'évolution des indicateurs principaux dans le temps.
- **Ressources** — l'espace occupé sur le stockage de fichiers et sa progression, rapportés au plafond du plan.

Chaque élément « à traiter » mène directement à la section concernée.

### 5.3 Comptes

**Rôle.** Retrouver un utilisateur et agir sur son compte.

**Liste.** Recherche par pseudo ou adresse e-mail ; filtres par état (actif, suspendu, suppression en cours, supprimé), par date d'inscription, par moyen de connexion.

**Détail.** Identité et état du compte, date d'inscription, dernières connexions, moyens de connexion rattachés, volumétrie de son espace (nombre de fiches, d'événements, de contenus générés), solde de crédits, Mur public et son état.

**Actions.** Suspendre ou rétablir un compte · lever le plafond de création de comptes sur un appareil, avec motif · restaurer un compte pendant son délai de grâce, à la demande de son propriétaire · désactiver un Mur public · consulter le solde et les mouvements de crédits. L'effacement immédiat, avant la fin du délai de grâce, relève du rôle administrateur (6).

### 5.4 Crédits et paiements

**Rôle.** Suivre l'argent et les crédits, et corriger ce qui doit l'être.

**Deux vues.** L'une liste les **paiements** — achats et remboursements, avec leur état ; l'autre liste les **mouvements de crédits** — octrois, achats, consommations, ajustements. Chacune se filtre par état, par période, par utilisateur et par moyen de paiement.

**Détail.** Un paiement avec son montant, son moyen, sa référence chez le prestataire, son issue et son motif d'échec le cas échéant ; les crédits qu'il a produits ; et l'**historique de ses états** — chacun avec sa durée, ce qui l'a provoqué (geste de l'utilisateur, notification du prestataire, interrogation, décision d'un administrateur, traitement programmé) et son auteur.

**Les paliers d'achat.** Les montants proposés dans l'application, leurs crédits et leur remise affichée. Aucune saisie libre : on achète un palier, et le plus petit fixe le minimum. Valeurs de départ : 500 F → 5 crédits · 1 000 → 10 · 2 000 → 22 (+10 %) · 5 000 → 57 (+15 %) · 10 000 → 120 (+20 %).

**Les recharges manuelles.** Une file de demandes à traiter : l'utilisateur a versé sur un numéro affiché dans l'application et déposé un justificatif. **Le justificatif ne prouve rien** — un montage est facile : l'administrateur **vérifie la réception sur le compte de l'opérateur** avant d'approuver. Approuver crédite le compte ; rejeter exige un motif. Le justificatif s'efface une fois la demande traitée.

**Actions.** Ajuster manuellement le solde d'un utilisateur, avec motif obligatoire · déclencher un remboursement · lever au cas par cas le blocage anti-fraude d'un remboursement, avec motif · relancer une opération restée en suspens · **confirmer manuellement un paiement en attente**, avec motif, lorsque l'opération a visiblement abouti chez l'opérateur sans que le prestataire l'ait rapporté.

**Note.** L'outil affiche une méthode de paiement par ses seuls éléments d'identification — opérateur et derniers chiffres, ou réseau et derniers chiffres d'une carte. Le numéro complet d'un compte mobile money demeure masqué, y compris pour l'administrateur ; les informations d'une carte restent chez le prestataire de paiement.

### 5.5 Modération

**Rôle.** Traiter ce qui est exposé publiquement et pose problème.

**Liste.** Les signalements et les contenus publics à examiner : Murs, portraits partagés, contributions reçues via les liens publics. Filtres par nature, par état de traitement, par ancienneté.

**Détail.** Le contenu concerné, son auteur, son contexte, l'historique des décisions prises.

**Actions.** Masquer un contenu public · révoquer un lien de collecte ou de partage · désactiver un Mur · notifier l'utilisateur · classer sans suite. Chaque décision demande un motif.

### 5.6 Paramètres

**Rôle.** Régler les valeurs qui pilotent le produit ; elles prennent effet dès l'enregistrement.

**Contenu.** Prix du crédit · crédits offerts à l'inscription · montants de parrainage (parrain et filleul) · délais d'anticipation des rappels · cadence des relances · fenêtre de dépôt de vœux (avant et après la date) · délai de grâce avant effacement d'un compte · ancienneté minimale d'une méthode de paiement pour un remboursement · nombre maximal de comptes créés depuis un même appareil · plafonds d'usage.

**Actions.** Modifier une valeur, avec rappel de la précédente et journalisation du changement.

### 5.7 Fonctionnalités

**Rôle.** Allumer et éteindre les fonctionnalités, pour livrer le produit **par morceaux** plutôt que d'un bloc.

**Contenu.** La liste des drapeaux, chacun avec ce qu'il gouverne en clair et son état. Le socle — proches, notes, dates, rappels, compte — n'y figure pas : il n'est pas extinguible.

**Chaque drapeau montre ce qu'il couvre** : les écrans qu'il éteint et les points d'entrée qu'il ferme. Un administrateur doit voir **ce qu'il éteint** avant de basculer, sans avoir à lire le code. Cette couverture vient du registre, tenu côté serveur.

**Ce que l'écran montre avant d'agir.** Éteindre une fonctionnalité en emporte parfois d'autres : le Mur emporte le dépôt de vœux et la réservation, la liste de souhaits emporte la réservation. **L'écran annonce les conséquences** avant la bascule, plutôt que de les laisser découvrir.

**Actions.** Allumer ou éteindre un drapeau. Chaque bascule est journalisée avec son auteur et sa date.

**Précaution.** Éteindre l'achat de crédits laisse les générations disponibles et gratuites, si leur propre drapeau est allumé — et c'est la recharge manuelle qui prend le relais. Éteindre le paiement ne doit jamais éteindre le produit.

### 5.8 Modèles d'IA

**Rôle.** Piloter ce qui produit les contenus payants, et en surveiller le coût.

**Liste.** Le catalogue des modèles avec leur fournisseur — Anthropic, DeepSeek, Grok —, leur priorité de routage, leur état d'activation et leur coût unitaire.

**Détail.** La configuration d'un modèle et sa consommation : appels, volumes, coûts réels, latence, taux d'échec.

**Actions.** Activer ou désactiver un modèle · changer sa priorité dans le routage · ajuster sa configuration.

**Suivi.** La consommation rapportée aux revenus des crédits, pour vérifier que le prix du crédit couvre bien le coût réel des actions.

**Le facturé et le réel, côte à côte.** Chaque production affiche ce qu'elle a coûté en face de ce qu'elle a rapporté. Le prix étant **unique pour tous**, certaines productions coûtent plus qu'elles ne rapportent et d'autres moins ; c'est la moyenne qui compte. Les **opérations d'administration ne facturent rien** — essais du studio, régénérations offertes, classement des notes — mais leur coût entre dans le calcul : les omettre donnerait une marge flatteuse et fausse.

### 5.9 Studio du portrait

**Rôle.** Régler ce que le portrait propose et ce qu'on demande aux modèles pour le produire. C'est la section qui bougera le plus : on ajuste, on essaie, on ajuste encore.

**Réservée aux administrateurs.** Le studio touche à la configuration des modèles et engage des coûts à chaque essai : il reste fermé au rôle support, y compris en lecture.

**Ce que l'administrateur décide**

- **Le modèle** appelé pour chaque production — message, illustration, traitement de photo.
- **Les orientations** proposées dans l'application : leurs libellés dans les deux langues, leur ordre, leur activation. Si les mesures montrent que trois orientations sur douze servent, on désactive les autres sans livraison.
- **Les ambiances** : familles d'illustration et styles de photo, avec leur nom, leur description et leur activation.
- **Le motif identitaire** employé, et l'emploi qui lui revient.
- **Les gabarits de production** — un par orientation, par famille, par style — avec leurs consignes et leurs garde-fous.

**Trois entrées, trois moments du travail**

**a) Réglages en service** — ce qui tourne aujourd'hui, et rien d'autre : le modèle appelé pour chaque production, les orientations actives et leur ordre, les ambiances, le motif retenu. S'y trouvent l'**historique des publications** — auteur, date, ce que chacune changeait — et le **retour arrière**, qui republie une version antérieure sans la reconstruire.

**b) Composition** — le brouillon qu'on modifie : les gabarits de production, leurs consignes et leurs garde-fous, les libellés dans les deux langues, l'activation de chaque orientation et de chaque ambiance. **On y travaille librement : rien ne change pour les utilisateurs tant qu'on n'a pas publié.**

**c) Banc d'essai** — là où l'on décide. On produit une combinaison sur un **profil de simulation**, on voit le résultat tel que l'utilisateur le verrait, et on **compare deux essais côte à côte** sur le même profil. Savoir si une combinaison vaut mieux que celle en service compte davantage que de la voir seule.

**La publication se fait depuis le banc d'essai**, non depuis la composition : on publie après avoir vu un résultat, pas après avoir tapé un texte. Elle reste **refusée tant qu'aucun essai n'a tourné** sur la combinaison en cours.

**Les profils de simulation.** L'administrateur les compose et les conserve, depuis le banc d'essai. Ils doivent couvrir ce qui met un gabarit à l'épreuve : une fiche **riche** et une fiche **pauvre** (deux notes suffisent), un **nom court** et un **nom long**, les **deux langues**, une relation **familiale** et une **professionnelle**, et au moins un **cas sensible** — c'est celui qui révèle si un gabarit dérape.

**Le coût des essais.** Chaque simulation appelle un modèle et se paie en argent réel. Le banc d'essai affiche **ce que l'essai a coûté** et le cumul du jour ; un plafond quotidien évite qu'une après-midi de réglages passe inaperçue. Les essais ne consomment aucun crédit et ne touchent aucun compte réel — mais leur coût entre dans le suivi de marge.

**Ce que la section montre.** Pour chaque orientation et chaque ambiance : le volume produit, le **taux de régénération** — un contenu qu'on relance aussitôt est un contenu manqué —, le coût moyen, le taux d'échec.

**Actions.** *Réglages* : consulter, revenir à une publication antérieure. *Composition* : modifier le brouillon, activer ou désactiver une orientation ou une ambiance. *Banc d'essai* : composer un profil, essayer une combinaison, comparer deux essais, publier.

### 5.10 Offres et croissance

**Rôle.** Animer l'acquisition et suivre ce qu'elle rapporte.

**Liste.** Les codes promotionnels (campagnes et coupons) avec leur validité, leur plafond et leur consommation ; les parrainages avec leur état.

**Détail.** Un code et ses utilisations ; un parrainage, ses deux parties et les crédits octroyés.

**Actions.** Créer, modifier, désactiver un code promotionnel · suivre les parrainages · corriger un octroi litigieux.

### 5.11 Métriques

**Rôle.** Comprendre l'usage au-delà des chiffres du tableau de bord.

**Contenu.** Usage par fonctionnalité, exécutions des actions payantes et leur issue, rétention, conversion vers l'achat de crédits, volumes de contributions reçues et validées. Ces vues s'appuient sur le tracking plan défini dans la spécification technique.

**Actions.** Choisir la période, croiser les axes, exporter.

### 5.12 Journal d'audit

**Rôle.** Savoir qui a fait quoi. C'est le contrepoids des pouvoirs de cet outil.

**Liste.** Les actions sensibles des administrateurs : ajustements de crédits, suspensions, suppressions, modérations, révocations, changements de paramètres. Chaque entrée porte son auteur, sa date, sa cible et son motif.

**Actions.** Rechercher, filtrer par auteur, par période, par nature ; exporter. Le journal est en lecture seule : ses entrées sont définitives, ce qui fonde sa valeur de preuve.

### 5.13 Connexions

**Rôle.** Repérer les accès anormaux.

**Liste.** Les tentatives de connexion, réussies comme échouées, avec leur horodatage, leur origine, leur appareil et leur voie (code, Google, Apple). Filtres par utilisateur, par résultat, par période.

**Usage.** Détecter les séries d'échecs, les accès inhabituels, et documenter un incident de sécurité.

### 5.14 Liens externes

**Rôle.** Rassembler les portes d'entrée vers les plateformes tierces sur lesquelles s'appuie le service, pour les atteindre depuis un seul endroit plutôt que de chercher chaque adresse ailleurs.

**Contenu.** Les outils utilisés, regroupés par nature — supervision technique et suivi des erreurs (Sentry), mesure d'usage (PostHog), hébergement (VPS) et base de données, stockage des fichiers (Cloudflare R2) et sauvegardes, prestataire de paiement (MTN MoMo, Orange Money), fournisseurs d'IA (Anthropic, DeepSeek, Grok), envoi d'e-mails (Mailgun), notifications poussées (OneSignal), magasins d'applications. Chaque entrée porte le nom de l'outil, ce à quoi il sert dans Lehno, et le lien vers sa console.

**Note.** Ce sont de simples raccourcis : chaque plateforme conserve sa propre authentification et ses propres données. La liste s'entretient à mesure que la pile technique évolue.

## 6. Rôles et accès

Deux rôles. Le premier suffit à l'assistance quotidienne ; le second ouvre les leviers qui engagent l'économie du service. (Correspondance au modèle de données : `admin_role` = `support` \| `admin`.)

**Support** — répondre aux utilisateurs et traiter les cas courants.
- Consulter les comptes, leur état, leur volumétrie ; suspendre ou rétablir un compte.
- Consulter les paiements et les mouvements de crédits ; relancer une opération en suspens.
- Modérer : masquer un contenu public, révoquer un lien, désactiver un Mur, notifier un utilisateur.
- Traiter les suppressions en cours, y compris restaurer un compte pendant le délai de grâce.
- Consulter le tableau de bord, les métriques, les connexions et les liens externes.

**Administrateur** — tout ce qui précède, et davantage.
- Modifier les paramètres globaux (prix du crédit, bonus, délais, seuils), les paliers d'achat et les drapeaux de fonctionnalité.
- Piloter les modèles d'IA : activation, priorité de routage, configuration.
- Régler le studio du portrait : orientations, ambiances, motif, gabarits de production, garde-fous, profils de simulation et essais.
- Créer et gérer les codes promotionnels ; corriger un octroi de parrainage.
- Ajuster manuellement un solde de crédits ; déclencher un remboursement ; lever le blocage anti-fraude d'un remboursement ; confirmer manuellement un paiement en attente.
- Effacer un compte sans attendre la fin du délai de grâce.
- Consulter le journal d'audit et gérer les accès des administrateurs.
- **Sortir une liste en fichier** — comptes, paiements, mouvements de crédits, connexions, journal d'audit.

**Ce que le support ne sort pas.** Aucune liste ne s'exporte depuis son compte, **pas même celles qu'il consulte**. Voir une liste et pouvoir la sortir sont deux choses : la première est une lecture bornée par l'écran, que l'on quitte en fermant l'onglet ; la seconde produit un fichier qui part de l'outil et qu'on ne rappelle plus. C'est le geste qu'on borne, pas la lecture — le support garde tout ce que la liste ci-dessus lui accorde.

**Ce que le support ne voit pas.** La famille **Économie** — paramètres, modèles d'IA, studio du portrait, offres — reste hors de sa navigation. Ce sont les leviers qui engagent le service et ses coûts.

**Règles communes.** Toute action sensible, quel que soit le rôle, est journalisée avec son auteur et son motif. L'interface **n'expose que les actions permises** par le rôle : chacun voit exactement ce qu'il peut faire, et une section entièrement fermée ne figure pas dans son menu. Le journal d'audit est réservé aux administrateurs — c'est ce qui lui donne sa valeur de contrôle sur le travail de l'équipe.

## 7. Éléments transverses

- **Recherche globale** — retrouver un utilisateur, un paiement ou un contenu depuis n'importe où.
- **Deux thèmes** — l'outil suit le thème du système, clair ou sombre, et laisse l'imposer. Les séances de travail sont longues ; le choix appartient à celui qui l'utilise.
- **Mise en page** — conçue pour l'ordinateur, largeurs de tableau ajustables, et lisible sur une tablette pour dépanner en déplacement.
- **Langue** — l'interface suit la langue de l'administrateur, français ou anglais.
- **Confirmation et motif** — toute action irréversible ou sensible demande une confirmation explicite et un motif, repris dans le journal d'audit.
- **Export** — les listes filtrées s'exportent, pour l'analyse ou la conformité, **et pour les administrateurs seuls** (§6). Le fichier emporte exactement les filtres de l'écran : reconstruire la requête à côté ferait dire au fichier autre chose qu'à la liste.
- **États vides et chargement** — mêmes principes que les autres surfaces : dire ce qui manque, et orienter.
- **Traçabilité visible** — sur chaque objet, l'historique des interventions est consultable depuis son détail.

## 8. Phasage

- **Phase 1 — Exploiter.** Tableau de bord, comptes, crédits et paiements, paramètres, journal d'audit. De quoi lancer le service et répondre aux utilisateurs.
- **Phase 2 — Encadrer.** Modération, connexions, modèles d'IA et suivi des coûts.
- **Phase 3 — Développer.** Offres et croissance, métriques approfondies, exports.

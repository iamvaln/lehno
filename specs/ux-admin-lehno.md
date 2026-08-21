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
5. Modèles d'IA
6. Offres et croissance

**Supervision** — l'observation
7. Métriques
8. Journal d'audit
9. Connexions

**Outils** — les plateformes tierces
10. Liens externes

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

### 5.7 Modèles d'IA

**Rôle.** Piloter ce qui produit les contenus payants, et en surveiller le coût.

**Liste.** Le catalogue des modèles avec leur fournisseur — Anthropic, DeepSeek, Grok —, leur priorité de routage, leur état d'activation et leur coût unitaire.

**Détail.** La configuration d'un modèle et sa consommation : appels, volumes, coûts réels, latence, taux d'échec.

**Actions.** Activer ou désactiver un modèle · changer sa priorité dans le routage · ajuster sa configuration.

**Suivi.** La consommation rapportée aux revenus des crédits, pour vérifier que le prix du crédit couvre bien le coût réel des actions.

### 5.8 Offres et croissance

**Rôle.** Animer l'acquisition et suivre ce qu'elle rapporte.

**Liste.** Les codes promotionnels (campagnes et coupons) avec leur validité, leur plafond et leur consommation ; les parrainages avec leur état.

**Détail.** Un code et ses utilisations ; un parrainage, ses deux parties et les crédits octroyés.

**Actions.** Créer, modifier, désactiver un code promotionnel · suivre les parrainages · corriger un octroi litigieux.

### 5.9 Métriques

**Rôle.** Comprendre l'usage au-delà des chiffres du tableau de bord.

**Contenu.** Usage par fonctionnalité, exécutions des actions payantes et leur issue, rétention, conversion vers l'achat de crédits, volumes de contributions reçues et validées. Ces vues s'appuient sur le tracking plan défini dans la spécification technique.

**Actions.** Choisir la période, croiser les axes, exporter.

### 5.10 Journal d'audit

**Rôle.** Savoir qui a fait quoi. C'est le contrepoids des pouvoirs de cet outil.

**Liste.** Les actions sensibles des administrateurs : ajustements de crédits, suspensions, suppressions, modérations, révocations, changements de paramètres. Chaque entrée porte son auteur, sa date, sa cible et son motif.

**Actions.** Rechercher, filtrer par auteur, par période, par nature ; exporter. Le journal est en lecture seule : ses entrées sont définitives, ce qui fonde sa valeur de preuve.

### 5.11 Connexions

**Rôle.** Repérer les accès anormaux.

**Liste.** Les tentatives de connexion, réussies comme échouées, avec leur horodatage, leur origine, leur appareil et leur voie (code, Google, Apple). Filtres par utilisateur, par résultat, par période.

**Usage.** Détecter les séries d'échecs, les accès inhabituels, et documenter un incident de sécurité.

### 5.12 Liens externes

**Rôle.** Rassembler les portes d'entrée vers les plateformes tierces sur lesquelles s'appuie le service, pour les atteindre depuis un seul endroit plutôt que de chercher chaque adresse ailleurs.

**Contenu.** Les outils utilisés, regroupés par nature — supervision technique et suivi des erreurs (Sentry), mesure d'usage (PostHog), hébergement (VPS) et base de données, stockage et sauvegardes, prestataire de paiement (MTN MoMo, Orange Money), fournisseurs d'IA (Anthropic, DeepSeek, Grok), envoi d'e-mails (Mailgun), notifications poussées (OneSignal), magasins d'applications. Chaque entrée porte le nom de l'outil, ce à quoi il sert dans Lehno, et le lien vers sa console.

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
- Modifier les paramètres globaux (prix du crédit, bonus, délais, seuils).
- Piloter les modèles d'IA : activation, priorité de routage, configuration.
- Créer et gérer les codes promotionnels ; corriger un octroi de parrainage.
- Ajuster manuellement un solde de crédits ; déclencher un remboursement ; lever le blocage anti-fraude d'un remboursement ; confirmer manuellement un paiement en attente.
- Effacer un compte sans attendre la fin du délai de grâce.
- Consulter le journal d'audit et gérer les accès des administrateurs.

**Règles communes.** Toute action sensible, quel que soit le rôle, est journalisée avec son auteur et son motif. L'interface **n'expose que les actions permises** par le rôle : chacun voit exactement ce qu'il peut faire. Le journal d'audit est réservé aux administrateurs — c'est ce qui lui donne sa valeur de contrôle sur le travail de l'équipe.

## 7. Éléments transverses

- **Recherche globale** — retrouver un utilisateur, un paiement ou un contenu depuis n'importe où.
- **Confirmation et motif** — toute action irréversible ou sensible demande une confirmation explicite et un motif, repris dans le journal d'audit.
- **Export** — les listes filtrées s'exportent, pour l'analyse ou la conformité.
- **États vides et chargement** — mêmes principes que les autres surfaces : dire ce qui manque, et orienter.
- **Traçabilité visible** — sur chaque objet, l'historique des interventions est consultable depuis son détail.

## 8. Phasage

- **Phase 1 — Exploiter.** Tableau de bord, comptes, crédits et paiements, paramètres, journal d'audit. De quoi lancer le service et répondre aux utilisateurs.
- **Phase 2 — Encadrer.** Modération, connexions, modèles d'IA et suivi des coûts.
- **Phase 3 — Développer.** Offres et croissance, métriques approfondies, exports.

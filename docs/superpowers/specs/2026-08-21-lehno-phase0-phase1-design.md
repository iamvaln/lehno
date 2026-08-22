# Lehno — Conception d'implémentation, phases 0 et 1

*2026-08-21*

Ce document dit **comment** se construisent les phases 0 et 1. Il ne redit pas le produit : la documentation fonctionnelle porte le modèle et les intentions, le dictionnaire les attributs, la spécification technique le contrat, et les trois specs UX les écrans. Il tranche ce que ces documents laissaient à l'implémentation, et signale ce qu'il a fallu leur ajouter.

## 1. Périmètre

**Phase 0 — Fondations & présence.** Monorepo, intégration continue, schéma PostgreSQL, authentification, cloisonnement multi-tenant, déploiement, observabilité, et la landing de pré-lancement avec sa liste d'attente.

**Phase 1 — Le carnet qui n'oublie pas.** Fiches, événements et échéances, notes classées, liste de souhaits, accueil, vue Dates, centre de notifications, et les rappels par e-mail et notification poussée. À l'issue de cette phase, l'application résout le besoin premier en solo : ne plus oublier une date, ni l'envoi du mot.

**Une nouveauté entrée depuis.** `WishlistItem` porte désormais `image_url` et `details`. La photo tire la phase 1 vers le **téléversement de fichiers** — type réel vérifié au contenu, poids et dimensions bornés, image recomposée, métadonnées retirées, servie depuis un domaine distinct sous un nom tiré au hasard (§9.6 de la spécification technique). C'est un travail que la phase 1 ne portait pas jusqu'ici et qu'il faut compter.

Hors périmètre : la collecte externe (phase 2), la génération payante et les crédits (phase 3), le Mur et le paiement (phase 4), parrainage et codes promotionnels (phase 5), le back-office (phase 4). Le schéma n'anticipe ces phases que là où l'anticipation coûte moins que la reprise — les types énumérés, essentiellement.

## 2. Décisions arrêtées

| Sujet | Décision | Raison |
|---|---|---|
| Gestionnaire de paquets | pnpm + espaces de travail, Turborepo | Cache de tâches, refactors atomiques à travers l'API et ses clients |
| Accès aux données | Prisma | Choix du porteur du projet ; les types PostgreSQL que Prisma n'exprime pas passent en SQL écrit à la main dans les migrations (§4) |
| Contrat | Schémas Zod dans un paquet partagé | Une seule source pour la validation serveur, les types clients et les codes d'erreur |
| Mobile | Expo, versions de développement | Greffons pris en charge pour l'acheminement des notifications, l'identité externe, le coffre sécurisé et les liens profonds |
| Traitements en file | pg-boss | Adossé à PostgreSQL : pas de service supplémentaire sur un VPS unique, et un travail se valide dans la même transaction que la donnée qu'il touche |
| Tests | Vitest, PostgreSQL réel via Testcontainers | Ce qui casse ici vit dans les contraintes et les index, qu'une base simulée ne vérifie pas |
| Ordre de construction | Fondation entière, puis tranches verticales | Chaque tranche est démontrable ; l'API précède l'écran **à l'intérieur** de chaque tranche |

## 3. Forme du dépôt

```
apps/
  api/        NestJS — /v1/me, /v1/public
  mobile/     Expo, Expo Router
  web/        Next.js, App Router, rendu au serveur
packages/
  contracts/  Schémas Zod, types inférés, codes d'erreur, valeurs d'énumération
  i18n/        Catalogues fr/en, partagés par le mobile et le web
  tokens/      Jetons de design : deux thèmes, couleurs par rôle
  tsconfig/ eslint-config/
infra/
  docker/     Images, composition locale
  deploy/     Provisionnement du VPS, TLS, sauvegardes
```

Le back-office n'est pas créé : une coquille vide entretenue pendant trois phases coûte plus qu'elle ne rapporte. Il apparaîtra en phase 4.

**Ce qui vit dans `packages/` plutôt que dans une application.** Un élément y descend lorsque deux surfaces au moins en dépendent et qu'une divergence entre elles serait un défaut. Les codes d'erreur en sont l'exemple : le serveur les émet, le mobile et le web les traduisent ; qu'ils se désynchronisent, et l'utilisateur lit un code brut.

## 4. Couche de données

Le schéma Prisma reprend le dictionnaire, entité par entité. Les énumérations se traduisent en types énumérés PostgreSQL natifs.

**Ce que Prisma n'exprime pas** passe en SQL écrit à la main, versionné dans les migrations et donc relu comme le reste :

| Élément | Traitement |
|---|---|
| `citext` | Extension créée, puis `ALTER TABLE … ALTER COLUMN … TYPE citext` dans une migration dédiée. Prisma manipule la colonne comme du texte |
| `inet` | `Unsupported("inet")`. Colonne en écriture seule côté client Prisma ; les lectures d'investigation passeront en SQL, en phase 4 |
| Index uniques partiels | Deux, et le second porte une règle métier que la migration ne dira pas : « une seule fiche de soi par compte » (`where is_self`), et **une seule réservation confirmée par souhait** (`where status = 'confirmed'` — et là seulement). Inclure `pending` dans le second laisserait une adresse inventée bloquer un cadeau : plusieurs demandes en attente coexistent, la première confirmée l'emporte, les autres expirent. À couvrir par un test, la contrainte seule ne l'exprimant pas |
| Contraintes `check` | Cohérence d'un `Schedule` (récurrent ⇒ unité et intervalle ; offset ⇒ unité et quantité) |
| `numeric(12,6)` | `@db.Decimal(12, 6)` |

**Vérification de la dérive.** Un test compare les valeurs d'énumération du paquet `contracts` à celles du schéma Prisma et échoue si elles divergent. C'est le seul point où deux déclarations décrivent la même chose ; le test tient le raccord.

**Amendements portés au dictionnaire.** La relecture croisée a montré six entités ou colonnes appelées par une règle ou un point d'entrée, mais absentes du dictionnaire. Elles ont depuis été **intégrées à la source** et vivent dans le corps du dictionnaire, à leur place — il n'y a pas de section de révisions où les retrouver groupées :

1. `NotificationPreference`, plus `timezone`, `send_hour`, `digest_frequency` et `reminder_lead_days` sur `User` — sans quoi `/me/notification-preferences` n'a rien à lire.
2. `Device` — sans quoi `/me/devices` n'a nulle part où écrire un jeton d'acheminement.
3. `notification_type` porté de quatre à quatorze valeurs, pour couvrir le catalogue de la spécification technique.
4. `Notification` reçoit `title_key`, `body_params`, `read_at` et `target_route` : le centre s'affiche dans la langue de l'interface, qui peut changer après l'envoi — un titre rédigé le figerait dans la langue du jour où il est parti.
5. `ai_usage.action_run_id` devient nullable, avec `purpose` et `user_id` : le classement des notes et la détection du sensible ne sont pas facturés, mais se paient en argent réel. Les laisser hors de la table fausserait le suivi de marge.
6. `RefreshToken` — la détection de rejeu promise par la spécification technique n'avait pas de table où vivre.

S'y ajoutent `WaitlistSignup` (phase 0) et `SupportRequest`, `Feedback`, `DataExportRequest`, appelés par les écrans Aide et Réglages.

**Deux règles de calendrier**, laissées ouvertes et désormais fixées : un anniversaire du 29 février se marque le **28** les années communes, et un offset qui tomberait sur un jour absent du mois d'arrivée est **ramené au dernier jour** de ce mois. Les offsets suivants se calculent toujours depuis la date de référence, jamais depuis une échéance déjà ramenée, pour que le décalage ne s'accumule pas.

## 5. Contrat et langues

`packages/contracts` porte, par ressource, les schémas de requête et de réponse, l'union des codes d'erreur, et les valeurs d'énumération. NestJS valide par un tuyau adossé à ces schémas ; la description OpenAPI s'en déduit. L'enveloppe d'erreur est celle de la spécification technique : un code stable, un message destiné au journal, des détails éventuels.

**Le serveur ne rend jamais de phrase destinée à un écran.** `packages/i18n` tient les catalogues français et anglais : codes d'erreur, libellés d'énumération, titres et corps de notification, textes d'interface. Le mobile les consomme par i18next, le web au rendu serveur. C'est ce qui rend l'application bilingue sans que le serveur connaisse la langue de qui l'appelle — et ce qui a motivé l'amendement 4.

Trois langues restent distinctes, comme le veut la spécification : celle de l'interface (`user.ui_language`), celle de communication propre à chaque proche (`person.language`, qui n'a d'effet qu'en phase 3), et celle du visiteur d'une page publique, lue dans la requête.

## 5 bis. Thèmes et jetons de design

L'application existe en **clair et en sombre**, sur le web comme sur le mobile (`user.theme` : `system` par défaut, ou `light`, ou `dark`). Cela décide la forme du paquet `tokens`.

Les couleurs s'y déclarent **par rôle** — fond, surface, panneau, texte, texte secondaire, mention, action, mise en avant, accent, filet, bordure — chaque rôle portant sa valeur dans les deux thèmes. Jamais d'hexadécimal dans un composant : un écran écrit en valeurs fixes est un écran qui ne bascule pas. Le jeu de référence est celui de la maquette de landing v3, dont les deux palettes ont été mesurées et passent le seuil AA.

Deux conséquences pratiques. Sur le **web**, le thème doit être résolu **avant la première peinture**, sinon la page s'affiche en clair puis bascule ; le choix persiste et retombe sur `prefers-color-scheme` à défaut. Sur le **mobile**, le thème suit le système par défaut, et le réglage explicite vit dans les réglages (3.11).

**Aucune ombre, dans aucun thème** — la profondeur vient des filets d'un pixel. La règle est celle de la charte de marque, et elle vaut ici parce qu'une ombre traverse mal le passage au sombre.

## 6. Authentification, sessions, cloisonnement

**Code à usage unique.** Six chiffres tirés par générateur cryptographique sur `[0, 10^6[`, sans reste de division qui biaiserait la distribution. Conservé en **HMAC-SHA-256 sous une clé tenue dans l'environnement**, au format `v1$<condensé>`, comparé en temps constant. Durée de vie de dix minutes, cinq tentatives puis le code est brûlé, fréquence limitée **par adresse destinataire autant que par origine** — borner la seule origine laisserait le point d'entrée servir à arroser la boîte d'un tiers —, réponse identique pour une adresse inconnue.

*Pourquoi une clé plutôt qu'un condensé simple, et pourquoi pas une fonction lente.* Un code à six chiffres ne compte qu'un million de valeurs : une lecture de la base suffirait à toutes les énumérer si le condensé se calculait sans secret. La clé, absente de la base, prive cette énumération de point d'appui. Une fonction lente — bcrypt, argon2, scrypt — ne conviendrait pas : elle est faite pour résister au cassage hors ligne de secrets à faible entropie qui vivent des années, quand celui-ci meurt en dix minutes et après cinq essais ; elle offrirait surtout un levier de saturation sur un point d'entrée ouvert sans compte. **Le produit ne comporte aucun mot de passe** — l'entrée repose sur le code et sur Google ou Apple —, donc aucune fonction de hachage lente n'a d'emploi dans ce dépôt.

**Identités externes.** Le rattachement s'appuie d'abord sur l'identifiant stable du fournisseur, puis sur l'adresse vérifiée — Apple pouvant transmettre une adresse relais. Une identité externe rejoint toujours un compte existant plutôt que d'en créer un second.

**Sessions.** Jeton d'accès court, jeton de rafraîchissement long conservé dans le coffre sécurisé de l'appareil, stocké en base sous un **SHA-256 sans clé** — 256 bits ne s'énumèrent pas, la clé n'apporterait rien. Le rafraîchissement fait tourner le jeton ; présenter un jeton déjà consommé révoque **toute la lignée**. La déconnexion révoque côté serveur.

**Plafond par appareil** vérifié avant toute création de compte, l'adresse conservée pour d'éventuelles investigations.

**Cloisonnement.** Chaque requête de `/v1/me` se restreint au porteur du jeton, jamais à un paramètre. La contrainte vit dans un dépôt de base et une garde, pas dans la discipline de chaque service. Une ressource d'autrui rend **404**, pas 403. Un test de cloisonnement par ressource, sans exception : c'est la garantie la moins visible et la plus coûteuse à perdre.

## 7. Moteur d'échéances

Module **pur**, sans entrées-sorties, isolé de NestJS et testé à part. C'est là que vivent les bogues subtils, et un module pur est ce qu'on relit le plus sûrement.

Il fait trois choses :

- **Développer** un `Event` et ses `Schedule` en échéances sur une fenêtre donnée — récurrences par unité et intervalle, offsets ponctuels, avec les règles de calendrier fixées en §4.
- **Matérialiser** l'échéance courante en `EventOccurrence`, une seule par événement à la fois, les passées demeurant comme archives.
- **Dériver** l'état d'une occurrence — à venir, fenêtre ouverte, close — de sa date et des délais configurés.

Le calcul se fait en dates civiles, dans le fuseau de l'utilisateur : aucune échéance ne se déplace parce qu'un serveur vit ailleurs.

## 8. Notifications et traitements programmés

**pg-boss** plutôt qu'une file adossée à Redis : sur une machine unique, un service de moins à exploiter, et un travail qui se valide dans la même transaction que la donnée qu'il touche — ce qui supprime la classe d'incidents où le travail part avant que la transaction n'aboutisse.

Les traitements de la phase 1 : balayage horaire des rappels, bascule quotidienne des occurrences, ouverture et fermeture des fenêtres, purge horaire des codes, sauvegarde quotidienne.

**Ce qui les rend rejouables.** Chaque envoi porte une `dedupe_key` stable dont l'unicité en base empêche qu'un traitement relancé après incident renvoie le même rappel. Le rattrapage prime sur l'abandon : les rappels du matin partent en retard plutôt que de sauter un jour.

**Selon le fuseau de chacun.** Le balayage tourne toutes les heures et retient les utilisateurs dont l'heure locale d'envoi est atteinte. Les envois se répartissent sur la plage plutôt que de partir à la même seconde.

**Acheminement.** `MailProvider` et `PushProvider` sont des interfaces ; Mailgun et OneSignal en sont les premiers adaptateurs. Un échec durable — adresse qui rebondit, jeton devenu invalide — désactive la destination plutôt que d'y persister.

## 9. Génération assistée gratuite

La phase 1 a besoin de deux traitements par intelligence artificielle, tous deux **gratuits** : le classement d'une note et la détection d'un événement sensible. La couche facturée n'arrive qu'en phase 3.

Un module de génération minimal est donc construit maintenant : **un seul fournisseur**, délai maximal par appel, repli propre — une note non classée reste une note, un événement non qualifié reste `happy`, et l'utilisateur corrige d'un geste, ce que l'interface prévoit déjà. Chaque appel est tracé en `AIUsage` avec son `purpose`, sans `ActionRun`.

La phase 3 étendra ce module par le catalogue de modèles, le routage par priorité, le repli entre fournisseurs et les crédits. Rien de ce qui est écrit ici n'est à jeter : c'est la raison de ne pas passer par un classement à base de règles, qui serait à la fois provisoire et visiblement médiocre — alors que la capture sans effort est une promesse centrale du produit.

## 10. Application mobile

Expo Router, quatre onglets — **Accueil · Dates · Proches · Moi** — et la cloche en en-tête. TanStack Query tient l'état serveur et son cache, ce qui sert directement l'exigence hors connexion : consulter ce qui a déjà été chargé reste possible, les écritures attendent le réseau et l'écran le dit. Le jeton de rafraîchissement vit dans le coffre sécurisé. Les liens profonds sont câblés dès maintenant, même si les surfaces qu'ils ouvrent arrivent en phase 2.

Les écrans de la phase 1 sont ceux du rattachement de la spec UX mobile, plus le hub **Moi** et ses sous-écrans, sans lesquels les réglages de notification n'ont pas de porte.

## 11. Surfaces publiques

Une seule application Next.js, en rendu serveur. La phase 0 y livre la landing bilingue, les pages légales et la liste d'attente ; les formulaires de collecte, le Mur et le portrait partagé viendront s'y ajouter aux phases 2 à 4.

Un drapeau bascule la landing entre pré-lancement — capture d'adresse — et lancé — liens vers les magasins.

## 12. Tests, intégration continue, déploiement

Vitest partout. Les règles qui portent le produit — développement des échéances, fenêtres de vœux, cloisonnement, unicité des envois — se testent contre un **PostgreSQL réel** via Testcontainers : les contraintes, index partiels et cascades sont précisément ce qu'une base simulée ne vérifie pas. Les tests s'écrivent avant le code. Chaque écran se vérifie **dans les deux thèmes** : c'est le genre de régression qu'aucun test unitaire n'attrape et qu'une capture par thème arrête.

L'intégration continue enchaîne typage, style, tests unitaires, tests d'intégration et construction, avec le cache Turborepo.

Le déploiement vise un VPS : images Docker, terminaison TLS, sauvegardes chiffrées vers un stockage distant, et une **restauration vérifiée** — une sauvegarde jamais restaurée ne vaut rien. Sentry et PostHog sont branchés dès la phase 0, derrière la même couche d'abstraction que les autres services tiers.

## 13. Séquence de construction

**Phase 0** — monorepo et intégration continue · paquets `contracts`, `i18n`, `tokens` · schéma Prisma, migrations, harnais Testcontainers · authentification et cloisonnement · configuration publique, pages légales, liste d'attente · landing · déploiement et observabilité.

**Phase 1** — fiches · événements et moteur d'échéances · notes, catégories, classement et détection du sensible · liste de souhaits, photo comprise · accueil et centre de notifications · préférences, appareils, traitements programmés, rappels · puis le mobile en quatre tranches — coquille, authentification et accueil · Proches · Dates et occasion · Moi et réglages · enfin une passe de vérification de bout en bout.

Chaque tranche de la phase 1 va du contrat à l'écran en passant par l'API et ses tests : la règle « l'API d'abord, les clients ensuite » tient **à l'intérieur** de chaque tranche, ce qui la préserve sans imposer d'attendre la fin de l'API pour voir quoi que ce soit.

**Ce que la phase 1 ne porte pas, malgré les apparences.** `/me/resumables` liste des brouillons de message et des portraits — de la génération, donc phase 3. Et `/me/home` ne rend en phase 1 que la **phrase d'accueil** et trois échéances : les contributions relèvent de la phase 2, les reprises et les compteurs de la phase 3. Construire les cinq blocs maintenant reviendrait à écrire du code que rien n'affiche avant longtemps.

**Deux rendez-vous de conception visuelle**, l'un avant la landing, l'autre avant les tranches mobiles.

## 14. Ce qui reste ouvert

- La **durée de vie** exacte des jetons d'accès et de rafraîchissement.
- Le **fournisseur** retenu pour les deux traitements gratuits de la phase 1, et le modèle employé chez lui — à caler sur le coût réel et la qualité observée.
- Le **fuseau par défaut** d'un compte à la création : déduit de l'appareil, ou fixé puis corrigé dans les réglages.
- Les **cadences exactes** des relances et du récapitulatif, qui vivent de toute façon en `SystemParameter` et se règlent sans redéploiement.

Ces points n'empêchent aucune tranche de démarrer : les trois premiers portent sur des valeurs, le dernier sur de la configuration.

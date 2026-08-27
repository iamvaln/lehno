# Écarts à reporter dans la documentation officielle

**Au 25 août 2026.** Ce qui a été décidé ou construit et qui ne correspond plus
à ce que disent les spécifications. Trois natures : ce qui les **contredit**, ce
qu'elles **ne couvrent pas**, et ce qui reste **ouvert**.

Chaque point cite la section concernée. Les décisions viennent du porteur du
projet, sauf mention contraire.

---

## Point au 27 août 2026 — relecture des spécifications

Chaque point ci-dessous a été relu contre les documents à leur état du jour.

### Réglé, à retirer de ce fichier

| Point | Où c'est désormais écrit |
|---|---|
| **A1** classement en arrière-plan, échec silencieux | doc fonctionnelle L476, L478 |
| **A2** une note peut n'appartenir à aucune catégorie | doc fonctionnelle L480, L482 |
| **A3** six catégories organisent, une contraint | doc fonctionnelle L486, L526 |
| **B1** les drapeaux de fonctionnalité | spec technique, quatorze passages : registre, 404 avant l'authentification, le back-office lit le registre |
| **B2** `launch.live` se lit à l'exécution | spec technique L312 — le geste d'administration, les cinq minutes, le repli en pré-lancement |
| **B3** conventions de statuts HTTP | spec technique L79 |
| **B4** `openapi.json` fait autorité | spec technique L60 |
| **E** la note sans catégorie à l'écran | tranché : le bloc « à ranger » (ux-app-mobile L189, L226) |

### Toujours ouvert

- **A4** — `admin_refresh_token` n'apparaît nulle part au dictionnaire. Les
  colonnes `ip` des autres tables y sont bien.
- **A5** — `login_method` et `login_activity.method` restent absents du
  dictionnaire, dont la table `LoginActivity` (L308) ne porte pas la voie.
- ~~**A6**~~ — **corrigé le 27/08.** La phrase est coupée à sa source :
  le dictionnaire dit maintenant que l'index est partiel **pour la taille et
  l'intention**, et que ce n'est pas pour admettre plusieurs nuls. Deux autres
  lignes du même passage suivaient le même raisonnement, elles y passent aussi.
- **B5** — origines autorisées et relais de confiance : rien dans aucune
  spécification, alors que `TRUST_PROXY_HOPS` est lu par le code.
- **C2** — `AIUsage.origin` : la table elle-même n'existe pas.
- **G**, **H**, **I**, **J** — ci-dessous.

### Partiellement réglé

- **C3** — `Payment` et `CreditTransaction.payment_id` **sont construits**
  depuis le chantier des paiements. Le paragraphe « rien n'est construit » ne
  vaut plus. Deux divergences subsistent, en **J**.
- **D** — six des vingt-et-une tables sont désormais livrées :
  `CreditTransaction`, `Payment`, `PaymentMethod`, `PaymentStatusHistory`,
  `AIModel`, `Referral`. Quinze restent absentes.

---

## A. Ce qui contredit la documentation actuelle

### A1. Le classement des notes n'est pas synchrone

**Où** : doc fonctionnelle §7, « Classement automatique ».

**Ce qui est écrit** : « Au moment de la validation d'une note, le système en
détermine la catégorie de rattachement (section 8) et l'y range sans solliciter
l'utilisateur. »

**Ce qui a été décidé** : l'utilisateur écrit sa note, ferme l'application et
vaque à ses affaires. Le classement se fait **en arrière-plan** et reste
**silencieux pour le client** en cas d'échec — silencieux pour lui, pas pour
l'équipe, qui garde journaux et alertes (spec technique §14.1, « Observés »).

**À reformuler** : le déclenchement, et le fait qu'un échec de classement n'est
jamais montré ni bloquant.

### A2. Une note peut n'appartenir à aucune catégorie

**Où** : doc fonctionnelle §7 (« et l'y range ») et §8.

**Ce qui a été décidé** : si le système ne sait pas classer une note, elle
**reste telle qu'elle a été saisie**, sans catégorie forcée. Aucun repli sur
« Faits marquants » — ce n'est pas une catégorie fourre-tout, §8 lui donne un
sens précis.

**Pourquoi ça ne prête pas à conséquence** : le classement sert la **lisibilité
de la fiche**. La génération assistée lit le **contenu** des notes, classées ou
non. Une note non rangée nourrit donc le message et les idées comme les autres.

**À ajouter** : le modèle l'autorise déjà — `NoteCategory` est une association
N–N, zéro ligne est un état valide (dictionnaire, § NoteCategory).

### A3. Une seule catégorie a des conséquences sur le produit

**Où** : doc fonctionnelle §8.

C'est déjà écrit pour `dislikes_nogo` (« contrainte active »), mais la
documentation met les sept catégories sur le même plan partout ailleurs. La
distinction mérite d'être rendue explicite : **six catégories organisent
l'affichage, une contraint ce que le produit propose.** Se tromper sur
« Faits marquants » coûte un rangement approximatif ; se tromper sur
« Dislikes / no-go » fait proposer du vin à quelqu'un qui ne boit pas.

---

### A4. Les adresses IP étaient en base, et vides

**Où** : `dictionnaire-donnees-lehno.md`, `LoginActivity` et `DeviceSignup` ·
`ux-admin-lehno.md` §5.13.

**Ce qui était** : la migration d'identité crée trois colonnes `ip` —
`login_activity`, `device_signup`, `refresh_token` — avec ce commentaire :
« conservées pour investigation, **jamais lues par le client Prisma** ».
L'intention protégeait de l'exposition accidentelle, en ne les modélisant pas.

**L'effet qu'on n'avait pas prévu** : Prisma ne peut pas écrire une colonne
qu'il ne modélise pas. Les trois sont donc restées **vides depuis le premier
jour**. Une trace d'investigation qui ne contient rien ne protège de rien.

**Ce qui a été décidé** (26/08/2026, porteur du projet) : l'adresse sert, elle
s'enregistre. Le modèle porte désormais `login_activity.ip` et
`device_signup.ip`, et la garde contre l'exposition devient un test plutôt
qu'une absence — `/admin/login-activity` ne la rend pas, et le contrat publié
n'a aucun champ pour la recevoir. Ce que l'écran montre reste le lieu
approximatif.

**Fait depuis** (26/08/2026) : `refresh_token.ip` est modélisée et écrite, à
l'ouverture comme à chaque rotation. C'est l'adresse de **ce tour-là**, pas
celle de l'ouverture : rejouer un jeton consommé révoque toute la lignée — le
signe qu'une copie circule — mais ça ne dit pas d'où. C'est la suite des
adresses d'une lignée qui le montre.

**Et un écart de plus, corrigé au passage** : `admin_refresh_token`, créée après
la migration d'identité, n'avait aucune colonne d'adresse. Une session
d'exploitation ouvre pourtant sur les comptes des autres, et sa durée est plus
courte pour cette raison précise — elle traçait donc moins qu'une session
ordinaire. **À reporter au dictionnaire**, qui ne décrit pas cette table.

### A5. La voie d'entrée manquait au dictionnaire

**Où** : `ux-admin-lehno.md` §5.13 contre `dictionnaire-donnees-lehno.md`,
`LoginActivity`.

**Le conflit** : la section d'administration demande « leur **voie** (code,
Google, Apple) ». Le dictionnaire ne prévoit pas ce champ, et le schéma ne
l'avait pas. Sans lui, une série d'échecs par code ne se distingue pas d'une
série par fournisseur externe — or c'est l'usage que la section annonce.

**Ce qui a été fait** : `login_method` (`otp` | `google` | `apple`) et
`login_activity.method`, renseignée aux deux points d'écriture. **À reporter au
dictionnaire.**

**Une citation inventée, au passage** : un commentaire de
`apps/api/src/admin/lectures.controller.ts` justifiait l'absence d'adresse en
citant « spécification technique §9 ». Cette section porte sur les droits
d'accès et ne dit rien de l'adresse. La citation a été retirée.

### A6. L'index partiel n'est pas ce qui permet plusieurs nuls — **corrigé**

**Où** : `dictionnaire-donnees-lehno.md`, `Payment.provider_ref`.

**Ce qui est écrit** : « L'unicité porte donc sur les valeurs présentes (index
unique partiel) — **sans quoi deux demandes en attente entreraient en collision
sur une valeur nulle**. »

**Ce qui est vrai** : Postgres traite deux nuls comme **distincts** dans un
index unique. Un index total sur `provider_ref` admettrait autant de nuls qu'on
veut. Vérifié en base plutôt que supposé, le 26/08/2026 : deux insertions à nul
passent sous un `create unique index` ordinaire.

**Ce que ça ne change pas** : l'index partiel reste le bon choix, pour la
**taille** et pour l'intention. Sur `credit_transaction.payment_id`, la plupart
des mouvements — octrois d'inscription, bonus de parrainage, consommations,
ajustements — n'ont pas de paiement, et il n'y a rien à gagner à les indexer.
N'indexer que les valeurs présentes dit aussi exactement ce qu'on garantit.

**Corrigé le 27/08/2026** au dictionnaire, en trois endroits : la ligne du
tableau (`provider_ref`), la note qui l'explicitait, et la mention de l'unicité
sur `credit_transaction.payment_id` — resserrée entre-temps au type `purchase`
(voir J).

**Quatre fois avant de couper à la racine.** Cette phrase a été rattrapée dans
un commentaire de migration, dans un commentaire de contrôleur, dans un
commentaire de test, puis enfin ici. Les trois premières fois ne servaient à
rien : la source continuait de la produire. Une correction qui laisse vivre ce
qui l'a causée n'est pas une correction.

**À corriger** : ~~la justification, pas la décision~~ — fait.

## B. Ce que la documentation ne couvre pas du tout

### B1. Les drapeaux de fonctionnalité — chapitre entier à écrire

Rien dans aucune spécification (`spec-technique` n'emploie pas le mot). Or c'est
construit et en production. À documenter :

- **Le registre est du code**, pas des données : `packages/contracts/src/flags.ts`.
  Ajouter un drapeau demande un déploiement ; en échange, une clé mal orthographiée
  ne compile pas.
- **La table `feature_flag`** ne porte que l'état (`key`, `enabled`, `updated_at`).
  Ce qui existe, sa description et sa lisibilité publique sont des faits de code.
- **Fermé par défaut** : une ligne absente vaut éteint, comme le reste du projet.
- **Une surface éteinte rend 404**, pas 403, et le garde passe **avant**
  l'authentification — sinon le statut distinguerait « éteinte » de « non
  authentifiée » et révélerait son existence.
- **Un drapeau par capacité**, pas par route : `me.persons` couvre l'annuaire et
  la fiche, qui sont la même chose du point de vue de l'utilisateur.
- **Réconciliation au démarrage** : les drapeaux manquants sont créés éteints,
  un état déjà réglé n'est jamais touché.
- **Deux drapeaux existent** : `launch.live` (public) et `me.persons` (privé).

### B2. Le drapeau de lancement se lit à l'exécution

**Où** : `ux-surfaces-publiques-lehno.md` §68 dit « Un seul drapeau bascule
l'affichage », sans dire comment.

C'était une variable de construction cuite dans l'image. C'est maintenant
`launch.live`, lu par `/v1/public/config`. À documenter :

- basculer est un geste d'administration, plus un redéploiement ;
- la bascule met jusqu'à **cinq minutes** à paraître (cache de page) ;
- **API injoignable ou incomplète → pré-lancement**. C'est une décision : mieux
  vaut afficher la capture d'adresse que promettre une application disponible.

### B3. Les conventions de statuts HTTP

La spécification technique ne cite **aucun** code de statut. Le contrat publié en
fixe maintenant :

| Cas | Statut | Raison |
|---|---|---|
| Création rendant une ressource nouvelle | **201** | Le client apprend un identifiant |
| Suppression | **204** | Rien à rendre |
| Ressource d'autrui | **404** | Un 403 confirmerait son existence |
| Surface éteinte par un drapeau | **404** | Idem |

Les `POST` qui ne créent rien au sens REST gardent 200 : `/auth/otp` envoie un
code, `/public/waitlist` est idempotent à dessein, `/public/contact` achemine.

### B4. Le contrat d'API publié

`docs/api/openapi.json` est **engendré depuis les schémas Zod**, jamais écrit à
la main, et un test échoue s'il est périmé. À mentionner comme l'artefact de
référence des intégrateurs, avec sa commande de régénération.

### B5. Origines autorisées et relais de confiance

Rien dans la spécification. Deux réglages pourtant nécessaires en production :
la liste fermée des origines de navigateur (jamais `*`), et le nombre de relais
de confiance devant l'API — sans quoi le plafond « par origine » devient un
compteur unique partagé par tous les visiteurs.

---

## C. Ajouts proposés au dictionnaire de données

### C1. `feature_flag` (déjà livré)

| Champ | Type | Notes |
|---|---|---|
| key | varchar(64) | PK ; correspond au registre du code |
| enabled | boolean | défaut `false` |
| updated_at | timestamptz | |

### C2. `AIUsage.origin` (proposé, pas encore fait)

Le dictionnaire couvre déjà remarquablement bien la journalisation des appels de
modèle — `purpose` (dont `note_classification`), `user_id`, `provider` et
`model_key` copiés, jetons, coût, latence, statut — et dit explicitement que
**les appels gratuits comptent aussi**.

Un manque : rien ne distingue **l'origine** d'un appel. Ni une passe
d'arrière-plan d'un geste de l'utilisateur, ni une première classification d'une
révision, ni deux exécutions du même traitement programmé. Sans cela, on verra
la dépense monter sans savoir laquelle des passes l'a causée.

**Proposition** : un champ `origin` (`user_action` | `scheduled_job` | `retry`)
et l'identifiant de corrélation que la §12.2 fait déjà voyager de bout en bout.

---

## C3. `CreditTransaction.payment_id` — ajouté au dictionnaire le 25/08

Un paiement et un octroi de crédits sont **deux entités**, et le dictionnaire
le disait déjà : « un `Payment` réussi produit une `CreditTransaction` de type
`purchase` ». Mais rien ne les **reliait** — `CreditTransaction` portait
`action_run_id`, `referral_id` et `promo_code_id`, sans `payment_id`.

Trois conséquences, dont une chère :

- une ligne `purchase` de +20 crédits ne disait pas quel paiement l'avait
  produite ;
- l'octroi unique ne pouvait pas se garantir par une contrainte, alors qu'un
  paiement se résout par **trois voies** — notification, interrogation,
  confirmation manuelle — dont deux peuvent constater le succès à quelques
  secondes d'écart ;
- **un remboursement ne savait pas quoi reprendre** : la ligne d'ajustement
  n'avait aucun moyen de désigner l'achat qu'elle annule, et un litige se
  serait réglé à l'estime.

Porté au dictionnaire avec l'**unicité partielle** sur `payment_id` là où
`type = 'purchase'` — la même logique que `referral.invited_user_id` : la
règle vit dans le schéma, pas dans le code qui la vérifie. Et un
`on delete restrict`, parce qu'effacer un paiement ne doit pas faire
disparaître le crédit qu'il a produit.

**Rien n'est construit** : `Payment` fait partie des tables absentes ci-dessous,
et la `CreditTransaction` livrée ne porte ni `payment_id`, ni `action_run_id`,
ni `promo_code_id` — leurs cibles n'existent pas, et une colonne sans sa
contrainte est une demi-vérité. Elles arriveront avec ce qu'elles référencent.

---

## F. Deux choses qui s'appellent « export » et ne se ressemblent pas

Relevé le 26/08/2026, après avoir livré le premier et constaté que la copie du
second s'était glissée dans le premier.

### F1. L'export d'administration — **livré**

Le journal d'audit, les connexions et la liste des comptes. Un administrateur
lit une table filtrée et obtient un fichier **tout de suite**, par
téléchargement. `POST /admin/audit-log/export` et
`POST /admin/login-activity/export`, plafonnés à dix mille lignes, journalisés
avec ce qui a été sorti.

**La copie de cet écran annonçait « le fichier arrive par courriel »** — reprise
du comportement de l'application, où c'est juste. Elle a été corrigée : il
n'existe ni file d'attente ni envoi de pièce jointe côté administration, et
promettre un courriel qui n'arrive jamais est pire qu'un téléchargement.

### F2. L'export de ses données par un utilisateur — **rien n'est construit**

**Ce que la documentation demande**, et les trois sources se recoupent :

- `ux-app-mobile-lehno.md` §3.11 : « *Exporter mes données* → préparation du
  fichier, envoyé par e-mail quand il est prêt. »
- `spec-technique-lehno.md` §15 le range dans les traitements programmés :
  « À la demande — compose le fichier et prévient quand il est prêt. »
- Le dictionnaire modélise exactement ce cycle : `DataExportRequest` avec
  `status` (`pending` → `ready` → `failed` → `expired`), `file_url`,
  `expires_at`, `completed_at`.

**Pourquoi ce choix diffère de F1**, et mérite d'être dit plutôt que subi :

- **Le volume.** Un export d'administration lit une table. Un export personnel
  rassemble tout ce qu'un compte a produit — proches, notes, occasions,
  souhaits, paiements, notifications — et compose un fichier. Le tenir dans une
  requête HTTP bloquerait la connexion et échouerait au premier compte chargé.
- **La preuve d'accès.** Un lien envoyé à l'adresse du compte prouve que le
  demandeur y a accès, ce qui rend l'export sûr sans redemander un code.
- **L'expiration.** `expires_at` existe pour que le fichier ne traîne pas : un
  export personnel contient tout, et un lien éternel serait une fuite qui dort.

**Ce qui manque, dans l'ordre où il faut le construire :**

1. **Le stockage des fichiers** — R2 n'est pas monté, et `file_url` n'aurait
   nulle part où pointer.
2. **La couche de traitements programmés** — elle n'existe pas. Elle bloque
   aussi les rappels d'échéance, la bascule des occasions, l'ouverture et la
   fermeture des fenêtres de vœux, la réconciliation et l'expiration des
   paiements, et les générations en souffrance (§15.2 et §15.3).
3. Puis seulement : `/me/data-exports`, la composition du fichier, et le
   courriel qui porte le lien.

C'est un chantier à part entière, pas une tâche — et le point 2 le dépasse
largement.


## D. Écart entre le dictionnaire et le schéma livré

**Vingt tables du dictionnaire n'existent pas dans `prisma/schema.prisma`.**
Ce n'est pas une erreur de documentation — c'est le périmètre non encore
construit. Utile à savoir pour ne pas documenter comme acquis ce qui ne l'est pas.

Wall · CreditTransaction · Payment · PaymentMethod · PaymentStatusHistory ·
PremiumAction · ActionRun · AIModel · AIUsage · GeneratedProfile ·
GeneratedMessage · GiftGiven · CollectionLink · WishCollectionLink ·
WishReservation · ReceivedWish · SubmittedWish · Submission · Referral ·
PromoCode · PromoCodeRedemption

---

## E. Question ouverte, à trancher par le design

La maquette de la fiche (`ux-app-mobile-lehno.md` §3.4) affiche « les notes
**rangées par catégories** » et ne prévoit aucune vue « toutes les notes ».
Une note sans catégorie n'a donc pas d'endroit où paraître à l'écran, même si
l'API la rend.

Trois issues : une vue « toutes les notes » ; un bloc « à ranger » que
l'utilisateur vide d'un geste ; ou accepter qu'une note non classée n'apparaisse
pas tant qu'elle ne l'est pas. Décision d'interface, pas d'implémentation.

---

## G. §5.14 énumère une pile que le dépôt ne branche pas encore

La section « Liens externes » nomme une quinzaine d'outils : Sentry, PostHog,
VPS et base, Cloudflare R2, MTN MoMo, Orange Money, Anthropic, DeepSeek, Grok,
Mailgun, OneSignal, magasins d'applications.

Ce que le code appelle réellement, aujourd'hui :

| Outil | État |
|---|---|
| PostHog | branché — `tracking/posthog.adapter.ts`, `POSTHOG_API_KEY` |
| Resend | branché — `mail/resend.adapter.ts`, `RESEND_API_KEY` |
| Google, Apple | branchés — `GOOGLE_CLIENT_ID`, `APPLE_CLIENT_ID` |
| Sentry | **déclaré, jamais lu** — `SENTRY_DSN` est dans `.env.example` et aucun fichier de source ne le lit |
| Mailgun | **déclaré, jamais lu** — `MAILGUN_API_KEY` et `MAILGUN_DOMAIN` idem ; c'est Resend qui envoie |
| R2, MoMo, Orange, Anthropic, DeepSeek, Grok, OneSignal, magasins | absents du code |

**Ce que l'écran fait de cet écart.** Il ne liste que ce qui sert. La
spécification le prévoit — « la liste s'entretient à mesure que la pile
technique évolue » — et annoncer une console pour un outil que rien n'appelle
donnerait à lire une pile qui n'existe pas.

**Deux choses à trancher.**

1. **Mailgun dans `.env.example`.** Deux variables qu'aucune source ne lit,
   pour un fournisseur que Resend a remplacé. Soit la migration est finie et
   elles s'en vont, soit elle ne l'est pas et il manque un adaptateur. Je ne
   les ai pas retirées : la configuration d'envoi n'est pas ma voie.
2. **L'hébergement n'a pas d'entrée.** Le VPS et la base sont bien réels, mais
   rien dans le dépôt ne nomme le fournisseur ni l'adresse de sa console. Une
   adresse inventée serait pire qu'une absence. À donner.

---

## H. Ce que le back-office affichait sans que ce soit vrai

Quatre écrans rendaient des données inventées, en production. Aucun ne pouvait
le signaler : la page se construisait, et ce qu'elle montrait avait l'air d'un
compte.

| Où | Ce qui s'affichait | Corrigé par |
|---|---|---|
| Mon profil | une fixture : adresse, rôle et sessions inventés, avec leurs IP | `GET /admin/me` |
| Barre haute | `"sam@lehno.app"` **écrit en dur** | l'adresse portée par la session |
| Traçabilité d'un compte | la même fixture d'historique pour tous | le journal filtré sur la cible |
| Journal d'audit | les codes bruts, alors que son filtre proposait les libellés | le même dictionnaire des deux côtés |

**Comment c'est entré.** Trois des quatre venaient d'un **défaut de props qui
valait une fixture**. L'appelant avait oublié de le remplacer, et rien ne
pouvait échouer — le défaut fournissait exactement ce qu'il fallait pour que la
page se construise.

Ce motif est refermé pour les deux écrans touchés : `profil` est désormais
exigé, `interventions` vaut le tableau vide. **Il reste ailleurs** —
`Detail.compte`, `Liste.comptes`, `Edition.parametres`, `Suppressions.demandes`
gardent chacun une fixture par défaut. Aucun ne fuit aujourd'hui : leurs
appelants passent tous des données réelles. Mais c'est la même porte, et c'est
par là que les autres sont entrées.

**Deux phrases fausses, corrigées avec.** « Sans adresse IP : elle ne descend
pas en base », sous les connexions — elle y descend depuis le chantier des IP.
Et le renvoi inventé à « la spécification technique §9 », qui vivait encore dans
`packages/contracts` après avoir été retiré du contrôleur.

**Ce qui reste ouvert.** Sept libellés d'action manquaient au dictionnaire du
journal ; ils y sont. Rien ne garantit que le prochain code écrit par le serveur
y arrive — l'outil ne peut pas lire les contrôleurs. Le repli affiche le code
brut, ce qui rend l'absence visible sans la corriger.

---

## I. §5.9 Studio du portrait — une entrée sur trois

La section décrit **trois entrées** : réglages en service, composition, banc
d'essai. Une seule a de la matière.

**Livrée — « réglages en service ».** Ce qui tourne aujourd'hui, l'historique
des publications et le retour arrière. Le serveur les servait déjà, sans écran :
`admin/portrait-studio/templates` versionne chaque gabarit, et une seule version
est en service par couple (genre, clé) — tenue par un index unique partiel, en
base et non dans le service.

### Correction du 27/08 : ce n'est pas une décision à prendre, c'est trois tables à construire

**J'ai d'abord écrit que le modèle n'avait pas de brouillon et que c'était « une
décision à prendre ». C'est faux.** Le dictionnaire de données spécifie le
studio en entier, et depuis avant ce chantier :

| Table | Ce qu'elle porte | Livrée |
|---|---|---|
| `StudioConfig` (L1068) | `state` : `draft` \| `published` \| `superseded` ; `settings` jsonb — orientations actives et leur ordre, ambiances, motif, modèle par production, gabarits retenus ; `published_at`, `published_by_admin_id`, `note` | **non** |
| `StudioProfile` (L1088) | Le profil de simulation, qui ne correspond à aucun compte réel | **non** |
| `StudioTrial` (L1102) | L'essai : sa sortie, son **coût réel**, son statut ; le plafond quotidien vit en `SystemParameter` `studio_trial_daily_cap` | **non** |
| `PromptTemplate` (L1120) | Les gabarits versionnés | oui |

Le dictionnaire écrit déjà, mot pour mot, ce que §5.9 promet : « **Un brouillon
se modifie librement ; une publication met en service.** Sans cette séparation,
chaque frappe partirait en production. » Il pose l'index unique partiel là où
`state` vaut `published`, le retour arrière qui republie sans reconstruire, et
la règle « **rien ne se publie sans essai** : au moins une `StudioTrial` doit
exister sur le brouillon ».

**Il n'y a donc rien à trancher.** Les orientations, les ambiances et le motif
identitaire ne sont pas « absents du modèle » : ils vivent dans
`StudioConfig.settings`, qui n'est pas construite. Ce qui manque est un chantier
de trois tables, entièrement spécifié.

**Bloqué pour de bon — le banc d'essai.** Celui-là ne tient pas au schéma : il
appelle un modèle et se paie en argent réel. Aucun fournisseur d'IA n'est
branché dans le dépôt (voir G), `AIUsage` n'existe pas, et
`/me/studio/options` — le catalogue que l'application consomme — n'est servi par
aucun contrôleur. Construire `StudioTrial` sans rien pour la remplir donnerait
une table vide et un écran qui ment.

**Ce que la section devait montrer** — volume produit, taux de régénération,
coût moyen, taux d'échec par orientation — suppose les mêmes données que les
métriques (§5.11). Rien ne les enregistre.

### Un désaccord à trancher : le studio est-il fermé au support ?

§5.9 est explicite : « il reste fermé au rôle support, **y compris en
lecture** ». `navigation.ts` le suit — la section ne figure pas au menu d'un
support.

Le serveur dit l'inverse : `GET admin/portrait-studio/templates` est ouvert aux
deux rôles, et un test le fixe délibérément — « le support consulte, il ne règle
pas » — avec pour raison que comprendre ce qui a produit un contenu raté fait
partie de l'assistance.

**Je n'ai pas tranché.** L'argument du test est défendable et la spécification
est nette ; ce n'est pas à moi de choisir entre les deux. En pratique la
divergence est invisible : le menu ne montre pas la section au support, qui n'a
donc aucun chemin pour l'atteindre. Elle deviendra visible le jour où un
raccourci y mènera.


---

## J. Deux divergences entre le dictionnaire et le schéma des paiements — **corrigées**

**Réglées le 27/08/2026**, migration `20260827120000_paiement_dictionnaire`. Le
schéma dit maintenant ce que le dictionnaire décrit : l'unicité de l'octroi est
réservée au type `purchase`, et le lien refuse la suppression d'un paiement qui
a produit un crédit. Trois garanties éprouvées par mutation dans
`schema-paiements.test.ts` — un remboursement peut désigner son achat, deux
octrois pour un paiement restent refusés, un paiement crédité ne se supprime
pas. Le récit ci-dessous reste pour mémoire.

Relevées le 27/08/2026 en relisant, sur `credit_transaction.payment_id` — le
lien ajouté en C3, désormais construit.

### J1. `on delete restrict` au dictionnaire, `SET NULL` en base

Le dictionnaire (L950) écrit : « FK → payment(id) **on delete restrict** ». Le
motif est donné en C3 : « effacer un paiement ne doit pas faire disparaître le
crédit qu'il a produit ».

La migration livre l'inverse :

```sql
-- prisma/migrations/20260826070000_paiements/migration.sql:200
FOREIGN KEY ("payment_id") REFERENCES "payment"("id") ON DELETE SET NULL;
```

Effacer un paiement ne serait donc pas **refusé** : il passerait, et la ligne de
crédit resterait sans savoir d'où elle vient. C'est précisément le litige que
C3 voulait rendre impossible à régler à l'estime.

Rien n'efface un paiement aujourd'hui — aucun chemin ne le propose. La
divergence est dormante, pas inoffensive.

### J2. L'index couvre plus que ce que le dictionnaire prévoit

Le dictionnaire (L950) porte `payment_id` « **si `purchase`**, et sur
l'ajustement qui reprend un remboursement ». Deux mouvements peuvent donc
désigner le même paiement : l'achat, et l'ajustement qui l'annule.

L'index livré ne l'admet pas :

```sql
CREATE UNIQUE INDEX "credit_transaction_un_octroi_par_paiement"
    ON "credit_transaction"("payment_id") WHERE "payment_id" IS NOT NULL;
```

Un seul mouvement par paiement, quel qu'en soit le type. **Le jour où un
remboursement voudra désigner l'achat qu'il annule, il entrera en collision avec
lui** — et le service rendra un conflit là où il devrait écrire.

L'index tient bien la garantie pour laquelle il a été posé : deux confirmations
concurrentes ne créditent pas deux fois. C'est sa portée qui déborde. Le
dictionnaire dit comment la resserrer : `WHERE type = 'purchase'`.

C'est à corriger **avant** le chantier des remboursements, pas pendant — §6
demande de « déclencher un remboursement » et de « lever le blocage anti-fraude
d'un remboursement », et `refunded` est déjà un état lisible que rien ne pose.

---

## K. Qui a le droit d'exporter une liste ? — **tranché**

**Décision du porteur du projet, 27/08/2026 : aucun export pour le support.**
La règle vaut pour les cinq listes. L'export des connexions, seul ouvert
jusque-là, est fermé avec les autres — c'était l'incohérence relevée ci-dessous,
et elle est levée dans le sens du plus fermé.

**Ce que ça pose comme principe** : voir une liste et pouvoir la sortir sont
deux choses. La première est une lecture bornée par l'écran ; la seconde produit
un fichier qui quitte l'outil, circule par courriel et s'ouvre dans un tableur.
C'est le geste qu'on borne, pas la lecture — le support garde l'accès à tout ce
que §6 lui accorde.

**À reporter** dans `ux-admin-lehno.md` : §7 dit « les listes filtrées
s'exportent » sans nommer de rôle, et §6 n'en parle pas. La restriction doit y
figurer, sans quoi la lecture naturelle des deux sections dit l'inverse de ce
qui est construit.

Le relevé d'origine, pour mémoire :

Relevé le 27/08/2026 en livrant l'export des trois listes d'exploitation.

**Trois textes, deux réponses.**

- **§6** accorde au support « consulter les comptes, leur état, leur
  volumétrie » et « consulter les paiements et les mouvements de crédits ».
- **§7** dit « les listes filtrées s'exportent, pour l'analyse ou la
  conformité », sans assortir l'export d'un rôle.
- **L'écran des comptes** réserve déjà son bouton d'export aux administrateurs
  — `RoleGate autorise="admin"` dans `Liste.tsx`, livré avant ce chantier.

Les deux premiers, ensemble, l'ouvriraient au support. Le troisième le ferme.

**Ce qui a été fait, et pourquoi.** Les trois exports sont réservés aux
administrateurs, côté serveur comme à l'écran. Devant un désaccord entre une
spécification et une décision livrée, on a pris la lecture la plus fermée : un
fichier sort de l'outil et circule — par courriel, dans un tableur, sur un
poste. Restreindre se défait d'une ligne ; élargir laisse sortir des données
qu'on ne rattrape pas.

**Ce que ça rendait incohérent.** L'export des connexions, livré plus tôt,
était **ouvert au support** parce que sa liste l'est. Le principe « l'export
suit la visibilité de sa liste » valait donc pour les connexions et pas pour les
comptes. Deux issues se présentaient : ouvrir les trois, ou fermer aussi les
connexions.

**C'est la seconde qui a été retenue** (voir en tête). Ma préférence allait à la
première ; élargir un accès n'était pas une décision d'implémentation, et elle
ne m'appartenait pas.

**Un détail qui n'en est pas un.** Le bouton d'export des comptes proposait
« csv » **et « json »** ; le serveur ne rend que du CSV. Choisir JSON aurait
livré un CSV nommé `comptes.csv`. Les formats servis se déclarent désormais à
l'appelant, qui ne propose que ce qui existe. Le dictionnaire garde le libellé
JSON pour le jour où le format arrivera.

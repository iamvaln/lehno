# Écarts à reporter dans la documentation officielle

**Au 25 août 2026.** Ce qui a été décidé ou construit et qui ne correspond plus
à ce que disent les spécifications. Trois natures : ce qui les **contredit**, ce
qu'elles **ne couvrent pas**, et ce qui reste **ouvert**.

Chaque point cite la section concernée. Les décisions viennent du porteur du
projet, sauf mention contraire.

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

### A6. L'index partiel n'est pas ce qui permet plusieurs nuls

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

**À corriger** : la justification, pas la décision.

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

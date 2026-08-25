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

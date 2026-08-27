# Lehno — Ce qui a changé, côté back-office

À lire avec `brief-maj-contrat-commun.md`, qui porte les conventions partagées — statuts, erreurs par code, drapeaux. Ce document ne traite que l'outil d'administration.

Références : `ux-admin-lehno.md`, `spec-technique-lehno.md` (§8 pour les chemins, §9 pour les droits), `spec-portrait-lehno.md`, `design-system-lehno.md`.

> **Corrigé le 25/08/2026 — `ManualTopUp` n'existe plus.** Elle a été absorbée
> par `Payment`, distingué par son `mode` : `provider`, `semi_manual`, `manual`.
> Une entité séparée aurait obligé à tenir deux registres et deux historiques
> d'états, et **embrouillerait la comptabilité** — une recharge manuelle
> n'aurait même pas paru dans l'historique des paiements du client, alors que
> c'en est un du point de vue de celui qui a versé l'argent.
>
> Les chemins deviennent : `/admin/payments` (lecture et **saisie**),
> `/admin/payments/{id}/decision` (confirmer ou rejeter, avec la référence de
> la transaction et le montant constaté), et `/admin/collection-accounts` (les
> comptes sur lesquels les clients versent). Voir le dictionnaire, sections
> `Payment` et `CollectionAccount`.

---

## 1. La navigation s'allonge

Deux sections nouvelles dans la famille **Économie**, et la numérotation a bougé.

**Tableau de bord** *(entrée)*

**Exploitation** — comptes · crédits et paiements · modération
**Économie** — paramètres · **fonctionnalités** · modèles d'IA · **studio du portrait** · offres et croissance
**Supervision** — métriques · journal d'audit · connexions
**Outils** — liens externes

---

## 2. Le rôle `support` perd l'accès à toute la famille Économie

**Y compris en lecture.** Paramètres, fonctionnalités, modèles d'IA, studio, offres : fermés.

Et une règle qui va plus loin qu'un refus : **une section entièrement fermée ne figure pas dans le menu**. Le support ne voit pas des portes closes, il voit son outil.

Ce qui lui reste : comptes, crédits et paiements (consultation, relance d'opération), modération, tableau de bord, métriques, connexions, liens externes.

---

## 3. §5.7 Fonctionnalités — section nouvelle

Allumer et éteindre les fonctionnalités, pour livrer le produit par morceaux.

**Le registre vient du serveur.** `/admin/feature-flags` rend, pour chaque drapeau, ce qu'il gouverne **et la liste des écrans et points d'entrée qu'il couvre**. L'écran affiche cette couverture : un administrateur doit voir **ce qu'il éteint** avant de basculer, sans lire le code.

**Les conséquences s'annoncent avant la bascule.** Éteindre le Mur emporte le dépôt de vœux et la réservation ; éteindre mes listes emporte la réservation. L'écran le dit, plutôt que de le laisser découvrir.

**Le socle n'y figure pas** — proches, notes, dates, rappels, compte ne sont pas extinguibles.

**L'arrêt pour intervention est ailleurs**, dans les paramètres. Éteindre une fonctionnalité retire une surface ; arrêter le service suspend tout et annonce un délai. Les mettre au même endroit inviterait à les confondre — et le back-office reste joignable pendant un arrêt, ce qui permet de le lever.

Chaque bascule est journalisée avec son auteur et sa date.

---

## 4. §5.9 Studio du portrait — section nouvelle, en trois entrées

C'est la section la plus riche de l'outil, et celle qui bougera le plus.

**a) Réglages en service** — ce qui tourne aujourd'hui : modèle par production, orientations actives et leur ordre, ambiances, motif. Plus l'**historique des publications** (auteur, date, ce que chacune changeait) et le **retour arrière**, qui **republie** une version antérieure sans la reconstruire.

**b) Composition** — le brouillon : gabarits de production, consignes, garde-fous, libellés dans les deux langues, activation de chaque orientation et ambiance.

**c) Banc d'essai** — profils de simulation, essais, **comparaison de deux essais côte à côte** sur le même profil, coût du jour.

**Trois règles qui structurent l'écran**

- **Le brouillon et la publication sont deux choses.** On modifie librement ; rien ne change pour les utilisateurs tant qu'on n'a pas publié.
- **La publication se fait depuis le banc d'essai**, non depuis la composition : on publie après avoir vu un résultat, pas après avoir tapé un texte.
- **Elle est refusée tant qu'aucun essai n'a tourné** sur la combinaison en cours. L'écran doit rendre le bouton indisponible, pas laisser l'appel échouer.

**Le coût des essais s'affiche.** Chaque simulation appelle un modèle et se paie en argent réel — l'écran montre ce que l'essai a coûté et le cumul du jour, et un plafond quotidien évite qu'une après-midi de réglages passe inaperçue. Aucun crédit consommé, aucun compte réel touché.

**Les profils de simulation** se composent et se conservent depuis le banc d'essai. Ils doivent couvrir : fiche riche et fiche pauvre, nom court et nom long, les deux langues, relation familiale et professionnelle, et **au moins un cas sensible** — c'est celui qui révèle si un gabarit dérape.

---

## 5. §5.4 Crédits et paiements — trois ajouts

**Les paliers d'achat.** Montants, crédits obtenus, remise affichée, ordre. Aucune saisie libre côté application : le plus petit palier fixe le minimum.

**Les paiements manuels.** Une recharge manuelle **est un paiement**, pas une demande à part : même cycle, même historique d'états, même place dans l'historique du client. Son `mode` la distingue — `semi_manual` (le client verse puis dépose son reçu) ou `manual` (l'administrateur saisit tout).

La file présente ceux qui attendent vérification, avec le palier, le **canal** et son barème, le **compte de collecte**, le **montant attendu** et le reçu.

> **Le reçu ne prouve rien.** Un montage est facile : l'administrateur **constate la réception sur le compte** et **saisit le montant reçu**. L'écart entre attendu et reçu se traite, il ne se devine pas. L'écran doit porter ce rappel — il évite l'approbation machinale. Rejeter exige un motif.

**Les canaux de paiement.** Opérateur, pays, barème : part proportionnelle, part fixe, plancher, plafond, et **qui supporte les frais**. Un barème se règle une fois — il ne se recopie pas sur chaque numéro de client.

**Les comptes de collecte.** Les numéros sur lesquels les clients versent. **`is_visible_in_app` et `is_active` ne disent pas la même chose** : le premier décide de ce que le client voit, le second de ce qui reste employable. Jamais supprimé, seulement désactivé — un paiement passé le référence.

**La confirmation manuelle d'un paiement.** Une opération restée en attente alors qu'elle a visiblement abouti chez l'opérateur se tranche à la main, avec motif.

**L'historique d'un paiement** s'affiche dans son détail : chaque état avec sa **durée**, ce qui l'a provoqué (geste de l'utilisateur, notification, interrogation, décision d'administration, traitement programmé) et son auteur.

---

## 6. §5.8 Modèles d'IA — l'écran a changé de forme

**Livré et en service.** Ce qui suit décrit ce que l'écran fait aujourd'hui, pas ce qu'il fera.

### Le rang n'est plus global : il y a une chaîne par tâche

L'écran affichait un **ordre unique** pour toute l'IA. Il forçait le classement des notes et la rédaction d'un message à partager le même modèle — alors que l'un tourne sur **chaque note** en arrière-plan sans que personne n'attende, et que l'autre **est le produit**.

Chaque tâche porte maintenant sa propre chaîne : rang 1, rang 2, rang 3.

| Tâche | Ce qui la caractérise |
|---|---|
| Classement des notes | volume maximal, personne n'attend |
| Détection du sensible | même volume, mais **l'erreur est irrattrapable** |
| Message | payé en crédits, lu par un humain |
| Idées de cadeaux | payé en crédits, tolère l'à-peu-près |
| Illustration · Style photo | **modèles d'image seulement** |

La détection du sensible est la seule tâche de fond qui ne suit pas l'économie : un événement mal jugé fait envoyer un « bonne fête » sur un anniversaire de décès.

### Deux interrupteurs, et l'écran ne doit jamais les fondre

**Éteint** est la décision d'un administrateur. **Momentanément injoignable** est le constat du disjoncteur, qui écarte un modèle après trois échecs consécutifs, pour cinq minutes.

Ils se réparent par des gestes **opposés** : le premier attend qu'on le rallume, le second se rouvre seul. Un modèle peut être **en service et injoignable** — et c'est justement l'état où l'on se demande pourquoi rien ne sort. Les afficher comme un seul « disponible » ferait attendre une reprise qui ne viendra pas.

Le disjoncteur **n'écrit jamais** dans l'interrupteur de l'administration, et lever une panne à la main ne rallume pas un modèle coupé.

### Le fournisseur est rappelé à chaque rang

Redondant avec le catalogue, et voulu : c'est ce qui rend visible d'un coup d'œil qu'on vient d'aligner trois modèles du même hébergeur — **une chaîne qu'une seule panne emporte en entier**, donc un repli qui n'aura jamais lieu.

### Ce que le serveur refuse, et ce dont il se contente d'avertir

**Refusé** — un modèle de texte sur une tâche d'image et l'inverse ; le même modèle deux fois dans une chaîne ; couper le dernier modèle en service **d'une tâche**, jugé tâche par tâche et non sur le catalogue entier (un catalogue riche en modèles de texte ne sauve pas la tâche d'image dont on vient de couper le dernier).

**Averti sans être refusé** — une chaîne de moins de trois rangs, une chaîne dont un fournisseur est répété. Ce sont des jugements d'exploitation, et refuser rendrait les tâches d'image **inconfigurables** : parmi les fournisseurs retenus, deux seulement produisent des images.

### Promouvoir et déclasser envoient la chaîne entière

Jamais un échange de deux rangs : la base porte une unicité sur (tâche, rang), et un échange en deux écritures la viole au milieu du chemin.

### Le repli ne vaut pas pour l'administration

Le repli automatique existe pour **ce qui tourne sans témoin** : l'arrière-plan et les générations d'utilisateur. Un essai lancé depuis le studio appelle **le modèle demandé**, ou échoue en le nommant — sinon l'administrateur regarderait un résultat produit par un modèle qu'il n'a pas choisi, et le publierait en croyant avoir vu ce qui tournera.

### Les tarifs sont vides au départ, et c'est voulu

Les prix changent sans nous prévenir ; un tarif recopié dans le code aurait l'air de faire foi longtemps après être devenu faux. L'écran affiche **« non tarifé »** tant que personne ne les a saisis — jamais « 0 », qui se prend pour un fait.

### Le facturé et le réel : pas encore

L'écran devra montrer, en face l'un de l'autre, **ce qu'une production a coûté** et **ce qu'elle a rapporté**. Le prix étant unique pour tous, certaines coûtent plus qu'elles ne rapportent : **c'est la moyenne qui compte**.

`AIUsage` existe désormais et porte la dépense par tentative. **Il lui manque deux champs** pour cet écran :

- **`origin`** — d'où vient l'appel. Les opérations d'administration **ne facturent rien mais coûtent** : essais du studio, régénérations offertes, classement des notes, détection du sensible. Les omettre donnerait une marge flatteuse et fausse.
- **un lien vers ce qui a déclenché l'appel** — `action_run_id`, ou l'essai de studio. Sans lui, une ligne de dépense ne se rattache à rien : on sait qu'on a payé, pas pour quoi. **Ce rattachement ne se reconstitue pas après coup** : à poser avant la première génération facturée.

`ActionRun` n'existe pas encore, donc « ce que ça a rapporté » n'a rien à lire.

---

## 7. §5.2 Tableau de bord — une ligne de plus

**Ressources** : l'espace occupé sur le stockage de fichiers et sa progression, rapportés au plafond du plan. L'alerte se déclenche à **70 %**, pas quand le plafond est atteint.

---

## 8. Ce que le back-office doit respecter, comme le reste

**Deux thèmes.** L'outil suit le thème du système et laisse l'imposer. Les séances sont longues ; le choix appartient à celui qui l'utilise. Les couleurs se déclarent **par rôle**, jamais par valeur.

**Bilingue.** L'interface suit la langue de l'administrateur. `admin/Topbar.jsx`, `admin/Breadcrumb.jsx` et `admin/AuditTrail.jsx` écrivent encore des chaînes en dur — même règle que pour l'application : **aucune chaîne dans un composant**.

**Motif obligatoire.** Les appels qui modifient l'état d'un compte, un solde ou un contenu **exigent un motif**. Sans lui la requête échoue — c'est ce qui garantit que le journal d'audit dise quelque chose.

**Une action hors des droits n'apparaît pas.** L'interface n'expose que ce que le rôle permet ; le serveur refuse par ailleurs.

**Le journal d'audit est réservé aux administrateurs** — c'est ce qui lui donne sa valeur de contrôle sur le travail du support.

---

## 9. Les chemins

Les nouveaux, sous `/v1/admin` :

| Chemin | Rôle |
|---|---|
| `/admin/feature-flags` | Drapeaux et leur couverture |
| `/admin/maintenance` | Déclencher, prolonger ou lever un arrêt pour intervention |
| `/admin/credit-bundles` | Paliers d'achat |
| `/admin/payments?mode=manual` | Paiements manuels à vérifier |
| `/admin/payments/{id}/verify` | Constater le montant reçu, approuver ou rejeter |
| `/admin/payment-channels` | Canaux et barèmes de frais |
| `/admin/collection-accounts` | Comptes de collecte |
| `/admin/payments/{id}/confirm` | Confirmation manuelle d'un paiement |
| `/admin/portrait-studio/candidates` | Valeurs candidates |
| `/admin/portrait-studio/config`, `/publish`, `/rollback`, `/history` | Brouillon, publication, retour arrière |
| `/admin/portrait-studio/profiles` | Profils de simulation |
| `/admin/portrait-studio/trials` | Essais |
| `/admin/portrait-studio/templates`, `/{id}` | Gabarits et leurs versions |

**Tous réservés au rôle `admin`.**

---

## 10. Ce qui reste ouvert

- Les **schémas détaillés** de requête et de réponse.
- Le **plafond quotidien** des essais du studio.
- Les **libellés** des drapeaux dans les deux langues — ils viennent du registre, côté serveur.

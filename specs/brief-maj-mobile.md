# Lehno — Ce qui a changé, côté mobile

À lire avec `brief-maj-contrat-commun.md`, qui porte ce qui vous engage avec le serveur. Ce document ne traite que l'application.

Références : `ux-app-mobile-lehno.md`, `design-system-lehno.md`, `spec-portrait-lehno.md`, `ton-et-ecriture-lehno.md`.

---

## 1. La navigation passe à cinq onglets

**Accueil · Dates · Proches · Moi · Réglages**

*Moi* s'est scindé :

- **Moi** (§3.17) — ce que je montre de moi : mon Mur, mes listes de souhaits, mon lien de vœux, les mots reçus, mes réservations.
- **Réglages** (§3.28) — profil, crédits et paiements, notifications et données, sécurité, aide.

Libellés anglais : *Home · Dates · People · Me · Settings*.

**`TabBar.jsx` porte encore quatre onglets** — et sa liste par défaut écrit les libellés en dur, ce qui les rend intraduisibles. Les deux se corrigent ensemble.

---

## 2. Ce que l'extinction d'un drapeau demande à l'écran

Le serveur rend la liste résolue ; l'application masque. **Mais un écran masqué laisse un trou, et le trou doit rester habitable.**

- **La barre d'onglets tient à trois comme à cinq.** Aucune largeur figée, et l'onglet d'ouverture existe toujours.
- **Les cartes à deux actions vivent avec une seule.** La carte d'échéance perd *Préparer* si la génération est éteinte : elle ne doit pas paraître amputée.
- **Les renvois disparaissent** plutôt que de mener à un écran vide. Une fiche ne propose pas un studio éteint.

**Un repli est nécessaire** : si l'appel des drapeaux échoue au démarrage, l'application s'ouvre sur le **socle** — proches, notes, dates, rappels — plutôt que vide.

**L'arrêt pour intervention n'est pas un drapeau, et les confondre casserait l'application.** Une fonctionnalité éteinte rend `404` et son écran disparaît. Un arrêt rend **`503`** avec `retryAfterSeconds` : **rien ne se masque**, un écran d'attente s'affiche, et le délai vient du serveur — ne le recalculez pas.

Puis interrogez `/public/maintenance` plutôt que de rejouer l'appel d'origine. **Aucune déconnexion, aucun cache vidé.**

L'arrêt couvre `/public/config` et `/auth/*` : **l'écran d'attente doit exister avant l'entrée dans l'application**, pas seulement une fois connecté.

**Un drapeau inconnu vaut éteint** : une version installée ignore une clé créée après elle.

---

## 3. L'accueil s'est allégé (§3.2)

Les trois tuiles d'actions rapides et le bandeau de compteurs ont disparu. Il reste :

1. **Une phrase d'accueil** qui donne l'état des lieux — « Une date aujourd'hui, deux cette semaine ».
2. **Trois échéances**, dont seule la plus imminente porte ses actions.
3. **Un bouton unique** — *Laisser une note*.
4. Une invitation discrète **« Faire ma liste »**, tant qu'aucune liste n'existe.

**La phrase d'accueil est conditionnelle.** Ses variantes s'écrivent **une à une dans chaque langue**, avec leurs formes de singulier et de pluriel — le zéro prend le singulier en français, le pluriel en anglais. Pas de recollage de morceaux.

Un seul appel la sert : `/me/home` rend les échéances **et les décomptes** de la phrase.

---

## 4. Le studio du portrait, en six temps (§3.7)

1. **L'écran s'ouvre déjà réglé** — `/me/studio/options` rend les orientations et ambiances **actives**, leurs valeurs par défaut et le prix. Une orientation désactivée en administration disparaît sans livraison.
2. **L'utilisateur change ce qu'il veut** — orientation, voie d'image, famille ou style, plage de notes.
3. **Il ajoute du texte libre** — ce qu'il faut savoir du proche, et la note qui accompagnera le portrait.
4. **Un récapitulatif** montre ce qui va servir et **ce que cela coûte**. Chaque ligne **ramène à son réglage** : voir « orientation : ma fierté » sans pouvoir la changer d'un geste serait pénible.
5. **Il confirme.** L'écran accompagne la production, laisse **quitter sans perdre**, et prévient à l'aboutissement.
6. **Le résultat arrive en deux temps** — le **texte dès qu'il est prêt**, l'**image ensuite**, en se dessinant progressivement. Les faire attendre l'un l'autre ferait patienter pour rien.

**L'image se télécharge depuis une URL signée**, jamais depuis un binaire encodé dans la réponse : c'est ce qui permet l'affichage progressif et le cache.

---

## 5. Mes listes de souhaits (§3.29) — et ce qu'il ne faut pas confondre

Une liste par occasion à moi. On crée, on tient, on partage, on voit ce qui a été réservé. **Une notification signale chaque réservation confirmée.**

**Deux objets distincts, deux traitements :**

| | Ma liste (§3.29) | Ce qu'un proche m'a demandé (§3.19) |
|---|---|---|
| Se partage | Oui | **Jamais** |
| Action | On **réserve** | Je **marque** ce qui m'intéresse |
| Qui voit | Le public | Moi seul |

Le **marquage** n'engage à rien et n'a aucun effet sur la disponibilité : il remonte le souhait en tête des suggestions à la préparation. Il lui faut donc un traitement visuel **différent** de « réservé ».

---

## 6. Le topo d'un proche, en tête de fiche

La fiche affiche ce que les notes ont appris : couleur, animal, plat, taille, métier, loisirs, ce qu'il faut éviter. Ces valeurs viennent de `/me/persons/{id}/attributes`.

**Le client n'a aucune logique à tenir.** Il affiche ce qui vient ; une valeur absente ne paraît pas, et une fiche neuve n'affiche aucun bloc plutôt qu'une liste de cases vides.

**Aucun formulaire ne les demande.** Ils sont extraits des notes. Corriger, c'est écrire une note nouvelle — le plus récent l'emporte.

Chaque attribut porte sa **ligne de provenance**, et un appui ramène à la note d'où il vient.

## 7. Les notes — classement asynchrone (§3.5, §3.4)

**La saisie se confirme aussitôt**, sans attendre le classement.

- **Un échec de classement n'est ni montré ni bloquant.**
- **Une note peut rester sans catégorie.** Elle paraît alors dans un bloc **« à ranger »** en tête de la fiche, que l'utilisateur vide d'un appui.
- **Elle sert quand même** : la préparation lit son contenu comme celui des autres.

**`CategoryTag` ne porte pas les catégories du modèle.** Le kit a *Goût, Idée cadeau, No-go, Souvenir, À classer*. Le modèle en compte sept, en deux natures :

- **Durables**, sur la fiche : `interests`, `dislikes_nogo`
- **Ponctuelles**, sur une occasion : `gift_ideas`, `message_ideas`, `facts`, `encouragements`, `challenges`

Et **`dislikes_nogo` ne pèse pas comme les autres** : six catégories organisent l'affichage, celle-ci **contraint ce que le produit propose**. Se tromper ailleurs coûte un rangement approximatif ; se tromper ici fait proposer du vin à quelqu'un qui ne boit pas.

---

## 8. Le paiement (§3.9)

**Les paliers remplacent la saisie libre.** Chacun affiche ses crédits et, sur les plus grands, **la remise en clair** (« +20 % offerts ») — c'est un argument de vente. Le plus petit palier fixe le minimum. Les valeurs viennent du serveur.

**Un autre chemin quand le paiement est indisponible**, et c'est **un paiement comme les autres** — il figure dans l'historique avec son état. L'écran affiche les **comptes sur lesquels verser** (nom et numéro), le **montant à envoyer** — frais compris s'ils sont à la charge du client —, puis l'utilisateur dépose son **reçu**. L'écran annonce le délai de vérification.

**Les frais se disent avant.** Personne ne doit découvrir un écart au moment de payer : si le client supporte les frais de l'opérateur, le montant affiché les inclut et l'écran l'explique.

---

## 9. Les liens universels

L'application déclare les chemins qu'elle prend en charge. **Trois cas** :

- **Installée, connecté** — la surface s'ouvre dans l'app, la personne est **reconnue**. Si le lien est le sien, retour à son espace plutôt qu'à la vue publique.
- **Installée, sans compte** — la surface s'ouvre **sans écran de connexion**. Répondre ne demande aucun compte ; la proposition d'en créer un vient après le geste.
- **Pas installée** — le navigateur suffit.

**Le lien survit à l'installation** : suivre un lien, installer, ouvrir → on retrouve la surface visée.

**Un chemin inconnu de la version installée s'ouvre dans le navigateur** plutôt que d'échouer.

---

## 10. Deux changements sur le contrat

**Le genre revient, mais au studio.** Il sert **l'accord grammatical** du texte produit — *fier ou fière* —, pour le proche comme pour celui qui signe. La question se pose **à la première génération**, là où elle sert, jamais dans le carnet. Elle se passe d'un geste.

**La date de naissance a changé de place.** Elle vit sur la fiche du proche (`birth_date`, `birth_year_known`), plus sur le planning de l'événement : **l'anniversaire s'en déduit**, et elle ne se saisit qu'une fois — dans le formulaire d'identité (§3.18).

**Le délai entre deux demandes de code croît** — 5 s, 25, 125 — et il vient du serveur dans `retryAfterSeconds`. Ne le recalculez pas : deux versions du parc appliqueraient deux règles.

## 11. Copy et thèmes

**Aucune chaîne dans un composant.** Le relevé du port en a trouvé neuf, `aria-label` compris — ceux-ci restent en français pour quelqu'un qui a mis l'application en anglais.

**Deux corrections de couleur**, issues de mesures :

- `faint` : `#726E82` → **`#6B6579`** (4,15 sur panneau lilas, sous le seuil)
- `on-apricot` : `#8A5527` → **`#7A4A22`** (4,19 sur abricot — c'est le texte de « aujourd'hui »)

**La règle qui en sort** : une paire posée sur autre chose que le fond se mesure pour elle-même, jamais par déduction.

**Le décompte** — `J−3` en français, `3 days` en anglais. **La notation n'est pas arrêtée** : elle sera éprouvée par un test utilisateur, avec l'hypothèse d'une forme valable dans les deux langues. Un composant qui la fabrique fige une décision qui n'est pas prise.

**Deux points relevés par le port**, à porter aussi côté kit web : les **guillemets sont de la copy** (`« … »` ne sont pas ceux de l'anglais), et la couleur d'icône ne s'hérite pas en React Native.

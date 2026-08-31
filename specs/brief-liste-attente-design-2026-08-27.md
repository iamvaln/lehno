# Lehno — la liste d'attente : ce qu'il faut dessiner

Deux surfaces, et une contrainte qui les traverse : **le nombre de lignes de crédits varie d'une personne à l'autre**, et chaque combinaison doit tenir.

---

## 1. L'écran de bienvenue — le point dur

Il affiche aujourd'hui deux choses : les crédits offerts à tout le monde, et le résultat d'un éventuel parrainage. Il en affiche maintenant **une troisième** : le cadeau réservé à qui attendait sur la liste.

**Ce ne sont pas des lignes optionnelles d'un même bloc. Ce sont trois gestes distincts**, et les confondre dans un total unique effacerait la raison de chacun — on ne saurait plus pourquoi on a été récompensé, ni qu'il fallait s'inscrire à la liste pour l'être.

### Les quatre états à dessiner

| Ce que la personne a fait | Lignes affichées |
|---|---|
| Elle s'est inscrite, simplement | **1** — le cadeau de bienvenue |
| Elle est arrivée par un code de parrainage | **2** — bienvenue + parrainage |
| Elle attendait sur la liste | **2** — bienvenue + cadeau d'attente |
| Elle attendait **et** est arrivée par un code | **3** |

Le troisième cas est celui du lancement : **tous ceux qui recevront le courrier d'ouverture verront deux lignes.** C'est l'état le plus fréquent des premiers jours, pas un cas limite.

### Le parrainage a lui-même trois issues

Il peut être **crédité**, mais aussi **inconnu** (le code n'existe pas) ou **à soi-même**. Dans ces deux derniers cas l'inscription aboutit quand même, et la ligne doit le dire sans dramatiser — c'est une information, pas un échec.

Un écran qui ne prévoit que « crédité » affichera un vide ou un message d'erreur là où il faudrait une phrase calme.

### Ce que le serveur envoie

- `signupCredits` — un nombre, toujours présent
- `waitlistBonus` — un nombre **ou rien**. Rien veut dire « cette personne n'attendait pas », et **la ligne ne doit alors pas exister** : pas de « 0 crédit », pas de ligne grisée.
- `referral` — **ou rien**, avec son issue quand il y en a un

---

## 2. La landing avant l'ouverture

Le formulaire de liste d'attente existe déjà. Deux choses s'y ajoutent, et **une décision reste ouverte**.

### La contrepartie : à trancher

Deux versions à préparer, pour que la décision se prenne tard :

**A — on annonce qu'il y a quelque chose, sans dire combien.** *« Les premiers inscrits reçoivent des crédits en plus à l'ouverture. »* On garde la raison de s'inscrire et la liberté de fixer le montant plus tard — voire de l'augmenter si la liste est courte.

**B — on ne dit rien**, et le cadeau se découvre à l'ouverture de l'application. Plus joli pour quelques centaines de personnes ; coûte les milliers qui ne se seraient pas inscrites.

Ma recommandation est **A**, mais dessine les deux : le choix se fera en voyant la page.

### Pas de compte à rebours

On ne contrôle pas la date — la revue des magasins peut prendre une semaine de plus. **Un décompte qu'on rate est une promesse rompue en public**, sur la seule page que les gens regardent.

À la place : *« on vous écrit dès l'ouverture »*. C'est vrai, c'est tenable, et c'est exactement ce qui va se passer.

### Ce qui change au jour J

Le drapeau `launch.live` bascule : les liens de magasin remplacent le formulaire. **La page ne se redéploie pas** — elle lit le drapeau, et la bascule met jusqu'à cinq minutes à paraître.

Il faut donc dessiner **les deux états de la même page**, pas deux pages.

---

## 3. Le courrier d'ouverture

Il part une seule fois, à tous ceux qui attendaient, le jour où on ouvre.

**Ce qu'il doit contenir** : que c'est ouvert, le lien vers l'application, et — si on choisit A — le rappel qu'un cadeau les attend à l'intérieur.

**Ce qu'il ne doit PAS contenir** : un code, un jeton, un identifiant personnel. **Le lien ne porte rien.** Le cadeau se déclenche sur l'adresse au moment où le compte se crée, et c'est ce qui le protège : un bonus porté par le lien serait transférable — dix amis toucheraient ce qui était réservé à un inscrit.

Le lien peut donc être partagé, transféré, publié. Ça ne coûte rien, et ça peut même servir.

**Ton** — c'est une bonne nouvelle attendue, pas une promotion. On dit ce qui est ouvert et on donne le chemin.

---

## 4. Ce qui reste à décider, et qui n'est pas pour toi

- **Le montant du cadeau**, réglé en administration avant l'ouverture. Zéro est valide : on peut ouvrir sans, et l'activer plus tard.
- **Le moment de la bascule**, et ce qu'on fait si la revue des magasins traîne.

---

## Le fil qui traverse tout

**Aucune ligne ne s'affiche à vide.** Un cadeau nul n'a pas de ligne, un parrainage absent n'a pas de bloc, un décompte qu'on ne tient pas n'existe pas.

C'est la même discipline que pour les drapeaux — *le trou doit rester habitable* — appliquée à un écran qui se remplit différemment pour chaque personne.

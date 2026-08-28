# Lehno — les modèles d'IA : catalogue, routage, repli, mesure

**But** : qu'aucune génération ne dépende d'un seul fournisseur, que l'administration
puisse changer d'avis sans livraison, et qu'on sache ce que chaque appel a coûté
**avant** de le découvrir sur la facture.

**Ordre imposé** : la gestion des modèles d'abord, la mesure de l'usage ensuite.

---

## Les deux décisions qui structurent tout

### 1. Le routage est par tâche, jamais global

Un rang unique pour toute l'IA forcerait le classement des notes et la rédaction
d'un message à partager le même modèle. Or l'un tourne sur **chaque note** en
arrière-plan sans que personne n'attende, et l'autre **est le produit**. Ils n'ont
ni le même besoin de qualité, ni le même volume, ni le même budget.

Chaque tâche porte donc sa propre **chaîne** : rang 1, rang 2, rang 3.

| Tâche | Ce qui la caractérise | Ce qu'on y range |
|---|---|---|
| `note_classification` | chaque note, en fond, personne n'attend | le plus rapide et le moins cher |
| `sensitive_detection` | même volume, mais **l'erreur est irrattrapable** | un cran au-dessus, volontairement |
| `message` | payé en crédits, lu par un humain | le meilleur |
| `gift_ideas` | payé en crédits, tolère l'à-peu-près | intermédiaire |
| `illustration` | image | modèles d'image seulement |
| `photo_style` | image | modèles d'image seulement |

`sensitive_detection` est le seul endroit où l'on **ne suit pas** l'économie. Le
classement qui se trompe donne une idée de cadeau bancale ; le sensible qui se
trompe fait envoyer un « bonne fête » sur un anniversaire de décès.

Le vocabulaire est celui de `PromptKind`, qui existait déjà. Deux énumérations
nommant la même chose autrement finissent toujours par diverger.

### 2. Deux interrupteurs, et surtout pas un seul

C'est le piège central, et il ne se referme qu'au modèle de données.

- **`enabled`** appartient à l'administrateur, et à lui seul.
- **`outageUntil` / `consecutiveFailures`** appartiennent au disjoncteur, et à lui seul.

Les confondre casse **dans les deux sens** : la reprise automatique rallumerait un
modèle qu'on avait volontairement coupé ; et le disjoncteur redéclasserait, trois
minutes plus tard, celui que l'admin vient de promouvoir — l'écran mentirait alors
sur ce qui est en vigueur.

**Conséquence** : un modèle coupé à la main reste coupé même quand il redevient
joignable. Un modèle en panne redevient primaire tout seul, sans que personne n'agisse.

Le **rang**, lui, n'appartient qu'à l'administrateur. Le repli ne réordonne rien :
il **saute**.

---

## Les lots

### Lot 1 — le modèle de données ✅ fait

`AIModel` remanié (capacité, deux interrupteurs, `priority` supprimé), `AITaskRoute`,
`AIUsage`, énumérations `AICapability` / `AITask` / `AIUsageStatus`, et la migration.

**Trois choix à retenir** :

- `AIUsage` porte **une ligne par tentative**, pas par génération. Un repli en
  produit deux, et c'est précisément la paire qu'on veut lire : une chaîne qui se
  replie systématiquement coûte le double en silence.
- `AIUsage` **référence** le modèle et **recopie** son fournisseur et sa clé. La
  référence sert aux jointures ; la copie survit au modèle, pour qu'un catalogue
  qu'on nettoie ne rende pas l'historique de facturation illisible.
- `AIUsageStatus` distingue `refused` de `error`. **Un refus ne se replie pas** :
  le modèle suivant refusera la même demande, et on aura payé deux fois le même non.

### Lot 2 — le catalogue pré-configuré

Un registre **dans le code** (`packages/contracts/src/ia.ts`), l'état en base,
réconcilié au démarrage — exactement la mécanique des drapeaux.

**La règle qui compte** : la réconciliation **crée** ce qui manque et ne **touche
jamais** une ligne existante. Sans elle, chaque redémarrage effacerait le choix de
l'administrateur, et on chercherait longtemps pourquoi le rang « ne tient pas ».

- Tests : un modèle nouveau apparaît ; un rang modifié à la main survit au redémarrage ;
  un modèle retiré du registre **n'est pas supprimé** (l'historique d'usage le référence).

### Lot 3 — le routeur

`chaine(tache)` rend les modèles par rang croissant, en **sautant** ceux qui sont
coupés à la main et ceux dont la panne n'est pas expirée.

- Tests : l'ordre est celui des rangs ; un modèle coupé est sauté sans décaler les autres ;
  une panne expirée le remet dans la chaîne ; **une chaîne entièrement indisponible
  échoue explicitement** plutôt que de rendre une liste vide qu'un appelant lirait
  comme « rien à faire ».

### Lot 4 — le disjoncteur

Compte les échecs consécutifs. Au seuil, pose `outageUntil`. Un succès remet le
compteur à zéro.

- **Seuil retenu : 3 échecs consécutifs, panne de 5 minutes.** Assez pour absorber
  une secousse, assez court pour qu'une panne brève ne prive pas de son primaire.
- Tests : trois échecs ouvrent ; un succès intercalé remet à zéro ; **un `refused`
  ne compte pas** — ce n'est pas une panne du fournisseur ; la panne expire seule.

### Lot 5 — les adaptateurs

Un par fournisseur, derrière une interface unique, plus un **faux** qui permet
d'éprouver le routeur et le disjoncteur sans réseau ni clé.

Sans le faux, aucun des lots 3 et 4 n'est testable en intégration continue.

### Lot 6 — la mesure

À chaque tentative, une ligne `AIUsage` : jetons, latence, coût estimé **au tarif
du catalogue au moment de l'appel**, et le rang tenté.

Le coût est **nul** quand le modèle n'est pas tarifé. Nul veut dire « on ne sait
pas », jamais « gratuit ».

- Tests : un repli laisse deux lignes, rangs 1 et 2, la première en `error` ; le
  coût suit le tarif ; **l'échec écrit sa ligne aussi** — sinon les pannes sont
  gratuites dans les statistiques, et la chaîne semble parfaite.

### Lot 7 — l'administration

- `GET /admin/ai-models` — le catalogue, avec **le fournisseur affiché à chaque rang**,
  pour qu'on voie d'un coup d'œil qu'on vient d'aligner trois modèles du même hébergeur.
- `GET /admin/ai-routes` — les chaînes, par tâche.
- `PATCH /admin/ai-routes` — réordonner une chaîne, promouvoir, déclasser. Motif obligatoire, journalisé.
- `PATCH /admin/ai-models` — couper ou rallumer, tarifer.

**Refus au serveur, pas à l'écran** :

- ranger un modèle de texte sur une tâche d'image, et l'inverse ;
- vider entièrement la chaîne d'une tâche — c'est le geste qu'on pose à trois heures
  du matin en éteignant ce qui échoue, et il coupe toute génération sans que rien
  ne le dise avant le premier appel.

**Avertissements, pas refus** : une chaîne de moins de trois modèles, une chaîne
dont plusieurs rangs partagent un fournisseur. Ce sont des jugements d'exploitation ;
les refuser rendrait la configuration d'image impossible (voir ci-dessous).

### Lot 8 — le contrat

Schémas Zod, `pnpm --filter @lehno/contracts openapi`, et le brief d'administration.

---

## Ce qui reste ouvert

**Les images n'ont pas trois fournisseurs.** La §1 du technique nomme Anthropic,
DeepSeek et Grok. Aucun des deux premiers ne produit d'image : la chaîne de
`illustration` et de `photo_style` ne peut pas atteindre trois rangs sans un
quatrième fournisseur. C'est pourquoi le lot 7 **avertit** au lieu de refuser.

**Les clés d'API manquent.** `.env.example` ne connaît que le courrielleur. Il en
faudra une par fournisseur — elles appartiennent au propriétaire du dépôt.

**`gift_ideas` n'a pas de `PromptKind`.** Les cinq gabarits existants ne couvrent
pas les idées de cadeaux, alors que la génération est prévue par la §5.4.

---

## Le fil

Les deux règles de ce chantier disent la même chose que le reste du dépôt :
**rendre le mauvais état impossible à écrire, plutôt que de compter sur la
discipline.** Le disjoncteur ne peut pas contredire l'administrateur parce qu'il
n'écrit pas dans son champ ; la chaîne ne peut pas se vider parce que le serveur
refuse ; un refus de modèle ne peut pas déclencher un repli payant parce qu'il
porte un statut distinct.

# Lehno mobile — le plan, au 27 août 2026

Écrit après lecture de `mobile app design.zip` (handoff du 27 août). Il dit ce
qui est fait, ce qui reste, **dans quel ordre**, et les trois décisions à
prendre avant d'écrire une ligne.

---

## 1. Le lancement est le plan

Le handoff donne la configuration décidée pour la première version :

> anniversaires seuls, versement manuel, collecte et parrainage ouverts.
> **Tout le reste éteint.**

Ce n'est pas un détail de paramétrage, c'est **l'ordre de construction**. Le
prototype calcule lui-même ce qui sort de la navigation (`ecranEteint`,
`moiVisible`). En appliquant le profil « Lancement » aux quarante écrans du
rail, la moitié disparaît.

**Construire dans l'ordre du rail serait construire à moitié ce que personne ne
verra.** L'ordre ci-dessous suit ce que le lancement ouvre.

### Ce que le lancement retire — donc ce qui attend

`souhait` (3.19) · `listes` (3.29) · `monmur` (3.10) · `reservations` (3.27) ·
`preparation` et `generation` (3.7) · `cadrage` (3.7) · `portrait` (3.22) ·
`studio` (3.7) · `reprises` (3.16) · `paiement` (3.25) · **`moi` (3.17)**

Treize écrans. **La barre passe à quatre onglets**, et l'identité — nom,
adresse publique, accès au profil — remonte en tête des Réglages.

### Ce qui reste à bâtir pour le lancement

Seize écrans, listés au §3.

---

## 2. Ce qui est déjà là

**Dix écrans**, tous vus tourner sur un émulateur contre l'API réelle :
l'ouverture animée, la connexion, le code, le pseudo, la bienvenue, le carnet,
la fiche d'un proche, son identité, la recherche, la maintenance.

**Vingt-deux primitives** sur les vingt-huit du nouveau kit, portées avec leurs
décisions dans des modules purs et éprouvées sans moteur de rendu — 110 tests.

**Les fondations** : jetons natifs dérivés de la même source que le CSS, client
HTTP avec renouvellement sérialisé, drapeaux, métadonnées, trousseau, arrêt pour
intervention, dictionnaire FR/EN.

**Les huit polices statiques sont en place** — Fraunces 400/500 et leurs
italiques, Karla 400/500/600/700, licences comprises, avec le script qui les
cuit. Le `A-COMPLETER.md` du handoff les liste encore comme **bloquantes pour
React Native** : elles ne le sont plus, et ça se voit à l'écran.

---

## 3. L'ordre de construction

### Lot A — la coquille (rien ne tient sans elle)

Aujourd'hui la porte mène droit au carnet, faute de coquille. Tout le reste s'y
accroche.

1. **La barre d'onglets** câblée, avec `moiVisible` **calculé** des drapeaux —
   jamais une liste tenue à la main. Le serveur n'enverra jamais `moi`.
2. **`ecranEteint`** en décision pure : un écran gouverné par un drapeau éteint
   sort de la navigation, et rien n'y mène.
3. **L'accueil (3.2)** — et sa règle : *un écran de consultation ne défile pas*.
   Il se remplit à la hauteur **mesurée** ; les rangs se retirent d'abord, puis
   une carte, minimum deux sur SE, et « Voir plus » porte le compte de ce qui
   sort. C'est le seul écran du lot qui demande de mesurer avant de rendre.
4. **La porte** mène à la coquille, plus au carnet.

### Lot B — le socle des dates (aucun drapeau, visible au lancement)

5. **Dates (3.14)** — se parcourt, donc défile.
6. **Ajouter une date (3.6)**, dans son état de lancement : `events.other`
   éteint, donc **pas de choix de type**. Ce qu'il disait passe dans la barre
   (« Nouvel anniversaire ») et l'année disparaît. La liste des types se lit
   dans `/me/metadata`, déjà filtrée — jamais le drapeau. C'est déjà branché.
7. **Saisie d'une note (3.5)**, et le bloc « à ranger » sur la fiche pour la
   note que le classement n'a pas su ranger. Ton neutre : elle sert déjà.
8. **Une occasion (3.21)**, sans son bloc de préparation — les générations sont
   éteintes au lancement — et son geste en pied.

À la fin de ce lot, **trois des cinq sorties de la fiche mènent quelque part**.

### Lot C — ce que le lancement ouvre

9. **Réglages (3.28)** avec l'identité remontée en tête, **Profil (3.23)**,
   **Rappels (3.11)**, **Sécurité (3.24)**, **Aide (3.26)**, **Mes données
   (3.31)**, **Compte fermé**.
10. **Notifications (3.13)** — la cloche à trois natures sur cinq, `collect`
    ouvert. Pas d'écran de détail : une notification est un chemin, pas une
    destination.
11. **Recharger (3.9)** dans son état de lancement : **le solde, les mouvements,
    le versement manuel**. Pas de paliers, pas de moyens de paiement, pas
    d'attente opérateur.
12. **Parrainage (3.9)** — la ligne vit à deux endroits et suit le drapeau aux
    deux.
13. **À valider (3.8)**, **Lien de collecte (3.20)**, **Un lien public (3.12)** —
    `collect` est ouvert au lancement.

### Lot D — après le lancement

Les treize écrans du §1, dans l'ordre où leurs drapeaux s'allumeront. Le studio
en six temps et le paiement par paliers sont les plus gros ; ils n'ont aucune
urgence.

---

## 4. Les primitives qui manquent, et quand

Six sur vingt-huit. **Elles ne se portent pas toutes maintenant** — chacune
arrive avec le lot qui l'emploie.

| Primitive | Lot | Pourquoi là |
|---|---|---|
| `Toast` | A | *Aucun geste muet* : chaque bouton mène à un écran ou pose un accusé |
| `ConfirmSheet` | B | La suppression, la fermeture de compte |
| `PaidActionSheet` | D | *Rien ne se paie en silence* — mais rien ne se paie au lancement |
| `BrandMark` | C | Les surfaces publiques |
| `SocialGlyph` | C | idem |
| `PortraitComposition` | D | Le portrait canonique, deux écrans l'importent |

Les vingt-deux existantes se **relisent** contre les `.d.ts` du nouveau kit
avant d'être réputées bonnes. Vérification faite sur cinq d'entre elles
(`Button`, `Tag`, `EventCard`, `TabBar`, `EmptyState`) : les contrats
correspondent. Ce n'est pas un re-portage, c'est une relecture.

---

## 5. Ce qu'il faut trancher avant d'écrire

Le handoff dit lui-même que ces choix sont **natifs** et qu'une planche ne peut
pas les exprimer. Ils nous reviennent, et ils conditionnent le lot A.

**Ce qui pousse et ce qui monte.** La préparation, la saisie de note, la feuille
payante. Une modale et un écran poussé ne se ferment pas du même geste et ne
gardent pas la même pile.

**Le clavier.** Où se pose le bouton plein quand il est ouvert — critique pour
la note, le formulaire d'événement, le code. Le code est déjà fait ; les deux
autres attendent.

**La zone sûre.** Ce qui passe sous l'encoche, ce qui passe sous la barre.

**Le tirer-pour-rafraîchir.** Le pilote du handoff dit : oui sur l'accueil, non
sur les formulaires. À confirmer pour Dates et le carnet.

**L'attente de génération** — « quitter sans perdre » est un comportement. Sans
objet au lancement, à trancher avant le lot D.

Je propose de les arrêter en un document court, comme le reste, plutôt qu'en
les découvrant écran par écran.

---

## 6. Ce qu'il faut dire au designer, vite

**Ne pas répliquer le port React Native.** Le `A-COMPLETER.md` propose de
convertir mécaniquement 50+ fichiers — « 274 `<div>`, 51 grilles, 62
raccourcis `border`, 190 propriétés sans effet ». **C'est fait, et autrement.**

`packages/ui-native` porte déjà vingt-deux primitives, avec une convention que
le kit web ne pouvait pas prévoir : les **décisions** de chaque composant vivent
dans un module pur, éprouvé sans moteur de rendu, et le `.tsx` n'est qu'une
couche d'application. C'est ce qui permet de tester qu'un bouton a un état
pressé visible **dans les deux thèmes et pour tous ses rangs** — ce qu'aucune
conversion mécanique ne donne.

Une seconde traduction produirait deux jeux de composants qui divergeraient à la
première correction. Ce qui nous sert du lot `react-native/`, c'est la **note de
conventions** — elle est juste, et elle recoupe ce qu'on a trouvé.

**Les polices ne bloquent plus.** Les huit instances statiques sont en place
depuis le lot 0.

---

## 7. Deux questions ouvertes

**Pour le backend.** `referral` allumé pendant que `credits` est éteint promet
des crédits qui n'achètent rien. Le handoff pose la question : dépendance à
ajouter au registre, ou promesse qui tient parce que les crédits garderont leur
valeur ? Elle ne se tranche pas côté client.

**Pour le backend, toujours.** `/me/persons` n'a pas de `?q=`. La recherche
charge donc le carnet entier par pages de cent et filtre en mémoire. Tenable
pour un carnet personnel, mais c'est le seul endroit où le client fait un
travail qui revient au serveur.

---

## 8. Comment on saura que c'est juste

Le handoff donne **quatre profils de drapeaux** — tout allumé, lancement,
portrait fermé, crédits éteints. Ils ne sont pas une commodité de revue : ce
sont **quatre états à éprouver**, et les décisions pures les rendent testables
sans écran.

Le profil « crédits éteints » est celui qui piège, et le seul où éteindre un
drapeau *ajoute* de la valeur : l'achat s'en va, **les générations restent et
deviennent gratuites**. Aucun prix, aucun solde, aucune feuille de coût nulle
part. Un écran qui dirait « rechargez » mentirait.

Le socle seul a déjà été vu tourner — carnet et fiche intacts, quinze drapeaux
éteints. C'est la méthode à reprendre pour chaque lot : un mandataire qui ne
réécrit que `/me/features`, et l'écran qu'on regarde.

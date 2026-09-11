# La fiche de soi sur mobile — plan d'implémentation

> **Pour qui exécute :** les étapes portent des cases à cocher. Chaque tâche
> finit par un livrable éprouvable seul, et par un commit.

**Objectif** — que le titulaire d'un compte ait une fiche, qu'elle naisse sans
qu'il ait rien à comprendre, et qu'il puisse enfin poser une date à lui.

**Approche** — Mon profil absorbe la fiche : un champ à l'écran, une source par
champ. L'enregistrement écrit `PATCH /me/profile` puis `PUT /me/self`. Et
puisque `/me/persons` rend désormais la fiche de soi parmi les autres, les
écrans qui veulent dire « mes proches » doivent l'exclure — c'est la moitié du
travail, et celle qu'on ne voit pas venir.

**Pile** — React Native / Expo Router, Zod au contrat, Vitest sur des décisions
pures (`apps/mobile/lib/*.ts` n'importe que des *types* de `react-native`).

**Spec** — `specs/design-fiche-de-soi-mobile-2026-09-11.md`

## Contraintes générales

- Node 22 : `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"` avant tout `pnpm`.
- **Lint et tests en série**, jamais en parallèle : le test de
  `@lehno/eslint-config` écrit un fichier sonde dans l'arbre, et un `eslint`
  concurrent échoue dessus.
- `exactOptionalPropertyTypes: true` — une propriété optionnelle se répand
  conditionnellement (`...(x === undefined ? {} : { x })`). **TypeScript ne
  vérifie pas les propriétés en trop d'un littéral répandu** : une clé inventée
  passe en silence.
- Les décisions vivent dans `apps/mobile/lib/*.ts`, testées ; le `.tsx` est une
  couche mince.
- Commentaires en français, et ils disent **pourquoi**, jamais quoi.
- **Aucune mention d'assistant dans un message de commit.**
- Vérification avant de pousser : `pnpm -r typecheck`, puis
  `pnpm --filter @lehno/mobile test`, puis `pnpm lint`.

## Ce que le serveur donne déjà — vérifié le 11 septembre

| Fait | Conséquence |
|---|---|
| `GET /me/self` → 404 tant qu'il n'y a pas de fiche | l'absence est un état, pas une panne |
| `PUT /me/self` crée ou met à jour (`ecrireSoi`) | un seul chemin, idempotent |
| `selfPersonSchema` **exige** `gender` (`female \| male`) | pas de création sans genre ; le compte en a un |
| `profileSchema.gender` existe et l'écran le demande | la fiche le recopie, aucune question neuve |
| **`/me/persons` inclut la fiche de soi** | les écrans « mes proches » doivent l'exclure |
| `PUT /me/self` avec `birthDate` ne crée **aucune** occurrence | la date se pose par « Ajouter une date » |

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `apps/mobile/lib/soi.ts` **(créé)** | les décisions : que poster, peut-on poster, qui est un proche |
| `apps/mobile/test/soi.test.ts` **(créé)** | leur épreuve |
| `apps/mobile/lib/profil.ts` | inchangé — `corpsDeMiseAJour` reste au compte |
| `apps/mobile/app/(app)/profil.tsx` | la naissance, le nom d'usage, et le second envoi |
| `apps/mobile/app/(app)/proches/index.tsx` | exclure soi |
| `apps/mobile/app/(app)/proches/recherche.tsx` | exclure soi |
| `apps/mobile/app/note.tsx` | exclure soi |
| `apps/mobile/app/evenement.tsx` | garder soi, et le nommer |
| `apps/mobile/app/(app)/moi.tsx` | le nom vient de la fiche |
| `apps/mobile/messages/fr.ts`, `en.ts` | les libellés |

---

## Tâche 1 — Les décisions, hors de React

**Fichiers**
- Créer : `apps/mobile/lib/soi.ts`
- Test : `apps/mobile/test/soi.test.ts`

**Interfaces produites** — les tâches suivantes en dépendent :
- `ficheAEnvoyer(saisie: SaisieDeSoi): SelfPersonInput | null`
- `sansSoi(personnes: readonly Person[]): Person[]`
- `soiDabord(personnes: readonly Person[]): Person[]`
- `interface SaisieDeSoi { nom: string; nomDUsage: string; genre: Profile["gender"]; langue: Profile["uiLanguage"]; naissance: SaisieDeNaissance }`

- [ ] **Étape 1 — écrire le test qui échoue**

```ts
// apps/mobile/test/soi.test.ts
import { describe, expect, it } from "vitest";
import type { Person } from "@lehno/contracts";
import { ficheAEnvoyer, sansSoi, soiDabord } from "../lib/soi.js";

const NAISSANCE_VIDE = { jour: null, mois: null, annee: null, anneeConnue: true };

const saisie = (p: Partial<Parameters<typeof ficheAEnvoyer>[0]> = {}) => ({
  nom: "Valentine", nomDUsage: "", genre: "female" as const,
  langue: "fr" as const, naissance: NAISSANCE_VIDE, ...p,
});

describe("ce qu'on envoie pour poser sa fiche", () => {
  /* LE GENRE EST EXIGÉ PAR LE CONTRAT, et il vient du compte. Sans lui, on ne
     poste pas : un refus du serveur ferait découvrir la règle après coup, sur
     un écran qui n'a rien demandé de neuf. */
  it("ne compose rien sans genre", () => {
    expect(ficheAEnvoyer(saisie({ genre: null }))).toBeNull();
  });

  it("ne compose rien sans nom", () => {
    expect(ficheAEnvoyer(saisie({ nom: "   " }))).toBeNull();
  });

  it("porte le nom, le genre et la langue", () => {
    expect(ficheAEnvoyer(saisie())).toEqual({
      displayName: "Valentine", gender: "female", language: "fr",
    });
  });

  /* `selfPersonSchema` est `.strict()` : une clé vide serait refusée là où
     l'absence passe. Le nom d'usage se retire donc, il ne s'envoie pas vide. */
  it("n'envoie pas un nom d'usage vide", () => {
    expect(ficheAEnvoyer(saisie({ nomDUsage: "  " })))
      .toEqual({ displayName: "Valentine", gender: "female", language: "fr" });
    expect(ficheAEnvoyer(saisie({ nomDUsage: "Vava" })))
      .toEqual({
        displayName: "Valentine", callingName: "Vava",
        gender: "female", language: "fr",
      });
  });

  /* La naissance passe par `naissanceAEnvoyer`, qui décide seule de ce qui
     tient — un 29 février doit exister, et l'année peut être inconnue. */
  it("porte la naissance quand elle tient", () => {
    expect(ficheAEnvoyer(saisie({
      naissance: { jour: 15, mois: 6, annee: 1994, anneeConnue: true },
    }))).toEqual({
      displayName: "Valentine", gender: "female", language: "fr",
      birthDate: "1994-06-15", birthYearKnown: true,
    });
  });

  it("n'envoie pas une naissance incomplète", () => {
    expect(ficheAEnvoyer(saisie({
      naissance: { jour: 15, mois: null, annee: null, anneeConnue: true },
    }))).toEqual({ displayName: "Valentine", gender: "female", language: "fr" });
  });
});

const personne = (n: string, isSelf = false): Person => ({
  id: n, displayName: n, callingName: null, avatarUrl: null, isSelf,
  relation: null, gender: null, relationHint: null, birthDate: null,
  birthYearKnown: true, city: null, country: null, register: null,
  language: null, preferredChannel: null, createdAt: "2026-01-01T00:00:00.000Z",
  notesCount: 0, nextOccurrence: null,
});

/* `/me/persons` REND LA FICHE DE SOI PARMI LES AUTRES — vérifié au serveur le
   11 septembre. Les écrans qui disent « mes proches » doivent donc l'écarter,
   faute de quoi on se retrouve dans son propre carnet : on n'est pas un proche
   de soi-même. */
describe("qui est un proche", () => {
  it("écarte la fiche de soi", () => {
    expect(sansSoi([personne("Awa"), personne("moi", true)]).map((p) => p.id))
      .toEqual(["Awa"]);
  });

  it("ne change rien quand la fiche n'existe pas", () => {
    expect(sansSoi([personne("Awa")]).map((p) => p.id)).toEqual(["Awa"]);
  });

  /* Là où l'on choisit une PERSONNE — poser une date, écrire une note — soi
     reste offert, et en tête : c'est la fiche qu'on cherche le plus souvent
     quand elle vient d'exister, et la chercher au milieu du carnet serait
     absurde. */
  it("met la fiche de soi en tête là où elle a sa place", () => {
    expect(soiDabord([personne("Awa"), personne("moi", true)]).map((p) => p.id))
      .toEqual(["moi", "Awa"]);
  });

  it("laisse l'ordre reçu quand il n'y a pas de fiche", () => {
    expect(soiDabord([personne("Awa"), personne("Bah")]).map((p) => p.id))
      .toEqual(["Awa", "Bah"]);
  });
});
```

- [ ] **Étape 2 — le lancer et vérifier qu'il échoue**

```
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
pnpm --filter @lehno/mobile exec vitest run test/soi.test.ts
```

Attendu : échec, `Cannot find module '../lib/soi.js'`.

- [ ] **Étape 3 — écrire le module**

```ts
// apps/mobile/lib/soi.ts
import type { Person, Profile, SelfPersonInput } from "@lehno/contracts";
import { naissanceAEnvoyer, type SaisieDeNaissance } from "./carnet.js";

/* La fiche de soi — §10 du brief backend, conception du 11 septembre.
 *
 * ELLE NE DEMANDE RIEN DE NEUF. Le nom, le genre et la langue sont déjà saisis
 * dans Mon profil ; la fiche les recopie. Le seul champ vraiment nouveau est la
 * naissance. C'est ce qui permet de la poser au premier enregistrement du
 * profil, sans que personne ait eu à comprendre qu'il en existait une.
 */

export interface SaisieDeSoi {
  nom: string;
  nomDUsage: string;
  genre: Profile["gender"];
  langue: Profile["uiLanguage"];
  naissance: SaisieDeNaissance;
}

/* CE QU'ON ENVOIE, ou rien.
 *
 * `selfPersonSchema` EXIGE le genre, et l'énumération ne vaut que
 * `female | male` : sans lui on ne poste pas. Ce n'est pas de la défiance —
 * c'est ce qui permet d'enregistrer le profil quand même, et de laisser la
 * fiche attendre le prochain passage, plutôt que de faire découvrir la règle
 * par un refus sur un écran qui n'a rien demandé de neuf.
 *
 * Le schéma est `.strict()` : une clé vide serait refusée là où l'absence
 * passe. Tout ce qui est facultatif se répand donc conditionnellement.
 */
export function ficheAEnvoyer(saisie: SaisieDeSoi): SelfPersonInput | null {
  const nom = saisie.nom.trim();
  if (nom === "" || saisie.genre === null) return null;

  const usage = saisie.nomDUsage.trim();
  const nee = naissanceAEnvoyer(saisie.naissance);

  return {
    displayName: nom,
    gender: saisie.genre,
    language: saisie.langue,
    ...(usage === "" ? {} : { callingName: usage }),
    ...(nee === null ? {} : nee),
  };
}

/* `/me/persons` REND LA FICHE DE SOI PARMI LES AUTRES.
 *
 * Vérifié au serveur le 11 septembre : la liste ne filtre pas. Les écrans qui
 * disent « mes proches » doivent donc l'écarter — sans quoi on se retrouve dans
 * son propre carnet, et on n'est pas un proche de soi-même.
 */
export function sansSoi(personnes: readonly Person[]): Person[] {
  return personnes.filter((p) => !p.isSelf);
}

/* LÀ OÙ L'ON CHOISIT UNE PERSONNE, soi reste offert et passe en tête.
 *
 * Poser une date, écrire une note : ce sont des gestes qui visent quelqu'un, et
 * ce quelqu'un peut être soi. En tête parce que c'est la fiche qu'on cherche le
 * plus souvent le jour où elle vient d'exister.
 *
 * Le tri est STABLE : l'ordre reçu du serveur — alphabétique — est conservé
 * pour tout le reste.
 */
export function soiDabord(personnes: readonly Person[]): Person[] {
  return [...personnes].sort((a, b) => Number(b.isSelf) - Number(a.isSelf));
}
```

- [ ] **Étape 4 — le lancer et vérifier qu'il passe**

```
pnpm --filter @lehno/mobile exec vitest run test/soi.test.ts
```

Attendu : tout vert.

- [ ] **Étape 5 — éprouver la garde par la panne**

Remplacer dans `sansSoi` le corps par `return [...personnes];`, relancer,
vérifier que « écarte la fiche de soi » tombe en nommant `["Awa","moi"]`.
**Rétablir par l'édition inverse**, jamais par `git checkout`. `git diff --stat`
doit redevenir vide.

- [ ] **Étape 6 — commiter**

```bash
git add apps/mobile/lib/soi.ts apps/mobile/test/soi.test.ts
git commit -m "soi : les décisions de la fiche du titulaire, hors de React"
```

---

## Tâche 2 — Les libellés

**Fichiers**
- Modifier : `apps/mobile/messages/fr.ts`, `apps/mobile/messages/en.ts`

**Interfaces produites** — employées par les tâches 3 à 6 :
`profilNomDUsage`, `profilNomDUsageAide`, `profilNaissance`, `profilNaissanceAide`,
`evtPourMoi`, `listeVotreDateAbsente`.

- [ ] **Étape 1 — poser les clés en français**

Après `profilGenreAide` dans `apps/mobile/messages/fr.ts` :

```ts
  profilNomDUsage: "Comment on vous appelle",
  profilNomDUsageAide: "Si c'est autrement que par votre nom.",
  profilNaissance: "Votre date de naissance",
  /* Elle ne crée pas d'anniversaire : naissance et échéance sont deux gestes,
     ici comme sur la fiche d'un proche. La phrase le dit plutôt que de laisser
     quelqu'un attendre un rappel qui ne viendra pas. */
  profilNaissanceAide: "Pour poser votre anniversaire, ajoutez-la ensuite dans Dates.",
  evtPourMoi: "Moi",
  listeVotreDateAbsente: "Pour ouvrir une liste sur une de vos dates, il faut d'abord une date à vous.",
```

- [ ] **Étape 2 — les mêmes en anglais**

Au même endroit dans `apps/mobile/messages/en.ts` :

```ts
  profilNomDUsage: "What people call you",
  profilNomDUsageAide: "If it is not your name.",
  profilNaissance: "Your date of birth",
  profilNaissanceAide: "To set your birthday, add it in Dates afterwards.",
  evtPourMoi: "Me",
  listeVotreDateAbsente: "To open a list on one of your dates, you first need a date of your own.",
```

- [ ] **Étape 3 — vérifier que les deux dictionnaires s'accordent**

```
pnpm --filter @lehno/mobile exec vitest run test/messages.test.ts
```

Attendu : vert. Ce test compare les deux jeux de clés ; une clé posée d'un seul
côté le fait tomber.

- [ ] **Étape 4 — commiter**

```bash
git add apps/mobile/messages/fr.ts apps/mobile/messages/en.ts
git commit -m "libellés : la naissance, le nom d'usage, et ce que la liste explique"
```

---

## Tâche 3 — Mon profil pose la fiche

**Fichiers**
- Modifier : `apps/mobile/app/(app)/profil.tsx`

**Interfaces consommées** — `ficheAEnvoyer`, `SaisieDeSoi` (tâche 1) ;
`profilNomDUsage`, `profilNaissance` (tâche 2) ;
`naissanceLue`, `RangeeDeJours`, `Pastille`, `Bascule`, `nomsDesMois` — tous
existants, employés par `apps/mobile/app/(app)/proches/identite.tsx:236-276`.

- [ ] **Étape 1 — lire la fiche au chargement**

Dans `charge`, après la lecture du profil, ajouter — **l'échec ne condamne
rien** :

```ts
      /* LA FICHE N'EXISTE PEUT-ÊTRE PAS, et c'est un état, pas une panne :
         `GET /me/self` rend 404 tant que personne ne l'a posée. On lit alors
         une naissance vide, et l'écran se comporte comme avant. */
      try {
        const fiche = personSchema.parse(await appel<unknown>("/me/self"));
        setNomDUsage(fiche.callingName ?? "");
        setNaissance(naissanceLue(fiche.birthDate, fiche.birthYearKnown));
      } catch { /* Pas de fiche : les champs restent vides. */ }
```

Ajouter les deux états, près des autres `useState` :

```ts
  const [nomDUsage, setNomDUsage] = useState("");
  const [naissance, setNaissance] = useState<SaisieDeNaissance>(
    { jour: null, mois: null, annee: null, anneeConnue: true },
  );
```

- [ ] **Étape 2 — poser les deux champs à l'écran**

Dans `styles.champs`, **après** le bloc du genre et **avant** celui du thème :

```tsx
        <TextField
          label={t.profilNomDUsage}
          value={nomDUsage}
          hint={t.profilNomDUsageAide}
          onChangeText={setNomDUsage}
        />

        <View>
          {/* JOUR PUIS MOIS, comme la fiche d'un proche et l'écran d'événement
              les posent. Un sélecteur natif exigerait une année — et c'est
              justement elle qu'on ignore le plus souvent. */}
          <SectionLabel>{t.profilNaissance}</SectionLabel>
          <Text style={[styles.aide, { color: couleurs.textSecondary }]}>{t.evtJour}</Text>
          <RangeeDeJours
            actif={naissance.jour}
            choisit={(j) => setNaissance({ ...naissance, jour: j })}
          />
          <Text style={[styles.aide, { color: couleurs.textSecondary }]}>{t.evtMois}</Text>
          <View style={styles.pastilles}>
            {nomsDesMois(langue).map((nom, i) => (
              <Pastille
                key={nom}
                actif={naissance.mois === i + 1}
                libelle={nom}
                appuie={() => setNaissance({ ...naissance, mois: i + 1 })}
              />
            ))}
          </View>
          <View style={{ marginTop: nativeSpace[12] }}>
            <Bascule
              actif={!naissance.anneeConnue}
              libelle={t.identAnneeInconnue}
              onBascule={() => setNaissance({ ...naissance, anneeConnue: !naissance.anneeConnue })}
            />
          </View>
          {naissance.anneeConnue ? (
            <TextField
              label={t.identAnnee}
              nature="annee"
              value={naissance.annee === null ? "" : String(naissance.annee)}
              onChangeText={(v) => setNaissance({
                ...naissance, annee: v === "" ? null : Number(v),
              })}
            />
          ) : null}
          <Text style={[styles.aide, { color: couleurs.textMention }]}>{t.profilNaissanceAide}</Text>
        </View>
```

Ajouter au `StyleSheet` :

```ts
  pastilles: { flexDirection: "row", flexWrap: "wrap", gap: nativeSpace[8] },
```

- [ ] **Étape 3 — écrire les deux objets à l'enregistrement**

Dans `enregistre`, après le `PATCH /me/profile` existant et **avant** l'accusé :

```ts
      /* LA FICHE SUIT LE COMPTE, et dans cet ordre : le genre qu'elle exige
         vient d'être enregistré. Elle naît ici, au premier enregistrement du
         profil, sans que personne ait eu à comprendre qu'elle existait.
         
         Son échec ne défait pas le profil : le compte est écrit, c'est le
         geste que la personne a demandé. La fiche attend le prochain passage —
         elle n'a rien d'urgent, et un profil refusé pour elle serait
         incompréhensible. */
      const fiche = ficheAEnvoyer({
        nom: saisie.nom, nomDUsage, genre: saisie.genre,
        langue: saisie.langue, naissance,
      });
      if (fiche !== null) {
        try {
          await appel<unknown>("/me/self", {
            method: "PUT", body: JSON.stringify(fiche),
          });
        } catch { /* Voir ci-dessus : le profil est enregistré, c'est l'essentiel. */ }
      }
```

- [ ] **Étape 4 — vérifier le typage et le lint**

```
pnpm --filter @lehno/mobile typecheck
pnpm lint
```

Attendu : les deux propres. `personSchema`, `SaisieDeNaissance`, `naissanceLue`,
`RangeeDeJours`, `Pastille`, `Bascule`, `nomsDesMois`, `SectionLabel` doivent
être importés — le typecheck le dira nommément.

- [ ] **Étape 5 — éprouver à l'appareil**

Stack : Docker → `lehno-pg` (port 5433) → API depuis la copie principale
(`LEHNO_MAIL_CONSOLE=1 PORT=3001`) → Metro depuis le worktree
(`expo start --lan --go`, `EXPO_PUBLIC_API_URL` non défini).

Ouvrir Mon profil, poser une date de naissance, enregistrer. Puis :

```
docker exec lehno-pg psql -U lehno -d lehno -c \
  "select display_name, is_self, birth_date from person where is_self = true;"
```

Attendu : une ligne, avec la date posée.

- [ ] **Étape 6 — commiter**

```bash
git add "apps/mobile/app/(app)/profil.tsx"
git commit -m "profil : la fiche de soi naît du premier enregistrement"
```

---

## Tâche 4 — On n'est pas un proche de soi-même

**Fichiers**
- Modifier : `apps/mobile/app/(app)/proches/index.tsx`
- Modifier : `apps/mobile/app/(app)/proches/recherche.tsx`
- Modifier : `apps/mobile/app/note.tsx`

**Interfaces consommées** — `sansSoi` (tâche 1).

**Pourquoi maintenant** — la tâche 3 vient de faire exister la fiche. Sans
celle-ci, elle apparaît dans le carnet dès le prochain chargement.

- [ ] **Étape 1 — écarter soi des trois listes**

Dans chacun des trois fichiers, envelopper le résultat de `personListSchema` :

```ts
setCarnet(sansSoi(personListSchema.parse(brut).persons));
```

Le nom de la variable diffère d'un écran à l'autre — `setCarnet`, `setProches`,
`setPersonnes`. Le typecheck nomme celui qui manque.

Ajouter l'import dans chacun :

```ts
import { sansSoi } from "../../lib/soi.js";
```

Le chemin relatif diffère : `../../lib/soi.js` sous `(app)/proches/`,
`../lib/soi.js` pour `note.tsx`.

- [ ] **Étape 2 — garder le compte juste**

`proches/index.tsx:57` fait `setTotal(page.total)`, et `:89` calcule
`resteACharger(total, proches.length)`. **Filtrer soi casse cette arithmétique** :
le serveur compte la fiche dans son `total`, la liste ne la porte plus, donc
« charger plus » resterait offert sur une liste complète.

Retrancher « quand la page contenait la fiche » ne marche pas : la fiche tombe
sur une page quelconque de l'ordre alphabétique, et `total` serait juste sur
cette page-là seulement. On demande donc directement :

Dans `charge`, **avant** la première page :

```ts
  /* LA FICHE EXISTE-T-ELLE ? `GET /me/self` rend 404 tant que personne ne l'a
     posée. On le demande une fois, au chargement, plutôt que de deviner depuis
     la page courante : la fiche tombe où l'ordre alphabétique la met, et un
     total juste une page sur trois serait pire que pas de total. */
  let aUneFiche = false;
  try {
    await appel<unknown>("/me/self");
    aUneFiche = true;
  } catch { /* Pas de fiche : le total du serveur est déjà juste. */ }
```

Puis, à la ligne 57 :

```ts
      setTotal(page.total - (aUneFiche ? 1 : 0));
```

`aUneFiche` doit vivre dans un `useState`, pas dans `charge` seul : la
pagination rappelle `charge` et ne doit pas redemander la fiche à chaque page.

- [ ] **Étape 3 — vérifier**

```
pnpm --filter @lehno/mobile typecheck
pnpm --filter @lehno/mobile test
pnpm lint
```

Attendu : les trois propres.

- [ ] **Étape 4 — éprouver à l'appareil**

Le compte a maintenant une fiche (tâche 3). Ouvrir Proches : **on ne doit pas
s'y voir**, et le compte doit correspondre au nombre de lignes. Ouvrir la
recherche, taper son propre nom : rien.

- [ ] **Étape 5 — commiter**

```bash
git add "apps/mobile/app/(app)/proches/index.tsx" \
        "apps/mobile/app/(app)/proches/recherche.tsx" \
        apps/mobile/app/note.tsx
git commit -m "proches : on n'est pas un proche de soi-même"
```

---

## Tâche 5 — « Pour qui » s'ouvre à soi

**Fichiers**
- Modifier : `apps/mobile/app/evenement.tsx`

**Interfaces consommées** — `soiDabord` (tâche 1), `evtPourMoi` (tâche 2).

**Pourquoi c'est le vrai levier** — la wishlist datée, le Mur et l'accueil
attendent tous une **occurrence** à soi. La naissance n'en fabrique pas
(vérifié : `recalerAnniversaire` recale, il ne crée pas). C'est ici, et
seulement ici, qu'une date à soi se pose.

- [ ] **Étape 1 — garder soi, et le mettre en tête**

Dans `charge` (`evenement.tsx:87`) :

```ts
    /* SOI RESTE OFFERT ICI — c'est le seul endroit où l'on pose une date à soi,
       et c'est lui qui débloque la wishlist datée et « Ma date d'anniversaire »
       sur le Mur. En tête : c'est la fiche qu'on cherche le jour où elle vient
       d'exister, et la chercher au milieu du carnet serait absurde. */
    setCarnet(soiDabord(page.persons));
```

- [ ] **Étape 2 — la nommer « Moi »**

Deux endroits, et deux seulement — `evenement.tsx:246` et `:248` :

```tsx
                <Avatar name={proche.isSelf ? t.evtPourMoi : proche.displayName} size={24} />
```

```tsx
                  {proche.isSelf ? t.evtPourMoi : proche.displayName}
```

**Pas la ligne 170**, qui filtre la recherche : on y garde le vrai nom. Taper
« Moi » pour se trouver n'aurait pas de sens, et masquerait son propre nom à qui
le tape.

- [ ] **Étape 3 — vérifier**

```
pnpm --filter @lehno/mobile typecheck && pnpm --filter @lehno/mobile test && pnpm lint
```

- [ ] **Étape 4 — éprouver la chaîne entière à l'appareil**

Dates → Ajouter une date → « Pour qui » : **« Moi » doit être en tête.**
Poser un anniversaire, enregistrer. Puis Moi → Mes wishlists → Nouvelle
wishlist : la date doit y figurer, et la liste s'ouvrir dessus.

C'est le parcours que toute cette conception existe pour rouvrir.

- [ ] **Étape 5 — commiter**

```bash
git add apps/mobile/app/evenement.tsx
git commit -m "dates : « Pour qui » s'ouvre enfin à soi"
```

---

## Tâche 6 — Le nom vient de la fiche

**Fichiers**
- Modifier : `apps/mobile/app/(app)/moi.tsx`
- Modifier : `apps/mobile/app/(app)/listes.tsx`

**Interfaces consommées** — `listeVotreDateAbsente` (tâche 2).

- [ ] **Étape 1 — l'en-tête de « Moi » lit la fiche**

`moi.tsx:146-149` lit `profil.displayName ?? profil.username`. La fiche porte
désormais le nom qui signe les messages ; l'en-tête doit dire le même.

Charger la fiche à côté du profil, sans condamner l'écran si elle manque :

```ts
      /* LE NOM QUI SIGNE. `profile.displayName` n'est plus lu nulle part
         ailleurs — voir §2.1 de la conception. Il retombe sur le pseudo tant
         que la fiche n'existe pas. */
      try {
        setFiche(personSchema.parse(await appel<unknown>("/me/self")));
      } catch { /* Pas de fiche : on garde le pseudo. */ }
```

Puis :

```tsx
<Avatar name={fiche?.displayName ?? profil.username} size={54} />
```

et la même expression pour le texte juste dessous.

- [ ] **Étape 2 — la liste explique et renvoie**

Dans `listes.tsx`, remplacer le texte de la branche « aucune date ouvrable »
(`listeMesDatesAucune`, ligne ~290) par la phrase **et le geste** :

```tsx
            <View style={{ marginTop: nativeSpace[8] }}>
              <Text style={[styles.mention, { color: couleurs.textMention }]}>
                {t.listeVotreDateAbsente}
              </Text>
              {/* ON NE REMET PAS UN FORMULAIRE ICI. Un second endroit où poser
                  sa date divergerait du premier au premier réglage ; on renvoie
                  vers celui qui existe, et le retour ramène ici. */}
              <View style={{ marginTop: nativeSpace[12] }}>
                <Button
                  variant="outline"
                  full
                  icon="plus"
                  onPress={() => routeur.push("/evenement")}
                >
                  {t.ficheAjouterDate}
                </Button>
              </View>
            </View>
```

- [ ] **Étape 3 — vérifier**

```
pnpm -r typecheck && pnpm --filter @lehno/mobile test && pnpm lint
```

- [ ] **Étape 4 — éprouver à l'appareil**

Moi : l'en-tête porte le nom de la fiche. Nouvelle wishlist sans date à soi :
la phrase paraît, le bouton mène à l'ajout d'une date, et le retour ramène sur
la création de liste.

- [ ] **Étape 5 — commiter**

```bash
git add "apps/mobile/app/(app)/moi.tsx" "apps/mobile/app/(app)/listes.tsx"
git commit -m "moi : le nom qui signe vient de la fiche, et la liste dit où poser sa date"
```

---

## Tâche 7 — La garde qui empêche le retour en arrière

**Fichiers**
- Créer : `apps/mobile/test/proches-sans-soi.test.ts`

**Pourquoi** — l'oubli est facile et silencieux : un écran qui lit
`/me/persons` sans écarter soi met le titulaire dans son propre carnet, et rien
ne tombe. C'est exactement la faute que ce plan corrige ; elle reviendra au
prochain écran qui lira la liste.

- [ ] **Étape 1 — écrire la garde**

```ts
// apps/mobile/test/proches-sans-soi.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* UN ÉCRAN QUI DIT « MES PROCHES » ÉCARTE LA FICHE DE SOI.
 *
 * `/me/persons` la rend parmi les autres — vérifié au serveur le 11 septembre.
 * Un écran qui lit la liste sans la filtrer met le titulaire dans son propre
 * carnet, et rien ne tombe : la liste est simplement plus longue d'un.
 *
 * La table est ÉCRITE À LA MAIN, et c'est le but : un écran qui se met à lire
 * le carnet doit être inscrit ici, donc DÉCIDÉ. Une détection automatique le
 * laisserait passer en silence — précisément le cas qu'on veut rendre
 * impossible.
 */
const ECRANS: Readonly<Record<string, "sansSoi" | "soiDabord">> = {
  "(app)/proches/index": "sansSoi",
  "(app)/proches/recherche": "sansSoi",
  "note": "sansSoi",
  /* Poser une date VISE quelqu'un, et ce quelqu'un peut être soi — c'est même
     le seul endroit où une date à soi se pose. */
  "evenement": "soiDabord",
};

const source = (nom: string): string =>
  readFileSync(new URL(`../app/${nom}.tsx`, import.meta.url), "utf8");

describe("le carnet et la fiche de soi", () => {
  for (const [ecran, attendu] of Object.entries(ECRANS)) {
    it(`app/${ecran}.tsx emploie ${attendu}`, () => {
      expect(source(ecran)).toContain(`${attendu}(`);
    });
  }

  /* LA SONDE. Une garde qui lit la source doit prouver qu'elle mord. */
  it("mord sur un écran qui lit le carnet sans rien filtrer", () => {
    const faute = "setCarnet(personListSchema.parse(brut).persons);";
    expect(faute).not.toContain("sansSoi(");
  });
});
```

- [ ] **Étape 2 — la lancer**

```
pnpm --filter @lehno/mobile exec vitest run test/proches-sans-soi.test.ts
```

Attendu : vert, les quatre écrans étant traités aux tâches 4 et 5.

- [ ] **Étape 3 — éprouver la garde par la panne**

Retirer `sansSoi(` de `note.tsx`, relancer : le test doit tomber en nommant
`app/note.tsx`. **Rétablir par l'édition inverse.**

- [ ] **Étape 4 — commiter**

```bash
git add apps/mobile/test/proches-sans-soi.test.ts
git commit -m "garde : un écran qui dit « mes proches » écarte la fiche de soi"
```

---

## Tâche 8 — Rapporter ce qui reste au serveur

**Fichiers**
- Modifier : `specs/brief-backend-mobile-2026-09-09.md`

- [ ] **Étape 1 — ajouter au §10 ce que l'implémentation a appris**

```markdown
> **Ajout du 11 septembre, après implémentation côté mobile.**
>
> **`/me/persons` rend la fiche de soi parmi les autres.** Le mobile l'écarte
> désormais des trois écrans qui disent « mes proches », et la garde
> `proches-sans-soi.test.ts` empêche l'oubli. Mais `total` compte la fiche sans
> l'exclure : tout client qui l'affiche annonce un proche de plus que sa liste
> n'en porte. Un `?includeSelf=false`, ou l'exclusion par défaut, éviterait que
> chaque client refasse le filtre.
>
> **`profile.displayName` est devenu vestigial** : plus personne ne le lit,
> l'en-tête de « Moi » prend celui de la fiche. Un champ qu'on écrit sans
> jamais le lire est un piège pour le suivant — à retirer, ou à dériver.
```

- [ ] **Étape 2 — commiter**

```bash
git add specs/brief-backend-mobile-2026-09-09.md
git commit -m "specs : deux constats que l'implémentation de la fiche a produits"
```

---

## Avant de pousser

```
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
pnpm -r typecheck                      # les huit paquets
pnpm --filter @lehno/mobile test       # puis seulement
pnpm lint                              # EN SÉRIE, jamais en parallèle
```

Puis la branche, puis la PR — `develop` refuse une poussée directe,
administrateurs compris.

## Ce que ce plan ne fait pas

- **Créer la fiche à l'inscription** : c'est le §A de la conception, côté
  serveur. Ce plan tient sans, et n'aura rien à défaire quand ce sera fait —
  `ecrireSoi` met à jour quand la fiche existe.
- **Poser l'anniversaire depuis la naissance** : naissance et échéance sont deux
  gestes, ici comme pour un proche. La tâche 5 ouvre le geste ; elle ne le fait
  pas à la place de quelqu'un.
- **`register`, `city`, `country`, `preferredChannel`** : la fiche les porte, la
  planche ne les demande pas pour soi.

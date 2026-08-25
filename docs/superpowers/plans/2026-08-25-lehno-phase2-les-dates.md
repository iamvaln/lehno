# Lehno phase 2 — les dates

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE : employer superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes emploient des cases à cocher (`- [ ]`).

**But :** servir les événements, leurs récurrences et leurs échéances — ce qui approche, la raison d'être du produit.

**Architecture :** un noyau de calendrier en **fonctions pures sur des chaînes de dates civiles**, puis des services qui s'appuient dessus. Le calcul ne touche jamais un objet `Date` : `new Date("2026-02-29")` s'interprète en UTC puis se décale du fuseau local, et une échéance change alors de jour selon l'endroit d'où l'on regarde. Les occurrences sont **matérialisées** en base — le statut et la date se requêtent, ils ne se recalculent pas à chaque affichage.

**Pile :** NestJS 11, Prisma 6, PostgreSQL, Zod, Vitest + Testcontainers.

**Spécification :** `specs/spec-technique-lehno.md` §5.2 et §5.8 · dictionnaire : `Event`, `Schedule`, `EventOccurrence` · maquette mobile §3.2, §3.6, §3.14, §3.21.

## Contraintes globales

- **Le serveur décide.** Cloisonnement, droits, statut : tout se vérifie côté serveur à chaque appel. Le client affiche, il ne tranche pas.
- **Cloisonnement par le dépôt, jamais à la main.** `TenantRepository` porte déjà `events(userId)` — portée `{ person: { userId } }` — et `occurrences(userId)` — portée `{ userId }`. Une requête Prisma directe sur ces tables dans un service `/me` est un défaut.
- **404, pas 403.** Une ressource qui appartient à quelqu'un d'autre n'existe pas pour le demandeur.
- **Les colonnes d'appartenance ne s'écrivent pas.** `Scope.updateOrThrow` refuse `userId` et `personId` dans les données.
- **Tout ce qui arrive est validé** avant traitement. Les schémas Zod sont en `.strict()`.
- **Les contrats existent déjà** dans `packages/contracts/src/me-events.ts` et `me-home.ts`. Ne pas les réécrire : les employer. S'il faut les étendre, l'étendre sans changer ce qui est publié.
- **Statuts HTTP** : `200` succès · `201` création rendant une ressource neuve · `204` suppression · `404` absent ou hors périmètre · `400` requête mal formée.
- **Toute tâche qui ajoute un chemin étend le contrat publié.** `docs/api/openapi.json` s'engendre depuis les schémas Zod, jamais à la main, et un test échoue s'il est périmé.
- **Le socle n'a pas de drapeau** : les dates en font partie. Aucun `@Feature` sur ces contrôleurs.
- **TDD** : le test s'écrit d'abord, on le voit échouer, puis on le fait passer. **Commit avant toute preuve par la panne** — `git checkout` sur un fichier non commité efface le travail.
- Commentaires en français, identifiants et code en anglais. Messages de commit en français à l'impératif.
- **Un « 0 tasks » n'est pas un feu vert**, et le cache de Turbo rejoue des succès périmés : lancer les paquets directement. Node 22 (`.nvmrc`), Docker requis pour les tests de l'api.

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `apps/api/src/me/calendrier.ts` | **Créer.** Fonctions pures : arithmétique de dates civiles, engendrement des échéances. Ni base, ni Nest, ni réseau. |
| `apps/api/src/me/event.service.ts` | **Créer.** Événements et leur règle de récurrence ; ouverture de la première occurrence. |
| `apps/api/src/me/event.controller.ts` | **Créer.** `/me/events`, `/me/events/{id}`. |
| `apps/api/src/me/occurrence.service.ts` | **Créer.** Lecture des échéances, dérivation du statut, notes de circonstance. |
| `apps/api/src/me/occurrence.controller.ts` | **Créer.** `/me/occurrences`, `/me/occurrences/{id}`, `/me/occurrences/{id}/notes`. |
| `apps/api/src/me/home.controller.ts` | **Créer.** `/me/home` — service et contrôleur, le fichier restant court. |

Le calendrier vit **à part** des services parce que c'est la partie la plus risquée et la plus susceptible de changer : elle se teste sans conteneur, en millisecondes, et se remplace sans toucher au reste.

---

### Tâche 1 : Le noyau de calendrier

**Le risque de tout le plan tient ici.** Une erreur de calendrier ne casse rien visiblement : elle décale un anniversaire d'un jour, une fois par an, et personne ne s'en aperçoit avant qu'un utilisateur le signale.

**Fichiers :**
- Créer : `apps/api/src/me/calendrier.ts`
- Tester : `apps/api/test/calendrier.test.ts`

**Interfaces :**
- Produit : `ajouterJours(date: string, n: number): string` · `ajouterMois(date: string, n: number): string` · `echeances(reference: string, regle: Regle, depuis: string, combien: number): string[]` · `type Regle = { unite: "day" | "week" | "month" | "quarter" | "year"; pas: number }`.
- Toutes les dates sont des chaînes `YYYY-MM-DD`.

- [ ] **Étape 1 : écrire le test qui échoue**

`apps/api/test/calendrier.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { ajouterJours, ajouterMois, echeances } from "../src/me/calendrier.js";

describe("arithmétique de dates civiles", () => {
  // Aucun objet Date : « new Date("2026-02-29") » s'interprète en UTC puis se
  // décale du fuseau local, et l'échéance change de jour selon l'endroit d'où
  // l'on regarde. On travaille en chaînes, de bout en bout.
  it("ajoute des jours en franchissant les mois et les années", () => {
    expect(ajouterJours("2026-01-30", 3)).toBe("2026-02-02");
    expect(ajouterJours("2026-12-31", 1)).toBe("2027-01-01");
    expect(ajouterJours("2024-02-28", 1)).toBe("2024-02-29");
    expect(ajouterJours("2026-02-28", 1)).toBe("2026-03-01");
    expect(ajouterJours("2026-03-01", -1)).toBe("2026-02-28");
  });

  describe("les jours absents du calendrier", () => {
    // Règle du dictionnaire : « une échéance qui tomberait sur un jour absent
    // du mois d'arrivée est ramenée au dernier jour de ce mois ».
    it("ramène au dernier jour du mois d'arrivée", () => {
      expect(ajouterMois("2026-01-31", 1)).toBe("2026-02-28");
      expect(ajouterMois("2024-01-31", 1)).toBe("2024-02-29");
      expect(ajouterMois("2026-03-31", 1)).toBe("2026-04-30");
      expect(ajouterMois("2026-05-31", 1)).toBe("2026-06-30");
    });

    it("un 29 février se marque le 28 les années communes", () => {
      expect(ajouterMois("2024-02-29", 12)).toBe("2025-02-28");
      expect(ajouterMois("2024-02-29", 24)).toBe("2026-02-28");
      // Et retrouve son vrai jour l'année bissextile suivante.
      expect(ajouterMois("2024-02-29", 48)).toBe("2028-02-29");
    });

    it("un jour qui existe partout n'est jamais ramené", () => {
      expect(ajouterMois("2026-03-14", 12)).toBe("2027-03-14");
      expect(ajouterMois("2026-01-15", 1)).toBe("2026-02-15");
    });
  });

  describe("l'absence de dérive", () => {
    // LA règle qui coûte cher si on la rate. « Les offsets successifs se
    // calculent toujours depuis la reference_date, jamais depuis une échéance
    // déjà ramenée : le décalage ne s'accumule pas. »
    //
    // Un calcul itératif — chaque échéance depuis la précédente — donnerait
    // 31 janvier → 28 février → 28 mars → 28 avril. La date s'éloignerait un
    // peu plus chaque mois, et au bout d'un an l'anniversaire aurait glissé.
    it("chaque échéance se calcule depuis la référence, jamais depuis la précédente", () => {
      const depuis31Janvier = [1, 2, 3, 4].map((k) => ajouterMois("2026-01-31", k));
      expect(depuis31Janvier).toEqual([
        "2026-02-28", // ramené
        "2026-03-31", // et NON 2026-03-28 : on repart du 31, pas du 28
        "2026-04-30", // ramené
        "2026-05-31", // et NON 2026-05-30
      ]);
    });

    it("un 29 février ne dérive pas non plus sur quatre ans", () => {
      const quatreAns = [12, 24, 36, 48].map((k) => ajouterMois("2024-02-29", k));
      expect(quatreAns).toEqual(["2025-02-28", "2026-02-28", "2027-02-28", "2028-02-29"]);
    });
  });
});

describe("l'engendrement des échéances", () => {
  // « depuis » est inclusif : une échéance qui tombe aujourd'hui approche
  // encore. L'exclure ferait disparaître l'anniversaire le jour même, ce qui
  // est exactement le jour où l'application doit le montrer.
  it("rend les échéances à venir, la date du jour comprise", () => {
    const dates = echeances("1990-03-14", { unite: "year", pas: 1 }, "2026-03-14", 3);
    expect(dates).toEqual(["2026-03-14", "2027-03-14", "2028-03-14"]);
  });

  it("saute les échéances déjà passées", () => {
    const dates = echeances("1990-03-14", { unite: "year", pas: 1 }, "2026-06-01", 2);
    expect(dates).toEqual(["2027-03-14", "2028-03-14"]);
  });

  it("sait engendrer autre chose qu'un anniversaire", () => {
    expect(echeances("2026-01-05", { unite: "month", pas: 3 }, "2026-01-05", 3))
      .toEqual(["2026-01-05", "2026-04-05", "2026-07-05"]);
    expect(echeances("2026-01-05", { unite: "week", pas: 2 }, "2026-01-05", 3))
      .toEqual(["2026-01-05", "2026-01-19", "2026-02-02"]);
    expect(echeances("2026-01-05", { unite: "day", pas: 10 }, "2026-01-05", 3))
      .toEqual(["2026-01-05", "2026-01-15", "2026-01-25"]);
  });

  it("un trimestre vaut trois mois", () => {
    expect(echeances("2026-01-31", { unite: "quarter", pas: 1 }, "2026-01-31", 3))
      .toEqual(["2026-01-31", "2026-04-30", "2026-07-31"]);
  });

  // « tous les 0 » n'est pas une récurrence : c'est une boucle sans fin. Le
  // contrat le refuse déjà à la saisie ; ce cas garde le noyau lui-même, qui
  // sert aussi ailleurs.
  it("refuse un pas nul ou négatif plutôt que de boucler", () => {
    expect(() => echeances("2026-01-01", { unite: "year", pas: 0 }, "2026-01-01", 3)).toThrow();
    expect(() => echeances("2026-01-01", { unite: "year", pas: -1 }, "2026-01-01", 3)).toThrow();
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/api exec vitest run test/calendrier.test.ts`
Attendu : ÉCHEC — `Failed to load url ../src/me/calendrier.js`

- [ ] **Étape 3 : écrire le noyau**

`apps/api/src/me/calendrier.ts` :
```ts
// L'arithmétique des dates civiles, en chaînes « YYYY-MM-DD ».
//
// Aucun objet Date de bout en bout, et c'est délibéré : « new Date("2026-02-29") »
// s'interprète en UTC puis se décale du fuseau local. Une échéance changerait
// alors de jour selon l'endroit d'où on la regarde, et le dictionnaire est
// formel — « le calcul se fait en dates civiles, dans le fuseau de
// l'utilisateur ». Une chaîne n'a pas de fuseau, donc rien à décaler.

export type UniteRegle = "day" | "week" | "month" | "quarter" | "year";
export type Regle = { unite: UniteRegle; pas: number };

function decomposer(date: string): [number, number, number] {
  const [a, m, j] = date.split("-").map(Number);
  if (a === undefined || m === undefined || j === undefined || Number.isNaN(a))
    throw new Error(`date civile attendue au format YYYY-MM-DD, reçu « ${date} »`);
  return [a, m, j];
}

function composer(a: number, m: number, j: number): string {
  return `${String(a).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(j).padStart(2, "0")}`;
}

// Bissextile : divisible par 4, sauf les siècles non divisibles par 400.
// 1900 ne l'était pas, 2000 l'était.
function bissextile(annee: number): boolean {
  return (annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0;
}

function joursDuMois(annee: number, mois: number): number {
  const longueurs = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (mois === 2 && bissextile(annee)) return 29;
  return longueurs[mois - 1] as number;
}

// Les jours s'ajoutent sans piège : un jour dure un jour, et la date civile
// n'a ni heure d'été ni fuseau. On compte en jours depuis une origine.
function versJourJulien(a: number, m: number, j: number): number {
  const a2 = m <= 2 ? a - 1 : a;
  const m2 = m <= 2 ? m + 12 : m;
  const siecle = Math.floor(a2 / 100);
  const correction = 2 - siecle + Math.floor(siecle / 4);
  return (
    Math.floor(365.25 * (a2 + 4716)) +
    Math.floor(30.6001 * (m2 + 1)) +
    j + correction - 1524
  );
}

function depuisJourJulien(jj: number): [number, number, number] {
  const a = jj + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return [
    100 * b + d - 4800 + Math.floor(m / 10),
    m + 3 - 12 * Math.floor(m / 10),
    e - Math.floor((153 * m + 2) / 5) + 1,
  ];
}

export function ajouterJours(date: string, n: number): string {
  const [a, m, j] = decomposer(date);
  const [a2, m2, j2] = depuisJourJulien(versJourJulien(a, m, j) + n);
  return composer(a2, m2, j2);
}

// Ajouter des mois demande une décision : que faire du 31 janvier quand on
// arrive en février ? Le dictionnaire tranche — « ramenée au dernier jour de
// ce mois ». Un 29 février se marque donc le 28 les années communes.
export function ajouterMois(date: string, n: number): string {
  const [a, m, j] = decomposer(date);
  const total = (a * 12 + (m - 1)) + n;
  const anneeCible = Math.floor(total / 12);
  const moisCible = (total % 12) + 1;
  const dernier = joursDuMois(anneeCible, moisCible);
  return composer(anneeCible, moisCible, Math.min(j, dernier));
}

// Les `combien` prochaines échéances à partir de `depuis` (inclus).
//
// Chaque échéance se calcule DEPUIS LA RÉFÉRENCE, en multipliant le pas —
// jamais depuis l'échéance précédente. C'est ce qui empêche la dérive : un
// calcul itératif donnerait 31 janvier → 28 février → 28 mars → 28 avril, et
// l'anniversaire glisserait un peu plus chaque mois.
export function echeances(
  reference: string,
  regle: Regle,
  depuis: string,
  combien: number,
): string[] {
  if (regle.pas < 1) {
    throw new Error(`un pas de ${regle.pas} n'est pas une récurrence : le calcul ne finirait pas`);
  }

  const avancer = (k: number): string => {
    switch (regle.unite) {
      case "day": return ajouterJours(reference, k * regle.pas);
      case "week": return ajouterJours(reference, k * regle.pas * 7);
      case "month": return ajouterMois(reference, k * regle.pas);
      case "quarter": return ajouterMois(reference, k * regle.pas * 3);
      case "year": return ajouterMois(reference, k * regle.pas * 12);
    }
  };

  // On saute d'abord les échéances passées, sans les fabriquer une à une : le
  // premier k utile s'approche, puis on ajuste. Une référence ancienne — une
  // date de naissance de 1950 — ne doit pas coûter mille itérations.
  const jjDepuis = versJourJulien(...decomposer(depuis));
  const jjRef = versJourJulien(...decomposer(reference));
  const parPas = { day: 1, week: 7, month: 30.44, quarter: 91.3, year: 365.25 }[regle.unite];
  let k = Math.max(0, Math.floor((jjDepuis - jjRef) / (parPas * regle.pas)) - 1);
  while (avancer(k) < depuis) k++;

  const rendues: string[] = [];
  for (let i = 0; i < combien; i++) rendues.push(avancer(k + i));
  return rendues;
}
```

- [ ] **Étape 4 : le voir passer**

Lancer : `pnpm --filter @lehno/api exec vitest run test/calendrier.test.ts`
Attendu : PASSE

- [ ] **Étape 5 : commiter**

```bash
git add apps/api/src/me/calendrier.ts apps/api/test/calendrier.test.ts
git commit -m "me: le noyau de calendrier, en dates civiles sans dérive"
```

- [ ] **Étape 6 : preuve par la panne**

Remplacer le corps de `echeances` par un calcul **itératif** — chaque échéance depuis la précédente au lieu de la référence :
```ts
  // SONDE, à retirer : calcul itératif, donc dérive.
  const rendues: string[] = [];
  let courante = reference;
  for (let i = 0; i < combien; i++) {
    courante = avancerDepuis(courante, regle);
    rendues.push(courante);
  }
```
Lancer les tests. Attendu : « chaque échéance se calcule depuis la référence » rougit, avec `2026-03-28` au lieu de `2026-03-31`. Retirer la sonde par l'**édition inverse** (jamais `git checkout`), relancer, tout repasse au vert. Rapporter les deux sorties.

---

### Tâche 2 : Les événements

**Fichiers :**
- Créer : `apps/api/src/me/event.service.ts`, `apps/api/src/me/event.controller.ts`
- Modifier : `apps/api/src/app.module.ts`, `packages/contracts/src/openapi.ts`
- Tester : `apps/api/test/event.test.ts`

**Interfaces :**
- Consomme : `echeances` (tâche 1) ; `TenantRepository.events(userId)` et `.persons(userId)` ; `eventSchema`, `createEventSchema`, `scheduleSchema` de `packages/contracts/src/me-events.ts`.
- Produit : `EventService.list(userId)`, `.create(userId, input)`, `.get(userId, id)`, `.update(userId, id, input)`, `.remove(userId, id)`.

**Ce que le contrat impose déjà** (`me-events.ts`, ne pas le réécrire) : `createEventSchema` exige un `label` quand `kind` vaut `other` — un événement libre porte son libellé, un anniversaire prend le sien dans les traductions. `scheduleSchema` refuse les formes mêlées : une règle est récurrente **ou** décalée.

- [ ] **Étape 1 : écrire le test qui échoue**

`apps/api/test/event.test.ts` — même montage que `note.test.ts` (base, deux comptes, `TenantRepository`), puis :
```ts
  it("crée un anniversaire et ouvre sa première échéance", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    const e = await events.create(awa, {
      personId: p.id, kind: "birthday", referenceDate: "1990-03-14",
    });

    expect(e.kind).toBe("birthday");
    expect(e.referenceDate).toBe("1990-03-14");

    // L'occurrence naît AVEC l'événement : sans elle, un anniversaire saisi
    // n'apparaîtrait nulle part avant qu'un traitement programmé ne passe, et
    // l'utilisateur croirait sa saisie perdue.
    const ouvertes = await db.prisma.eventOccurrence.findMany({ where: { eventId: e.id } });
    expect(ouvertes).toHaveLength(1);
    expect(ouvertes[0]?.userId).toBe(awa);
  });

  it("un événement libre porte son libellé", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    const e = await events.create(awa, {
      personId: p.id, kind: "other", label: "Notre rencontre", referenceDate: "2019-07-02",
    });
    expect(e.label).toBe("Notre rencontre");
  });

  it("n'attache pas un événement au proche d'un autre compte", async () => {
    const p = await persons.create(bila, { displayName: "Celarine" });
    await expect(
      events.create(awa, { personId: p.id, kind: "birthday", referenceDate: "1990-03-14" }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(await db.prisma.event.count()).toBe(0);
  });

  it("ne rend pas l'événement d'un autre compte", async () => {
    const p = await persons.create(bila, { displayName: "Celarine" });
    const e = await events.create(bila, { personId: p.id, kind: "birthday", referenceDate: "1990-03-14" });
    await expect(events.get(awa, e.id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("ne supprime pas l'événement d'un autre compte", async () => {
    const p = await persons.create(bila, { displayName: "Celarine" });
    const e = await events.create(bila, { personId: p.id, kind: "birthday", referenceDate: "1990-03-14" });
    await expect(events.remove(awa, e.id)).rejects.toMatchObject({ code: "not_found" });
    expect(await db.prisma.event.count({ where: { id: e.id } })).toBe(1);
  });

  // Supprimer un événement emporte ses occurrences : la cascade est déclarée
  // au schéma, ce cas la constate plutôt que de la supposer.
  it("supprimer l'événement emporte ses échéances", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    const e = await events.create(awa, { personId: p.id, kind: "birthday", referenceDate: "1990-03-14" });
    await events.remove(awa, e.id);
    expect(await db.prisma.eventOccurrence.count({ where: { eventId: e.id } })).toBe(0);
  });

  // L'année de naissance peut être inconnue : on note le jour sans l'âge.
  it("accepte une date dont l'année n'est pas connue", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    const e = await events.create(awa, {
      personId: p.id, kind: "birthday", referenceDate: "1900-03-14", yearKnown: false,
    });
    expect(e.yearKnown).toBe(false);
  });

  it("corriger la date rouvre l'échéance au bon jour", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    const e = await events.create(awa, { personId: p.id, kind: "birthday", referenceDate: "1990-03-14" });
    await events.update(awa, e.id, { referenceDate: "1990-08-02" });

    const ouvertes = await db.prisma.eventOccurrence.findMany({ where: { eventId: e.id } });
    // Une seule, et au nouveau jour : laisser l'ancienne afficherait deux
    // anniversaires pour la même personne.
    expect(ouvertes).toHaveLength(1);
    expect(ouvertes[0]?.occurrenceDate.toISOString().slice(0, 10)).toMatch(/-08-02$/);
  });
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/api exec vitest run test/event.test.ts`
Attendu : ÉCHEC — `Failed to load url ../src/me/event.service.js`

- [ ] **Étape 3 : écrire le service**

`apps/api/src/me/event.service.ts` :
```ts
import { Inject, Injectable } from "@nestjs/common";
import type { CreateEventInput, UpdateEventInput, Event as EventContrat } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantRepository } from "../tenancy/tenant.repository.js";
import { echeances, type Regle } from "./calendrier.js";

// Un anniversaire se répète tous les ans. C'est la règle par défaut, et la
// seule que la saisie propose aujourd'hui — les récurrences libres viendront
// avec l'écran qui les compose.
const TOUS_LES_ANS: Regle = { unite: "year", pas: 1 };

@Injectable()
export class EventService {
  // @Inject explicite : voir ProfileService, même contrainte esbuild/vitest.
  constructor(
    @Inject(TenantRepository) private readonly depot: TenantRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  // « Aujourd'hui » en date civile. Le fuseau de l'utilisateur affinera ce
  // calcul quand les préférences le porteront ; en attendant, la date du
  // serveur, exprimée en chaîne pour ne jamais entrer dans un objet Date.
  private aujourdhui(): string {
    return new Date().toISOString().slice(0, 10);
  }

  async list(userId: string): Promise<EventContrat[]> {
    return (await this.depot.events(userId).findMany({})).map(rendre);
  }

  async get(userId: string, id: string): Promise<EventContrat> {
    return rendre(await this.depot.events(userId).findOrThrow(id));
  }

  async create(userId: string, input: CreateEventInput): Promise<EventContrat> {
    // findOrThrow d'abord : rattacher un événement au proche d'un autre doit
    // échouer AVANT toute écriture, et rendre 404 plutôt que 403.
    await this.depot.persons(userId).findOrThrow(input.personId);

    const ligne = await this.prisma.event.create({
      data: {
        personId: input.personId,
        authorUserId: userId,
        kind: input.kind,
        label: input.label ?? null,
        eventNature: input.nature ?? "happy",
        referenceDate: new Date(`${input.referenceDate}T00:00:00Z`),
        yearKnown: input.yearKnown ?? true,
      },
    });

    await this.ouvrirProchaine(userId, ligne.id, input.referenceDate);
    return rendre(ligne);
  }

  async update(userId: string, id: string, input: UpdateEventInput): Promise<EventContrat> {
    const avant = await this.depot.events(userId).findOrThrow(id);
    const data: Record<string, unknown> = {};
    if (input.label !== undefined) data["label"] = input.label;
    if (input.kind !== undefined) data["kind"] = input.kind;
    if (input.nature !== undefined) data["eventNature"] = input.nature;
    if (input.yearKnown !== undefined) data["yearKnown"] = input.yearKnown;
    if (input.referenceDate !== undefined)
      data["referenceDate"] = new Date(`${input.referenceDate}T00:00:00Z`);

    const apres = await this.depot.events(userId).updateOrThrow(id, data as never);

    // La date a bougé : l'échéance ouverte ne vaut plus. La laisser
    // afficherait deux anniversaires pour la même personne.
    if (input.referenceDate !== undefined && input.referenceDate !== iso(avant.referenceDate)) {
      await this.prisma.eventOccurrence.deleteMany({ where: { eventId: id, status: "upcoming" } });
      await this.ouvrirProchaine(userId, id, input.referenceDate);
    }
    return rendre(apres);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.depot.events(userId).deleteOrThrow(id);
  }

  // L'occurrence naît AVEC l'événement. Sans elle, un anniversaire saisi
  // n'apparaîtrait nulle part avant qu'un traitement programmé ne passe, et
  // l'utilisateur croirait sa saisie perdue.
  private async ouvrirProchaine(userId: string, eventId: string, reference: string): Promise<void> {
    const [prochaine] = echeances(reference, TOUS_LES_ANS, this.aujourdhui(), 1);
    if (!prochaine) return;
    await this.prisma.eventOccurrence.create({
      data: {
        eventId, userId,
        occurrenceDate: new Date(`${prochaine}T00:00:00Z`),
        occurrenceYear: Number(prochaine.slice(0, 4)),
      },
    });
  }
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function rendre(e: {
  id: string; personId: string; label: string | null; kind: string;
  eventNature: string; referenceDate: Date; yearKnown: boolean;
}): EventContrat {
  return {
    id: e.id,
    personId: e.personId,
    label: e.label,
    kind: e.kind as EventContrat["kind"],
    nature: e.eventNature as EventContrat["nature"],
    referenceDate: iso(e.referenceDate),
    yearKnown: e.yearKnown,
  };
}
```

- [ ] **Étape 4 : écrire le contrôleur**

`apps/api/src/me/event.controller.ts` :
```ts
import {
  Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards,
} from "@nestjs/common";
import {
  createEventSchema, updateEventSchema,
  type CreateEventInput, type UpdateEventInput, type Event as EventContrat,
} from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { EventService } from "./event.service.js";

type AuthedRequest = { userId: string };

// Pas de @Feature : les dates relèvent du SOCLE, qui n'a pas de drapeau
// (spécification technique §6.3).
@Controller("me/events")
@UseGuards(AuthGuard)
export class EventController {
  constructor(@Inject(EventService) private readonly events: EventService) {}

  @Get()
  list(@Req() req: AuthedRequest): Promise<EventContrat[]> {
    return this.events.list(req.userId);
  }

  @Post()
  create(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(createEventSchema)) body: CreateEventInput,
  ): Promise<EventContrat> {
    return this.events.create(req.userId, body);
  }

  @Get(":id")
  get(@Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string): Promise<EventContrat> {
    return this.events.get(req.userId, id);
  }

  @Patch(":id")
  update(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateEventSchema)) body: UpdateEventInput,
  ): Promise<EventContrat> {
    return this.events.update(req.userId, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.events.remove(req.userId, id);
  }
}
```

Enregistrer `EventController` dans les `controllers` et `EventService` dans les `providers` d'`app.module.ts`.

- [ ] **Étape 5 : étendre le contrat, côté schémas**

`createEventSchema` se termine par un `.refine()` — c'est donc un `ZodEffects`,
et **`.partial()` n'existe pas dessus**. Écrire `createEventSchema.partial()`
ne compile pas. Ajouter à `packages/contracts/src/me-events.ts` :

```ts
/* La correction d'un événement. Dérivée de la création plutôt que réécrite —
   deux déclarations divergeraient, et la validation d'une correction finirait
   par être plus laxiste que celle d'une création.
   
   `createEventSchema` porte un `.refine()` et devient un ZodEffects, sur lequel
   `.partial()` n'existe pas : on repart donc de la forme d'objet, à laquelle on
   retire `personId`. Un événement ne change pas de proche — le déplacer serait
   le supprimer et le recréer, pas le corriger. */
export const updateEventSchema = z.object({
  kind: z.enum(EVENT_KINDS).optional(),
  label: z.string().trim().min(1).max(120).optional(),
  nature: z.enum(EVENT_NATURES).optional(),
  referenceDate: dateCivileSchema.optional(),
  yearKnown: z.boolean().optional(),
}).strict().refine((v) => Object.keys(v).length > 0, {
  message: "au moins un champ doit être fourni",
});

export type UpdateEventInput = z.infer<typeof updateEventSchema>;
```

Le contrôleur emploie `updateEventSchema`, et `EventService.update` prend
`UpdateEventInput` — non `Partial<CreateEventInput>`, qui laisserait passer un
`personId`.

- [ ] **Étape 6 : étendre le contrat publié**

Ajouter les cinq chemins au tableau `CHEMINS` de `packages/contracts/src/openapi.ts` — `GET`/`POST /me/events`, `GET`/`PATCH`/`DELETE /me/events/{id}` — sur le modèle des chemins de `/me/persons`. `DELETE` porte `sansContenu: true` et `statut: 204` ; `POST` porte `statut: 201`. Réengendrer : `pnpm --filter @lehno/contracts openapi`.

- [ ] **Étape 7 : lancer et commiter**

```bash
pnpm --filter @lehno/api exec vitest run test/event.test.ts
pnpm --filter @lehno/contracts test
git add -A && git commit -m "me: les événements et leur première échéance"
```

- [ ] **Étape 8 : preuve par la panne**

Retirer le `findOrThrow` sur le proche dans `create`. Attendu : « n'attache pas un événement au proche d'un autre compte » rougit, et un événement est écrit sur la fiche de quelqu'un d'autre. Retirer la sonde par l'édition inverse, relancer.

---

### Tâche 3 : Les échéances

**Fichiers :**
- Créer : `apps/api/src/me/occurrence.service.ts`, `apps/api/src/me/occurrence.controller.ts`
- Modifier : `apps/api/src/app.module.ts`, `packages/contracts/src/openapi.ts`
- Tester : `apps/api/test/occurrence.test.ts`

**Interfaces :**
- Consomme : `ajouterJours` (tâche 1) ; `EventService` (tâche 2) ; `TenantRepository.occurrences(userId)` ; `occurrenceSchema`, `listOccurrencesQuerySchema` de `me-events.ts`.
- Produit : `OccurrenceService.list(userId, query)`, `.get(userId, id)`.

**Ce que la spécification impose** (§5.2) : « `/me/occurrences` accepte une fenêtre de dates et un plafond : l'accueil en demande trois, l'écran Dates un mois. C'est le même appel, paramétré — les deux surfaces ne divergent pas. »

Le statut se **dérive** de la date et des délais : `upcoming` avant la fenêtre, `collecting` dedans, `closed` après. La fenêtre vaut `[date − wish_window_lead_days, date + wish_window_trail_days]`, les deux délais venant de `SystemParameter` (défauts 7 et 30).

- [ ] **Étape 1 : écrire le test qui échoue**

`apps/api/test/occurrence.test.ts` :
```ts
  it("rend les échéances avec le nom du proche", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    await events.create(awa, { personId: p.id, kind: "birthday", referenceDate: "1990-03-14" });

    const [e] = await occurrences.list(awa, {});
    // Le nom voyage AVEC l'échéance : sans lui, chaque carte d'une liste
    // demanderait sa fiche, et l'accueil ferait quatre appels au lieu d'un.
    expect(e?.personDisplayName).toBe("Valery");
    expect(e?.kind).toBe("birthday");
  });

  it("ne rend pas les échéances d'un autre compte", async () => {
    const p = await persons.create(bila, { displayName: "Celarine" });
    await events.create(bila, { personId: p.id, kind: "birthday", referenceDate: "1990-03-14" });
    expect(await occurrences.list(awa, {})).toEqual([]);
  });

  it("respecte la fenêtre et le plafond", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    for (const jour of ["01-10", "02-10", "03-10"]) {
      await events.create(awa, {
        personId: p.id, kind: "other", label: `Jalon ${jour}`, referenceDate: `2020-${jour}`,
      });
    }
    const deux = await occurrences.list(awa, { limit: 2 });
    expect(deux).toHaveLength(2);
  });

  // Négatif pour une échéance passée : la vue Dates montre le mois écoulé, et
  // un décompte non signé rendrait « J−3 » trois jours APRÈS la date.
  it("compte les jours, en signé", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    const e = await events.create(awa, { personId: p.id, kind: "birthday", referenceDate: "1990-03-14" });
    const hier = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await db.prisma.eventOccurrence.updateMany({
      where: { eventId: e.id }, data: { occurrenceDate: new Date(`${hier}T00:00:00Z`) },
    });

    const [passee] = await occurrences.list(awa, { from: hier });
    expect(passee?.daysUntil).toBe(-1);
  });

  // L'âge se déduit de l'année de naissance — et vaut null quand elle n'est
  // pas connue. Nullable plutôt qu'absent : l'écran est OBLIGÉ de traiter le
  // cas au lieu de l'oublier et d'afficher « NaN ans ».
  it("rend l'âge, et null quand l'année n'est pas connue", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    await events.create(awa, { personId: p.id, kind: "birthday", referenceDate: "1990-03-14" });
    const [avec] = await occurrences.list(awa, {});
    expect(avec?.age).toBe(Number(avec?.occurrenceDate.slice(0, 4)) - 1990);

    const q = await persons.create(awa, { displayName: "Inconnu" });
    await events.create(awa, {
      personId: q.id, kind: "birthday", referenceDate: "1900-06-01", yearKnown: false,
    });
    const sans = (await occurrences.list(awa, {})).find((o) => o.personId === q.id);
    expect(sans?.age).toBeNull();
  });

  describe("le statut se dérive de la date", () => {
    const poser = async (dans: number): Promise<string> => {
      const p = await persons.create(awa, { displayName: `P${dans}` });
      const e = await events.create(awa, { personId: p.id, kind: "birthday", referenceDate: "1990-01-01" });
      const jour = new Date(Date.now() + dans * 86_400_000).toISOString().slice(0, 10);
      await db.prisma.eventOccurrence.updateMany({
        where: { eventId: e.id }, data: { occurrenceDate: new Date(`${jour}T00:00:00Z`) },
      });
      return e.id;
    };

    it("avant la fenêtre : upcoming", async () => {
      await poser(60);
      const [o] = await occurrences.list(awa, { limit: 1 });
      expect(o?.status).toBe("upcoming");
    });

    it("dans la fenêtre : collecting", async () => {
      await poser(3);
      const [o] = await occurrences.list(awa, { limit: 1 });
      expect(o?.status).toBe("collecting");
    });

    it("après la fenêtre : closed", async () => {
      const hier = new Date(Date.now() - 40 * 86_400_000).toISOString().slice(0, 10);
      await poser(-40);
      const [o] = await occurrences.list(awa, { from: hier, limit: 1 });
      expect(o?.status).toBe("closed");
    });
  });

  it("ne rend pas le détail d'une échéance d'un autre compte", async () => {
    const p = await persons.create(bila, { displayName: "Celarine" });
    const e = await events.create(bila, { personId: p.id, kind: "birthday", referenceDate: "1990-03-14" });
    const o = await db.prisma.eventOccurrence.findFirstOrThrow({ where: { eventId: e.id } });
    await expect(occurrences.get(awa, o.id)).rejects.toMatchObject({ code: "not_found" });
  });
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/api exec vitest run test/occurrence.test.ts`
Attendu : ÉCHEC — `Failed to load url ../src/me/occurrence.service.js`

- [ ] **Étape 3 : écrire le service**

`apps/api/src/me/occurrence.service.ts` :
```ts
import { Inject, Injectable } from "@nestjs/common";
import type { ListOccurrencesQuery, Occurrence } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantRepository } from "../tenancy/tenant.repository.js";
import { ajouterJours } from "./calendrier.js";

// Défauts du dictionnaire, employés si system_parameter ne les porte pas.
const FENETRE_AVANT = 7;
const FENETRE_APRES = 30;
// L'écran Dates montre un mois ; sans plafond explicite, on borne large plutôt
// que de rendre l'historique entier à un client qui n'en veut pas.
const PLAFOND_DEFAUT = 50;

type LigneJointe = {
  id: string; eventId: string; occurrenceDate: Date; occurrenceYear: number | null;
  event: {
    kind: string; eventNature: string; label: string | null;
    referenceDate: Date; yearKnown: boolean;
    person: { id: string; displayName: string };
  };
};

@Injectable()
export class OccurrenceService {
  constructor(
    @Inject(TenantRepository) private readonly depot: TenantRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  private aujourdhui(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private async fenetre(): Promise<[number, number]> {
    const lignes = await this.prisma.systemParameter.findMany({
      where: { key: { in: ["wish_window_lead_days", "wish_window_trail_days"] } },
    });
    const lire = (cle: string, defaut: number): number => {
      const l = lignes.find((x) => x.key === cle);
      return l ? Number(l.value) : defaut;
    };
    return [lire("wish_window_lead_days", FENETRE_AVANT), lire("wish_window_trail_days", FENETRE_APRES)];
  }

  async list(userId: string, query: ListOccurrencesQuery): Promise<Occurrence[]> {
    const depuis = query.from ?? this.aujourdhui();
    const lignes = (await this.depot.occurrences(userId).findMany({
      occurrenceDate: {
        gte: new Date(`${depuis}T00:00:00Z`),
        ...(query.to ? { lte: new Date(`${query.to}T00:00:00Z`) } : {}),
      },
    })) as unknown[];

    // La portée cloisonnée rend les lignes ; on recharge avec leurs relations
    // pour que le nom du proche voyage avec l'échéance.
    const jointes = await this.prisma.eventOccurrence.findMany({
      where: { id: { in: (lignes as { id: string }[]).map((l) => l.id) } },
      orderBy: { occurrenceDate: "asc" },
      take: query.limit ?? PLAFOND_DEFAUT,
      include: { event: { include: { person: true } } },
    });

    const [avant, apres] = await this.fenetre();
    return jointes.map((l) => this.rendre(l as LigneJointe, avant, apres));
  }

  async get(userId: string, id: string): Promise<Occurrence> {
    // findOrThrow d'abord : 404 sur ce qui n'est pas au demandeur, avant
    // toute lecture jointe.
    await this.depot.occurrences(userId).findOrThrow(id);
    const l = await this.prisma.eventOccurrence.findUniqueOrThrow({
      where: { id }, include: { event: { include: { person: true } } },
    });
    const [avant, apres] = await this.fenetre();
    return this.rendre(l as LigneJointe, avant, apres);
  }

  private rendre(l: LigneJointe, avant: number, apres: number): Occurrence {
    const date = l.occurrenceDate.toISOString().slice(0, 10);
    const jour = this.aujourdhui();

    // Le statut se DÉRIVE : la colonne en base est une matérialisation pour
    // requêter, pas la vérité. Une occurrence dont la fenêtre s'est ouverte
    // pendant la nuit doit se lire « collecting » sans qu'aucun traitement
    // programmé ne soit passé.
    const ouverture = ajouterJours(date, -avant);
    const fermeture = ajouterJours(date, apres);
    const status = jour < ouverture ? "upcoming" : jour > fermeture ? "closed" : "collecting";

    return {
      id: l.id,
      eventId: l.eventId,
      personId: l.event.person.id,
      personDisplayName: l.event.person.displayName,
      kind: l.event.kind as Occurrence["kind"],
      nature: l.event.eventNature as Occurrence["nature"],
      label: l.event.label,
      occurrenceDate: date,
      occurrenceYear: l.occurrenceYear,
      status,
      daysUntil: joursEntre(jour, date),
      age: l.event.yearKnown
        ? Number(date.slice(0, 4)) - l.event.referenceDate.getUTCFullYear()
        : null,
    };
  }
}

// Le décompte est SIGNÉ : négatif pour une échéance passée. Un décompte non
// signé rendrait « J−3 » trois jours après la date.
function joursEntre(de: string, a: string): number {
  const ms = Date.parse(`${a}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
```

- [ ] **Étape 4 : écrire le contrôleur**

`apps/api/src/me/occurrence.controller.ts` :
```ts
import { Controller, Get, Inject, Param, ParseUUIDPipe, Query, Req, UseGuards } from "@nestjs/common";
import { listOccurrencesQuerySchema, type Occurrence } from "@lehno/contracts";
import { AuthGuard } from "../auth/auth.guard.js";
import { AppError } from "../common/errors.js";
import { OccurrenceService } from "./occurrence.service.js";

type AuthedRequest = { userId: string };

// Pas de @Feature : les dates relèvent du SOCLE, qui n'a pas de drapeau.
@Controller("me/occurrences")
@UseGuards(AuthGuard)
export class OccurrenceController {
  constructor(@Inject(OccurrenceService) private readonly occurrences: OccurrenceService) {}

  // La chaîne de requête ne porte que du texte : `limit` arrive en « 3 », pas
  // en 3. On convertit AVANT de valider, sinon le schéma refuse une valeur
  // parfaitement légitime et le client reçoit un 400 incompréhensible.
  @Get()
  list(
    @Req() req: AuthedRequest,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit") limit?: string,
  ): Promise<Occurrence[]> {
    const analyse = listOccurrencesQuerySchema.safeParse({
      ...(from !== undefined ? { from } : {}),
      ...(to !== undefined ? { to } : {}),
      ...(limit !== undefined ? { limit: Number(limit) } : {}),
    });
    if (!analyse.success) {
      throw new AppError("validation_failed", "invalid occurrences query", {
        query: analyse.error.issues.map((i) => i.message).join(", "),
      });
    }
    return this.occurrences.list(req.userId, analyse.data);
  }

  @Get(":id")
  get(@Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string): Promise<Occurrence> {
    return this.occurrences.get(req.userId, id);
  }
}
```

Enregistrer `OccurrenceController` dans les `controllers` et `OccurrenceService` dans les `providers` d'`app.module.ts`.

- [ ] **Étape 5 : étendre le contrat publié, lancer, commiter**

Deux chemins dans `CHEMINS`, réengendrer, lancer `test/occurrence.test.ts` et le paquet des contrats, commiter.

- [ ] **Étape 6 : preuve par la panne**

Remplacer la dérivation du statut par la lecture de la colonne `status` en base. Attendu : « dans la fenêtre : collecting » rougit, l'occurrence restant `upcoming` alors que sa fenêtre est ouverte. Retirer par l'édition inverse.

---

### Tâche 4 : Les notes de circonstance

**Fichiers :**
- Modifier : `apps/api/src/me/occurrence.controller.ts`, `apps/api/src/me/note.service.ts`, `packages/contracts/src/openapi.ts`
- Tester : `apps/api/test/occurrence.test.ts`

**Interfaces :**
- Consomme : `NoteService` (phase 1), `TenantRepository.occurrences(userId)`.
- Produit : `NoteService.listForOccurrence(userId, occurrenceId)`, `.createForOccurrence(userId, occurrenceId, input)`.

**La distinction qui compte** (dictionnaire, `Note`) : deux natures de notes, distinguées par `eventOccurrenceId`. **Durable** (nul) décrit le proche et vaut d'une année sur l'autre ; **de circonstance** (renseigné) appartient à une occasion. `/me/persons/{id}/notes` rend les durables — cette tâche ajoute le pendant pour les autres.

- [ ] **Étape 1 : écrire le test qui échoue**

```ts
  it("écrit une note de circonstance rattachée à l'occasion", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    const e = await events.create(awa, { personId: p.id, kind: "birthday", referenceDate: "1990-03-14" });
    const o = await db.prisma.eventOccurrence.findFirstOrThrow({ where: { eventId: e.id } });

    const n = await notes.createForOccurrence(awa, o.id, { content: "Il a parlé d'un cadeau" });
    expect(n.eventOccurrenceId).toBe(o.id);
    expect(n.personId).toBe(p.id);
  });

  // Les deux natures ne se mélangent pas : la fiche montre les durables, la
  // page de l'occasion montre les siennes. Une note de circonstance qui
  // remonterait dans les durables ferait ressurgir « il a parlé d'un moulin »
  // trois ans plus tard, hors de son contexte.
  it("ne mêle pas les durables et les notes de circonstance", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    const e = await events.create(awa, { personId: p.id, kind: "birthday", referenceDate: "1990-03-14" });
    const o = await db.prisma.eventOccurrence.findFirstOrThrow({ where: { eventId: e.id } });

    await notes.createForPerson(awa, p.id, { content: "aime le café" });
    await notes.createForOccurrence(awa, o.id, { content: "lui offrir un moulin" });

    const durables = await notes.listForPerson(awa, p.id);
    expect(durables.map((n) => n.content)).toEqual(["aime le café"]);

    const circonstance = await notes.listForOccurrence(awa, o.id);
    expect(circonstance.map((n) => n.content)).toEqual(["lui offrir un moulin"]);
  });

  it("n'écrit pas sur l'occasion d'un autre compte", async () => {
    const p = await persons.create(bila, { displayName: "Celarine" });
    const e = await events.create(bila, { personId: p.id, kind: "birthday", referenceDate: "1990-03-14" });
    const o = await db.prisma.eventOccurrence.findFirstOrThrow({ where: { eventId: e.id } });

    await expect(
      notes.createForOccurrence(awa, o.id, { content: "essai" }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(await db.prisma.note.count()).toBe(0);
  });
```

- [ ] **Étape 2 : le voir échouer, puis écrire les deux méthodes**

Dans `note.service.ts` :
```ts
  // Les notes d'une occasion. Le proche s'en déduit : une occurrence appartient
  // à un événement, qui appartient à un proche — le client n'a pas à le dire,
  // et le lui faire dire ouvrirait la porte à une incohérence.
  async listForOccurrence(userId: string, occurrenceId: string): Promise<Note[]> {
    await this.depot.occurrences(userId).findOrThrow(occurrenceId);
    const lignes = await this.prisma.note.findMany({
      where: { eventOccurrenceId: occurrenceId },
      orderBy: { createdAt: "desc" },
      include: { categories: { include: { category: true } } },
    });
    return lignes.map(rendre);
  }

  async createForOccurrence(
    userId: string, occurrenceId: string, input: CreateNoteInput,
  ): Promise<Note> {
    await this.depot.occurrences(userId).findOrThrow(occurrenceId);
    const occurrence = await this.prisma.eventOccurrence.findUniqueOrThrow({
      where: { id: occurrenceId }, include: { event: true },
    });

    const codes = classer(input.content);
    const categories = codes.length
      ? await this.prisma.category.findMany({ where: { code: { in: codes } } })
      : [];

    const ligne = await this.prisma.note.create({
      data: {
        personId: occurrence.event.personId,
        authorUserId: userId,
        content: input.content,
        eventOccurrenceId: occurrenceId,
        categories: { create: categories.map((c) => ({ categoryId: c.id })) },
      },
      include: { categories: { include: { category: true } } },
    });
    return rendre(ligne);
  }
```

`listForPerson` doit ne rendre que les **durables** : ajouter `eventOccurrenceId: null` à son `where`. Sans ça, une note de circonstance remonterait dans les durables et ressurgirait hors de son contexte des années plus tard.

- [ ] **Étape 3 : les deux chemins au contrôleur, le contrat, les tests, le commit**

`GET`/`POST /me/occurrences/:id/notes` dans `occurrence.controller.ts`, `POST` en 201. Étendre `CHEMINS`, réengendrer, lancer, commiter.

- [ ] **Étape 4 : preuve par la panne**

Retirer `eventOccurrenceId: null` du `where` de `listForPerson`. Attendu : « ne mêle pas les durables et les notes de circonstance » rougit avec deux notes au lieu d'une. Retirer par l'édition inverse.

---

### Tâche 5 : L'accueil

**Fichiers :**
- Créer : `apps/api/src/me/home.controller.ts`
- Modifier : `apps/api/src/app.module.ts`, `packages/contracts/src/openapi.ts`
- Tester : `apps/api/test/home.test.ts`

**Interfaces :**
- Consomme : `OccurrenceService.list` (tâche 3) ; `homeSchema` de `me-home.ts`.
- Produit : `HomeService.get(userId): Promise<Home>`.

**Ce que le contrat impose déjà** (`me-home.ts`, à lire avant d'écrire) : `firstName`, trois `occurrences`, des `counts` (`today`, `thisWeek`), `unreadNotifications`, et `hasPersons`. Ce dernier existe parce que **les deux états vides ne se ressemblent pas** : au premier lancement le bouton devient « Ajouter un anniversaire », alors qu'un carnet rempli sans échéance garde « Laisser une note ». Le client ne peut pas les distinguer depuis une liste vide.

- [ ] **Étape 1 : écrire le test qui échoue**

```ts
  it("rend trois échéances, pas davantage", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    for (const j of ["01-10", "02-10", "03-10", "04-10"]) {
      await events.create(awa, {
        personId: p.id, kind: "other", label: `Jalon ${j}`, referenceDate: `2020-${j}`,
      });
    }
    const accueil = await home.get(awa);
    expect(accueil.occurrences).toHaveLength(3);
  });

  // Les décomptes ne se déduisent PAS de la liste rendue : trois échéances ne
  // disent pas combien il y en a cette semaine. C'est la raison d'être de
  // « counts » dans le contrat.
  it("compte au-delà des trois rendues", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    const jour = new Date().toISOString().slice(5, 10);
    for (let i = 0; i < 5; i++) {
      const q = await persons.create(awa, { displayName: `P${i}` });
      await events.create(awa, { personId: q.id, kind: "birthday", referenceDate: `1990-${jour}` });
    }
    const accueil = await home.get(awa);
    expect(accueil.occurrences).toHaveLength(3);
    expect(accueil.counts.today).toBe(5);
  });

  // Les deux états vides ne se ressemblent pas, et une liste vide ne les
  // distingue pas : sans ce drapeau, le client appellerait /me/persons rien
  // que pour choisir un libellé de bouton.
  it("distingue le carnet vide du carnet sans échéance", async () => {
    expect((await home.get(awa)).hasPersons).toBe(false);
    await persons.create(awa, { displayName: "Valery" });
    const apres = await home.get(awa);
    expect(apres.hasPersons).toBe(true);
    expect(apres.occurrences).toEqual([]);
  });

  it("ne compte que ses propres échéances", async () => {
    const p = await persons.create(bila, { displayName: "Celarine" });
    await events.create(bila, { personId: p.id, kind: "birthday", referenceDate: "1990-03-14" });
    const accueil = await home.get(awa);
    expect(accueil.occurrences).toEqual([]);
    expect(accueil.counts.thisWeek).toBe(0);
  });
```

- [ ] **Étape 2 : écrire le service et le contrôleur**

`apps/api/src/me/home.controller.ts` :
```ts
import { Controller, Get, Inject, Injectable, Req, UseGuards } from "@nestjs/common";
import type { Home } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { OccurrenceService } from "./occurrence.service.js";
import { ajouterJours } from "./calendrier.js";

type AuthedRequest = { userId: string };

// Trois cartes à l'accueil (maquette §3.2). Les décomptes, eux, se comptent à
// part : trois échéances rendues ne disent pas combien il y en a cette
// semaine, et déduire les chiffres de la liste plafonnée les plafonnerait
// aussi — « une date aujourd'hui » là où il y en a cinq.
const CARTES = 3;

@Injectable()
export class HomeService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OccurrenceService) private readonly occurrences: OccurrenceService,
  ) {}

  private aujourdhui(): string {
    return new Date().toISOString().slice(0, 10);
  }

  async get(userId: string): Promise<Home> {
    const jour = this.aujourdhui();
    const dansUneSemaine = ajouterJours(jour, 7);

    const [user, cartes, today, thisWeek, unreadNotifications, personnes] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      this.occurrences.list(userId, { from: jour, limit: CARTES }),
      this.prisma.eventOccurrence.count({
        where: { userId, occurrenceDate: new Date(`${jour}T00:00:00Z`) },
      }),
      this.prisma.eventOccurrence.count({
        where: {
          userId,
          occurrenceDate: {
            gte: new Date(`${jour}T00:00:00Z`),
            lte: new Date(`${dansUneSemaine}T00:00:00Z`),
          },
        },
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
      // findFirst, pas count : on demande « y en a-t-il », pas « combien ».
      // Compter tout le carnet pour répondre à un booléen serait du gaspillage
      // sur une fiche bien remplie.
      this.prisma.person.findFirst({ where: { userId }, select: { id: true } }),
    ]);

    return {
      firstName: user.displayName ?? user.username,
      occurrences: cartes,
      counts: { today, thisWeek },
      unreadNotifications,
      hasPersons: personnes !== null,
    };
  }
}

@Controller("me/home")
@UseGuards(AuthGuard)
export class HomeController {
  constructor(@Inject(HomeService) private readonly home: HomeService) {}

  @Get()
  get(@Req() req: AuthedRequest): Promise<Home> {
    return this.home.get(req.userId);
  }
}
```

**Un point à vérifier avant d'écrire** : `count` n'accepte pas `take` chez
Prisma. Employer `findFirst({ where: { userId }, select: { id: true } })` et
tester la nullité — on demande « y en a-t-il », pas « combien », et compter
tout le carnet pour répondre à un booléen serait du gaspillage sur une fiche
bien remplie.

Le champ « lue » de `Notification` est bien `readAt` (nullable), vérifié au
schéma — il porte même un index `[userId, readAt]`, donc ce décompte est
servi par l'index.

Enregistrer `HomeController` et `HomeService` dans `app.module.ts`.

- [ ] **Étape 3 : le contrat, les tests, le commit**

Un chemin dans `CHEMINS` avec `homeSchema`, réengendrer, lancer `test/home.test.ts`, commiter.

- [ ] **Étape 4 : preuve par la panne**

Remplacer les décomptes par une dérivation de la liste rendue — `counts.today = occurrences.filter(o => o.daysUntil === 0).length`. Attendu : « compte au-delà des trois rendues » rougit avec 3 au lieu de 5. Retirer par l'édition inverse.

---

## Ce que ce plan ne fait pas

- **Les récurrences libres.** `Schedule` accepte cinq unités et deux formes de décalage, mais la saisie ne propose que l'anniversaire annuel. L'écran qui compose une récurrence viendra avec elles ; le noyau de calendrier les sait déjà calculer.
- **La bascule automatique des occurrences.** À la fermeture d'une fenêtre, l'occurrence de l'année suivante doit s'ouvrir (dictionnaire, `EventOccurrence`). C'est un traitement programmé (§15.2), et rien de cette couche n'existe encore — le statut se dérivant à la lecture, l'absence de bascule ne fausse aucun affichage, elle laisse seulement l'occurrence suivante non matérialisée.
- **Les souhaits d'une occasion** (`/me/occurrences/{id}/wishes`) : ils dépendent de `WishlistItem`, qui relève du drapeau `wishlist` et d'un autre chantier.
- **Les portraits et les cadeaux d'un proche** (`/me/persons/{id}/portraits`, `/gifts`) : dépendent de `GeneratedProfile` et `GiftGiven`, absentes du schéma.

# Lehno phase 1 — les proches et leurs notes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ouvrir l'espace privé sur ce qui fait Lehno — enregistrer un proche, écrire ce qu'on sait de lui, et retrouver ces notes rangées.

**Architecture:** Six chemins sous `/v1/me`, tous derrière `AuthGuard`, tous cloisonnés par le dépôt `TenantRepository` déjà en place. Aucune table à créer : le schéma les attend depuis la phase 0. Le classement des notes est une fonction pure, sans appel réseau ni modèle, testée comme telle.

**Tech Stack:** NestJS 11, Prisma 6.19.3, Zod, Vitest + Testcontainers. Modules ESM, imports relatifs suffixés en `.js`.

**Spec:** `specs/spec-technique-lehno.md` §5.2 · `specs/dictionnaire-donnees-lehno.md` (Person, Note, Category, NoteCategory) · `specs/doc-fonctionnelle-assistant-anniversaires.md` §7 et §8

---

## Contraintes globales

- **Le serveur décide.** Cloisonnement, droits, classement : tout se vérifie côté serveur à chaque appel. Le client affiche, il ne tranche pas.
- **Cloisonnement par le dépôt, jamais à la main.** `TenantRepository` (`src/tenancy/tenant.repository.ts`) porte déjà les portées `persons`, `events`, `notes`, `wishes`, `occurrences`. Une requête Prisma directe sur ces tables, dans un service `/me`, est un défaut.
- **404, pas 403.** Une ressource qui appartient à quelqu'un d'autre n'existe pas pour le demandeur. `Scope.findOrThrow` le fait déjà ; ne pas le contourner.
- **Les colonnes d'appartenance ne s'écrivent pas.** `Scope.updateOrThrow` refuse `userId` et `personId` dans les données. Ne pas court-circuiter.
- **Tout ce qui arrive est validé** avant traitement : type, format, bornes, valeurs d'énumération. Un champ inattendu fait échouer la requête — les schémas Zod sont en `.strict()`.
- **Les catégories sont un ensemble fixe du système** : `gift_ideas`, `message_ideas`, `facts`, `encouragements`, `challenges` (ponctuelles) ; `interests`, `dislikes_nogo` (durables, `dislikes_nogo` porte `is_constraint = true`). Elles sont déjà semées par la migration `20260822154334_content`. Aucune catégorie personnalisée.
- **Deux natures de notes**, distinguées par `eventOccurrenceId` : **durable** (nul) décrit le proche et vaut d'une année sur l'autre ; **de circonstance** (renseigné) appartient à une occasion.
- **Une note peut relever de deux catégories.** Le double rattachement est voulu, pas toléré.
- **Le classement est corrigeable.** `NoteCategory.assignedBy` vaut `auto` par défaut et `user` après correction.
- **Aucun appel d'IA dans ce plan.** Les notes sont gratuites (« Les fonctions de base du Service sont gratuites », CGU §6) et un appel de modèle se paie en crédits. Le classement est donc heuristique — voir la décision en tête de la tâche 4.
- **Toute tâche qui ajoute un chemin étend le contrat publié.** `docs/api/openapi.json` est engendré depuis les schémas Zod, jamais écrit à la main, et un test échoue s'il est périmé (tâche 0). Un contrat qui ment est pire qu'un contrat absent.
- **TDD** : le test s'écrit d'abord, on le voit échouer, puis on le fait passer. Commit à chaque tâche.
- Commentaires en français, identifiants et code en anglais. Messages de commit en français à l'impératif.
- **Un `pnpm test` qui affiche « 0 tasks » n'est pas un feu vert**, et le cache de Turbo rejoue des succès périmés : vérifier « cache miss » ou lancer le paquet directement.

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `packages/contracts/src/me.ts` | Schémas Zod et types de `/me/persons` et `/me/notes` |
| `apps/api/src/me/person.service.ts` | L'annuaire et la fiche : lecture, création, mise à jour, suppression |
| `apps/api/src/me/person.controller.ts` | Les chemins `/me/persons` et `/me/persons/{id}` |
| `apps/api/src/me/note-classifier.ts` | Le classement heuristique — fonction pure, sans dépendance |
| `apps/api/src/me/note.service.ts` | Création et lecture des notes, classement compris |
| `apps/api/src/me/note.controller.ts` | Les chemins `/me/notes` et `/me/persons/{id}/notes` |

Le classement vit dans son propre fichier parce qu'il se teste sans base, sans Nest et sans conteneur — et parce qu'il changera plus souvent que le reste.

---

### Tâche 0 : Le contrat publié

**Décision.** Le contrat se dérive des **schémas Zod** de `packages/contracts`, pas de décorateurs Nest. `@nestjs/swagger` demanderait de redéclarer chaque schéma en DTO décoré : une seconde définition des mêmes formes, qui dérive de la première dès la première correction. Les contrats Zod sont déjà la source unique, partagée par le web et le mobile — le document se calcule à partir d'eux. Coût si ce choix est mauvais : un fichier d'engendrement à réécrire, sans toucher aux contrats ni aux routes.

**Le fichier est versionné**, et non seulement servi. Un contrat dans un diff se relit ; un contrat qui n'existe qu'en mémoire ne se relit jamais. Et c'est ce qui rend le test de péremption possible.

**Fichiers :**
- Créer : `packages/contracts/src/openapi.ts`, `packages/contracts/scripts/build-openapi.ts`
- Créer : `docs/api/openapi.json` (engendré)
- Modifier : `packages/contracts/package.json` (dépendance et script)
- Test : `packages/contracts/src/openapi.test.ts`

**Interfaces :**
- Produit : `construireOpenApi(): object` — le document complet, calculé depuis les schémas exportés.

- [ ] **Étape 1 : écrire le test qui échoue**

`packages/contracts/src/openapi.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { construireOpenApi } from "./openapi.js";

describe("contrat publié", () => {
  it("porte les métadonnées du service", () => {
    const d = construireOpenApi() as { openapi: string; info: { title: string }; servers: unknown[] };
    expect(d.openapi).toMatch(/^3\./);
    expect(d.info.title).toBe("Lehno");
    expect(d.servers).not.toHaveLength(0);
  });

  // Le contrat décrit ce que le serveur sert vraiment : les chemins publics
  // existent déjà, ils doivent y être.
  it("décrit les chemins déjà servis", () => {
    const chemins = Object.keys((construireOpenApi() as { paths: object }).paths);
    expect(chemins).toContain("/public/waitlist");
    expect(chemins).toContain("/public/contact");
  });

  // LE test qui compte. Un fichier engendré que rien ne vérifie pourrit : il
  // décrit alors une API qui n'existe plus, et un client s'y fie.
  it("le fichier versionné n'est pas périmé", () => {
    const surDisque = readFileSync(
      join(import.meta.dirname, "..", "..", "..", "docs", "api", "openapi.json"),
      "utf-8",
    );
    expect(
      JSON.parse(surDisque),
      "docs/api/openapi.json est périmé — relancer `pnpm --filter @lehno/contracts openapi`",
    ).toEqual(construireOpenApi());
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/contracts exec vitest run src/openapi.test.ts`
Attendu : ÉCHEC — `Failed to load url ./openapi.js`

- [ ] **Étape 3 : installer l'engendrement**

```bash
pnpm --filter @lehno/contracts add zod-to-json-schema
pnpm install --frozen-lockfile   # le verrou doit suivre, la CI l'exige
```

- [ ] **Étape 4 : écrire le constructeur**

`packages/contracts/src/openapi.ts` — décrire chaque chemin **une fois**, en tirant ses schémas de ceux qui existent déjà :

```ts
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ZodTypeAny } from "zod";
import { waitlistJoinSchema, waitlistJoinResponseSchema, contactSendSchema, contactSendResponseSchema } from "./public.js";
import { errorEnvelopeSchema } from "./errors.js";

// Le contrat se CALCULE depuis les schémas Zod, il ne se recopie pas. Une
// seconde déclaration des mêmes formes — en DTO décoré, par exemple — dériverait
// de la première dès la première correction.
const schema = (s: ZodTypeAny): object => zodToJsonSchema(s, { target: "openApi3" });

type Chemin = {
  chemin: string;
  methode: "get" | "post" | "patch" | "delete";
  resume: string;
  authentifie?: boolean;
  corps?: ZodTypeAny;
  reponse?: ZodTypeAny;
  statut?: number;
};

// Une entrée par chemin servi. Les tâches suivantes ajoutent les leurs ici, et
// le test de péremption refuse un contrat qui ne les décrit pas.
const CHEMINS: Chemin[] = [
  { chemin: "/public/waitlist", methode: "post", resume: "S'inscrire à la liste d'attente", corps: waitlistJoinSchema, reponse: waitlistJoinResponseSchema },
  { chemin: "/public/contact", methode: "post", resume: "Écrire à l'équipe", corps: contactSendSchema, reponse: contactSendResponseSchema },
];

export function construireOpenApi(): object {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const c of CHEMINS) {
    paths[c.chemin] ??= {};
    paths[c.chemin]![c.methode] = {
      summary: c.resume,
      ...(c.authentifie ? { security: [{ bearerAuth: [] }] } : {}),
      ...(c.corps ? { requestBody: { required: true, content: { "application/json": { schema: schema(c.corps) } } } } : {}),
      responses: {
        [String(c.statut ?? 200)]: {
          description: "Succès",
          ...(c.reponse ? { content: { "application/json": { schema: schema(c.reponse) } } } : {}),
        },
        "4XX": {
          description: "Refus — l'enveloppe d'erreur du produit",
          content: { "application/json": { schema: schema(errorEnvelopeSchema) } },
        },
      },
    };
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "Lehno",
      version: "1",
      description: "L'assistant des dates qui comptent. Le contrat est engendré depuis les schémas Zod de @lehno/contracts — il ne s'écrit pas à la main.",
    },
    servers: [{ url: "https://api.lehno.app/v1" }, { url: "http://localhost:3001/v1", description: "développement" }],
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    },
    paths,
  };
}
```

- [ ] **Étape 5 : écrire le script d'engendrement**

`packages/contracts/scripts/build-openapi.ts` :
```ts
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { construireOpenApi } from "../src/openapi.js";

const sortie = join(import.meta.dirname, "..", "..", "..", "docs", "api");
mkdirSync(sortie, { recursive: true });
// Indenté et terminé par un saut de ligne : le fichier se relit dans un diff.
writeFileSync(join(sortie, "openapi.json"), `${JSON.stringify(construireOpenApi(), null, 2)}\n`);
console.log("docs/api/openapi.json engendré");
```

Ajouter à `packages/contracts/package.json` : `"openapi": "tsx scripts/build-openapi.ts"`.

- [ ] **Étape 6 : engendrer, puis voir les tests passer**

```bash
pnpm --filter @lehno/contracts openapi
pnpm --filter @lehno/contracts exec vitest run
```
Attendu : tous verts, `docs/api/openapi.json` créé.

- [ ] **Étape 7 : prouver que le test de péremption mord**

Modifier une ligne de `docs/api/openapi.json` à la main, relancer les tests, **coller la sortie d'échec**, puis réengendrer. Un fichier engendré que rien ne vérifie décrit tôt ou tard une API qui n'existe plus.

- [ ] **Étape 8 : commit**

```bash
git add packages/contracts docs/api
git commit -m "contrats: publie le contrat d'API, engendré depuis les schémas Zod"
```

---

### Tâche 1 : Les contrats des proches

**Fichiers :**
- Créer : `packages/contracts/src/me.ts`
- Modifier : `packages/contracts/src/index.ts`
- Test : `packages/contracts/src/me.test.ts`

**Interfaces :**
- Produit : `personSchema`, `createPersonSchema`, `updatePersonSchema`, `PERSON_REGISTERS`, et les types `Person`, `CreatePersonInput`, `UpdatePersonInput`.

- [ ] **Étape 1 : écrire le test qui échoue**

`packages/contracts/src/me.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { createPersonSchema, updatePersonSchema, PERSON_REGISTERS } from "./me.js";

describe("contrats des proches", () => {
  it("exige un nom d'usage non vide", () => {
    expect(createPersonSchema.safeParse({ displayName: "" }).success).toBe(false);
    expect(createPersonSchema.safeParse({ displayName: "Awa" }).success).toBe(true);
  });

  // Le registre gouverne le ton des messages produits : trois valeurs, pas une
  // chaîne libre (voir dictionnaire, enum person_register).
  it("n'accepte que les trois registres du dictionnaire", () => {
    expect(PERSON_REGISTERS).toEqual(["familier", "amical", "formel"]);
    expect(createPersonSchema.safeParse({ displayName: "Awa", register: "copain" }).success).toBe(false);
    expect(createPersonSchema.safeParse({ displayName: "Awa", register: "amical" }).success).toBe(true);
  });

  // .strict() : un champ inattendu fait échouer, il ne se laisse pas ignorer.
  it("refuse un champ inconnu", () => {
    expect(createPersonSchema.safeParse({ displayName: "Awa", isSelf: true }).success).toBe(false);
  });

  // La mise à jour n'a pas de champ obligatoire, mais elle en exige au moins un :
  // un PATCH vide est une requête qui ne veut rien dire.
  it("exige au moins un champ à la mise à jour", () => {
    expect(updatePersonSchema.safeParse({}).success).toBe(false);
    expect(updatePersonSchema.safeParse({ register: "formel" }).success).toBe(true);
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/contracts exec vitest run src/me.test.ts`
Attendu : ÉCHEC — `Failed to load url ./me.js`

- [ ] **Étape 3 : écrire les contrats**

`packages/contracts/src/me.ts` :
```ts
import { z } from "zod";

// Le registre de langage gouverne le ton de ce que le produit écrira pour ce
// proche. Ensemble fixe : enum person_register du dictionnaire.
export const PERSON_REGISTERS = ["familier", "amical", "formel"] as const;
export type PersonRegister = (typeof PERSON_REGISTERS)[number];

export const personSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  isSelf: z.boolean(),
  register: z.enum(PERSON_REGISTERS).nullable(),
  language: z.string().nullable(),
  relationHint: z.string().nullable(),
  createdAt: z.string(),
}).strict();

export type Person = z.infer<typeof personSchema>;

export const createPersonSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  register: z.enum(PERSON_REGISTERS).optional(),
  // Langue de ce que le produit écrira POUR ce proche — distincte de la langue
  // d'interface du propriétaire.
  language: z.enum(["fr", "en"]).optional(),
  // « ma sœur », « mon voisin » : une aide à la génération, pas une taxonomie.
  relationHint: z.string().trim().max(80).optional(),
}).strict();

export type CreatePersonInput = z.infer<typeof createPersonSchema>;

// Un PATCH vide ne veut rien dire : au moins un champ.
export const updatePersonSchema = createPersonSchema
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "au moins un champ" });

export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
```

Ajouter à `packages/contracts/src/index.ts` : `export * from "./me.js";`

- [ ] **Étape 4 : le voir passer**

Lancer : `pnpm --filter @lehno/contracts exec vitest run`
Attendu : tous verts.

- [ ] **Étape 5 : commit**

```bash
git add packages/contracts
git commit -m "contrats: les proches — nom d'usage, registre, langue, lien"
```

---

### Tâche 2 : L'annuaire

**Fichiers :**
- Créer : `apps/api/src/me/person.service.ts`, `apps/api/src/me/person.controller.ts`
- Modifier : `apps/api/src/app.module.ts`
- Test : `apps/api/test/person.test.ts`

**Interfaces :**
- Consomme : `createPersonSchema`, `CreatePersonInput`, `Person` de `@lehno/contracts` (tâche 1) ; `TenantRepository.persons(userId)`.
- Produit : `PersonService.list(userId): Promise<Person[]>` et `PersonService.create(userId, input): Promise<Person>`.

- [ ] **Étape 1 : écrire le test qui échoue**

`apps/api/test/person.test.ts` :
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { PersonService } from "../src/me/person.service.js";
import { TenantRepository } from "../src/tenancy/tenant.repository.js";
import { randomBytes } from "node:crypto";

describe("annuaire des proches", () => {
  let db: TestDb;
  let service: PersonService;
  let awa: string;
  let bila: string;

  const compte = async (): Promise<string> => {
    const u = await db.prisma.user.create({
      data: {
        email: `${randomBytes(6).toString("hex")}@example.com`,
        username: `u${randomBytes(4).toString("hex")}`,
        referralCode: randomBytes(4).toString("hex").toUpperCase(),
      },
    });
    return u.id;
  };

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    service = new PersonService(new TenantRepository(db.prisma as never));
    awa = await compte();
    bila = await compte();
  });

  it("crée un proche et le rend avec son identifiant", async () => {
    const p = await service.create(awa, { displayName: "Valery", register: "amical" });
    expect(p.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(p.displayName).toBe("Valery");
    expect(p.register).toBe("amical");
    expect(p.isSelf).toBe(false);
  });

  // Le cloisonnement est la propriété qui compte le plus ici : l'annuaire d'un
  // compte ne doit jamais laisser voir celui d'un autre.
  it("ne montre que les proches du demandeur", async () => {
    await service.create(awa, { displayName: "Valery" });
    await service.create(bila, { displayName: "Celarine" });

    const vus = await service.list(awa);
    expect(vus.map((p) => p.displayName)).toEqual(["Valery"]);
  });

  // Le nom d'usage n'est pas unique : deux « Maman » sont deux personnes.
  it("accepte deux proches du même nom", async () => {
    await service.create(awa, { displayName: "Maman" });
    await service.create(awa, { displayName: "Maman" });
    expect(await service.list(awa)).toHaveLength(2);
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/api exec vitest run test/person.test.ts`
Attendu : ÉCHEC — `Failed to load url ../src/me/person.service.js`

- [ ] **Étape 3 : écrire le service**

`apps/api/src/me/person.service.ts` :
```ts
import { Inject, Injectable } from "@nestjs/common";
import type { CreatePersonInput, Person } from "@lehno/contracts";
import { TenantRepository } from "../tenancy/tenant.repository.js";

// L'annuaire et la fiche. Toutes les lectures passent par la portée cloisonnée
// du dépôt : une requête Prisma directe sur `person` ici serait un défaut, le
// cloisonnement cesserait d'être garanti par construction.
@Injectable()
export class PersonService {
  // @Inject explicite : voir ProfileService, même contrainte esbuild/vitest.
  constructor(@Inject(TenantRepository) private readonly depot: TenantRepository) {}

  async list(userId: string): Promise<Person[]> {
    const lignes = await this.depot.persons(userId).findMany({});
    return lignes.map(rendre);
  }

  async create(userId: string, input: CreatePersonInput): Promise<Person> {
    const ligne = await this.depot.persons(userId).create({
      displayName: input.displayName,
      register: input.register ?? null,
      language: input.language ?? null,
      relationHint: input.relationHint ?? null,
    });
    return rendre(ligne);
  }
}

// La date se rend en chaîne ISO : le contrat est du JSON, pas un objet Date.
function rendre(p: {
  id: string; displayName: string; isSelf: boolean;
  register: string | null; language: string | null; relationHint: string | null;
  createdAt: Date;
}): Person {
  return {
    id: p.id,
    displayName: p.displayName,
    isSelf: p.isSelf,
    register: p.register as Person["register"],
    language: p.language,
    relationHint: p.relationHint,
    createdAt: p.createdAt.toISOString(),
  };
}
```

`Scope` ne porte pas encore de `create` : l'ajouter dans `src/tenancy/tenant.repository.ts`, à côté de `findMany`, en injectant la portée dans les données —

```ts
  create(data: object): Promise<T> {
    // La portée s'ajoute aux données, elle ne s'y remplace pas : l'appelant ne
    // peut donc pas créer une ressource au nom d'un autre.
    return this.delegate.create({ data: { ...data, ...this.scope } }) as Promise<T>;
  }
```

et déclarer `create` sur l'interface `Delegate` en tête du fichier :
```ts
  create(a: { data: object }): Promise<unknown>;
```

- [ ] **Étape 4 : le voir passer**

Lancer : `pnpm --filter @lehno/api exec vitest run test/person.test.ts`
Attendu : trois tests verts.

- [ ] **Étape 5 : écrire le contrôleur**

`apps/api/src/me/person.controller.ts` :
```ts
import { Body, Controller, Get, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { createPersonSchema, type CreatePersonInput, type Person } from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { PersonService } from "./person.service.js";

// Posé par AuthGuard : req.userId. Type minimal, comme ProfileController.
type AuthedRequest = { userId: string };

@Controller("me/persons")
@UseGuards(AuthGuard)
export class PersonController {
  constructor(@Inject(PersonService) private readonly persons: PersonService) {}

  @Get()
  list(@Req() req: AuthedRequest): Promise<Person[]> {
    return this.persons.list(req.userId);
  }

  @Post()
  create(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(createPersonSchema)) body: CreatePersonInput,
  ): Promise<Person> {
    return this.persons.create(req.userId, body);
  }
}
```

Déclarer `PersonController` dans `controllers` et `PersonService` dans `providers` de `app.module.ts`. `TenantRepository` y est peut-être déjà : vérifier avant d'ajouter.

- [ ] **Étape 6 : éprouver la route réelle**

Ajouter à `apps/api/test/person.test.ts` un cas qui monte l'application et appelle le chemin, sur le modèle de `test/public-http.e2e.test.ts` — un appel sans jeton doit répondre 401, jamais 200 avec une liste vide.

```ts
  it("refuse un appel sans jeton", async () => {
    const r = await fetch(`${baseUrl}/v1/me/persons`);
    expect(r.status).toBe(401);
  });
```

- [ ] **Étape : étendre le contrat publié**

Ajouter les chemins de cette tâche au tableau `CHEMINS` de `packages/contracts/src/openapi.ts`, puis réengendrer :

```bash
pnpm --filter @lehno/contracts openapi
pnpm --filter @lehno/contracts exec vitest run
```

Le test de péremption échoue tant que `docs/api/openapi.json` ne décrit pas ce que la tâche vient de servir. Commiter le fichier engendré avec le reste.

- [ ] **Étape 7 : commit**

```bash
git add apps/api packages
git commit -m "me: l'annuaire des proches, cloisonné par le dépôt"
```

---

### Tâche 3 : La fiche

**Fichiers :**
- Modifier : `apps/api/src/me/person.service.ts`, `apps/api/src/me/person.controller.ts`
- Test : `apps/api/test/person.test.ts`

**Interfaces :**
- Produit : `PersonService.get(userId, id)`, `.update(userId, id, input)`, `.remove(userId, id)`.

- [ ] **Étape 1 : écrire le test qui échoue**

```ts
  it("rend la fiche d'un proche", async () => {
    const p = await service.create(awa, { displayName: "Valery" });
    expect((await service.get(awa, p.id)).displayName).toBe("Valery");
  });

  // 404 et non 403 : la fiche d'un autre n'existe pas pour le demandeur. Un 403
  // confirmerait qu'elle existe, et l'identifiant deviendrait un oracle.
  it("ne rend pas la fiche d'un autre compte", async () => {
    const p = await service.create(bila, { displayName: "Celarine" });
    await expect(service.get(awa, p.id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("met à jour le registre sans toucher au reste", async () => {
    const p = await service.create(awa, { displayName: "Valery", register: "amical" });
    const m = await service.update(awa, p.id, { register: "formel" });
    expect(m.register).toBe("formel");
    expect(m.displayName).toBe("Valery");
  });

  it("ne met pas à jour la fiche d'un autre compte", async () => {
    const p = await service.create(bila, { displayName: "Celarine" });
    await expect(service.update(awa, p.id, { register: "formel" })).rejects.toMatchObject({ code: "not_found" });
  });

  // Supprimer un proche emporte ses notes : la cascade est déclarée au schéma,
  // ce test la constate plutôt que de la supposer.
  it("supprime le proche et ses notes", async () => {
    const p = await service.create(awa, { displayName: "Valery" });
    await db.prisma.note.create({ data: { personId: p.id, content: "aime le café" } });

    await service.remove(awa, p.id);

    expect(await db.prisma.person.count({ where: { id: p.id } })).toBe(0);
    expect(await db.prisma.note.count({ where: { personId: p.id } })).toBe(0);
  });
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/api exec vitest run test/person.test.ts`
Attendu : ÉCHEC — `service.get is not a function`

- [ ] **Étape 3 : écrire les trois méthodes**

Dans `person.service.ts` :
```ts
  async get(userId: string, id: string): Promise<Person> {
    return rendre(await this.depot.persons(userId).findOrThrow(id));
  }

  async update(userId: string, id: string, input: UpdatePersonInput): Promise<Person> {
    // updateOrThrow refuse les colonnes d'appartenance dans les données et rend
    // un not_found si la ressource n'est pas au demandeur — les deux
    // protections viennent du dépôt, pas d'un contrôle ici.
    return rendre(await this.depot.persons(userId).updateOrThrow(id, input as never));
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.depot.persons(userId).deleteOrThrow(id);
  }
```

Importer `UpdatePersonInput` depuis `@lehno/contracts`.

- [ ] **Étape 4 : le voir passer**

Lancer : `pnpm --filter @lehno/api exec vitest run test/person.test.ts`
Attendu : tous verts.

- [ ] **Étape 5 : brancher les chemins**

Dans `person.controller.ts` :
```ts
  @Get(":id")
  get(@Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string): Promise<Person> {
    return this.persons.get(req.userId, id);
  }

  @Patch(":id")
  update(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updatePersonSchema)) body: UpdatePersonInput,
  ): Promise<Person> {
    return this.persons.update(req.userId, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.persons.remove(req.userId, id);
  }
```

`ParseUUIDPipe` importe de `@nestjs/common`. Un identifiant malformé doit répondre 400, pas atteindre la base.

- [ ] **Étape : étendre le contrat publié**

Ajouter les chemins de cette tâche au tableau `CHEMINS` de `packages/contracts/src/openapi.ts`, puis réengendrer :

```bash
pnpm --filter @lehno/contracts openapi
pnpm --filter @lehno/contracts exec vitest run
```

Le test de péremption échoue tant que `docs/api/openapi.json` ne décrit pas ce que la tâche vient de servir. Commiter le fichier engendré avec le reste.

- [ ] **Étape 6 : commit**

```bash
git add apps/api
git commit -m "me: la fiche d'un proche — lecture, correction, suppression"
```

---

### Tâche 4 : Le classement des notes

**Décision, à ne pas rediscuter en cours de route.** Le classement de CETTE tâche est **heuristique**, sans appel de modèle, parce que les notes sont gratuites alors qu'un appel d'IA se paie en crédits (CGU §6).

**Correction du 25/08/2026 (partenaire humain).** Ce paragraphe invoquait aussi « un classement synchrone ne peut pas dépendre d'un tiers qui peut échouer ». La prémisse est fausse : le classement n'a jamais eu à être synchrone. L'utilisateur écrit sa note, ferme l'application et vaque ; le classement se fait en arrière-plan et reste **silencieux pour le client** en cas d'échec — silencieux pour lui, pas pour nous, qui gardons journaux et alertes (spec §14.1, « Observés »). Une note non classée reste dans la liste globale du proche, telle qu'elle a été saisie. Point final.

Ce que cela change : la fonction pure ci-dessous reste le plancher — la note a ses catégories à l'instant où elle est enregistrée, sans dépendance ni attente. Une passe d'IA pourra plus tard **réviser les rattachements `auto` sans jamais toucher aux corrections `user`**, en arrière-plan, derrière son propre drapeau. Ce n'est pas cette tâche : elle attend la couche de traitements programmés (spec §14), que rien n'a encore construite. La documentation fonctionnelle exige seulement que le classement soit **automatique et corrigeable** (§7) — elle n'impose aucun moyen. Coût si ce choix est mauvais : un classement moins fin, que l'utilisateur corrige d'un geste, et une fonction pure à remplacer plus tard sans toucher au reste.

**Fichiers :**
- Créer : `apps/api/src/me/note-classifier.ts`
- Test : `apps/api/test/note-classifier.test.ts`

**Interfaces :**
- Produit : `classer(texte: string): CategoryCode[]` où `CategoryCode` est l'union des sept codes.

- [ ] **Étape 1 : écrire le test qui échoue**

`apps/api/test/note-classifier.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { classer, CODES } from "../src/me/note-classifier.js";

// Une fonction pure : ni base, ni Nest, ni conteneur. C'est aussi la partie qui
// changera le plus souvent, d'où son fichier à elle.
describe("classement d'une note", () => {
  it("connaît les sept codes du dictionnaire, et rien d'autre", () => {
    expect([...CODES].sort()).toEqual([
      "challenges", "dislikes_nogo", "encouragements", "facts",
      "gift_ideas", "interests", "message_ideas",
    ]);
  });

  it.each([
    ["Il a parlé d'un moulin à café manuel", "gift_ideas"],
    ["Elle adore le cinéma coréen", "interests"],
    ["Je ne bois pas d'alcool", "dislikes_nogo"],
    ["Il traverse une période difficile au travail", "challenges"],
    ["Née le 14 mars à Douala", "facts"],
  ])("range « %s » dans %s", (texte, attendu) => {
    expect(classer(texte)).toContain(attendu);
  });

  // Le double rattachement est voulu : une difficulté relève de ce qu'il
  // traverse ET de ce qu'il a besoin d'entendre (doc fonctionnelle §7).
  it("peut ranger une note dans deux catégories", () => {
    const c = classer("Il traverse une période difficile, il a besoin qu'on le soutienne");
    expect(c).toContain("challenges");
    expect(c).toContain("encouragements");
  });

  // Une note qu'on ne sait pas ranger ne se range NULLE PART. Elle reste dans
  // la liste globale du proche, telle qu'elle a été saisie — le classement est
  // une décoration par-dessus, jamais une condition de visibilité.
  //
  // Le repli sur « facts » qui figurait ici était doublement faux. Sa raison
  // — « sans cela elle disparaîtrait de toutes les vues » — est fausse :
  // listForPerson rend toutes les notes du proche, catégorie ou pas, et
  // NoteCategory est une association N–N où zéro ligne est un état valide.
  // Et son effet était pire que le trou qu'il prétendait combler : une note
  // rangée dans « facts » faute de mieux devient indiscernable d'une note qui
  // parle vraiment d'un fait. La catégorie se remplit alors de bruit qu'on ne
  // sait plus séparer du signal, et personne ne peut corriger ce qu'il ne
  // peut pas repérer.
  it("ne range nulle part ce qu'il ne sait pas classer", () => {
    expect(classer("azerty qwerty")).toEqual([]);
  });

  it("ne rend jamais deux fois la même catégorie", () => {
    const c = classer("cadeau cadeau idée cadeau");
    expect(new Set(c).size).toBe(c.length);
  });

  it("ignore la casse et les accents", () => {
    expect(classer("ELLE ADORE LE CINÉMA")).toContain("interests");
    expect(classer("elle adore le cinema")).toContain("interests");
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/api exec vitest run test/note-classifier.test.ts`
Attendu : ÉCHEC — `Failed to load url ../src/me/note-classifier.js`

- [ ] **Étape 3 : écrire le classeur**

`apps/api/src/me/note-classifier.ts` :
```ts
// Le classement d'une note en catégories, par indices lexicaux.
//
// Aucun appel de modèle : les notes sont gratuites (CGU §6) alors qu'un appel
// d'IA se paie en crédits, et un classement synchrone ne peut pas dépendre d'un
// tiers qui peut échouer. La documentation fonctionnelle (§7) exige que le
// classement soit automatique et corrigeable — elle n'impose aucun moyen.
//
// Fonction pure, sans état ni réseau : elle se teste sans base et se remplace
// sans toucher au reste le jour où l'on voudra mieux.
export const CODES = [
  "gift_ideas", "message_ideas", "facts", "encouragements", "challenges",
  "interests", "dislikes_nogo",
] as const;

export type CategoryCode = (typeof CODES)[number];

// Les accents ne changent pas le sens : « cinéma » et « cinema » se rangent
// pareil. La normalisation NFD sépare la lettre de son accent, qu'on retire.
function normaliser(texte: string): string {
  return texte.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Ordre voulu : le refus l'emporte sur le goût. « Je ne bois pas d'alcool »
// parle d'alcool, mais c'est une contrainte, pas un intérêt.
const INDICES: { code: CategoryCode; mots: readonly string[] }[] = [
  { code: "dislikes_nogo", mots: ["ne bois pas", "ne mange pas", "deteste", "supporte pas", "allergique", "evite", "jamais de", "pas de"] },
  { code: "challenges", mots: ["difficile", "difficulte", "epreuve", "traverse", "malade", "deuil", "chomage", "fatigue", "separation"] },
  { code: "encouragements", mots: ["soutenir", "soutien", "encourager", "besoin qu on", "besoin de", "rassurer", "fier de"] },
  { code: "gift_ideas", mots: ["cadeau", "offrir", "aimerait avoir", "reve de", "moulin", "voudrait", "envie de"] },
  { code: "message_ideas", mots: ["lui dire", "lui ecrire", "message", "mot pour", "remercier"] },
  { code: "interests", mots: ["adore", "aime", "passionne", "fan de", "cinema", "musique", "lecture", "sport", "cuisine", "voyage"] },
];

export function classer(texte: string): CategoryCode[] {
  const t = normaliser(texte);
  const trouves = INDICES.filter(({ mots }) => mots.some((m) => t.includes(m))).map(({ code }) => code);

  // Aucun indice trouvé : aucune catégorie. La note reste dans la liste
  // globale du proche, telle qu'elle a été saisie. Ranger d'office dans
  // « facts » ce qu'on n'a pas su lire polluerait la catégorie d'un bruit
  // qu'aucune correction ne saurait ensuite repérer.
  return [...new Set(trouves)];
}
```

- [ ] **Étape 4 : le voir passer**

Lancer : `pnpm --filter @lehno/api exec vitest run test/note-classifier.test.ts`
Attendu : tous verts. Ajuster les indices jusqu'à ce que les cas du test passent, sans ajouter de cas au test pour l'accommoder.

- [ ] **Étape 5 : commit**

```bash
git add apps/api
git commit -m "me: le classement heuristique des notes, sans appel de modèle"
```

---

### Tâche 5 : Les notes d'un proche

**Fichiers :**
- Créer : `apps/api/src/me/note.service.ts`, `apps/api/src/me/note.controller.ts`
- Modifier : `packages/contracts/src/me.ts`, `apps/api/src/app.module.ts`
- Test : `apps/api/test/note.test.ts`

**Interfaces :**
- Consomme : `classer`, `CategoryCode` (tâche 4) ; `TenantRepository.notes(userId)` et `.persons(userId)`.
- Produit : `NoteService.listForPerson(userId, personId)`, `.createForPerson(userId, personId, input)`.

- [ ] **Étape 1 : ajouter les contrats**

Dans `packages/contracts/src/me.ts` :
```ts
export const CATEGORY_CODES = [
  "gift_ideas", "message_ideas", "facts", "encouragements", "challenges",
  "interests", "dislikes_nogo",
] as const;

export const noteSchema = z.object({
  id: z.string().uuid(),
  personId: z.string().uuid(),
  content: z.string(),
  // Nul pour une note durable, renseigné pour une note de circonstance.
  eventOccurrenceId: z.string().uuid().nullable(),
  categories: z.array(z.enum(CATEGORY_CODES)),
  createdAt: z.string(),
}).strict();

export type Note = z.infer<typeof noteSchema>;

export const createNoteSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  eventOccurrenceId: z.string().uuid().optional(),
}).strict();

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
```

- [ ] **Étape 2 : écrire le test qui échoue**

`apps/api/test/note.test.ts` — même montage que `person.test.ts` (base, deux comptes), puis :
```ts
  it("crée une note déjà rangée", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    const n = await notes.createForPerson(awa, p.id, { content: "Il a parlé d'un moulin à café" });

    expect(n.categories).toContain("gift_ideas");
    expect(n.eventOccurrenceId).toBeNull();
  });

  // Le classement est une décision du serveur : il est rendu avec la note, sans
  // second appel (spec technique §5.2).
  it("range en base, pas seulement dans la réponse", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    const n = await notes.createForPerson(awa, p.id, { content: "Elle adore le cinéma" });

    const liens = await db.prisma.noteCategory.findMany({ where: { noteId: n.id } });
    expect(liens).toHaveLength(n.categories.length);
    expect(liens.every((l) => l.assignedBy === "auto")).toBe(true);
  });

  // L'INVARIANT que le classement ne doit jamais mettre en cause : une note
  // sans aucune catégorie reste dans la liste globale du proche, telle qu'elle
  // a été saisie. Le classement décore, il ne conditionne pas la visibilité.
  //
  // Sans ce cas, une jointure interne sur les catégories — écrite un jour pour
  // « simplifier » la requête — ferait disparaître silencieusement les notes
  // non classées. C'est précisément la perte que l'ancien repli sur « facts »
  // prétendait éviter, en la payant d'un mensonge. On l'évite ici par un test.
  it("rend les notes sans aucune catégorie", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    const n = await notes.createForPerson(awa, p.id, { content: "azerty qwerty" });
    expect(n.categories).toEqual([]);

    const listees = await notes.listForPerson(awa, p.id);
    expect(listees.map((x) => x.id)).toContain(n.id);
    expect(listees.find((x) => x.id === n.id)?.content).toBe("azerty qwerty");
  });

  it("n'écrit pas de note sur le proche d'un autre", async () => {
    const p = await persons.create(bila, { displayName: "Celarine" });
    await expect(
      notes.createForPerson(awa, p.id, { content: "essai" }),
    ).rejects.toMatchObject({ code: "not_found" });
    expect(await db.prisma.note.count()).toBe(0);
  });

  it("ne lit que les notes du proche demandé", async () => {
    const a = await persons.create(awa, { displayName: "Valery" });
    const b = await persons.create(awa, { displayName: "Celarine" });
    await notes.createForPerson(awa, a.id, { content: "aime le café" });
    await notes.createForPerson(awa, b.id, { content: "aime le thé" });

    const vues = await notes.listForPerson(awa, a.id);
    expect(vues.map((n) => n.content)).toEqual(["aime le café"]);
  });

  // Les plus récentes d'abord : la fiche se lit du haut, et une note fraîche
  // vaut mieux qu'une note d'il y a deux ans (doc fonctionnelle §7).
  it("rend les notes de la plus récente à la plus ancienne", async () => {
    const p = await persons.create(awa, { displayName: "Valery" });
    await notes.createForPerson(awa, p.id, { content: "premiere" });
    await notes.createForPerson(awa, p.id, { content: "seconde" });

    const vues = await notes.listForPerson(awa, p.id);
    expect(vues[0]?.content).toBe("seconde");
  });
```

- [ ] **Étape 3 : le voir échouer**

Lancer : `pnpm --filter @lehno/api exec vitest run test/note.test.ts`
Attendu : ÉCHEC — `Failed to load url ../src/me/note.service.js`

- [ ] **Étape 4 : écrire le service**

`apps/api/src/me/note.service.ts` :
```ts
import { Inject, Injectable } from "@nestjs/common";
import type { CreateNoteInput, Note } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantRepository } from "../tenancy/tenant.repository.js";
import { classer } from "./note-classifier.js";

@Injectable()
export class NoteService {
  constructor(
    @Inject(TenantRepository) private readonly depot: TenantRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async listForPerson(userId: string, personId: string): Promise<Note[]> {
    // findOrThrow d'abord : si le proche n'est pas au demandeur, on rend 404
    // avant même de lire des notes. Sans cela, une liste vide laisserait croire
    // que le proche existe et n'a rien.
    await this.depot.persons(userId).findOrThrow(personId);

    const lignes = await this.prisma.note.findMany({
      where: { personId },
      orderBy: { createdAt: "desc" },
      include: { categories: { include: { category: true } } },
    });
    return lignes.map(rendre);
  }

  async createForPerson(userId: string, personId: string, input: CreateNoteInput): Promise<Note> {
    await this.depot.persons(userId).findOrThrow(personId);

    const codes = classer(input.content);
    const categories = await this.prisma.category.findMany({ where: { code: { in: codes } } });

    // La note et ses rattachements naissent ensemble : une note sans catégorie
    // n'apparaîtrait dans aucune vue de la fiche.
    const ligne = await this.prisma.note.create({
      data: {
        personId,
        authorUserId: userId,
        content: input.content,
        eventOccurrenceId: input.eventOccurrenceId ?? null,
        categories: { create: categories.map((c) => ({ categoryId: c.id })) },
      },
      include: { categories: { include: { category: true } } },
    });
    return rendre(ligne);
  }
}

function rendre(n: {
  id: string; personId: string; content: string;
  eventOccurrenceId: string | null; createdAt: Date;
  categories: { category: { code: string } }[];
}): Note {
  return {
    id: n.id,
    personId: n.personId,
    content: n.content,
    eventOccurrenceId: n.eventOccurrenceId,
    categories: n.categories.map((c) => c.category.code) as Note["categories"],
    createdAt: n.createdAt.toISOString(),
  };
}
```

- [ ] **Étape 5 : le voir passer**

Lancer : `pnpm --filter @lehno/api exec vitest run test/note.test.ts`
Attendu : tous verts.

- [ ] **Étape 6 : brancher les chemins**

`apps/api/src/me/note.controller.ts` sert `/me/persons/:id/notes` en GET et POST, sur le modèle exact de `PersonController` — `@UseGuards(AuthGuard)`, `@Param("id", ParseUUIDPipe)`, `ZodValidationPipe(createNoteSchema)`. Déclarer dans `app.module.ts`.

- [ ] **Étape : étendre le contrat publié**

Ajouter les chemins de cette tâche au tableau `CHEMINS` de `packages/contracts/src/openapi.ts`, puis réengendrer :

```bash
pnpm --filter @lehno/contracts openapi
pnpm --filter @lehno/contracts exec vitest run
```

Le test de péremption échoue tant que `docs/api/openapi.json` ne décrit pas ce que la tâche vient de servir. Commiter le fichier engendré avec le reste.

- [ ] **Étape 7 : commit**

```bash
git add apps/api packages
git commit -m "me: les notes d'un proche, rangées à l'écriture"
```

---

### Tâche 6 : Une note pour plusieurs proches

**Fichiers :**
- Modifier : `packages/contracts/src/me.ts`, `apps/api/src/me/note.service.ts`, `apps/api/src/me/note.controller.ts`
- Test : `apps/api/test/note.test.ts`

**Interfaces :**
- Produit : `NoteService.createForMany(userId, input): Promise<Note[]>`.

**Ce que la spécification impose** (§5.2, dernier paragraphe) : le point d'entrée accepte un texte, **une liste de proches** et une occasion facultative. Il crée **une note par proche**, indépendantes ensuite. **La liste des proches est vérifiée avant toute écriture : un identifiant qui ne désigne pas un proche du demandeur fait échouer l'appel entier, sans rien créer.**

- [ ] **Étape 1 : ajouter le contrat**

```ts
export const createNotesSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  // Au moins un proche, et pas cinquante : une note se partage entre quelques
  // personnes, elle ne se diffuse pas.
  personIds: z.array(z.string().uuid()).min(1).max(20),
  eventOccurrenceId: z.string().uuid().optional(),
}).strict();

export type CreateNotesInput = z.infer<typeof createNotesSchema>;
```

- [ ] **Étape 2 : écrire le test qui échoue**

```ts
  it("crée une note par proche, indépendantes", async () => {
    const a = await persons.create(awa, { displayName: "Valery" });
    const b = await persons.create(awa, { displayName: "Celarine" });

    const creees = await notes.createForMany(awa, {
      content: "Ils adorent le cinéma", personIds: [a.id, b.id],
    });

    expect(creees).toHaveLength(2);
    expect(new Set(creees.map((n) => n.id)).size).toBe(2);
    expect(creees.map((n) => n.personId).sort()).toEqual([a.id, b.id].sort());
  });

  // Tout ou rien : la spec l'exige, et sans transaction on écrirait la première
  // note avant de découvrir que la seconde n'est pas permise.
  it("n'écrit rien si un seul identifiant n'est pas au demandeur", async () => {
    const mien = await persons.create(awa, { displayName: "Valery" });
    const autre = await persons.create(bila, { displayName: "Celarine" });

    await expect(
      notes.createForMany(awa, { content: "essai", personIds: [mien.id, autre.id] }),
    ).rejects.toMatchObject({ code: "not_found" });

    expect(await db.prisma.note.count(), "aucune note ne doit exister").toBe(0);
  });

  it("attache l'occasion à toutes les notes quand elle est donnée", async () => {
    // Monter un événement et son occurrence directement en base : cette tâche
    // ne construit pas les chemins des dates, elle s'appuie sur le schéma.
    const p = await persons.create(awa, { displayName: "Valery" });
    const e = await db.prisma.event.create({
      data: {
        personId: p.id, kind: "birthday", eventNature: "happy",
        label: "Anniversaire", referenceDate: new Date("1990-03-14"),
      },
    });
    const o = await db.prisma.eventOccurrence.create({
      data: { eventId: e.id, userId: awa, occurrenceDate: new Date("2027-03-14") },
    });

    const creees = await notes.createForMany(awa, {
      content: "Prevoir un gateau", personIds: [p.id], eventOccurrenceId: o.id,
    });
    expect(creees[0]?.eventOccurrenceId).toBe(o.id);
  });
```

Les colonnes ci-dessus ont été relevées dans `prisma/schema.prisma`, pas supposées : `Event` porte `label`, `eventNature` et `referenceDate` (et non `title`, `nature`, ni de date d'occurrence), `EventOccurrence` porte `occurrenceDate` (et non `occursOn`). En cas de doute, le schéma fait foi — jamais l'inverse.

- [ ] **Étape 3 : le voir échouer**

Lancer : `pnpm --filter @lehno/api exec vitest run test/note.test.ts`
Attendu : ÉCHEC — `notes.createForMany is not a function`

- [ ] **Étape 4 : écrire la méthode**

```ts
  async createForMany(userId: string, input: CreateNotesInput): Promise<Note[]> {
    const codes = classer(input.content);

    // Tout ou rien, dans une seule transaction. La vérification vient d'abord :
    // sans elle, on écrirait la première note avant de découvrir que la seconde
    // n'est pas permise, et l'appel laisserait une trace à moitié.
    return this.prisma.$transaction(async (tx) => {
      const permis = await tx.person.findMany({
        where: { id: { in: input.personIds }, userId },
        select: { id: true },
      });
      if (permis.length !== new Set(input.personIds).size) {
        throw new AppError("not_found", "unknown person in list");
      }

      const categories = await tx.category.findMany({ where: { code: { in: codes } } });
      const creees: Note[] = [];
      for (const personId of input.personIds) {
        const ligne = await tx.note.create({
          data: {
            personId,
            authorUserId: userId,
            content: input.content,
            eventOccurrenceId: input.eventOccurrenceId ?? null,
            categories: { create: categories.map((c) => ({ categoryId: c.id })) },
          },
          include: { categories: { include: { category: true } } },
        });
        creees.push(rendre(ligne));
      }
      return creees;
    });
  }
```

Importer `AppError` de `../common/errors.js` et `CreateNotesInput` de `@lehno/contracts`.

- [ ] **Étape 5 : le voir passer**

Lancer : `pnpm --filter @lehno/api exec vitest run test/note.test.ts`
Attendu : tous verts.

- [ ] **Étape 6 : prouver que la protection mord**

Retirer la vérification `permis.length !== …`, relancer, **coller la sortie d'échec** dans le rapport, puis la remettre. Un test qui ne mord pas ne protège rien.

- [ ] **Étape : étendre le contrat publié**

Ajouter les chemins de cette tâche au tableau `CHEMINS` de `packages/contracts/src/openapi.ts`, puis réengendrer :

```bash
pnpm --filter @lehno/contracts openapi
pnpm --filter @lehno/contracts exec vitest run
```

Le test de péremption échoue tant que `docs/api/openapi.json` ne décrit pas ce que la tâche vient de servir. Commiter le fichier engendré avec le reste.

- [ ] **Étape 7 : brancher le chemin et commiter**

`@Post()` sur `@Controller("me/notes")`, `ZodValidationPipe(createNotesSchema)`.

```bash
git add apps/api packages
git commit -m "me: une note pour plusieurs proches, tout ou rien"
```

---

## Ce que ce plan ne fait pas

- `/me/persons/{id}/gifts` et `/me/gifts/{id}` : **les tables `Gift` n'existent pas**. Une migration est nécessaire avant de les servir — hors périmètre, à traiter dans un plan à part.
- `/me/persons/{id}/portraits` : dépend de la génération (§5.4), non construite.
- Les événements, les occurrences, les souhaits et `/me/home` : plans suivants, dans cet ordre.

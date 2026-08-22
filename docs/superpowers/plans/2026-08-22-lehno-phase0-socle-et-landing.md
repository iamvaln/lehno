# Lehno — Phase 0 : socle et landing

> **Pour les agents :** COMPÉTENCE REQUISE — utiliser `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans` pour exécuter ce plan tâche par tâche. Les étapes portent des cases à cocher (`- [ ]`) pour le suivi.

**But :** poser le socle technique de Lehno — monorepo, schéma, authentification, cloisonnement — et mettre en ligne la landing bilingue de pré-lancement avec sa liste d'attente.

**Architecture :** un monorepo TypeScript où le contrat d'interface vit dans un paquet partagé, consommé par le serveur NestJS et par les clients. La base PostgreSQL porte le modèle complet des phases 0 et 1 dès maintenant. L'authentification repose sur un code à usage unique et sur Google/Apple — aucun mot de passe n'existe dans le produit. Le cloisonnement multi-tenant est une garde, pas une discipline.

**Pile :** pnpm · Turborepo · TypeScript · NestJS · Prisma · PostgreSQL · Next.js (App Router, rendu serveur) · Zod · Vitest · Testcontainers · Docker.

**Spec :** `docs/superpowers/specs/2026-08-21-lehno-phase0-phase1-design.md`, qui s'appuie sur `specs/spec-technique-lehno.md`, `specs/dictionnaire-donnees-lehno.md`, `specs/ux-surfaces-publiques-lehno.md` et `specs/identite-visuelle-lehno.html`.

## Contraintes globales

Ces règles valent pour **toutes** les tâches. Aucune n'est négociable au cas par cas.

- **Node 20**, pnpm 9, modules ESM. Les versions se figent au verrou (`pnpm-lock.yaml`), commité.
- **Le serveur ne rend jamais de phrase destinée à un écran.** Erreurs, états et libellés d'énumération circulent en **codes stables** ; la traduction vit dans `packages/i18n`, côté client.
- **Enveloppe d'erreur unique** : `{ code, message, details? }` — `code` stable et lisible par la machine, `message` en anglais et destiné au journal, jamais affiché.
- **Statuts HTTP** : `400` requête mal formée · `401` identification manquante · `403` droit refusé · `404` ressource absente **ou hors périmètre** · `409` conflit d'état · `422` règle métier non satisfaite · `429` trop de requêtes.
- **Une ressource d'autrui rend `404`, jamais `403`** — répondre « interdit » confirmerait son existence.
- **Les identifiants sont des UUID** (`gen_random_uuid()`), les dates en ISO 8601 avec fuseau.
- **Aucune fonction de hachage lente** (bcrypt, argon2, scrypt) : le produit n'a pas de mot de passe. Le code à usage unique se hache en **HMAC-SHA-256 sous clé d'environnement** ; les jetons de 256 bits en **SHA-256 nu**.
- **Aucun secret dans le dépôt.** Clés et accès viennent de l'environnement ; `.env` est ignoré par git, `.env.example` est commité.
- **Rien de sensible dans un journal** : contenu des notes, codes à usage unique, jetons, numéros de téléphone. Masqués à l'écriture, pas après coup.
- **Aucune ombre dans l'interface**, dans aucun thème. La profondeur vient des filets d'un pixel. Deux thèmes, couleurs déclarées **par rôle** — jamais d'hexadécimal dans un composant.
- **Palette** — clair : fond `#FFFFFF`, surface `#FAF9FC`, panneau `#EDEAF7`, texte `#221F2B`, secondaire `#4A4556`, mention `#726E82`, filet `#EDEBF2`, filet2 `#E2DDF0`, bordure `#88839A`, violet `#7B6BB7`, violet profond `#5A4B93`, sur-violet `#FFFFFF`, abricot `#F0CFB4`, sur-abricot `#7A4A22`, bandeau `#221F2B`, sur-bandeau `#FFFFFF`. Sombre : fond `#17161F`, surface `#1E1C29`, panneau `#2E2945`, texte `#F2F0F7`, secondaire `#B9B4C6`, mention `#9A94A8`, filet `#2A2836`, filet2 `#3D3757`, bordure `#726C96`, violet `#9C8BD8`, violet profond `#C3B4EE`, sur-violet `#15131D`, abricot `#F0CFB4`, sur-abricot `#3A2413`, bandeau `#41357E`, sur-bandeau `#F2F0F7`, carte `#1B1928`.
- **Typographie** — Fraunces (titres, noms, décomptes ; graisses 400 et 500 ; `font-variation-settings: 'SOFT' 40, 'WONK' 1`) et Karla (texte courant, 300 à 700). **Auto-hébergées**, jamais servies depuis un CDN : la politique de sécurité de contenu interdit les sources externes.
- **Bilingue fr/en** partout, dès la première ligne. Le français est la langue de référence ; l'anglais s'écrit, il ne se traduit pas.
- **TDD** : le test s'écrit avant le code, on le voit échouer, puis on le fait passer. Commit à chaque tâche.

## Structure des fichiers

```
apps/
  api/                     NestJS
    src/
      main.ts              amorçage, préfixe /v1, arrêt propre
      app.module.ts
      common/
        errors.ts          AppError, filtre d'exception, enveloppe
        zod-validation.pipe.ts
        correlation.middleware.ts
      prisma/
        prisma.service.ts
      auth/
        otp.service.ts     génération, HMAC, vérification, tentatives
        token.service.ts   accès + rafraîchissement, rotation, rejeu
        auth.controller.ts /auth/*
        auth.guard.ts      session -> req.userId
        federated.service.ts
      tenancy/
        tenant.guard.ts    cloisonnement, 404 hors périmètre
      me/
        profile.controller.ts
      public/
        config.controller.ts
        legal.controller.ts
        waitlist.controller.ts
  web/                     Next.js App Router
    app/[locale]/          landing, pages légales
    lib/theme.ts           résolution avant peinture
packages/
  contracts/               schémas Zod, types, codes d'erreur, énums
  i18n/                    catalogues fr/en
  tokens/                  deux thèmes, couleurs par rôle
  tsconfig/ eslint-config/
infra/
  docker/                  Dockerfile api, Dockerfile web, compose local
  deploy/                  provisionnement VPS, Caddy, sauvegardes
prisma/
  schema.prisma
  migrations/
```

---

### Tâche 1 : Squelette du monorepo

**Fichiers :**
- Créer : `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.gitignore`, `.npmrc`, `.nvmrc`
- Créer : `packages/tsconfig/base.json`, `packages/tsconfig/package.json`
- Créer : `packages/eslint-config/index.js`, `packages/eslint-config/package.json`
- Créer : `vitest.workspace.ts`

**Interfaces :**
- Produit : l'espace de travail `@lehno/*`, la commande `pnpm test` qui traverse tous les paquets, et `@lehno/tsconfig/base.json` dont chaque paquet hérite.

- [ ] **Étape 1 : poser l'espace de travail**

`package.json` :
```json
{
  "name": "lehno",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=20.18 <21" },
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "turbo": "^2.1.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`pnpm-workspace.yaml` :
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`.nvmrc` : `20.18.0` · `.npmrc` : `engine-strict=true`

`.gitignore` :
```
node_modules/
dist/
.next/
.turbo/
.env
.env.*
!.env.example
*.tsbuildinfo
.DS_Store
```

- [ ] **Étape 2 : la configuration TypeScript partagée**

`packages/tsconfig/base.json` :
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "isolatedModules": true
  }
}
```

`packages/tsconfig/package.json` :
```json
{ "name": "@lehno/tsconfig", "version": "0.0.0", "private": true, "files": ["base.json"] }
```

`noUncheckedIndexedAccess` compte : il force à traiter le cas absent d'un accès par index, ce qui évite une classe entière de `undefined` en production.

- [ ] **Étape 3 : le pipeline Turborepo**

`turbo.json` :
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build":     { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**", "!.next/cache/**"] },
    "test":      { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"] },
    "lint":      {}
  }
}
```

- [ ] **Étape 4 : vérifier que l'espace de travail se résout**

```bash
pnpm install
pnpm turbo run typecheck --dry=json | head -20
```
Attendu : l'installation aboutit, et `turbo` liste les paquets sans erreur de résolution.

- [ ] **Étape 5 : commit**

```bash
git add -A
git commit -m "socle: squelette du monorepo, TypeScript partagé, pipeline Turborepo"
```

---

### Tâche 2 : Jetons de design — deux thèmes, couleurs par rôle

**Fichiers :**
- Créer : `packages/tokens/package.json`, `packages/tokens/src/index.ts`, `packages/tokens/src/themes.ts`
- Test : `packages/tokens/src/themes.test.ts`

**Interfaces :**
- Produit : `themes.light` et `themes.dark`, tous deux de type `Theme` ; `type ColorRole` ; `contrastRatio(fg, bg): number` ; `cssVariables(theme): string`.
- Consommé par : la tâche 18 (Next.js) et, en phase 1, l'application mobile.

- [ ] **Étape 1 : écrire le test qui échoue**

`packages/tokens/src/themes.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { themes, contrastRatio, cssVariables, type ColorRole } from "./index.js";

const ROLES: ColorRole[] = [
  "bg", "surface", "panel", "text", "muted", "faint", "line", "line2",
  "edge", "violet", "violetDeep", "onViolet", "apricot", "onApricot",
  "band", "onBand", "card",
];

describe("thèmes", () => {
  it("les deux thèmes portent exactement les mêmes rôles", () => {
    expect(Object.keys(themes.light).sort()).toEqual([...ROLES].sort());
    expect(Object.keys(themes.dark).sort()).toEqual([...ROLES].sort());
  });

  it("toutes les couleurs sont des hexadécimaux à six chiffres", () => {
    for (const theme of [themes.light, themes.dark])
      for (const value of Object.values(theme))
        expect(value).toMatch(/^#[0-9A-F]{6}$/);
  });

  // Le contraste est une propriété du produit, pas une intention : on le mesure.
  it.each([
    ["text", "bg"], ["muted", "bg"], ["faint", "bg"],
    ["onViolet", "violet"], ["violetDeep", "bg"], ["onApricot", "apricot"], ["onBand", "band"],
  ] as const)("%s sur %s atteint 4,5:1 dans les deux thèmes", (fg, bg) => {
    expect(contrastRatio(themes.light[fg], themes.light[bg])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(themes.dark[fg], themes.dark[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it("cssVariables rend une déclaration par rôle", () => {
    const css = cssVariables(themes.light);
    expect(css).toContain("--bg: #FFFFFF;");
    expect(css).toContain("--violet-deep: #5A4B93;");
    expect(css.split(";").filter(Boolean)).toHaveLength(ROLES.length);
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/tokens test`
Attendu : ÉCHEC — `Cannot find module './index.js'`.

- [ ] **Étape 3 : implémenter**

`packages/tokens/src/themes.ts` :
```ts
export type ColorRole =
  | "bg" | "surface" | "panel" | "text" | "muted" | "faint" | "line" | "line2"
  | "edge" | "violet" | "violetDeep" | "onViolet" | "apricot" | "onApricot"
  | "band" | "onBand" | "card";

export type Theme = Record<ColorRole, string>;

export const themes: { light: Theme; dark: Theme } = {
  light: {
    bg: "#FFFFFF", surface: "#FAF9FC", panel: "#EDEAF7", card: "#FFFFFF",
    text: "#221F2B", muted: "#4A4556", faint: "#726E82",
    line: "#EDEBF2", line2: "#E2DDF0", edge: "#88839A",
    violet: "#7B6BB7", violetDeep: "#5A4B93", onViolet: "#FFFFFF",
    apricot: "#F0CFB4", onApricot: "#7A4A22",
    band: "#221F2B", onBand: "#FFFFFF",
  },
  dark: {
    bg: "#17161F", surface: "#1E1C29", panel: "#2E2945", card: "#1B1928",
    text: "#F2F0F7", muted: "#B9B4C6", faint: "#9A94A8",
    line: "#2A2836", line2: "#3D3757", edge: "#726C96",
    violet: "#9C8BD8", violetDeep: "#C3B4EE", onViolet: "#15131D",
    apricot: "#F0CFB4", onApricot: "#3A2413",
    band: "#41357E", onBand: "#F2F0F7",
  },
};

const KEBAB: Record<string, string> = {};
function kebab(role: string): string {
  return (KEBAB[role] ??= role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));
}

export function cssVariables(theme: Theme): string {
  return Object.entries(theme).map(([role, value]) => `--${kebab(role)}: ${value};`).join(" ");
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(h.slice(i, i + 2), 16)));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrastRatio(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)];
  const [hi, lo] = a! > b! ? [a!, b!] : [b!, a!];
  return (hi + 0.05) / (lo + 0.05);
}
```

`packages/tokens/src/index.ts` : `export * from "./themes.js";`

`packages/tokens/package.json` :
```json
{
  "name": "@lehno/tokens",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
  "devDependencies": { "@lehno/tsconfig": "workspace:*", "typescript": "^5.6.0", "vitest": "^2.1.0" }
}
```

- [ ] **Étape 4 : le voir passer**

Lancer : `pnpm --filter @lehno/tokens test`
Attendu : SUCCÈS, 4 tests.

- [ ] **Étape 5 : commit**

```bash
git add packages/tokens
git commit -m "jetons: deux thèmes en rôles, avec le contraste vérifié par test"
```

---

### Tâche 3 : Codes d'erreur et enveloppe

**Fichiers :**
- Créer : `packages/contracts/package.json`, `packages/contracts/src/errors.ts`, `packages/contracts/src/index.ts`
- Test : `packages/contracts/src/errors.test.ts`

**Interfaces :**
- Produit : `ERROR_CODES` (tuple figé), `type ErrorCode`, `errorEnvelopeSchema`, `type ErrorEnvelope`.
- Consommé par : les tâches 9 à 16 (serveur) et 17 à 18 (web), plus `@lehno/i18n` qui doit couvrir chaque code.

- [ ] **Étape 1 : écrire le test qui échoue**

`packages/contracts/src/errors.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { ERROR_CODES, errorEnvelopeSchema } from "./index.js";

describe("codes d'erreur", () => {
  it("sont uniques", () => {
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
  });

  it("sont en minuscules avec des tirets bas", () => {
    for (const code of ERROR_CODES) expect(code).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it("l'enveloppe accepte un code connu et refuse l'inconnu", () => {
    expect(errorEnvelopeSchema.safeParse({ code: "otp_invalid", message: "bad code" }).success).toBe(true);
    expect(errorEnvelopeSchema.safeParse({ code: "pas_un_code", message: "x" }).success).toBe(false);
  });

  it("l'enveloppe refuse un champ inattendu", () => {
    const r = errorEnvelopeSchema.safeParse({ code: "otp_invalid", message: "x", oops: 1 });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/contracts test`
Attendu : ÉCHEC — module introuvable.

- [ ] **Étape 3 : implémenter**

`packages/contracts/src/errors.ts` :
```ts
import { z } from "zod";

export const ERROR_CODES = [
  // requête
  "validation_failed", "not_found", "conflict", "rate_limited", "internal_error",
  // session
  "unauthorized", "forbidden", "session_expired", "refresh_reused",
  // code à usage unique
  "otp_invalid", "otp_expired", "otp_too_many_attempts", "otp_rate_limited",
  // compte
  "username_taken", "username_invalid", "device_limit_reached",
  "account_suspended", "account_pending_deletion",
  // identité externe
  "federated_token_invalid", "federated_already_linked",
  // liste d'attente
  "waitlist_email_invalid",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const errorEnvelopeSchema = z
  .object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  })
  .strict();

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
```

`packages/contracts/src/index.ts` : `export * from "./errors.js";`

`packages/contracts/package.json` : même forme que `@lehno/tokens`, nom `@lehno/contracts`, avec `"zod": "^3.23.0"` en dépendance.

`.strict()` compte : la spécification technique veut qu'un champ inattendu fasse échouer la requête plutôt que de passer inaperçu.

- [ ] **Étape 4 : le voir passer**

Lancer : `pnpm --filter @lehno/contracts test`
Attendu : SUCCÈS, 4 tests.

- [ ] **Étape 5 : commit**

```bash
git add packages/contracts
git commit -m "contrat: codes d'erreur stables et enveloppe stricte"
```

---

### Tâche 4 : Catalogues de langue, couvrant chaque code d'erreur

**Fichiers :**
- Créer : `packages/i18n/package.json`, `packages/i18n/src/fr.ts`, `packages/i18n/src/en.ts`, `packages/i18n/src/index.ts`
- Test : `packages/i18n/src/index.test.ts`

**Interfaces :**
- Produit : `catalogues` (`{ fr, en }`), `type Locale = "fr" | "en"`, `translateError(code, locale): string`, `LOCALES`.
- Consommé par : les tâches 17 et 18, et l'application mobile en phase 1.

- [ ] **Étape 1 : écrire le test qui échoue**

`packages/i18n/src/index.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@lehno/contracts";
import { catalogues, translateError, LOCALES } from "./index.js";

describe("catalogues", () => {
  // Le vrai risque n'est pas la faute de frappe : c'est le code ajouté au serveur
  // que personne ne traduit, et que l'utilisateur lit brut.
  it.each(LOCALES)("%s traduit chaque code d'erreur", (locale) => {
    const manquants = ERROR_CODES.filter((c) => !catalogues[locale].errors[c]);
    expect(manquants).toEqual([]);
  });

  it("les deux catalogues portent exactement les mêmes clés", () => {
    const clefs = (o: object): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        v && typeof v === "object" ? clefs(v).map((s) => `${k}.${s}`) : [k],
      );
    expect(clefs(catalogues.fr).sort()).toEqual(clefs(catalogues.en).sort());
  });

  it("translateError rend la phrase de la langue demandée", () => {
    expect(translateError("otp_expired", "fr")).toBe("Ce code a expiré. Demandez-en un nouveau.");
    expect(translateError("otp_expired", "en")).toBe("That code has expired. Ask for a new one.");
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/i18n test`
Attendu : ÉCHEC — module introuvable.

- [ ] **Étape 3 : implémenter**

`packages/i18n/src/fr.ts` :
```ts
export const fr = {
  errors: {
    validation_failed: "Cette demande n'est pas valide.",
    not_found: "Introuvable.",
    conflict: "Cette opération entre en conflit avec l'état actuel.",
    rate_limited: "Trop de tentatives. Réessayez dans un moment.",
    internal_error: "Quelque chose s'est mal passé de notre côté.",
    unauthorized: "Vous devez être connecté.",
    forbidden: "Vous n'avez pas accès à cela.",
    session_expired: "Votre session a expiré. Reconnectez-vous.",
    refresh_reused: "Votre session a été fermée par sécurité. Reconnectez-vous.",
    otp_invalid: "Ce code ne correspond pas.",
    otp_expired: "Ce code a expiré. Demandez-en un nouveau.",
    otp_too_many_attempts: "Trop d'essais. Demandez un nouveau code.",
    otp_rate_limited: "Vous avez demandé plusieurs codes. Patientez un instant.",
    username_taken: "Ce pseudo est déjà pris.",
    username_invalid: "Ce pseudo ne convient pas.",
    device_limit_reached: "Trop de comptes créés depuis cet appareil.",
    account_suspended: "Ce compte est suspendu.",
    account_pending_deletion: "Ce compte est en cours de suppression.",
    federated_token_invalid: "La connexion avec ce service n'a pas abouti.",
    federated_already_linked: "Ce compte est déjà rattaché ailleurs.",
    waitlist_email_invalid: "Cette adresse ne semble pas valide.",
  },
} as const;
```

`packages/i18n/src/en.ts` : même structure, écrite en anglais — pas traduite mot à mot. `otp_expired` doit valoir exactement `"That code has expired. Ask for a new one."` pour satisfaire le test.

`packages/i18n/src/index.ts` :
```ts
import type { ErrorCode } from "@lehno/contracts";
import { fr } from "./fr.js";
import { en } from "./en.js";

export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const catalogues = { fr, en } as const;

export function translateError(code: ErrorCode, locale: Locale): string {
  return catalogues[locale].errors[code];
}
```

- [ ] **Étape 4 : le voir passer**

Lancer : `pnpm --filter @lehno/i18n test`
Attendu : SUCCÈS. Si un code manque, le test le nomme.

- [ ] **Étape 5 : commit**

```bash
git add packages/i18n
git commit -m "langues: catalogues fr/en, avec la couverture des codes vérifiée par test"
```

---

### Tâche 5 : PostgreSQL local, Prisma, et le harnais de test

**Fichiers :**
- Créer : `infra/docker/compose.yml`, `.env.example`
- Créer : `prisma/schema.prisma` (amorce), `apps/api/package.json`
- Créer : `apps/api/test/db.ts` (harnais Testcontainers), `apps/api/vitest.config.ts`
- Test : `apps/api/test/db.test.ts`

**Interfaces :**
- Produit : `withDatabase()` qui lève une base éphémère, y applique les migrations et rend un `PrismaClient` ; `resetDatabase(prisma)` qui vide les tables entre deux tests.
- Consommé par : toutes les tâches serveur qui suivent.

Pourquoi une vraie base plutôt qu'une simulation : ce qui casse ici vit dans les contraintes, les index partiels et les cascades. Une base simulée les ignore toutes.

- [ ] **Étape 1 : la base locale et les variables d'environnement**

`infra/docker/compose.yml` :
```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: lehno
      POSTGRES_PASSWORD: lehno
      POSTGRES_DB: lehno
    ports: ["5432:5432"]
    volumes: ["lehno-db:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U lehno"]
      interval: 5s
      retries: 10
volumes:
  lehno-db:
```

`.env.example` :
```
DATABASE_URL=postgresql://lehno:lehno@localhost:5432/lehno
OTP_PEPPER=
JWT_SECRET=
MAILGUN_API_KEY=
MAILGUN_DOMAIN=
SENTRY_DSN=
```

`OTP_PEPPER` et `JWT_SECRET` se génèrent par `openssl rand -base64 32`. Ils restent vides dans l'exemple : un secret par défaut est un secret partagé.

- [ ] **Étape 2 : écrire le test qui échoue**

`apps/api/test/db.test.ts` :
```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withDatabase, type TestDb } from "./db.js";

describe("harnais de base", () => {
  let db: TestDb;
  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });

  it("lève une base et y applique les migrations", async () => {
    const rows = await db.prisma.$queryRaw<{ table_name: string }[]>`
      select table_name from information_schema.tables where table_schema = 'public'
    `;
    expect(rows.length).toBeGreaterThan(0);
  });

  it("l'extension citext est présente", async () => {
    const rows = await db.prisma.$queryRaw<{ extname: string }[]>`
      select extname from pg_extension where extname = 'citext'
    `;
    expect(rows).toHaveLength(1);
  });
});
```

- [ ] **Étape 3 : le voir échouer**

Lancer : `pnpm --filter @lehno/api test test/db.test.ts`
Attendu : ÉCHEC — `./db.js` introuvable.

- [ ] **Étape 4 : implémenter le harnais**

`apps/api/test/db.ts` :
```ts
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "node:child_process";

export type TestDb = { prisma: PrismaClient; url: string; close: () => Promise<void> };

export async function withDatabase(): Promise<TestDb> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer("postgres:16-alpine").start();
  const url = container.getConnectionUri();
  // migrate deploy plutôt que db push : on veut tester les migrations réelles,
  // y compris le SQL écrit à la main que Prisma n'exprime pas.
  execFileSync("pnpm", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  return {
    prisma,
    url,
    close: async () => { await prisma.$disconnect(); await container.stop(); },
  };
}

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    select tablename from pg_tables
    where schemaname = 'public' and tablename not like '_prisma%'
  `;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`truncate table ${list} restart identity cascade`);
}
```

`apps/api/vitest.config.ts` :
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 120_000, // lever un conteneur prend du temps la première fois
    pool: "forks",
    poolOptions: { forks: { singleFork: true } }, // une seule base partagée
  },
});
```

`apps/api/package.json` porte `@prisma/client`, `prisma`, `@testcontainers/postgresql`, `vitest`.

- [ ] **Étape 5 : la migration d'amorce**

`prisma/schema.prisma` :
```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql", url = env("DATABASE_URL") }
```

Puis créer la migration d'extensions à la main :
```bash
mkdir -p prisma/migrations/00000000000000_extensions
cat > prisma/migrations/00000000000000_extensions/migration.sql <<'SQL'
create extension if not exists citext;
create extension if not exists pgcrypto;
SQL
```

`pgcrypto` fournit `gen_random_uuid()`, `citext` l'unicité insensible à la casse des adresses et des pseudos.

- [ ] **Étape 6 : le voir passer**

```bash
docker compose -f infra/docker/compose.yml up -d
pnpm --filter @lehno/api exec prisma migrate deploy
pnpm --filter @lehno/api test test/db.test.ts
```
Attendu : SUCCÈS, 2 tests.

- [ ] **Étape 7 : commit**

```bash
git add infra prisma apps/api .env.example
git commit -m "base: PostgreSQL local, extensions, et harnais Testcontainers"
```

---

### Tâche 6 : Schéma — identité et compte

**Fichiers :**
- Modifier : `prisma/schema.prisma`
- Créer : `prisma/migrations/<horodatage>_identity/migration.sql` (complété à la main)
- Test : `apps/api/test/schema-identity.test.ts`

**Interfaces :**
- Produit : les modèles `User`, `OtpCode`, `FederatedIdentity`, `RefreshToken`, `DeviceSignup`, `LoginActivity`, `WaitlistSignup` et leurs énums.

- [ ] **Étape 1 : écrire le test qui échoue**

`apps/api/test/schema-identity.test.ts` :
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";

describe("schéma — identité", () => {
  let db: TestDb;
  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  beforeEach(async () => { await resetDatabase(db.prisma); });
  afterAll(async () => { await db.close(); });

  const user = (over: Record<string, unknown> = {}) => ({
    email: "awa@example.com", username: "awa", referralCode: "AWA123", ...over,
  });

  it("l'adresse est unique sans égard à la casse", async () => {
    await db.prisma.user.create({ data: user() });
    await expect(
      db.prisma.user.create({ data: user({ email: "AWA@EXAMPLE.COM", username: "awa2", referralCode: "AWA124" }) }),
    ).rejects.toThrow();
  });

  it("le pseudo est unique sans égard à la casse", async () => {
    await db.prisma.user.create({ data: user() });
    await expect(
      db.prisma.user.create({ data: user({ email: "b@example.com", username: "AWA", referralCode: "B1" }) }),
    ).rejects.toThrow();
  });

  it("le thème vaut « system » par défaut et la langue « fr »", async () => {
    const u = await db.prisma.user.create({ data: user() });
    expect(u.theme).toBe("system");
    expect(u.uiLanguage).toBe("fr");
    expect(u.sendHour).toBe(9);
  });

  it("une identité externe ne pointe que vers un compte", async () => {
    const a = await db.prisma.user.create({ data: user() });
    const b = await db.prisma.user.create({ data: user({ email: "b@example.com", username: "b", referralCode: "B1" }) });
    const identity = { provider: "google" as const, providerUserId: "g-1" };
    await db.prisma.federatedIdentity.create({ data: { ...identity, userId: a.id } });
    await expect(
      db.prisma.federatedIdentity.create({ data: { ...identity, userId: b.id } }),
    ).rejects.toThrow();
  });

  it("supprimer un compte emporte ses jetons de rafraîchissement", async () => {
    const u = await db.prisma.user.create({ data: user() });
    await db.prisma.refreshToken.create({
      data: { userId: u.id, familyId: crypto.randomUUID(), tokenHash: "x".repeat(64),
              expiresAt: new Date(Date.now() + 86_400_000) },
    });
    await db.prisma.user.delete({ where: { id: u.id } });
    expect(await db.prisma.refreshToken.count()).toBe(0);
  });

  it("la liste d'attente refuse deux fois la même adresse", async () => {
    await db.prisma.waitlistSignup.create({ data: { email: "x@example.com", locale: "fr" } });
    await expect(
      db.prisma.waitlistSignup.create({ data: { email: "X@EXAMPLE.COM", locale: "en" } }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/api test test/schema-identity.test.ts`
Attendu : ÉCHEC — `db.prisma.user` n'existe pas.

- [ ] **Étape 3 : écrire le schéma**

Ajouter à `prisma/schema.prisma` :
```prisma
enum UserStatus       { active suspended pending_deletion deleted }
enum UiTheme          { system light dark }
enum DigestFrequency  { monthly weekly never }
enum OtpReason        { email_verification login }
enum IdentityProvider { google apple }
enum LoginResult      { success failure }

model User {
  id                  String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email               String    @unique
  emailVerified       Boolean   @default(false) @map("email_verified")
  username            String    @unique
  displayName         String?   @map("display_name")
  avatarUrl           String?   @map("avatar_url")
  referralCode        String    @unique @map("referral_code") @db.VarChar(16)
  referredBy          String?   @map("referred_by") @db.Uuid
  status              UserStatus @default(active)
  deletionRequestedAt DateTime? @map("deletion_requested_at") @db.Timestamptz
  deletionReason      String?   @map("deletion_reason")
  uiLanguage          String    @default("fr") @map("ui_language") @db.VarChar(10)
  theme               UiTheme   @default(system)
  timezone            String    @default("UTC") @db.VarChar(64)
  sendHour            Int       @default(9) @map("send_hour") @db.SmallInt
  digestFrequency     DigestFrequency @default(monthly) @map("digest_frequency")
  reminderLeadDays    Int?      @map("reminder_lead_days")
  createdAt           DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt           DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  otpCodes      OtpCode[]
  identities    FederatedIdentity[]
  refreshTokens RefreshToken[]
  deviceSignups DeviceSignup[]

  @@map("user")
}

model OtpCode {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId      String?   @map("user_id") @db.Uuid
  targetEmail String    @map("target_email")
  codeHash    String    @map("code_hash")
  reason      OtpReason
  expiresAt   DateTime  @map("expires_at") @db.Timestamptz
  consumedAt  DateTime? @map("consumed_at") @db.Timestamptz
  attempts    Int       @default(0)
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz

  user User? @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([targetEmail, reason])
  @@map("otp_code")
}

model FederatedIdentity {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId         String   @map("user_id") @db.Uuid
  provider       IdentityProvider
  providerUserId String   @map("provider_user_id")
  emailAtLink    String?  @map("email_at_link")
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz
  lastUsedAt     DateTime? @map("last_used_at") @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerUserId])
  @@unique([userId, provider])
  @@map("federated_identity")
}

model RefreshToken {
  id         String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId     String    @map("user_id") @db.Uuid
  familyId   String    @map("family_id") @db.Uuid
  tokenHash  String    @unique @map("token_hash")
  parentId   String?   @map("parent_id") @db.Uuid
  expiresAt  DateTime  @map("expires_at") @db.Timestamptz
  consumedAt DateTime? @map("consumed_at") @db.Timestamptz
  revokedAt  DateTime? @map("revoked_at") @db.Timestamptz
  userAgent  String?   @map("user_agent")
  createdAt  DateTime  @default(now()) @map("created_at") @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, revokedAt])
  @@index([familyId])
  @@map("refresh_token")
}

model DeviceSignup {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  deviceId  String   @map("device_id") @db.VarChar(128)
  userId    String   @map("user_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([deviceId])
  @@map("device_signup")
}

model LoginActivity {
  id             String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId         String?     @map("user_id") @db.Uuid
  attemptedEmail String?     @map("attempted_email")
  result         LoginResult
  userAgent      String?     @map("user_agent")
  geoApprox      String?     @map("geo_approx")
  createdAt      DateTime    @default(now()) @map("created_at") @db.Timestamptz

  @@index([userId, createdAt])
  @@map("login_activity")
}

model WaitlistSignup {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email     String   @unique
  locale    String?  @db.VarChar(10)
  source    String?  @db.VarChar(64)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

  @@map("waitlist_signup")
}
```

- [ ] **Étape 4 : générer la migration, puis compléter le SQL à la main**

```bash
pnpm --filter @lehno/api exec prisma migrate dev --name identity --create-only
```

Ajouter **à la fin** du `migration.sql` produit — Prisma n'exprime ni `citext` ni `inet` :
```sql
-- Unicité insensible à la casse des adresses et des pseudos
alter table "user"            alter column "email"           type citext;
alter table "user"            alter column "username"        type citext;
alter table "otp_code"        alter column "target_email"    type citext;
alter table "federated_identity" alter column "email_at_link" type citext;
alter table "login_activity"  alter column "attempted_email" type citext;
alter table "waitlist_signup" alter column "email"           type citext;

-- Adresses IP : conservées pour investigation, jamais lues par le client Prisma
alter table "device_signup"   add column "ip" inet;
alter table "login_activity"  add column "ip" inet;
alter table "refresh_token"   add column "ip" inet;
```

Puis appliquer : `pnpm --filter @lehno/api exec prisma migrate deploy`

- [ ] **Étape 5 : le voir passer**

Lancer : `pnpm --filter @lehno/api test test/schema-identity.test.ts`
Attendu : SUCCÈS, 6 tests. Les deux premiers échoueraient sans les `alter column … type citext`.

- [ ] **Étape 6 : commit**

```bash
git add prisma apps/api/test
git commit -m "schéma: identité et compte, avec citext et inet en SQL écrit à la main"
```

---

### Tâche 7 : Schéma — fiches, événements, échéances, notes, souhaits

**Fichiers :**
- Modifier : `prisma/schema.prisma`
- Créer : `prisma/migrations/<horodatage>_content/migration.sql` (complété à la main)
- Test : `apps/api/test/schema-content.test.ts`

**Interfaces :**
- Produit : `Person`, `Event`, `Schedule`, `EventOccurrence`, `Note`, `Category`, `NoteCategory`, `WishlistItem` et leurs énums.

Le modèle est **générique** : l'anniversaire n'est pas un type d'entité, c'est une configuration d'`Event` (`kind = birthday`, récurrence annuelle). La spécialisation relève de l'interface, jamais du schéma.

- [ ] **Étape 1 : écrire le test qui échoue**

`apps/api/test/schema-content.test.ts` :
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";

describe("schéma — contenu", () => {
  let db: TestDb;
  let userId: string;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa", referralCode: "AWA1" },
    });
    userId = u.id;
  });

  it("un compte n'a qu'une seule fiche de soi", async () => {
    await db.prisma.person.create({ data: { userId, displayName: "Awa", isSelf: true } });
    await expect(
      db.prisma.person.create({ data: { userId, displayName: "Awa bis", isSelf: true } }),
    ).rejects.toThrow();
    // mais autant de fiches ordinaires qu'on veut
    await db.prisma.person.create({ data: { userId, displayName: "Karim" } });
    expect(await db.prisma.person.count()).toBe(2);
  });

  it("un schedule récurrent exige unité et intervalle", async () => {
    const p = await db.prisma.person.create({ data: { userId, displayName: "Karim" } });
    const e = await db.prisma.event.create({
      data: { personId: p.id, kind: "birthday", referenceDate: new Date("1990-08-24") },
    });
    await expect(
      db.prisma.schedule.create({ data: { eventId: e.id, type: "recurrent" } }),
    ).rejects.toThrow();
    const ok = await db.prisma.schedule.create({
      data: { eventId: e.id, type: "recurrent", unit: "year", interval: 1 },
    });
    expect(ok.interval).toBe(1);
  });

  it("un schedule offset exige unité et quantité", async () => {
    const p = await db.prisma.person.create({ data: { userId, displayName: "Karim" } });
    const e = await db.prisma.event.create({
      data: { personId: p.id, referenceDate: new Date("2024-03-14") },
    });
    await expect(
      db.prisma.schedule.create({ data: { eventId: e.id, type: "offset" } }),
    ).rejects.toThrow();
  });

  it("une occurrence est unique pour un événement et une date", async () => {
    const p = await db.prisma.person.create({ data: { userId, displayName: "Karim" } });
    const e = await db.prisma.event.create({
      data: { personId: p.id, kind: "birthday", referenceDate: new Date("1990-08-24") },
    });
    const row = { eventId: e.id, userId, occurrenceDate: new Date("2026-08-24"), occurrenceYear: 2026 };
    await db.prisma.eventOccurrence.create({ data: row });
    await expect(db.prisma.eventOccurrence.create({ data: row })).rejects.toThrow();
  });

  it("une note relève de deux catégories, et supprimer la fiche l'emporte", async () => {
    const p = await db.prisma.person.create({ data: { userId, displayName: "Karim" } });
    const n = await db.prisma.note.create({ data: { personId: p.id, content: "il traverse une période dure" } });
    const cats = await db.prisma.category.findMany({ where: { code: { in: ["challenges", "encouragements"] } } });
    expect(cats).toHaveLength(2); // semées par la migration
    await db.prisma.noteCategory.createMany({
      data: cats.map((c) => ({ noteId: n.id, categoryId: c.id })),
    });
    expect(await db.prisma.noteCategory.count()).toBe(2);
    await db.prisma.person.delete({ where: { id: p.id } });
    expect(await db.prisma.note.count()).toBe(0);
    expect(await db.prisma.noteCategory.count()).toBe(0);
  });

  it("un souhait porte une photo et des précisions", async () => {
    const p = await db.prisma.person.create({ data: { userId, displayName: "Karim" } });
    const e = await db.prisma.event.create({
      data: { personId: p.id, kind: "birthday", referenceDate: new Date("1990-08-24") },
    });
    const o = await db.prisma.eventOccurrence.create({
      data: { eventId: e.id, userId, occurrenceDate: new Date("2026-08-24"), occurrenceYear: 2026 },
    });
    const w = await db.prisma.wishlistItem.create({
      data: { eventOccurrenceId: o.id, label: "moulin à café manuel", origin: "owner",
              imageUrl: "https://media.example/x.jpg", details: "manuel, pas électrique" },
    });
    expect(w.status).toBe("available");
    expect(w.isPublic).toBe(false);
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/api test test/schema-content.test.ts`
Attendu : ÉCHEC — `db.prisma.person` n'existe pas.

- [ ] **Étape 3 : écrire le schéma**

```prisma
enum PersonRegister  { familier amical formel }
enum EventKind       { birthday other }
enum EventNature     { happy sensitive }
enum ScheduleType    { recurrent offset }
enum ScheduleUnit    { day week month quarter year }
enum OffsetUnit      { day month }
enum OccurrenceStatus{ upcoming collecting closed }
enum ContentOrigin   { owner collected }
enum CategoryKind    { ponctuelle durable }
enum AssignmentSource{ auto user }
enum WishlistStatus  { available reserved fulfilled }
enum WishlistOrigin  { collected accepted_idea owner }

model Person {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId        String   @map("user_id") @db.Uuid
  displayName   String   @map("display_name")
  isSelf        Boolean  @default(false) @map("is_self")
  register      PersonRegister?
  language      String?  @db.VarChar(10)
  relationHint  String?  @map("relation_hint")
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt     DateTime @updatedAt @map("updated_at") @db.Timestamptz

  events Event[]
  notes  Note[]

  @@index([userId])
  @@map("person")
}

model Event {
  id            String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  personId      String      @map("person_id") @db.Uuid
  authorUserId  String?     @map("author_user_id") @db.Uuid
  label         String?
  kind          EventKind   @default(other)
  eventNature   EventNature @default(happy) @map("event_nature")
  referenceDate DateTime    @map("reference_date") @db.Date
  yearKnown     Boolean     @default(true) @map("year_known")
  createdAt     DateTime    @default(now()) @map("created_at") @db.Timestamptz
  updatedAt     DateTime    @updatedAt @map("updated_at") @db.Timestamptz

  person      Person            @relation(fields: [personId], references: [id], onDelete: Cascade)
  schedules   Schedule[]
  occurrences EventOccurrence[]

  @@index([personId])
  @@map("event")
}

model Schedule {
  id           String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  eventId      String        @map("event_id") @db.Uuid
  type         ScheduleType
  unit         ScheduleUnit?
  interval     Int?
  offsetUnit   OffsetUnit?   @map("offset_unit")
  offsetAmount Int?          @map("offset_amount")
  leadTimeDays Int?          @map("lead_time_days")
  createdAt    DateTime      @default(now()) @map("created_at") @db.Timestamptz

  event Event @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@index([eventId])
  @@map("schedule")
}

model EventOccurrence {
  id             String            @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  eventId        String            @map("event_id") @db.Uuid
  userId         String            @map("user_id") @db.Uuid
  occurrenceDate DateTime          @map("occurrence_date") @db.Date
  occurrenceYear Int?              @map("occurrence_year")
  status         OccurrenceStatus  @default(upcoming)
  createdAt      DateTime          @default(now()) @map("created_at") @db.Timestamptz

  event Event          @relation(fields: [eventId], references: [id], onDelete: Cascade)
  notes Note[]
  wishes WishlistItem[]

  @@unique([eventId, occurrenceDate])
  @@index([userId, occurrenceDate])
  @@map("event_occurrence")
}

model Note {
  id                String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  personId          String        @map("person_id") @db.Uuid
  authorUserId      String?       @map("author_user_id") @db.Uuid
  eventId           String?       @map("event_id") @db.Uuid
  eventOccurrenceId String?       @map("event_occurrence_id") @db.Uuid
  content           String
  origin            ContentOrigin @default(owner)
  createdAt         DateTime      @default(now()) @map("created_at") @db.Timestamptz

  person     Person           @relation(fields: [personId], references: [id], onDelete: Cascade)
  occurrence EventOccurrence? @relation(fields: [eventOccurrenceId], references: [id], onDelete: Cascade)
  categories NoteCategory[]

  @@index([personId, createdAt])
  @@map("note")
}

model Category {
  id           String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  code         String       @unique @db.VarChar(40)
  kind         CategoryKind
  isConstraint Boolean      @default(false) @map("is_constraint")

  notes NoteCategory[]

  @@map("category")
}

model NoteCategory {
  noteId     String           @map("note_id") @db.Uuid
  categoryId String           @map("category_id") @db.Uuid
  assignedBy AssignmentSource @default(auto) @map("assigned_by")

  note     Note     @relation(fields: [noteId], references: [id], onDelete: Cascade)
  category Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)

  @@id([noteId, categoryId])
  @@map("note_category")
}

model WishlistItem {
  id                String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  eventOccurrenceId String         @map("event_occurrence_id") @db.Uuid
  authorUserId      String?        @map("author_user_id") @db.Uuid
  label             String
  imageUrl          String?        @map("image_url")
  details           String?
  link              String?
  price             Decimal?       @db.Decimal(12, 2)
  currency          String?        @db.VarChar(3)
  status            WishlistStatus @default(available)
  origin            WishlistOrigin
  isPublic          Boolean        @default(false) @map("is_public")
  createdAt         DateTime       @default(now()) @map("created_at") @db.Timestamptz
  updatedAt         DateTime       @updatedAt @map("updated_at") @db.Timestamptz

  occurrence EventOccurrence @relation(fields: [eventOccurrenceId], references: [id], onDelete: Cascade)

  @@index([eventOccurrenceId])
  @@map("wishlist_item")
}
```

- [ ] **Étape 4 : générer la migration et compléter le SQL**

```bash
pnpm --filter @lehno/api exec prisma migrate dev --name content --create-only
```

Ajouter à la fin du `migration.sql` :
```sql
-- Une seule fiche de soi par compte. Un index unique ordinaire l'interdirait
-- pour toutes les fiches ; le partiel ne contraint que celles marquées.
create unique index "person_one_self_per_user"
  on "person" ("user_id") where "is_self";

-- Cohérence d'un schedule : récurrent ⇒ unité + intervalle, offset ⇒ unité + quantité
alter table "schedule" add constraint "schedule_shape" check (
  (type = 'recurrent' and unit is not null and interval is not null and interval >= 1)
  or
  (type = 'offset' and offset_unit is not null and offset_amount is not null)
);

-- Le socle des catégories, fixé par le système et non éditable par l'utilisateur
insert into "category" ("id", "code", "kind", "is_constraint") values
  (gen_random_uuid(), 'gift_ideas',     'ponctuelle', false),
  (gen_random_uuid(), 'message_ideas',  'ponctuelle', false),
  (gen_random_uuid(), 'facts',          'ponctuelle', false),
  (gen_random_uuid(), 'encouragements', 'ponctuelle', false),
  (gen_random_uuid(), 'challenges',     'ponctuelle', false),
  (gen_random_uuid(), 'interests',      'durable',    false),
  (gen_random_uuid(), 'dislikes_nogo',  'durable',    true);
```

`dislikes_nogo` porte `is_constraint` : son contenu ne s'affiche pas seulement, il **filtre** la génération en phase 3.

- [ ] **Étape 5 : le voir passer**

```bash
pnpm --filter @lehno/api exec prisma migrate deploy
pnpm --filter @lehno/api test test/schema-content.test.ts
```
Attendu : SUCCÈS, 6 tests.

- [ ] **Étape 6 : commit**

```bash
git add prisma apps/api/test
git commit -m "schéma: fiches, événements, échéances, notes et souhaits"
```

---

### Tâche 8 : Schéma — notifications, appareils, paramètres

**Fichiers :**
- Modifier : `prisma/schema.prisma`
- Créer : `prisma/migrations/<horodatage>_notifications/migration.sql`
- Test : `apps/api/test/schema-notifications.test.ts`

**Interfaces :**
- Produit : `Notification`, `NotificationPreference`, `Device`, `SystemParameter`, `SupportRequest`, `Feedback`, `DataExportRequest`.

- [ ] **Étape 1 : écrire le test qui échoue**

`apps/api/test/schema-notifications.test.ts` :
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";

describe("schéma — notifications", () => {
  let db: TestDb;
  let userId: string;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa", referralCode: "AWA1" },
    });
    userId = u.id;
  });

  it("la clé d'anti-doublon empêche le même envoi deux fois", async () => {
    const row = {
      userId, type: "event_reminder" as const, channel: "push" as const,
      titleKey: "reminder.title", dedupeKey: "event_reminder:occ-1:7",
    };
    await db.prisma.notification.create({ data: row });
    await expect(db.prisma.notification.create({ data: row })).rejects.toThrow();
  });

  it("une préférence est unique par compte et par nature", async () => {
    const row = { userId, type: "digest" as const };
    await db.prisma.notificationPreference.create({ data: row });
    await expect(db.prisma.notificationPreference.create({ data: row })).rejects.toThrow();
  });

  it("les deux canaux sont actifs par défaut, et coupables tous les deux", async () => {
    const p = await db.prisma.notificationPreference.create({ data: { userId, type: "digest" } });
    expect(p.pushEnabled).toBe(true);
    expect(p.emailEnabled).toBe(true);
    const off = await db.prisma.notificationPreference.update({
      where: { id: p.id }, data: { pushEnabled: false, emailEnabled: false },
    });
    expect(off.pushEnabled).toBe(false);
  });

  it("réenregistrer le même jeton d'appareil ne crée pas de doublon", async () => {
    const row = { userId, pushToken: "tok-1", platform: "ios" as const };
    await db.prisma.device.create({ data: row });
    await expect(db.prisma.device.create({ data: row })).rejects.toThrow();
  });

  it("les paramètres du socle sont semés", async () => {
    const keys = await db.prisma.systemParameter.findMany({ select: { key: true } });
    expect(keys.map((k) => k.key)).toEqual(
      expect.arrayContaining([
        "reminder_lead_days_default", "wish_window_lead_days",
        "wish_window_trail_days", "max_accounts_per_device", "account_grace_period_days",
      ]),
    );
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/api test test/schema-notifications.test.ts`
Attendu : ÉCHEC.

- [ ] **Étape 3 : écrire le schéma**

```prisma
enum NotificationType {
  event_reminder event_day_of digest contribution_received wish_received
  enrichment_nudge_global enrichment_nudge_person generation_ready
  payment_succeeded payment_failed credits_received login_code security account
}
enum NotificationChannel { email push in_app }
enum NotificationStatus  { pending sent read failed }
enum DevicePlatform      { ios android }
enum ParamValueType      { number money duration boolean string }
enum SupportRequestStatus{ open answered closed }
enum DataExportStatus    { pending ready failed expired }

model Notification {
  id                String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId            String              @map("user_id") @db.Uuid
  type              NotificationType
  eventOccurrenceId String?             @map("event_occurrence_id") @db.Uuid
  personId          String?             @map("person_id") @db.Uuid
  channel           NotificationChannel
  titleKey          String              @map("title_key") @db.VarChar(64)
  bodyParams        Json?               @map("body_params")
  targetRoute       String?             @map("target_route")
  dedupeKey         String?             @unique @map("dedupe_key")
  scheduledFor      DateTime?           @map("scheduled_for") @db.Timestamptz
  sentAt            DateTime?           @map("sent_at") @db.Timestamptz
  readAt            DateTime?           @map("read_at") @db.Timestamptz
  status            NotificationStatus  @default(pending)
  createdAt         DateTime            @default(now()) @map("created_at") @db.Timestamptz

  @@index([userId, readAt])
  @@index([status, scheduledFor])
  @@map("notification")
}

model NotificationPreference {
  id           String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId       String           @map("user_id") @db.Uuid
  type         NotificationType
  pushEnabled  Boolean          @default(true) @map("push_enabled")
  emailEnabled Boolean          @default(true) @map("email_enabled")
  createdAt    DateTime         @default(now()) @map("created_at") @db.Timestamptz
  updatedAt    DateTime         @updatedAt @map("updated_at") @db.Timestamptz

  @@unique([userId, type])
  @@map("notification_preference")
}

model Device {
  id         String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId     String         @map("user_id") @db.Uuid
  pushToken  String         @map("push_token")
  platform   DevicePlatform
  appVersion String?        @map("app_version") @db.VarChar(20)
  isActive   Boolean        @default(true) @map("is_active")
  lastSeenAt DateTime?      @map("last_seen_at") @db.Timestamptz
  createdAt  DateTime       @default(now()) @map("created_at") @db.Timestamptz

  @@unique([userId, pushToken])
  @@map("device")
}

model SystemParameter {
  id          String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  key         String         @unique @db.VarChar(64)
  value       String
  valueType   ParamValueType @map("value_type")
  description String?
  updatedAt   DateTime       @updatedAt @map("updated_at") @db.Timestamptz

  @@map("system_parameter")
}

model SupportRequest {
  id         String               @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId     String               @map("user_id") @db.Uuid
  subject    String?
  body       String
  appVersion String?              @map("app_version") @db.VarChar(20)
  platform   DevicePlatform?
  status     SupportRequestStatus @default(open)
  createdAt  DateTime             @default(now()) @map("created_at") @db.Timestamptz

  @@index([userId])
  @@map("support_request")
}

model Feedback {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId     String   @map("user_id") @db.Uuid
  rating     Int?     @db.SmallInt
  body       String?
  appVersion String?  @map("app_version") @db.VarChar(20)
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz

  @@index([userId])
  @@map("feedback")
}

model DataExportRequest {
  id          String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId      String           @map("user_id") @db.Uuid
  status      DataExportStatus @default(pending)
  fileUrl     String?          @map("file_url")
  expiresAt   DateTime?        @map("expires_at") @db.Timestamptz
  completedAt DateTime?        @map("completed_at") @db.Timestamptz
  createdAt   DateTime         @default(now()) @map("created_at") @db.Timestamptz

  @@index([userId])
  @@map("data_export_request")
}
```

- [ ] **Étape 4 : générer la migration et semer les paramètres**

```bash
pnpm --filter @lehno/api exec prisma migrate dev --name notifications --create-only
```

Ajouter à la fin du `migration.sql` :
```sql
insert into "system_parameter" ("id", "key", "value", "value_type", "description") values
  (gen_random_uuid(), 'reminder_lead_days_default', '7',  'number', 'Délai d''anticipation par défaut, en jours'),
  (gen_random_uuid(), 'wish_window_lead_days',      '7',  'number', 'Ouverture de la fenêtre de vœux avant la date'),
  (gen_random_uuid(), 'wish_window_trail_days',     '30', 'number', 'Fermeture de la fenêtre de vœux après la date'),
  (gen_random_uuid(), 'max_accounts_per_device',    '3',  'number', 'Plafond de comptes créés depuis un même appareil'),
  (gen_random_uuid(), 'account_grace_period_days',  '30', 'number', 'Délai de grâce avant effacement définitif'),
  (gen_random_uuid(), 'signup_free_credits',        '5',  'number', 'Crédits offerts à l''inscription'),
  (gen_random_uuid(), 'credit_unit_price',          '100','money',  'Prix unitaire du crédit');
```

Ces valeurs vivent en base et non dans le code : l'administration les change sans redéploiement, et `/public/config` les sert à la landing.

- [ ] **Étape 5 : le voir passer**

```bash
pnpm --filter @lehno/api exec prisma migrate deploy
pnpm --filter @lehno/api test test/schema-notifications.test.ts
```
Attendu : SUCCÈS, 5 tests.

- [ ] **Étape 6 : commit**

```bash
git add prisma apps/api/test
git commit -m "schéma: notifications, appareils, paramètres et entités d'assistance"
```

---

### Tâche 9 : Serveur NestJS — amorçage, erreurs, validation, corrélation

**Fichiers :**
- Créer : `apps/api/src/main.ts`, `apps/api/src/app.module.ts`
- Créer : `apps/api/src/common/errors.ts`, `apps/api/src/common/zod-validation.pipe.ts`, `apps/api/src/common/correlation.middleware.ts`
- Créer : `apps/api/src/prisma/prisma.service.ts`
- Test : `apps/api/test/errors.test.ts`

**Interfaces :**
- Produit : `AppError` (`new AppError(code, message, status, details?)`), `AppExceptionFilter`, `ZodValidationPipe`, `PrismaService`, et le préfixe global `/v1`.
- Consommé par : toutes les tâches serveur suivantes.

- [ ] **Étape 1 : écrire le test qui échoue**

`apps/api/test/errors.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { AppError, statusForCode } from "../src/common/errors.js";
import { errorEnvelopeSchema } from "@lehno/contracts";

describe("erreurs", () => {
  it("l'enveloppe rendue est conforme au contrat", () => {
    const e = new AppError("otp_expired", "otp expired");
    expect(errorEnvelopeSchema.safeParse(e.toEnvelope()).success).toBe(true);
  });

  it("chaque code porte le statut que la spécification lui donne", () => {
    expect(statusForCode("validation_failed")).toBe(400);
    expect(statusForCode("unauthorized")).toBe(401);
    expect(statusForCode("forbidden")).toBe(403);
    expect(statusForCode("not_found")).toBe(404);
    expect(statusForCode("conflict")).toBe(409);
    expect(statusForCode("otp_expired")).toBe(422);
    expect(statusForCode("rate_limited")).toBe(429);
    expect(statusForCode("internal_error")).toBe(500);
  });

  it("le message reste destiné au journal, jamais à l'écran", () => {
    const e = new AppError("username_taken", "username already in use");
    expect(e.toEnvelope().message).toBe("username already in use");
    expect(e.toEnvelope().code).toBe("username_taken");
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/api test test/errors.test.ts`
Attendu : ÉCHEC — module introuvable.

- [ ] **Étape 3 : implémenter**

`apps/api/src/common/errors.ts` :
```ts
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import { Catch, HttpException, Logger } from "@nestjs/common";
import type { ErrorCode, ErrorEnvelope } from "@lehno/contracts";

const STATUS: Partial<Record<ErrorCode, number>> = {
  validation_failed: 400, waitlist_email_invalid: 400,
  unauthorized: 401, session_expired: 401, refresh_reused: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409, username_taken: 409, federated_already_linked: 409,
  rate_limited: 429, otp_rate_limited: 429,
  internal_error: 500,
};

// 422 par défaut : une règle métier non satisfaite, requête pourtant bien formée.
export function statusForCode(code: ErrorCode): number {
  return STATUS[code] ?? 422;
}

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) { super(message); }

  get status(): number { return statusForCode(this.code); }

  toEnvelope(): ErrorEnvelope {
    return this.details
      ? { code: this.code, message: this.message, details: this.details }
      : { code: this.code, message: this.message };
  }
}

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("http");

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse();
    if (exception instanceof AppError) {
      this.logger.warn(`${exception.code}: ${exception.message}`);
      res.status(exception.status).json(exception.toEnvelope());
      return;
    }
    if (exception instanceof HttpException) {
      const code: ErrorCode = exception.getStatus() === 404 ? "not_found" : "validation_failed";
      res.status(exception.getStatus()).json({ code, message: exception.message });
      return;
    }
    // Rien de l'incident ne descend au client : il pourrait porter du contenu.
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    res.status(500).json({ code: "internal_error", message: "unexpected error" });
  }
}
```

`apps/api/src/common/zod-validation.pipe.ts` :
```ts
import type { PipeTransform } from "@nestjs/common";
import type { ZodTypeAny } from "zod";
import { AppError } from "./errors.js";

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodTypeAny) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    const details = Object.fromEntries(
      result.error.issues.map((i) => [i.path.join(".") || "(racine)", i.message]),
    );
    throw new AppError("validation_failed", "request failed schema validation", details);
  }
}
```

`apps/api/src/common/correlation.middleware.ts` :
```ts
import { randomUUID } from "node:crypto";
import type { NestMiddleware } from "@nestjs/common";
import { Injectable } from "@nestjs/common";

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void): void {
    const id = req.headers["x-correlation-id"] ?? randomUUID();
    req.correlationId = id;
    res.setHeader("x-correlation-id", id);
    next();
  }
}
```

`apps/api/src/prisma/prisma.service.ts` :
```ts
import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> { await this.$connect(); }
  async onModuleDestroy(): Promise<void> { await this.$disconnect(); }
}
```

`apps/api/src/main.ts` :
```ts
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { AppExceptionFilter } from "./common/errors.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("v1");
  app.useGlobalFilters(new AppExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3000));
}
void bootstrap();
```

- [ ] **Étape 4 : le voir passer**

Lancer : `pnpm --filter @lehno/api test test/errors.test.ts`
Attendu : SUCCÈS, 3 tests.

- [ ] **Étape 5 : commit**

```bash
git add apps/api/src apps/api/test
git commit -m "serveur: amorçage NestJS, enveloppe d'erreur, validation Zod, corrélation"
```

---

### Tâche 10 : Code à usage unique — génération, HMAC, vérification

**Fichiers :**
- Créer : `apps/api/src/auth/otp.service.ts`
- Test : `apps/api/test/otp.test.ts`

**Interfaces :**
- Produit : `OtpService` avec `issue(email, reason): Promise<{ code: string; expiresAt: Date }>`, `verify(email, reason, code): Promise<{ userId: string | null }>`, et `hash(code): string`.
- Consommé par : les tâches 11 et 13.

**Les règles, et pourquoi.** Six chiffres tirés par générateur cryptographique, sans reste de division qui biaiserait la distribution. Conservé en **HMAC-SHA-256 sous clé d'environnement**, au format `v1$<condensé base64>` — le préfixe désigne la clé et rend sa rotation indolore. Comparaison en **temps constant**. Dix minutes de vie, cinq essais puis le code est brûlé. Aucune fonction de hachage lente : elle ne défendrait rien ici et offrirait un levier de saturation sur un point d'entrée ouvert sans compte.

- [ ] **Étape 1 : écrire le test qui échoue**

`apps/api/test/otp.test.ts` :
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { OtpService } from "../src/auth/otp.service.js";
import { AppError } from "../src/common/errors.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";

describe("code à usage unique", () => {
  let db: TestDb;
  let otp: OtpService;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    otp = new OtpService(db.prisma as never, PEPPER);
  });

  it("émet six chiffres", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    expect(code).toMatch(/^\d{6}$/);
  });

  it("ne conserve jamais le code en clair", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    const row = await db.prisma.otpCode.findFirstOrThrow();
    expect(row.codeHash).not.toContain(code);
    expect(row.codeHash).toMatch(/^v1\$/);
  });

  it("un condensé sans la clé ne permet pas de retrouver le code", () => {
    const autre = new OtpService(db.prisma as never, "dW5lLWF1dHJlLWNsZS1lbnRpZXJlbWVudC1kaWZmZXJlbnRl");
    expect(otp.hash("123456")).not.toBe(autre.hash("123456"));
  });

  it("accepte le bon code une seule fois", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    await expect(otp.verify("awa@example.com", "login", code)).resolves.toEqual({ userId: null });
    await expect(otp.verify("awa@example.com", "login", code)).rejects.toThrow(AppError);
  });

  it("refuse un code expiré", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    // On antidate la ligne plutôt que de déplacer l'horloge : de faux
    // horodateurs perturberaient les minuteries du pilote PostgreSQL,
    // que ce test utilise réellement.
    await db.prisma.otpCode.updateMany({
      where: { targetEmail: "awa@example.com" },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    await expect(otp.verify("awa@example.com", "login", code)).rejects.toMatchObject({ code: "otp_expired" });
  });

  it("brûle le code au cinquième essai raté", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    for (let i = 0; i < 5; i++)
      await expect(otp.verify("awa@example.com", "login", "000000")).rejects.toThrow(AppError);
    // même le bon code ne passe plus
    await expect(otp.verify("awa@example.com", "login", code))
      .rejects.toMatchObject({ code: "otp_too_many_attempts" });
  });

  it("une nouvelle demande invalide la précédente", async () => {
    const first = await otp.issue("awa@example.com", "login");
    await otp.issue("awa@example.com", "login");
    await expect(otp.verify("awa@example.com", "login", first.code)).rejects.toThrow(AppError);
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/api test test/otp.test.ts`
Attendu : ÉCHEC — `otp.service.js` introuvable.

- [ ] **Étape 3 : implémenter**

`apps/api/src/auth/otp.service.ts` :
```ts
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { OtpReason } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";

const TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const KEY_VERSION = "v1";

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject("OTP_PEPPER") private readonly pepper: string,
  ) {
    if (!pepper) throw new Error("OTP_PEPPER manquant : refuser de démarrer plutôt que de hacher sans clé");
  }

  hash(code: string): string {
    const digest = createHmac("sha256", Buffer.from(this.pepper, "base64")).update(code).digest("base64");
    return `${KEY_VERSION}$${digest}`;
  }

  private matches(stored: string, candidate: string): boolean {
    const a = Buffer.from(stored);
    const b = Buffer.from(this.hash(candidate));
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async issue(email: string, reason: OtpReason): Promise<{ code: string; expiresAt: Date }> {
    // Une demande neuve annule les précédentes : sinon plusieurs codes vivent
    // en parallèle et le plafond de tentatives se contourne en en demandant un autre.
    await this.prisma.otpCode.updateMany({
      where: { targetEmail: email, reason, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAt = new Date(Date.now() + TTL_MS);
    await this.prisma.otpCode.create({
      data: { targetEmail: email, reason, codeHash: this.hash(code), expiresAt },
    });
    return { code, expiresAt };
  }

  async verify(email: string, reason: OtpReason, code: string): Promise<{ userId: string | null }> {
    const row = await this.prisma.otpCode.findFirst({
      where: { targetEmail: email, reason, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!row) throw new AppError("otp_invalid", "no pending code for this address");
    if (row.attempts >= MAX_ATTEMPTS)
      throw new AppError("otp_too_many_attempts", "code burnt after too many attempts");
    if (row.expiresAt.getTime() < Date.now())
      throw new AppError("otp_expired", "code expired");

    if (!this.matches(row.codeHash, code)) {
      await this.prisma.otpCode.update({
        where: { id: row.id }, data: { attempts: { increment: 1 } },
      });
      throw new AppError("otp_invalid", "code does not match");
    }
    await this.prisma.otpCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
    return { userId: row.userId };
  }
}
```

- [ ] **Étape 4 : le voir passer**

Lancer : `pnpm --filter @lehno/api test test/otp.test.ts`
Attendu : SUCCÈS, 7 tests.

- [ ] **Étape 5 : commit**

```bash
git add apps/api/src/auth apps/api/test/otp.test.ts
git commit -m "auth: code à usage unique en HMAC-SHA-256 sous clé, comparé en temps constant"
```

---

### Tâche 11 : Sessions — rotation du jeton et détection de rejeu

**Fichiers :**
- Créer : `apps/api/src/auth/token.service.ts`
- Test : `apps/api/test/token.test.ts`

**Interfaces :**
- Produit : `TokenService` avec `issuePair(userId, userAgent?): Promise<Pair>`, `rotate(refreshToken): Promise<Pair>`, `revokeFamily(refreshToken): Promise<void>`, `verifyAccess(jwt): { userId: string }`.
- `type Pair = { accessToken: string; refreshToken: string; expiresIn: number }`.
- Consommé par : les tâches 12, 13 et 14.

**Le mécanisme.** Le jeton d'accès est un JWT court (quinze minutes). Le jeton de rafraîchissement fait 32 octets tirés au hasard, conservé en **SHA-256 nu** — pas de clé, parce que 256 bits ne s'énumèrent pas, à la différence des six chiffres d'un code. Chaque rafraîchissement **consomme** le jeton présenté et en émet un autre dans la même lignée. Présenter un jeton déjà consommé signale un vol : **toute la lignée tombe**.

- [ ] **Étape 1 : écrire le test qui échoue**

`apps/api/test/token.test.ts` :
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { TokenService } from "../src/auth/token.service.js";

const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";

describe("sessions", () => {
  let db: TestDb;
  let tokens: TokenService;
  let userId: string;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    tokens = new TokenService(db.prisma as never, SECRET);
    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa", referralCode: "AWA1" },
    });
    userId = u.id;
  });

  it("le jeton d'accès porte le compte et se vérifie", async () => {
    const pair = await tokens.issuePair(userId);
    expect(tokens.verifyAccess(pair.accessToken)).toEqual({ userId });
  });

  it("le jeton de rafraîchissement n'est jamais stocké en clair", async () => {
    const pair = await tokens.issuePair(userId);
    const row = await db.prisma.refreshToken.findFirstOrThrow();
    expect(row.tokenHash).not.toBe(pair.refreshToken);
    expect(row.tokenHash).toHaveLength(64); // SHA-256 en hexadécimal
  });

  it("la rotation rend un jeton neuf et consomme l'ancien", async () => {
    const first = await tokens.issuePair(userId);
    const second = await tokens.rotate(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    const rows = await db.prisma.refreshToken.findMany({ orderBy: { createdAt: "asc" } });
    expect(rows[0]!.consumedAt).not.toBeNull();
    expect(rows[1]!.consumedAt).toBeNull();
    expect(rows[1]!.familyId).toBe(rows[0]!.familyId); // même lignée
  });

  it("rejouer un jeton consommé abat toute la lignée", async () => {
    const first = await tokens.issuePair(userId);
    const second = await tokens.rotate(first.refreshToken);
    // le voleur présente l'ancien
    await expect(tokens.rotate(first.refreshToken)).rejects.toMatchObject({ code: "refresh_reused" });
    // le légitime tombe aussi : on ne sait pas qui est qui
    await expect(tokens.rotate(second.refreshToken)).rejects.toThrow();
    const vivants = await db.prisma.refreshToken.count({ where: { revokedAt: null } });
    expect(vivants).toBe(0);
  });

  it("un jeton inconnu est refusé sans rien révéler", async () => {
    await expect(tokens.rotate("inconnu")).rejects.toMatchObject({ code: "session_expired" });
  });

  it("la déconnexion révoque la lignée côté serveur", async () => {
    const pair = await tokens.issuePair(userId);
    await tokens.revokeFamily(pair.refreshToken);
    await expect(tokens.rotate(pair.refreshToken)).rejects.toThrow();
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/api test test/token.test.ts`
Attendu : ÉCHEC — module introuvable.

- [ ] **Étape 3 : implémenter**

`apps/api/src/auth/token.service.ts` :
```ts
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import jwt from "jsonwebtoken";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";

const ACCESS_TTL_S = 15 * 60;
const REFRESH_TTL_MS = 60 * 24 * 3_600_000; // soixante jours

export type Pair = { accessToken: string; refreshToken: string; expiresIn: number };

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject("JWT_SECRET") private readonly secret: string,
  ) {
    if (!secret) throw new Error("JWT_SECRET manquant");
  }

  // Pas de clé ici, à la différence de l'OTP : 256 bits tirés au hasard
  // ne s'énumèrent pas, donc un condensé nu ne donne aucune prise.
  private hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  verifyAccess(token: string): { userId: string } {
    try {
      const payload = jwt.verify(token, this.secret) as { sub: string };
      return { userId: payload.sub };
    } catch {
      throw new AppError("session_expired", "access token invalid or expired");
    }
  }

  private async mint(userId: string, familyId: string, parentId: string | null, userAgent?: string): Promise<Pair> {
    const refreshToken = randomBytes(32).toString("base64url");
    await this.prisma.refreshToken.create({
      data: {
        userId, familyId, parentId, tokenHash: this.hash(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        userAgent: userAgent ?? null,
      },
    });
    const accessToken = jwt.sign({ sub: userId }, this.secret, { expiresIn: ACCESS_TTL_S });
    return { accessToken, refreshToken, expiresIn: ACCESS_TTL_S };
  }

  issuePair(userId: string, userAgent?: string): Promise<Pair> {
    return this.mint(userId, randomUUID(), null, userAgent);
  }

  async rotate(refreshToken: string, userAgent?: string): Promise<Pair> {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: this.hash(refreshToken) } });
    if (!row || row.revokedAt) throw new AppError("session_expired", "refresh token unknown or revoked");

    if (row.consumedAt) {
      // Un jeton déjà consommé qui revient : quelqu'un le rejoue. On ne peut pas
      // distinguer le voleur du légitime, donc la lignée entière tombe.
      await this.prisma.refreshToken.updateMany({
        where: { familyId: row.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new AppError("refresh_reused", "refresh token replayed; family revoked");
    }
    if (row.expiresAt.getTime() < Date.now())
      throw new AppError("session_expired", "refresh token expired");

    await this.prisma.refreshToken.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
    return this.mint(row.userId, row.familyId, row.id, userAgent);
  }

  async revokeFamily(refreshToken: string): Promise<void> {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: this.hash(refreshToken) } });
    if (!row) return; // se déconnecter d'une session inconnue n'est pas une erreur
    await this.prisma.refreshToken.updateMany({
      where: { familyId: row.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
```

- [ ] **Étape 4 : le voir passer**

Lancer : `pnpm --filter @lehno/api test test/token.test.ts`
Attendu : SUCCÈS, 6 tests.

- [ ] **Étape 5 : commit**

```bash
git add apps/api/src/auth/token.service.ts apps/api/test/token.test.ts
git commit -m "auth: rotation du jeton de rafraîchissement et révocation de lignée au rejeu"
```

---

### Tâche 12 : Points d'entrée d'authentification et création de compte

**Fichiers :**
- Créer : `apps/api/src/auth/auth.controller.ts`, `apps/api/src/auth/auth.service.ts`, `apps/api/src/auth/auth.guard.ts`
- Modifier : `packages/contracts/src/index.ts` (schémas d'authentification)
- Test : `apps/api/test/auth.e2e.test.ts`

**Interfaces :**
- Produit : `POST /v1/auth/otp`, `POST /v1/auth/otp/verify`, `POST /v1/auth/refresh`, `DELETE /v1/auth/session` ; `AuthGuard` qui pose `req.userId`.
- Consommé par : les tâches 14, 15.

**Deux règles de la spécification, faciles à manquer.** La demande de code rend **la même réponse pour une adresse inconnue que pour une connue** — sinon le point d'entrée énumère les comptes. Et le **plafond de comptes par appareil** se vérifie **avant** de créer quoi que ce soit.

- [ ] **Étape 1 : les schémas du contrat**

Ajouter `packages/contracts/src/auth.ts` :
```ts
import { z } from "zod";

export const requestOtpSchema = z.object({ email: z.string().email().max(254) }).strict();

export const verifyOtpSchema = z.object({
  email: z.string().email().max(254),
  code: z.string().regex(/^\d{6}$/),
  deviceId: z.string().min(1).max(128).optional(),
  referralCode: z.string().max(16).optional(),
}).strict();

export const sessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
  isNewAccount: z.boolean(),
}).strict();

export const refreshSchema = z.object({ refreshToken: z.string().min(1) }).strict();

export type Session = z.infer<typeof sessionSchema>;
```

- [ ] **Étape 2 : écrire le test qui échoue**

`apps/api/test/auth.e2e.test.ts` :
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { AuthService } from "../src/auth/auth.service.js";
import { OtpService } from "../src/auth/otp.service.js";
import { TokenService } from "../src/auth/token.service.js";

const PEPPER = "dGVzdC1wZXBwZXItMzItb2N0ZXRzLWV4YWN0ZW1lbnQhIQ==";
const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";

describe("authentification", () => {
  let db: TestDb;
  let auth: AuthService;
  let otp: OtpService;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    otp = new OtpService(db.prisma as never, PEPPER);
    auth = new AuthService(db.prisma as never, otp, new TokenService(db.prisma as never, SECRET));
  });

  it("la première vérification crée le compte", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    const s = await auth.verifyOtp({ email: "awa@example.com", code, deviceId: "dev-1" });
    expect(s.isNewAccount).toBe(true);
    const u = await db.prisma.user.findUniqueOrThrow({ where: { email: "awa@example.com" } });
    expect(u.emailVerified).toBe(true);
    expect(u.username).toMatch(/^u[0-9a-f]{8}$/); // pseudo provisoire, choisi ensuite
  });

  it("la deuxième connexion retrouve le même compte", async () => {
    const a = await otp.issue("awa@example.com", "login");
    await auth.verifyOtp({ email: "awa@example.com", code: a.code, deviceId: "dev-1" });
    const b = await otp.issue("awa@example.com", "login");
    const s = await auth.verifyOtp({ email: "awa@example.com", code: b.code, deviceId: "dev-1" });
    expect(s.isNewAccount).toBe(false);
    expect(await db.prisma.user.count()).toBe(1);
  });

  it("le plafond par appareil refuse le quatrième compte", async () => {
    for (const n of [1, 2, 3]) {
      const { code } = await otp.issue(`u${n}@example.com`, "login");
      await auth.verifyOtp({ email: `u${n}@example.com`, code, deviceId: "partagé" });
    }
    const { code } = await otp.issue("u4@example.com", "login");
    await expect(auth.verifyOtp({ email: "u4@example.com", code, deviceId: "partagé" }))
      .rejects.toMatchObject({ code: "device_limit_reached" });
    expect(await db.prisma.user.count()).toBe(3); // rien n'a été créé
  });

  it("un compte suspendu ne peut pas ouvrir de session", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    await auth.verifyOtp({ email: "awa@example.com", code, deviceId: "dev-1" });
    await db.prisma.user.update({ where: { email: "awa@example.com" }, data: { status: "suspended" } });
    const next = await otp.issue("awa@example.com", "login");
    await expect(auth.verifyOtp({ email: "awa@example.com", code: next.code, deviceId: "dev-1" }))
      .rejects.toMatchObject({ code: "account_suspended" });
  });

  it("chaque tentative laisse une trace, réussie comme échouée", async () => {
    const { code } = await otp.issue("awa@example.com", "login");
    await auth.verifyOtp({ email: "awa@example.com", code, deviceId: "dev-1" });
    await auth.verifyOtp({ email: "awa@example.com", code: "000000", deviceId: "dev-1" }).catch(() => {});
    const rows = await db.prisma.loginActivity.findMany();
    expect(rows.map((r) => r.result).sort()).toEqual(["failure", "success"]);
  });

  it("demander un code pour une adresse inconnue ne le dit pas", async () => {
    const connue = await auth.requestOtp({ email: "awa@example.com" });
    const inconnue = await auth.requestOtp({ email: "personne@example.com" });
    expect(connue).toEqual(inconnue); // même forme, aucun indice
  });
});
```

- [ ] **Étape 3 : le voir échouer**

Lancer : `pnpm --filter @lehno/api test test/auth.e2e.test.ts`
Attendu : ÉCHEC — `auth.service.js` introuvable.

- [ ] **Étape 4 : implémenter**

`apps/api/src/auth/auth.service.ts` :
```ts
import { randomBytes, randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { OtpService } from "./otp.service.js";
import { TokenService, type Pair } from "./token.service.js";

type VerifyInput = { email: string; code: string; deviceId?: string; userAgent?: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
  ) {}

  // Rend toujours la même chose : une adresse inconnue ne doit pas se distinguer
  // d'une connue, sinon le point d'entrée énumère les comptes.
  async requestOtp(input: { email: string }): Promise<{ sent: true }> {
    const { code } = await this.otp.issue(input.email, "login");
    // L'envoi passera par l'adaptateur d'envoi (tâche 17) ; en attendant on journalise.
    if (process.env.NODE_ENV !== "production") console.log(`[otp] ${input.email} → ${code}`);
    return { sent: true };
  }

  private async paramNumber(key: string, fallback: number): Promise<number> {
    const row = await this.prisma.systemParameter.findUnique({ where: { key } });
    return row ? Number(row.value) : fallback;
  }

  async verifyOtp(input: VerifyInput): Promise<Pair & { isNewAccount: boolean }> {
    try {
      await this.otp.verify(input.email, "login", input.code);
    } catch (e) {
      await this.prisma.loginActivity.create({
        data: { attemptedEmail: input.email, result: "failure", userAgent: input.userAgent ?? null },
      });
      throw e;
    }

    let user = await this.prisma.user.findUnique({ where: { email: input.email } });
    let isNewAccount = false;

    if (!user) {
      if (input.deviceId) {
        const seuil = await this.paramNumber("max_accounts_per_device", 3);
        const déjà = await this.prisma.deviceSignup.count({ where: { deviceId: input.deviceId } });
        // Vérifié AVANT toute création : refuser après aurait laissé un compte orphelin.
        if (déjà >= seuil)
          throw new AppError("device_limit_reached", "too many accounts from this device");
      }
      user = await this.prisma.user.create({
        data: {
          email: input.email,
          emailVerified: true,
          // Pseudo provisoire : l'écran de première connexion en fait choisir un vrai.
          username: `u${randomBytes(4).toString("hex")}`,
          referralCode: randomBytes(6).toString("base64url").slice(0, 8).toUpperCase(),
        },
      });
      isNewAccount = true;
      if (input.deviceId)
        await this.prisma.deviceSignup.create({ data: { deviceId: input.deviceId, userId: user.id } });
    } else if (!user.emailVerified) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    }

    if (user.status === "suspended") throw new AppError("account_suspended", "account suspended");
    if (user.status === "pending_deletion")
      throw new AppError("account_pending_deletion", "account is being deleted");

    await this.prisma.loginActivity.create({
      data: { userId: user.id, attemptedEmail: input.email, result: "success", userAgent: input.userAgent ?? null },
    });
    const pair = await this.tokens.issuePair(user.id, input.userAgent);
    return { ...pair, isNewAccount };
  }
}
```

`apps/api/src/auth/auth.controller.ts` expose les quatre chemins en appelant `AuthService` et `TokenService`, chacun validé par `ZodValidationPipe` sur le schéma correspondant.

`apps/api/src/auth/auth.guard.ts` :
```ts
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { TokenService } from "./token.service.js";
import { AppError } from "../common/errors.js";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    if (!header?.startsWith("Bearer "))
      throw new AppError("unauthorized", "missing bearer token");
    req.userId = this.tokens.verifyAccess(header.slice(7)).userId;
    return true;
  }
}
```

- [ ] **Étape 5 : le voir passer**

Lancer : `pnpm --filter @lehno/api test test/auth.e2e.test.ts`
Attendu : SUCCÈS, 6 tests.

- [ ] **Étape 6 : commit**

```bash
git add apps/api/src/auth packages/contracts/src apps/api/test/auth.e2e.test.ts
git commit -m "auth: création de compte, plafond par appareil, traces de connexion, réponse uniforme"
```

---

### Tâche 13 : Connexion par Google et Apple

**Fichiers :**
- Créer : `apps/api/src/auth/federated.service.ts`, `apps/api/src/auth/providers.ts`
- Modifier : `apps/api/src/auth/auth.controller.ts` (ajouter `POST /auth/federated`)
- Test : `apps/api/test/federated.test.ts`

**Interfaces :**
- Produit : `FederatedService.signIn({ provider, idToken, deviceId? }): Promise<Pair & { isNewAccount: boolean }>` ; `interface IdentityVerifier { verify(idToken: string): Promise<{ providerUserId: string; email: string | null; emailVerified: boolean }> }`.

**La règle qui compte.** Le rattachement s'appuie **d'abord sur l'identifiant du fournisseur**, puis sur l'adresse vérifiée — Apple pouvant transmettre une adresse relais privée qui change. Une identité externe rejoint toujours un compte existant plutôt que d'en créer un second.

- [ ] **Étape 1 : écrire le test qui échoue**

`apps/api/test/federated.test.ts` :
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { FederatedService, type IdentityVerifier } from "../src/auth/federated.service.js";
import { TokenService } from "../src/auth/token.service.js";

const SECRET = "c2VjcmV0LWRlLXRlc3QtMzItb2N0ZXRzLWV4YWN0ZW1lbnQ=";

// Le vérificateur réel appelle le fournisseur ; ici on décide de sa réponse.
const verifier = (r: { providerUserId: string; email: string | null; emailVerified: boolean }): IdentityVerifier =>
  ({ verify: async () => r });

describe("identités externes", () => {
  let db: TestDb;
  let userId: string;
  const build = (v: IdentityVerifier) =>
    new FederatedService(db.prisma as never, new TokenService(db.prisma as never, SECRET),
      { google: v, apple: v });

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa", referralCode: "AWA1", emailVerified: true },
    });
    userId = u.id;
  });

  it("rattache au compte existant quand l'adresse vérifiée correspond", async () => {
    const svc = build(verifier({ providerUserId: "g-1", email: "awa@example.com", emailVerified: true }));
    const s = await svc.signIn({ provider: "google", idToken: "x" });
    expect(s.isNewAccount).toBe(false);
    expect(await db.prisma.user.count()).toBe(1);
    expect(await db.prisma.federatedIdentity.count()).toBe(1);
  });

  it("reconnaît par l'identifiant du fournisseur même si l'adresse a changé", async () => {
    await db.prisma.federatedIdentity.create({
      data: { userId, provider: "apple", providerUserId: "a-1" },
    });
    const svc = build(verifier({ providerUserId: "a-1", email: "relais@privaterelay.example", emailVerified: true }));
    const s = await svc.signIn({ provider: "apple", idToken: "x" });
    expect(s.isNewAccount).toBe(false);
    expect(await db.prisma.user.count()).toBe(1);
  });

  it("refuse de rattacher sur une adresse non vérifiée", async () => {
    const svc = build(verifier({ providerUserId: "g-9", email: "awa@example.com", emailVerified: false }));
    await expect(svc.signIn({ provider: "google", idToken: "x" }))
      .rejects.toMatchObject({ code: "federated_token_invalid" });
  });

  it("crée un compte quand rien ne correspond", async () => {
    const svc = build(verifier({ providerUserId: "g-2", email: "karim@example.com", emailVerified: true }));
    const s = await svc.signIn({ provider: "google", idToken: "x", deviceId: "dev-1" });
    expect(s.isNewAccount).toBe(true);
    expect(await db.prisma.user.count()).toBe(2);
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/api test test/federated.test.ts`
Attendu : ÉCHEC — module introuvable.

- [ ] **Étape 3 : implémenter**

`apps/api/src/auth/federated.service.ts` :
```ts
import { randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { IdentityProvider } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { TokenService, type Pair } from "./token.service.js";
import { AppError } from "../common/errors.js";

export interface IdentityVerifier {
  verify(idToken: string): Promise<{ providerUserId: string; email: string | null; emailVerified: boolean }>;
}

@Injectable()
export class FederatedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly verifiers: Record<IdentityProvider, IdentityVerifier>,
  ) {}

  async signIn(input: { provider: IdentityProvider; idToken: string; deviceId?: string }): Promise<Pair & { isNewAccount: boolean }> {
    const claims = await this.verifiers[input.provider].verify(input.idToken).catch(() => {
      throw new AppError("federated_token_invalid", "provider token rejected");
    });

    // D'abord l'identifiant du fournisseur : il est stable, l'adresse ne l'est pas.
    const existing = await this.prisma.federatedIdentity.findUnique({
      where: { provider_providerUserId: { provider: input.provider, providerUserId: claims.providerUserId } },
    });
    if (existing) {
      await this.prisma.federatedIdentity.update({
        where: { id: existing.id }, data: { lastUsedAt: new Date() },
      });
      const pair = await this.tokens.issuePair(existing.userId);
      return { ...pair, isNewAccount: false };
    }

    // Ensuite l'adresse, mais seulement si le fournisseur la dit vérifiée :
    // sinon n'importe qui déclarerait l'adresse d'autrui.
    if (!claims.email || !claims.emailVerified)
      throw new AppError("federated_token_invalid", "provider did not supply a verified email");

    let user = await this.prisma.user.findUnique({ where: { email: claims.email } });
    let isNewAccount = false;
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: claims.email, emailVerified: true,
          username: `u${randomBytes(4).toString("hex")}`,
          referralCode: randomBytes(6).toString("base64url").slice(0, 8).toUpperCase(),
        },
      });
      isNewAccount = true;
      if (input.deviceId)
        await this.prisma.deviceSignup.create({ data: { deviceId: input.deviceId, userId: user.id } });
    }
    if (user.status !== "active") throw new AppError("account_suspended", "account not active");

    await this.prisma.federatedIdentity.create({
      data: {
        userId: user.id, provider: input.provider, providerUserId: claims.providerUserId,
        emailAtLink: claims.email, lastUsedAt: new Date(),
      },
    });
    const pair = await this.tokens.issuePair(user.id);
    return { ...pair, isNewAccount };
  }
}
```

`apps/api/src/auth/providers.ts` fournit les deux vérificateurs réels : Google via `google-auth-library` (`OAuth2Client.verifyIdToken`), Apple via la vérification du JWT signé contre les clés publiques de `https://appleid.apple.com/auth/keys`. Ils implémentent tous deux `IdentityVerifier`, ce qui permet au test de les remplacer sans réseau.

- [ ] **Étape 4 : le voir passer**

Lancer : `pnpm --filter @lehno/api test test/federated.test.ts`
Attendu : SUCCÈS, 4 tests.

- [ ] **Étape 5 : commit**

```bash
git add apps/api/src/auth apps/api/test/federated.test.ts
git commit -m "auth: Google et Apple, rattachés par identifiant du fournisseur puis adresse vérifiée"
```

---

### Tâche 14 : Cloisonnement multi-tenant

**Fichiers :**
- Créer : `apps/api/src/tenancy/tenant.repository.ts`
- Test : `apps/api/test/tenancy.test.ts`

**Interfaces :**
- Produit : `TenantRepository` avec `persons(userId)`, `events(userId)`, `occurrences(userId)`, `notes(userId)`, `wishes(userId)` — chacun rendant un accesseur déjà restreint, et `findOrThrow` qui lève `not_found` hors périmètre.

**La règle.** L'appartenance se vérifie **à chaque requête, depuis le jeton**, jamais depuis un paramètre. Une ressource d'autrui rend **404**, pas 403 : répondre « interdit » confirmerait son existence. La contrainte vit ici, dans un dépôt, pas dans la discipline de chaque service.

- [ ] **Étape 1 : écrire le test qui échoue**

`apps/api/test/tenancy.test.ts` :
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { TenantRepository } from "../src/tenancy/tenant.repository.js";

describe("cloisonnement", () => {
  let db: TestDb;
  let repo: TenantRepository;
  let awa: string, karim: string, fichesDeKarim: string;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    repo = new TenantRepository(db.prisma as never);
    const a = await db.prisma.user.create({ data: { email: "a@x.com", username: "awa", referralCode: "A1" } });
    const k = await db.prisma.user.create({ data: { email: "k@x.com", username: "karim", referralCode: "K1" } });
    awa = a.id; karim = k.id;
    const p = await db.prisma.person.create({ data: { userId: karim, displayName: "Maman de Karim" } });
    fichesDeKarim = p.id;
  });

  it("la liste ne rend que ce qui appartient au demandeur", async () => {
    await db.prisma.person.create({ data: { userId: awa, displayName: "Maman d'Awa" } });
    const à_awa = await repo.persons(awa).findMany();
    expect(à_awa).toHaveLength(1);
    expect(à_awa[0]!.displayName).toBe("Maman d'Awa");
  });

  it("lire la fiche d'autrui rend 404, jamais 403", async () => {
    await expect(repo.persons(awa).findOrThrow(fichesDeKarim))
      .rejects.toMatchObject({ code: "not_found" });
  });

  it("une fiche inexistante rend le même 404 — indistinguable", async () => {
    const inventé = "00000000-0000-4000-8000-000000000000";
    const autrui = await repo.persons(awa).findOrThrow(fichesDeKarim).catch((e) => e);
    const absent = await repo.persons(awa).findOrThrow(inventé).catch((e) => e);
    expect(autrui.code).toBe(absent.code);
    expect(autrui.message).toBe(absent.message);
  });

  it("modifier la fiche d'autrui ne touche rien", async () => {
    await expect(repo.persons(awa).updateOrThrow(fichesDeKarim, { displayName: "détourné" }))
      .rejects.toMatchObject({ code: "not_found" });
    const intacte = await db.prisma.person.findUniqueOrThrow({ where: { id: fichesDeKarim } });
    expect(intacte.displayName).toBe("Maman de Karim");
  });

  it("supprimer la fiche d'autrui ne touche rien", async () => {
    await expect(repo.persons(awa).deleteOrThrow(fichesDeKarim))
      .rejects.toMatchObject({ code: "not_found" });
    expect(await db.prisma.person.count()).toBe(1);
  });

  it("les échéances passent par le même filtre", async () => {
    const e = await db.prisma.event.create({
      data: { personId: fichesDeKarim, referenceDate: new Date("1990-01-01") },
    });
    const o = await db.prisma.eventOccurrence.create({
      data: { eventId: e.id, userId: karim, occurrenceDate: new Date("2026-01-01"), occurrenceYear: 2026 },
    });
    await expect(repo.occurrences(awa).findOrThrow(o.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(repo.occurrences(karim).findOrThrow(o.id)).resolves.toMatchObject({ id: o.id });
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/api test test/tenancy.test.ts`
Attendu : ÉCHEC — module introuvable.

- [ ] **Étape 3 : implémenter**

`apps/api/src/tenancy/tenant.repository.ts` :
```ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";

// Message unique : hors périmètre et inexistant doivent être indistinguables.
const ABSENT = (): AppError => new AppError("not_found", "resource not found");

type Delegate = {
  findMany(a: { where: object }): Promise<unknown[]>;
  findFirst(a: { where: object }): Promise<unknown | null>;
  updateMany(a: { where: object; data: object }): Promise<{ count: number }>;
  deleteMany(a: { where: object }): Promise<{ count: number }>;
};

class Scope<T> {
  constructor(private readonly delegate: Delegate, private readonly scope: object) {}

  findMany(where: object = {}): Promise<T[]> {
    return this.delegate.findMany({ where: { ...this.scope, ...where } }) as Promise<T[]>;
  }

  async findOrThrow(id: string): Promise<T> {
    const row = await this.delegate.findFirst({ where: { ...this.scope, id } });
    if (!row) throw ABSENT();
    return row as T;
  }

  // updateMany plutôt que update : le filtre de périmètre entre dans le WHERE,
  // donc une ressource d'autrui donne count = 0 au lieu d'être modifiée.
  async updateOrThrow(id: string, data: object): Promise<T> {
    const { count } = await this.delegate.updateMany({ where: { ...this.scope, id }, data });
    if (count === 0) throw ABSENT();
    return this.findOrThrow(id);
  }

  async deleteOrThrow(id: string): Promise<void> {
    const { count } = await this.delegate.deleteMany({ where: { ...this.scope, id } });
    if (count === 0) throw ABSENT();
  }
}

@Injectable()
export class TenantRepository {
  constructor(private readonly prisma: PrismaService) {}

  persons(userId: string) { return new Scope<any>(this.prisma.person as never, { userId }); }
  occurrences(userId: string) { return new Scope<any>(this.prisma.eventOccurrence as never, { userId }); }
  // Event et Note se rattachent au propriétaire par leur parent, non par une colonne.
  events(userId: string) { return new Scope<any>(this.prisma.event as never, { person: { userId } }); }
  notes(userId: string) { return new Scope<any>(this.prisma.note as never, { person: { userId } }); }
  wishes(userId: string) {
    return new Scope<any>(this.prisma.wishlistItem as never, { occurrence: { userId } });
  }
}
```

- [ ] **Étape 4 : le voir passer**

Lancer : `pnpm --filter @lehno/api test test/tenancy.test.ts`
Attendu : SUCCÈS, 6 tests.

- [ ] **Étape 5 : commit**

```bash
git add apps/api/src/tenancy apps/api/test/tenancy.test.ts
git commit -m "cloisonnement: périmètre dans le dépôt, 404 indistinguable hors périmètre"
```

---

### Tâche 15 : Profil — pseudo, langue, thème

**Fichiers :**
- Créer : `apps/api/src/me/profile.controller.ts`, `apps/api/src/me/profile.service.ts`
- Modifier : `packages/contracts/src/index.ts` (ajouter `packages/contracts/src/profile.ts`)
- Test : `apps/api/test/profile.test.ts`

**Interfaces :**
- Produit : `GET /v1/me/profile`, `PATCH /v1/me/profile`, `GET /v1/me/profile/username-available?username=…`.
- `profileSchema` : `{ id, username, displayName, avatarUrl, email, emailVerified, uiLanguage, theme, timezone, sendHour }`.

- [ ] **Étape 1 : le contrat**

`packages/contracts/src/profile.ts` :
```ts
import { z } from "zod";

// Trois à trente caractères, minuscules, chiffres et tirets bas. Il forme
// l'adresse du Mur : ce qui n'entre pas dans une URL n'a pas sa place ici.
export const usernameSchema = z.string().regex(/^[a-z0-9_]{3,30}$/);

export const profileSchema = z.object({
  id: z.string().uuid(),
  username: usernameSchema,
  displayName: z.string().max(80).nullable(),
  avatarUrl: z.string().url().nullable(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  uiLanguage: z.enum(["fr", "en"]),
  theme: z.enum(["system", "light", "dark"]),
  timezone: z.string().max(64),
  sendHour: z.number().int().min(0).max(23),
}).strict();

export const updateProfileSchema = profileSchema
  .pick({ username: true, displayName: true, uiLanguage: true, theme: true, timezone: true, sendHour: true })
  .partial()
  .strict();

export type Profile = z.infer<typeof profileSchema>;
```

- [ ] **Étape 2 : écrire le test qui échoue**

`apps/api/test/profile.test.ts` :
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { ProfileService } from "../src/me/profile.service.js";
import { profileSchema } from "@lehno/contracts";

describe("profil", () => {
  let db: TestDb;
  let svc: ProfileService;
  let userId: string;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => {
    await resetDatabase(db.prisma);
    svc = new ProfileService(db.prisma as never);
    const u = await db.prisma.user.create({
      data: { email: "awa@example.com", username: "awa", referralCode: "A1" },
    });
    userId = u.id;
  });

  it("le profil rendu est conforme au contrat", async () => {
    expect(profileSchema.safeParse(await svc.get(userId)).success).toBe(true);
  });

  it("change la langue et le thème", async () => {
    const p = await svc.update(userId, { uiLanguage: "en", theme: "dark" });
    expect(p.uiLanguage).toBe("en");
    expect(p.theme).toBe("dark");
  });

  it("refuse un pseudo déjà pris, sans égard à la casse", async () => {
    await db.prisma.user.create({ data: { email: "k@x.com", username: "karim", referralCode: "K1" } });
    await expect(svc.update(userId, { username: "KARIM" }))
      .rejects.toMatchObject({ code: "username_taken" });
  });

  it("garder son propre pseudo n'est pas un conflit", async () => {
    await expect(svc.update(userId, { username: "awa" })).resolves.toMatchObject({ username: "awa" });
  });

  it("la disponibilité tient compte de la casse et du demandeur", async () => {
    expect(await svc.usernameAvailable("KARIM", userId)).toBe(true);
    expect(await svc.usernameAvailable("awa", userId)).toBe(true);   // le sien
    expect(await svc.usernameAvailable("awa", "autre-id")).toBe(false);
  });
});
```

- [ ] **Étape 3 : le voir échouer**

Lancer : `pnpm --filter @lehno/api test test/profile.test.ts`
Attendu : ÉCHEC — module introuvable.

- [ ] **Étape 4 : implémenter**

`apps/api/src/me/profile.service.ts` :
```ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import type { Profile } from "@lehno/contracts";

const SELECT = {
  id: true, username: true, displayName: true, avatarUrl: true, email: true,
  emailVerified: true, uiLanguage: true, theme: true, timezone: true, sendHour: true,
} as const;

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<Profile> {
    return (await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: SELECT })) as Profile;
  }

  // La colonne est en citext : la comparaison est déjà insensible à la casse.
  async usernameAvailable(username: string, forUserId: string): Promise<boolean> {
    const taken = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
    return !taken || taken.id === forUserId;
  }

  async update(userId: string, patch: Partial<Profile>): Promise<Profile> {
    if (patch.username && !(await this.usernameAvailable(patch.username, userId)))
      throw new AppError("username_taken", "username already in use");
    return (await this.prisma.user.update({
      where: { id: userId }, data: patch, select: SELECT,
    })) as Profile;
  }
}
```

`apps/api/src/me/profile.controller.ts` monte les trois chemins sous `AuthGuard`, lit `req.userId`, valide le corps du `PATCH` par `ZodValidationPipe(updateProfileSchema)`.

- [ ] **Étape 5 : le voir passer**

Lancer : `pnpm --filter @lehno/api test test/profile.test.ts`
Attendu : SUCCÈS, 5 tests.

- [ ] **Étape 6 : commit**

```bash
git add apps/api/src/me packages/contracts/src apps/api/test/profile.test.ts
git commit -m "profil: pseudo, langue, thème, fuseau et heure d'envoi"
```

---

### Tâche 16 : Surfaces publiques — configuration, pages légales, liste d'attente

**Fichiers :**
- Créer : `apps/api/src/public/config.controller.ts`, `apps/api/src/public/legal.controller.ts`, `apps/api/src/public/waitlist.controller.ts`, `apps/api/src/public/waitlist.service.ts`
- Créer : `apps/api/src/public/legal/{cgu,confidentialite,mentions}.{fr,en}.md`
- Test : `apps/api/test/public.test.ts`

**Interfaces :**
- Produit : `GET /v1/public/config`, `GET /v1/public/legal/:document`, `POST /v1/public/waitlist`.
- `publicConfigSchema` : `{ signupFreeCredits, creditUnitPrice, currency, referralBonusInvited }`.

**Pourquoi `/public/config` existe.** La landing annonce des montants qui se règlent côté administration. Elle les **lit ici** plutôt que de les figer dans le code du site : un prix écrit en dur devient faux le jour où l'administration le change.

- [ ] **Étape 1 : écrire le test qui échoue**

`apps/api/test/public.test.ts` :
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { WaitlistService } from "../src/public/waitlist.service.js";
import { ConfigService } from "../src/public/config.controller.js";

describe("surfaces publiques", () => {
  let db: TestDb;
  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => { await resetDatabase(db.prisma); });

  it("la configuration publique vient de la base, pas du code", async () => {
    await db.prisma.systemParameter.createMany({
      data: [
        { key: "signup_free_credits", value: "5", valueType: "number" },
        { key: "credit_unit_price", value: "100", valueType: "money" },
      ],
    });
    const cfg = await new ConfigService(db.prisma as never).get();
    expect(cfg.signupFreeCredits).toBe(5);
    expect(cfg.creditUnitPrice).toBe(100);

    await db.prisma.systemParameter.update({
      where: { key: "credit_unit_price" }, data: { value: "150" },
    });
    expect((await new ConfigService(db.prisma as never).get()).creditUnitPrice).toBe(150);
  });

  it("un dépôt sur la liste d'attente enregistre l'adresse", async () => {
    const svc = new WaitlistService(db.prisma as never);
    await svc.join({ email: "awa@example.com", locale: "fr" });
    expect(await db.prisma.waitlistSignup.count()).toBe(1);
  });

  it("deux dépôts de la même adresse n'en font qu'un, et ne le disent pas", async () => {
    const svc = new WaitlistService(db.prisma as never);
    const a = await svc.join({ email: "awa@example.com", locale: "fr" });
    const b = await svc.join({ email: "AWA@EXAMPLE.COM", locale: "en" });
    expect(a).toEqual(b); // réponse identique : la liste ne s'énumère pas
    expect(await db.prisma.waitlistSignup.count()).toBe(1);
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/api test test/public.test.ts`
Attendu : ÉCHEC — modules introuvables.

- [ ] **Étape 3 : implémenter**

`apps/api/src/public/waitlist.service.ts` :
```ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class WaitlistService {
  constructor(private readonly prisma: PrismaService) {}

  // Idempotent, et muet sur ce qu'il savait déjà : dire « déjà inscrit »
  // ferait de ce point d'entrée un test d'appartenance.
  async join(input: { email: string; locale?: string; source?: string }): Promise<{ joined: true }> {
    await this.prisma.waitlistSignup.upsert({
      where: { email: input.email },
      create: { email: input.email, locale: input.locale ?? null, source: input.source ?? null },
      update: {},
    });
    return { joined: true };
  }
}
```

`apps/api/src/public/config.controller.ts` porte aussi le service :
```ts
import { Controller, Get, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class ConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<{ signupFreeCredits: number; creditUnitPrice: number; currency: string; referralBonusInvited: number }> {
    const rows = await this.prisma.systemParameter.findMany();
    const num = (key: string, fallback: number): number => {
      const row = rows.find((r) => r.key === key);
      return row ? Number(row.value) : fallback;
    };
    return {
      signupFreeCredits: num("signup_free_credits", 5),
      creditUnitPrice: num("credit_unit_price", 100),
      currency: "XAF",
      referralBonusInvited: num("referral_bonus_invited", 0),
    };
  }
}

@Controller("public/config")
export class ConfigController {
  constructor(private readonly service: ConfigService) {}
  @Get() get() { return this.service.get(); }
}
```

`legal.controller.ts` sert les fichiers Markdown par document et par langue, en refusant tout nom hors de la liste connue (`cgu`, `confidentialite`, `mentions`) — un chemin construit depuis l'entrée ouvrirait la traversée de répertoire.

- [ ] **Étape 4 : le voir passer**

Lancer : `pnpm --filter @lehno/api test test/public.test.ts`
Attendu : SUCCÈS, 3 tests.

- [ ] **Étape 5 : commit**

```bash
git add apps/api/src/public apps/api/test/public.test.ts
git commit -m "public: configuration lue en base, pages légales, liste d'attente idempotente"
```

---

### Tâche 17 : Envoi d'e-mails et limitation de débit

**Fichiers :**
- Créer : `apps/api/src/mail/mail.port.ts`, `apps/api/src/mail/mailgun.adapter.ts`, `apps/api/src/mail/templates.ts`
- Créer : `apps/api/src/common/rate-limit.service.ts`
- Modifier : `apps/api/src/auth/auth.service.ts` (envoyer le code, borner la fréquence)
- Test : `apps/api/test/mail.test.ts`, `apps/api/test/rate-limit.test.ts`

**Interfaces :**
- Produit : `interface MailPort { send(m: Mail): Promise<void> }` avec `type Mail = { to: string; subject: string; text: string; locale: Locale }` ; `MailgunAdapter implements MailPort` ; `RateLimitService.hit(key, limit, windowMs): Promise<void>` qui lève `rate_limited` au dépassement.
- Consommé par : la tâche 12 (le code part réellement), et toute la phase 1 pour les rappels.

**Pourquoi les deux ensemble.** Le point d'entrée qui envoie un courrier est exactement celui qu'il faut borner : sans plafond, `/auth/otp` sert à arroser la boîte d'un tiers. La spécification demande de limiter **par adresse destinataire autant que par origine** — borner la seule origine laisse passer celui qui vise une personne, borner la seule adresse laisse passer celui qui balaie un annuaire.

- [ ] **Étape 1 : écrire les tests qui échouent**

`apps/api/test/rate-limit.test.ts` :
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withDatabase, resetDatabase, type TestDb } from "./db.js";
import { RateLimitService } from "../src/common/rate-limit.service.js";

describe("limitation de débit", () => {
  let db: TestDb;
  let limiter: RateLimitService;

  beforeAll(async () => { db = await withDatabase(); }, 120_000);
  afterAll(async () => { await db.close(); });
  beforeEach(async () => { await resetDatabase(db.prisma); limiter = new RateLimitService(db.prisma as never); });

  it("laisse passer sous le plafond", async () => {
    for (let i = 0; i < 3; i++) await limiter.hit("otp:awa@example.com", 3, 60_000);
    expect(true).toBe(true);
  });

  it("refuse au-delà du plafond", async () => {
    for (let i = 0; i < 3; i++) await limiter.hit("otp:awa@example.com", 3, 60_000);
    await expect(limiter.hit("otp:awa@example.com", 3, 60_000))
      .rejects.toMatchObject({ code: "rate_limited" });
  });

  it("les clés ne se gênent pas entre elles", async () => {
    for (let i = 0; i < 3; i++) await limiter.hit("otp:awa@example.com", 3, 60_000);
    await expect(limiter.hit("otp:karim@example.com", 3, 60_000)).resolves.toBeUndefined();
  });

  it("la fenêtre glisse : les frappes anciennes ne comptent plus", async () => {
    for (let i = 0; i < 3; i++) await limiter.hit("otp:awa@example.com", 3, 60_000);
    // Antidater les frappes revient au même que d'avancer l'horloge,
    // sans toucher aux minuteries du pilote.
    await db.prisma.rateLimitHit.updateMany({
      where: { key: "otp:awa@example.com" },
      data: { createdAt: new Date(Date.now() - 61_000) },
    });
    await expect(limiter.hit("otp:awa@example.com", 3, 60_000)).resolves.toBeUndefined();
  });
});
```

`apps/api/test/mail.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { otpEmail } from "../src/mail/templates.js";

describe("gabarits d'e-mail", () => {
  it("compose le code dans la langue du destinataire", () => {
    const fr = otpEmail({ code: "123456", locale: "fr" });
    const en = otpEmail({ code: "123456", locale: "en" });
    expect(fr.subject).toBe("Votre code Lehno");
    expect(en.subject).toBe("Your Lehno code");
    expect(fr.text).toContain("123456");
    expect(en.text).toContain("123456");
  });

  // Le gabarit est fixe et les valeurs s'y injectent : jamais de texte assemblé
  // à la volée, sinon la relecture d'une langue ne garantit rien sur l'autre.
  it("annonce la durée de vie du code", () => {
    expect(otpEmail({ code: "123456", locale: "fr" }).text).toContain("10 minutes");
  });
});
```

- [ ] **Étape 2 : les voir échouer**

Lancer : `pnpm --filter @lehno/api test test/rate-limit.test.ts test/mail.test.ts`
Attendu : ÉCHEC — modules introuvables.

- [ ] **Étape 3 : la table des compteurs**

Ajouter à `prisma/schema.prisma`, puis migrer sous le nom `rate_limit` :
```prisma
model RateLimitHit {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  key       String   @db.VarChar(160)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz

  @@index([key, createdAt])
  @@map("rate_limit_hit")
}
```

Une table plutôt qu'un compteur en mémoire : sur un VPS, le serveur redémarre, et un plafond qui s'oublie au redémarrage ne borne rien.

- [ ] **Étape 4 : implémenter**

`apps/api/src/common/rate-limit.service.ts` :
```ts
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "./errors.js";

@Injectable()
export class RateLimitService {
  constructor(private readonly prisma: PrismaService) {}

  async hit(key: string, limit: number, windowMs: number): Promise<void> {
    const depuis = new Date(Date.now() - windowMs);
    const récents = await this.prisma.rateLimitHit.count({ where: { key, createdAt: { gte: depuis } } });
    if (récents >= limit) throw new AppError("rate_limited", `rate limit reached for ${key}`);
    await this.prisma.rateLimitHit.create({ data: { key } });
  }
}
```

`apps/api/src/mail/mail.port.ts` :
```ts
import type { Locale } from "@lehno/i18n";

export type Mail = { to: string; subject: string; text: string; locale: Locale };

// Une interface, pour que changer de service ne demande qu'un adaptateur.
export interface MailPort { send(mail: Mail): Promise<void>; }
```

`apps/api/src/mail/templates.ts` :
```ts
import type { Locale } from "@lehno/i18n";

const GABARITS = {
  fr: {
    subject: "Votre code Lehno",
    body: (code: string) =>
      `Votre code de connexion est ${code}.

Il est valable 10 minutes. ` +
      `Si vous n'avez rien demandé, ignorez ce message.`,
  },
  en: {
    subject: "Your Lehno code",
    body: (code: string) =>
      `Your sign-in code is ${code}.

It is valid for 10 minutes. ` +
      `If you didn't ask for it, ignore this message.`,
  },
} as const;

export function otpEmail(input: { code: string; locale: Locale }): { subject: string; text: string } {
  const g = GABARITS[input.locale];
  return { subject: g.subject, text: g.body(input.code) };
}
```

`apps/api/src/mail/mailgun.adapter.ts` implémente `MailPort` par un appel à l'API Mailgun, et journalise l'échec sans jamais écrire le contenu du courrier. En développement, un `ConsoleMailAdapter` affiche le message : personne n'a besoin d'un compte Mailgun pour travailler sur le reste.

**Le constructeur d'`AuthService` gagne deux dépendances**, et le test de la tâche 12 doit suivre :

```ts
// apps/api/src/auth/auth.service.ts — signature élargie
constructor(
  private readonly prisma: PrismaService,
  private readonly otp: OtpService,
  private readonly tokens: TokenService,
  private readonly limiter: RateLimitService,
  private readonly mail: MailPort,
) {}
```

```ts
// apps/api/test/auth.e2e.test.ts — le montage du test, mis à jour
const envoyés: Mail[] = [];
const mailDeTest: MailPort = { send: async (m) => { envoyés.push(m); } };
auth = new AuthService(
  db.prisma as never, otp, new TokenService(db.prisma as never, SECRET),
  new RateLimitService(db.prisma as never), mailDeTest,
);
```

Garder `envoyés` sous la main permet d'ajouter un test qui vérifie qu'un courrier est bien parti, et dans la bonne langue.

Enfin, `AuthService.requestOtp` borne puis envoie :
```ts
async requestOtp(input: { email: string; ip?: string }): Promise<{ sent: true }> {
  // Par destinataire ET par origine : l'un arrête celui qui vise une personne,
  // l'autre celui qui balaie un annuaire.
  await this.limiter.hit(`otp:email:${input.email}`, 5, 3_600_000);
  if (input.ip) await this.limiter.hit(`otp:ip:${input.ip}`, 20, 3_600_000);

  const { code } = await this.otp.issue(input.email, "login");
  const user = await this.prisma.user.findUnique({
    where: { email: input.email }, select: { uiLanguage: true },
  });
  const locale = (user?.uiLanguage === "en" ? "en" : "fr") as Locale;
  const { subject, text } = otpEmail({ code, locale });
  await this.mail.send({ to: input.email, subject, text, locale });
  return { sent: true };
}
```

La réponse reste **la même pour une adresse inconnue** : on émet un code et on envoie, que le compte existe ou non.

- [ ] **Étape 5 : les voir passer**

Lancer : `pnpm --filter @lehno/api test test/rate-limit.test.ts test/mail.test.ts test/auth.e2e.test.ts`
Attendu : SUCCÈS. Le test d'authentification passe toujours : le service accepte un adaptateur de console.

- [ ] **Étape 6 : commit**

```bash
git add apps/api/src/mail apps/api/src/common/rate-limit.service.ts prisma apps/api/test
git commit -m "envoi: adaptateur d'e-mail derrière une interface, et débit borné par destinataire et par origine"
```

---
### Tâche 18 : Next.js — langues, thème avant la première peinture, caractères

**Fichiers :**
- Créer : `apps/web/package.json`, `apps/web/next.config.mjs`, `apps/web/app/layout.tsx`, `apps/web/app/[locale]/layout.tsx`
- Créer : `apps/web/lib/theme-script.ts`, `apps/web/lib/theme-css.ts`, `apps/web/lib/fonts.ts`, `apps/web/app/globals.css`
- Créer : `apps/web/middleware.ts`
- Test : `apps/web/test/theme-script.test.ts`

**Interfaces :**
- Produit : la route `/[locale]` (`fr` | `en`), les variables CSS des deux thèmes, `themeScript` (chaîne injectée en ligne), les polices auto-hébergées.

**Les deux pièges.** Le thème doit être résolu **avant la première peinture**, sinon la page s'affiche en clair puis bascule sous les yeux du visiteur. Et les polices sont **auto-hébergées** par `next/font/google`, qui les télécharge à la compilation : la politique de sécurité de contenu interdit les sources externes, et un appel au CDN ferait sauter la page.

- [ ] **Étape 1 : écrire le test qui échoue**

`apps/web/test/theme-script.test.ts` :
```ts
import { describe, expect, it } from "vitest";
import { themeScript } from "../lib/theme-script.js";

describe("script de thème", () => {
  const run = (stored: string | null, prefersDark: boolean): string => {
    const root: { dataset: Record<string, string> } = { dataset: {} };
    const fn = new Function("localStorage", "matchMedia", "document", themeScript);
    fn(
      { getItem: () => stored },
      (q: string) => ({ matches: prefersDark && q.includes("dark") }),
      { documentElement: root },
    );
    return root.dataset.theme ?? "";
  };

  it("le choix explicite l'emporte sur le système", () => {
    expect(run("light", true)).toBe("light");
    expect(run("dark", false)).toBe("dark");
  });

  it("sans choix, il suit le système", () => {
    expect(run(null, true)).toBe("dark");
    expect(run(null, false)).toBe("light");
  });

  it("« system » stocké retombe sur la préférence du navigateur", () => {
    expect(run("system", true)).toBe("dark");
  });

  it("un stockage inaccessible ne fait pas planter la page", () => {
    const root: { dataset: Record<string, string> } = { dataset: {} };
    const fn = new Function("localStorage", "matchMedia", "document", themeScript);
    expect(() => fn(
      { getItem: () => { throw new Error("bloqué"); } },
      () => ({ matches: false }),
      { documentElement: root },
    )).not.toThrow();
    expect(root.dataset.theme).toBe("light");
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/web test`
Attendu : ÉCHEC — `theme-script.js` introuvable.

- [ ] **Étape 3 : implémenter**

`apps/web/lib/theme-script.ts` :
```ts
// Injecté en ligne dans <head>, il s'exécute avant la première peinture.
// Un navigateur en navigation privée peut refuser localStorage : d'où le try.
export const themeScript = `
try {
  var choix = localStorage.getItem("lehno.theme");
  var sombre = choix === "dark" ||
    ((!choix || choix === "system") && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = sombre ? "dark" : "light";
} catch (e) {
  document.documentElement.dataset.theme = "light";
}
`.trim();
```

`apps/web/lib/fonts.ts` :
```ts
import { Fraunces, Karla } from "next/font/google";

// next/font télécharge et sert les fichiers depuis notre domaine :
// aucun appel au CDN, donc rien à autoriser dans la politique de contenu.
export const fraunces = Fraunces({
  subsets: ["latin"], display: "swap", variable: "--font-titre",
  axes: ["SOFT", "WONK", "opsz"], weight: ["400", "500"],
});

export const karla = Karla({
  subsets: ["latin"], display: "swap", variable: "--font-texte",
  weight: ["300", "400", "500", "600", "700"],
});
```

`apps/web/app/globals.css` ne contient **aucune couleur** : les variables des deux thèmes
sont émises depuis `@lehno/tokens`, seule source de ces valeurs. Les répéter ici en donnerait
deux copies que rien n'obligerait à concorder, et leur dérive casserait le mode sombre sans
qu'aucun test ne le voie.

```ts
// apps/web/lib/theme-css.ts
import { themes, cssVariables } from "@lehno/tokens";

export const themeCss = `
:root[data-theme="light"] { ${cssVariables(themes.light)} }
:root[data-theme="dark"]  { ${cssVariables(themes.dark)} }
`.trim();
```

```css
/* apps/web/app/globals.css — structure seulement */
* { margin: 0; box-sizing: border-box; }
body {
  background: var(--bg); color: var(--text);
  font-family: var(--font-texte), system-ui, sans-serif;
  font-size: 16px; line-height: 1.6;
}
.titre { font-family: var(--font-titre), Georgia, serif; font-variation-settings: "SOFT" 40, "WONK" 1; }
/* Aucune ombre nulle part : la profondeur vient des filets. */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
```

`apps/web/app/layout.tsx` injecte dans `<head>` une balise `<style>` portant `themeCss`, puis `themeScript` via `dangerouslySetInnerHTML`, applique les variables de police au `<html>`, et importe `globals.css`.

`apps/web/middleware.ts` redirige `/` vers `/fr` ou `/en` selon l'en-tête `Accept-Language`, en n'acceptant que ces deux valeurs.

- [ ] **Étape 4 : le voir passer**

Lancer : `pnpm --filter @lehno/web test`
Attendu : SUCCÈS, 4 tests.

- [ ] **Étape 5 : commit**

```bash
git add apps/web
git commit -m "web: squelette Next.js, deux thèmes résolus avant peinture, polices auto-hébergées"
```

---

### Tâche 19 : La landing

**Fichiers :**
- Créer : `apps/web/app/[locale]/page.tsx`
- Créer : `apps/web/components/{Entete,Hero,Etapes,Contenu,Mur,Cloture,Pied,BasculeTheme,BasculeLangue,FormulaireAttente}.tsx`
- Créer : `apps/web/messages/{fr,en}.ts`
- Créer : `apps/web/public/brand/` (copie de `images/brand/svg/`)
- Test : `apps/web/test/landing.test.tsx`

**Interfaces :**
- Consomme : `GET /v1/public/config` (montants), `POST /v1/public/waitlist` (dépôt d'adresse).
- Produit : la page rendue au serveur, en deux langues et deux thèmes.

**La source.** La maquette de référence est `specs/Landing Lehno v3.dc.html` : en-tête · hero (titre, sous-titre, formulaire ou badges de magasins, aperçu de l'application) · « Comment ça marche » en trois temps · « Ce que l'application contient » en trois blocs alternés · le Mur · « Ce que ça coûte » · clôture sur bandeau · pied. Sa table de chaînes `STR` se transpose telle quelle dans `messages/{fr,en}.ts` — **sans reprendre les clés mortes** `qaAnniv`, `qaNote`, `qaFiche`, `contribs`, `reprises`, `voirTout`, héritées d'un accueil que la spec mobile a depuis réécrit.

**Les montants viennent de l'API.** La maquette écrit « 100 F » et « 5 crédits » en dur ; la page, elle, les lit sur `/v1/public/config`.

- [ ] **Étape 1 : écrire le test qui échoue**

`apps/web/test/landing.test.tsx` :
```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Landing from "../app/[locale]/page.js";

const config = { signupFreeCredits: 5, creditUnitPrice: 100, currency: "XAF", referralBonusInvited: 0 };

describe("landing", () => {
  it("rend le titre dans la langue demandée", async () => {
    render(await Landing({ params: { locale: "fr" }, config }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Soyez là le jour J");
  });

  it("rend le titre anglais, écrit et non traduit mot à mot", async () => {
    render(await Landing({ params: { locale: "en" }, config }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Be there on the day");
  });

  it("affiche le prix venu de la configuration, jamais une valeur écrite en dur", async () => {
    render(await Landing({ params: { locale: "fr" }, config: { ...config, creditUnitPrice: 150 } }));
    expect(screen.getByText(/150/)).toBeInTheDocument();
    expect(screen.queryByText(/\b100 F\b/)).not.toBeInTheDocument();
  });

  it("porte un seul h1", async () => {
    render(await Landing({ params: { locale: "fr" }, config }));
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("chaque image porte un texte de remplacement", async () => {
    render(await Landing({ params: { locale: "fr" }, config }));
    for (const img of screen.getAllByRole("img")) expect(img).toHaveAccessibleName();
  });
});
```

- [ ] **Étape 2 : le voir échouer**

Lancer : `pnpm --filter @lehno/web test test/landing.test.tsx`
Attendu : ÉCHEC — la page n'existe pas.

- [ ] **Étape 3 : implémenter**

Transposer la maquette section par section. Chaque composant reçoit ses textes en propriétés depuis `messages/{locale}.ts` ; **aucune chaîne n'est écrite dans un composant**. Les couleurs passent par les variables CSS de la tâche 17 — aucun hexadécimal dans un composant, sinon la bascule de thème ne le suit pas.

Le formulaire de liste d'attente poste sur `/v1/public/waitlist` et rend le bloc de remerciement à la réponse. Les badges de magasins se choisissent selon la langue **et** le thème (Apple en noir sur fond clair, en blanc sur fond sombre) ; ils vivent dans `public/badges/`.

La page charge la configuration au rendu serveur :
```tsx
export const revalidate = 300; // cache court, la configuration bouge rarement

async function chargerConfig() {
  const r = await fetch(`${process.env.API_URL}/v1/public/config`, { next: { revalidate } });
  if (!r.ok) return { signupFreeCredits: 5, creditUnitPrice: 100, currency: "XAF", referralBonusInvited: 0 };
  return r.json();
}
```

Le repli existe pour que l'indisponibilité de l'API ne rende pas la landing blanche — une page de pré-lancement doit survivre à une panne du serveur.

- [ ] **Étape 4 : le voir passer**

Lancer : `pnpm --filter @lehno/web test test/landing.test.tsx`
Attendu : SUCCÈS, 5 tests.

- [ ] **Étape 5 : vérifier les deux thèmes et les deux langues à l'œil**

```bash
pnpm --filter @lehno/web dev
```
Ouvrir `/fr` et `/en`, basculer le thème, réduire la fenêtre sous 760 px pour voir le menu se replier. Vérifier qu'aucune ombre n'apparaît.

- [ ] **Étape 6 : commit**

```bash
git add apps/web
git commit -m "landing: bilingue, deux thèmes, montants lus sur la configuration publique"
```

---

### Tâche 20 : Conteneurs et intégration continue

**Fichiers :**
- Créer : `infra/docker/Dockerfile.api`, `infra/docker/Dockerfile.web`, `.dockerignore`
- Créer : `.github/workflows/ci.yml`
- Test : la chaîne elle-même

**Interfaces :**
- Produit : deux images, et une chaîne qui refuse une contribution cassée.

- [ ] **Étape 1 : les images**

`infra/docker/Dockerfile.api` — construction en plusieurs étapes, `node:20-alpine`, `pnpm deploy --filter @lehno/api` pour n'emporter que les dépendances utiles, `prisma generate` à la construction, `prisma migrate deploy` au démarrage, utilisateur non privilégié, `HEALTHCHECK` sur `/v1/public/config`.

`infra/docker/Dockerfile.web` — même base, `next build` puis la sortie autonome (`output: "standalone"` dans `next.config.mjs`).

- [ ] **Étape 2 : la chaîne**

`.github/workflows/ci.yml` :
```yaml
name: ci
on: { push: { branches: [main] }, pull_request: {} }

jobs:
  verifier:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test            # Testcontainers lève ses bases via le Docker du runner
      - run: pnpm build
      - name: secrets dans l'historique
        uses: gitleaks/gitleaks-action@v2
```

`--frozen-lockfile` compte : sans lui, la chaîne réinstallerait des versions différentes de celles vérifiées en local, et testerait autre chose que ce qui sera livré.

- [ ] **Étape 3 : vérifier**

```bash
docker build -f infra/docker/Dockerfile.api -t lehno-api .
docker build -f infra/docker/Dockerfile.web -t lehno-web .
```
Attendu : les deux images se construisent.

- [ ] **Étape 4 : commit**

```bash
git add infra .github .dockerignore
git commit -m "livraison: images api et web, chaîne d'intégration continue"
```

---

### Tâche 21 : Mise en ligne, sauvegardes, observation

**Fichiers :**
- Créer : `infra/deploy/compose.prod.yml`, `infra/deploy/Caddyfile`, `infra/deploy/backup.sh`, `infra/deploy/README.md`
- Modifier : `apps/api/src/main.ts` (Sentry), `apps/web/app/layout.tsx` (PostHog)

**Interfaces :**
- Produit : la landing servie en HTTPS sur le domaine, les sauvegardes chiffrées vers un stockage distant, les incidents remontés.

- [ ] **Étape 1 : la composition de production et le service TLS**

`infra/deploy/Caddyfile` — Caddy termine le TLS (certificats obtenus et renouvelés seuls), sert `apps/web`, et transmet `/v1/*` à l'API. Il pose les en-têtes de sécurité que la spécification demande :
```
lehno.app {
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    X-Content-Type-Options "nosniff"
    X-Frame-Options "DENY"
    Referrer-Policy "strict-origin-when-cross-origin"
    Content-Security-Policy "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'"
  }
  handle /v1/* { reverse_proxy api:3000 }
  handle       { reverse_proxy web:3000 }
}
```

`script-src 'unsafe-inline'` est nécessaire au script de thème de la tâche 17 ; il se remplacera par un `nonce` quand la page en aura d'autres.

- [ ] **Étape 2 : les sauvegardes**

`infra/deploy/backup.sh` — `pg_dump` compressé, chiffré par `age` avec une clé publique dont la privée ne vit pas sur le VPS, envoyé vers Cloudflare R2, rétention glissante. Programmé chaque nuit.

- [ ] **Étape 3 : la restauration, vérifiée**

Restaurer la dernière sauvegarde dans une base jetable et compter les tables :
```bash
age -d -i restore-key.txt backup-latest.sql.age | gunzip | psql "$URL_CONTROLE"
psql "$URL_CONTROLE" -c "select count(*) from information_schema.tables where table_schema='public'"
```
Attendu : le même nombre de tables qu'en production. **Une sauvegarde jamais restaurée ne vaut rien** — à refaire chaque mois, noté au calendrier.

- [ ] **Étape 4 : l'observation**

Sentry côté API et web, avec l'identifiant de corrélation de la tâche 9 comme étiquette. PostHog derrière un adaptateur interne, pour que changer d'outil ne touche que lui. **Ne jamais y envoyer** le contenu des notes, les adresses ni les numéros — on compte des faits, on ne transporte pas ce qui a été écrit.

- [ ] **Étape 5 : vérifier de bout en bout**

```bash
curl -sS https://lehno.app/v1/public/config | jq .
curl -sS -o /dev/null -w '%{http_code}\n' https://lehno.app/fr
curl -sS -X POST https://lehno.app/v1/public/waitlist \
  -H 'content-type: application/json' -d '{"email":"essai@example.com","locale":"fr"}'
```
Attendu : la configuration en JSON, `200` sur la landing, et le dépôt accepté. Vérifier ensuite en base que l'adresse est bien là, et une seule fois si l'on rejoue l'appel.

- [ ] **Étape 6 : commit**

```bash
git add infra/deploy apps
git commit -m "exploitation: mise en ligne, TLS et en-têtes, sauvegardes chiffrées, observation"
```

---

## Ce que la phase 0 laisse ouvert

- La **durée de vie** exacte des jetons : quinze minutes et soixante jours sont des valeurs de départ, à ajuster sur l'usage réel.
- Le **fournisseur d'IA** des deux traitements gratuits de la phase 1, et le modèle retenu chez lui.
- Le **fuseau par défaut** d'un compte à la création : déduit de l'appareil, ou fixé puis corrigé dans les réglages.
- Le **pseudo provisoire** attribué à la création (`u` + huit caractères) suppose que l'écran de première connexion en fasse choisir un vrai. Cet écran est de phase 1.

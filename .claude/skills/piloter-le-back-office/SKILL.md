---
name: piloter-le-back-office
description: Lancer le back-office et le piloter dans un vrai navigateur, contre une vraie API et une vraie base. À employer dès qu'on veut éprouver un écran d'administration autrement qu'en test — et avant d'affirmer qu'une fonctionnalité marche.
---

# Piloter le back-office dans un navigateur

Les suites de l'outil rendent des composants en mémoire. Elles ne voient ni une
classe CSS qui n'existe pas, ni une origine refusée, ni un écran qui reste en
échec après une connexion réussie. **Les trois sont arrivés le 28/08/2026**, sur
du code dont toutes les suites étaient vertes.

Cette recette a coûté cinq détours à établir. Suivez-la ; ne la redécouvrez pas.

---

## 1. L'API, avec le courrier en console

Le code de connexion part par courriel. Sans boîte aux lettres, on ne le lit
nulle part — sauf en forçant l'adaptateur console.

```bash
cd apps/api
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
set -a; . ../../.env.local; set +a          # le worktree n'a pas de .env.local
export RESEND_API_KEY="" RESEND_FROM=""     # VIDES, pas absentes — voir ci-dessous
export PORT=3099 LEHNO_MAIL_CONSOLE=1
node --import tsx/esm src/main.ts > /tmp/api-verif.log 2>&1 &
```

**Deux pièges, tous deux rencontrés :**

- **Resend prime sur la console.** `app.module.ts` choisit l'adaptateur ainsi :
  si `RESEND_API_KEY` **et** `RESEND_FROM` sont posées, c'est Resend, quelle que
  soit `LEHNO_MAIL_CONSOLE`. La clé du projet refuse les envois vers une adresse
  non vérifiée — d'où un `500` sur la demande de code.
- **`unset` ne suffit pas.** `env.ts` appelle dotenv au démarrage, qui relit
  `.env.local` et repose ce qu'on vient d'enlever. Il faut les poser **vides** :
  dotenv n'écrase jamais une variable déjà présente.

Un worktree n'a pas de `.env.local` — il est ignoré par git. D'où le `set -a`
sur celui de la copie principale, sinon le démarrage échoue sur `OTP_PEPPER`.

## 2. L'outil

```bash
cd apps/admin
VITE_API_URL=http://localhost:3099/v1 pnpm dev
```

Vite sert sur **5173**. Cette origine est autorisée par `common/cors.ts` depuis
le 28/08 — avant, chaque appel était refusé par le navigateur avant de partir,
et l'outil n'était pas utilisable en local. Si vous voyez
`No 'Access-Control-Allow-Origin' header`, c'est là qu'il faut regarder.

## 3. Un compte d'administration

```bash
PGPASSWORD=lehno psql -h localhost -p 5433 -U lehno -d lehno \
  -tAc "insert into admin (email, role) values ('verif@lehno.app', 'admin') on conflict do nothing;"
```

## 4. Le pilote

Playwright s'installe **hors du dépôt** — le bac à sable de la session, jamais
`package.json`. `playwright-core` suffit : il emprunte le Chrome du poste, sans
télécharger de navigateur.

```bash
mkdir -p "$SCRATCH/pilote" && cd "$SCRATCH/pilote"
npm init -y && npm install playwright-core
```

```js
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

const codes = () => [...readFileSync("/tmp/api-verif.log", "utf8")
  .matchAll(/\b(\d{6})\b/g)].map((m) => m[1]);

const navigateur = await chromium.launch({ channel: "chrome", headless: true });
const page = await (await navigateur.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();

// Le relevé des appels vaut autant que les captures : il dit quelle route a
// répondu quoi, et dans quel ordre.
const appels = [];
page.on("response", (r) => { if (r.url().includes("/v1/")) appels.push(`${r.status()} ${r.request().method()} ${r.url()}`); });
page.on("pageerror", (e) => console.log("page:", e.message));
page.on("requestfailed", (r) => console.log("requête:", r.url(), r.failure()?.errorText));

await page.goto("http://localhost:5173", { waitUntil: "networkidle" });

// Le code apparaît dans le journal du serveur, jamais à l'écran.
const avant = codes().at(-1);
await page.getByLabel("Adresse e-mail").fill("verif@lehno.app");
await page.getByRole("button", { name: "Recevoir un code" }).click();
let code = null;
for (let i = 0; i < 30 && !code; i += 1) {
  await page.waitForTimeout(500);
  const c = codes().at(-1);
  if (c && c !== avant) code = c;
}
await page.getByLabel("Code à 6 chiffres").fill(code);
await page.getByRole("button", { name: "Entrer", exact: true }).click();
await page.waitForTimeout(2500);

await page.getByRole("navigation").getByText("Métriques", { exact: true }).click();
await page.screenshot({ path: "metriques.png", fullPage: true });
```

**Regardez la capture.** Une page qui se rend n'est pas une page correcte : le
tableau coupé après deux colonnes et le libellé collé à son texte ne se voyaient
que là.

## 5. Ce qui mute l'état global

L'arrêt pour intervention ferme l'API **pour tous ceux qui lisent la même
base** — y compris le serveur de développement du propriétaire. Ne l'éprouvez
jamais sur la base partagée. Une base jetable coûte trois commandes :

```bash
PGPASSWORD=lehno psql -h localhost -p 5433 -U lehno -d postgres \
  -c "create database lehno_essai;"
DATABASE_URL="postgresql://lehno:lehno@localhost:5433/lehno_essai" \
  pnpm --filter @lehno/api exec prisma migrate deploy --schema ../../prisma/schema.prisma
# … puis l'API sur un autre port, avec ce DATABASE_URL
```

Et on la supprime après.

## 6. Ranger — **par port, jamais par motif de commande**

```bash
kill $(lsof -tiTCP:3099 -sTCP:LISTEN) 2>/dev/null   # votre API
kill $(lsof -tiTCP:5173 -sTCP:LISTEN) 2>/dev/null   # votre Vite
PGPASSWORD=lehno psql -h localhost -p 5433 -U lehno -d postgres -c "drop database if exists lehno_essai;"
```

> **N'employez pas `pkill -f "tsx/esm src/main.ts"`.** Le serveur de
> développement du propriétaire tourne avec **exactement la même ligne de
> commande** : le motif l'emporte avec les vôtres, et il faut le relancer — avec
> son `PORT=3001`, que le défaut ne rend pas. C'est arrivé le 28/08, en rangeant
> précisément cette recette.

---

## Ce que ce contrôle a trouvé, une fois établi

Cinq défauts en une séance, tous sur du code aux suites vertes : sept classes
CSS inexistantes, un libellé collé à son texte, une commande offerte deux fois,
un bouton « Enregistrer » éteint en permanence qui bloquait tous les réglages du
produit, et un tableau de bord en échec après chaque connexion.

Aucun n'était visible autrement.

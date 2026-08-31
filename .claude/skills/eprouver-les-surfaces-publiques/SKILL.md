---
name: eprouver-les-surfaces-publiques
description: Monter une vraie API sur une base jetable, semer de quoi voir les cinq surfaces de lien, et les piloter dans un navigateur. À employer avant d'affirmer qu'une page publique marche — les suites en mémoire ne voient ni un statut mal deviné, ni un en-tête refusé par la requête préalable.
---

# Éprouver les surfaces publiques

Le 30/08/2026, **293 tests étaient verts** au-dessus de trois défauts : un statut
deviné (403 au lieu de 422), un 410 pris pour une panne, et un en-tête que le
CORS refusait — ce dernier tuant en silence « le visiteur revenu retrouve les
siens ».

Aucun n'était visible autrement, pour une seule raison : **un faux serveur rend
ce que le client attend.** Les tests aussi. Vert des deux côtés, faux des deux
côtés.

Cette recette a coûté une demi-journée à établir. Suivez-la.

---

## 1. Une base à soi, jamais celle du propriétaire

Allumer un drapeau ou semer un compte dans la base de développement change ce
que le propriétaire voit. On monte la sienne :

```bash
docker run -d --name lehno-verif \
  -e POSTGRES_USER=lehno -e POSTGRES_PASSWORD=lehno -e POSTGRES_DB=lehno \
  -p 5455:5432 postgres:16-alpine

cd apps/api
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
set -a; . ../../.env.local; set +a          # un worktree n'a pas de .env.local
export DATABASE_URL="postgresql://lehno:lehno@localhost:5455/lehno"
npx prisma migrate deploy
```

## 2. L'API, avec le courrier en console

```bash
export RESEND_API_KEY="" RESEND_FROM=""     # VIDES, pas absentes
export LEHNO_MAIL_CONSOLE=1 PORT=3098
node --import tsx/esm src/main.ts > /tmp/api-verif.log 2>&1 &
```

`unset` ne suffit pas : `env.ts` appelle dotenv, qui relit `.env.local` et
repose ce qu'on vient d'enlever — et si `RESEND_API_KEY` et `RESEND_FROM` sont
posées, Resend prime sur la console, quelle que soit `LEHNO_MAIL_CONSOLE`.

**Les drapeaux naissent au démarrage**, éteints (`FlagsService.reconcilier`).
Une base fraîche n'en a aucun tant que l'API n'a pas démarré une fois. Ensuite :

```sql
update feature_flag set enabled = true
 where key in ('wall','collect','wishes','wishlist','wishlist.own','reservation','referral');
```

Sans eux, les cinq contrôleurs rendent **404** — ce qui est un cas à éprouver en
soi : drapeau éteint, la page n'existe pour personne.

## 3. Semer

Les pièges rencontrés, dans l'ordre où ils tombent :

- `PersonRegister` vaut `familier | amical | formel` — pas `tu` ;
- `WishlistStatus` vaut `available | reserved | fulfilled` — pas `active` ;
- **un seul lien de vœux par occasion** (contrainte d'unicité) : pour éprouver
  le lien révoqué, il faut une seconde occasion ;
- la liste partagée lit `owner_wish`, **pas** `wishlist_item`, et filtre
  `is_public` en base ;
- la fenêtre de vœux s'ouvre **7 jours avant** l'occasion : une occasion à J+12
  donne `isOpen: false`, une à J+3 donne le dépôt ouvert **et** le bouton du Mur.

## 4. Le site, sur une origine autorisée

```bash
NEXT_PUBLIC_API_URL=http://localhost:3098 pnpm --filter @lehno/web build
API_URL=http://localhost:3098 NEXT_PUBLIC_API_URL=http://localhost:3098 \
  PORT=3000 npx next start
```

**Le port 3000, pas un autre** : `common/cors.ts` n'autorise que 3000 et 5173 en
développement. Sur 3100, chaque envoi est refusé par le navigateur avant de
partir.

Et `NEXT_PUBLIC_API_URL` doit être posée **à la construction** : Next l'inscrit
dans le paquet. Servie sans elle, la page se rend bien et tous les envois
partent vers le serveur Next — qui répond 404, ce qui se lit comme une panne.

## 5. Piloter

`playwright-core` **hors du dépôt** (dans le scratchpad), `chromium.launch({
channel: "chrome" })`.

**Attendez 1,4 s après le chargement avant de cliquer.** Le filtre anti-robot
refuse toute soumission arrivée en moins d'une seconde après le rendu
(`renderedAt`) : Playwright est plus rapide qu'un humain, et le refus se lit
comme une panne (« délai de soumission invraisemblable » dans le journal).

Le code à six chiffres se lit dans le journal de l'API :
`grep -oE "\b[0-9]{6}\b" /tmp/api-verif.log | tail -1`.

Ce qu'il faut regarder, et que les suites ne voient pas :

- les **erreurs de console**, y compris `blocked by CORS policy` ;
- le **débordement horizontal** à 390 px — ces liens s'ouvrent sur un téléphone ;
- ce que le serveur a **réellement reçu** (relisez la base), pas ce que la page
  croit avoir envoyé ;
- ce qu'un **autre** visiteur voit de la même ressource.

## 6. Démonter — par le port, jamais par `pkill -f`

Le serveur du propriétaire porte la même ligne de commande : `pkill -f
"tsx/esm src/main.ts"` l'a déjà tué une fois.

```bash
kill $(lsof -tiTCP:3000 -sTCP:LISTEN)
kill $(lsof -tiTCP:3098 -sTCP:LISTEN)
docker rm -f lehno-verif
```

Puis vérifiez que l'API du propriétaire répond toujours.

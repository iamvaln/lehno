# Prisma — piège connu : `citext` et `inet`

Ce schéma porte des types que Prisma ne sait pas exprimer : `citext`
(unicité insensible à la casse sur les adresses et les pseudos) et `inet`
(adresses IP, pour investigation, jamais lues par le client Prisma). Ils
ont été posés **à la main**, en SQL ajouté à la fin des fichiers de
migration — voir `migrations/20260822134245_identity/migration.sql`.

## Le piège

Quand tu ajoutes une nouvelle migration avec :

```bash
pnpm --filter @lehno/api exec prisma migrate dev --name <ta-migration> --create-only
```

Prisma calcule le SQL en comparant l'état de la base (rejouée depuis les
migrations existantes, donc avec `citext`/`inet`) à ce que dit
`schema.prisma` (qui ne peut décrire que `text` et pas de colonne `ip` du
tout, faute de support). Il en conclut — à tort — qu'il faut corriger une
dérive, et génère des lignes comme :

```sql
ALTER TABLE "user" ALTER COLUMN "email" SET DATA TYPE TEXT;
ALTER TABLE "device_signup" DROP COLUMN "ip";
```

**Retire ces lignes du SQL généré avant d'appliquer la migration.** Si
elles passent, l'unicité insensible à la casse de l'adresse et du pseudo
disparaît en silence — deux comptes `awa@…` et `AWA@…` redeviennent
possibles — et les colonnes `ip` sont perdues. Aucune erreur ne le
signale sur le moment : c'est `apps/api/test/schema-identity.test.ts`
(le test « les types citext et inet posés à la main survivent aux
migrations ») qui l'attrape, en interrogeant `information_schema.columns`
directement.

## Colonnes concernées

`citext` : `user.email`, `user.username`, `otp_code.target_email`,
`federated_identity.email_at_link`, `login_activity.attempted_email`,
`waitlist_signup.email`.

`inet` : `device_signup.ip`, `login_activity.ip`, `refresh_token.ip`.

## Méthode

1. `prisma migrate dev --name <nom> --create-only` — génère sans appliquer.
2. Relire le SQL généré ; retirer toute ligne qui repasse une des colonnes
   ci-dessus en `text`, ou qui touche à une colonne `ip`.
3. Ajouter le SQL manuel nécessaire à ta migration, s'il y en a.
4. `prisma migrate deploy` — applique.
5. `pnpm --filter @lehno/api test` — le test de garde-fou ci-dessus doit
   rester vert.

Ne modifie jamais une migration déjà appliquée : les checksums de Prisma
le détecteraient, et une base déjà migrée s'en trouverait décalée.
Crée toujours une nouvelle migration.

-- La forme canonique d'une adresse : celle sous laquelle deux saisies
-- désignent la même boîte. Sans elle, « a+1@example.com » et
-- « a+2@example.com » sont deux lignes, deux confirmations, et une liste
-- gonflée par une seule personne. Voir apps/api/src/common/email.ts, qui
-- porte la même règle côté application.
--
-- « email » reste en citext et n'est pas touchée : c'est l'adresse telle
-- qu'elle a été saisie, celle à laquelle on écrit. Prisma ne connaît pas ce
-- type et son diff proposait de la rétrograder en text — ce qui aurait retiré
-- l'unicité insensible à la casse sans que rien ne le signale.

-- Ajoutée en NULL d'abord : une table déjà peuplée doit pouvoir se remplir
-- avant que la contrainte ne s'applique.
ALTER TABLE "waitlist_signup" ADD COLUMN "email_canonical" citext;

-- Report des lignes existantes, avec la même règle que le code applique :
-- casse abaissée, étiquette après le « + » retirée, et chez Gmail seulement,
-- points ignorés et googlemail.com ramené à gmail.com.
UPDATE "waitlist_signup"
SET "email_canonical" = (
  CASE
    WHEN split_part(lower("email"::text), '@', 2) IN ('gmail.com', 'googlemail.com')
      THEN replace(
             regexp_replace(split_part(lower("email"::text), '@', 1), '\+.*$', ''),
             '.', ''
           ) || '@gmail.com'
    ELSE regexp_replace(split_part(lower("email"::text), '@', 1), '\+.*$', '')
           || '@' || split_part(lower("email"::text), '@', 2)
  END
)::citext
WHERE "email_canonical" IS NULL;

-- Deux lignes d'avant la contrainte peuvent désigner la même boîte : on garde
-- la plus ancienne, celle qui a reçu la confirmation.
DELETE FROM "waitlist_signup" a
USING "waitlist_signup" b
WHERE a."email_canonical" = b."email_canonical"
  AND a."created_at" > b."created_at";

ALTER TABLE "waitlist_signup" ALTER COLUMN "email_canonical" SET NOT NULL;

CREATE UNIQUE INDEX "waitlist_signup_email_canonical_key"
  ON "waitlist_signup" ("email_canonical");

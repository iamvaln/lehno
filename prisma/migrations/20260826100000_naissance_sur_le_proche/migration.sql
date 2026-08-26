-- La date de naissance appartient au PROCHE, pas à un événement.
--
-- C'est un fait de son identité, au même titre que son nom ou sa ville.
-- L'anniversaire n'en est qu'une conséquence : le prochain jour de l'année
-- portant le même jour et le même mois — celui de cette année s'il est devant
-- nous, celui de l'année prochaine sinon.
--
-- La ranger sur un `event` revenait à mêler un fait d'identité aux
-- rendez-vous, et obligeait à la corriger à deux endroits le jour où elle se
-- révélait fausse.

ALTER TABLE "person"
  ADD COLUMN "birth_date" date,
  -- Faux quand on connaît le jour et le mois sans l'année : on suit alors
  -- l'anniversaire sans pouvoir annoncer d'âge. C'est la NAISSANCE dont
  -- l'année est inconnue — l'anniversaire, lui, a toujours celle qui vient.
  ADD COLUMN "birth_year_known" boolean NOT NULL DEFAULT true;

-- Report des anniversaires déjà saisis : leur date d'ancrage ÉTAIT la date de
-- naissance, sous l'ancien modèle. On la remonte sur le proche avant que
-- `event.reference_date` ne change de sens.
UPDATE "person" p
SET "birth_date" = e."reference_date",
    "birth_year_known" = e."year_known"
FROM "event" e
WHERE e."person_id" = p."id" AND e."kind" = 'birthday';

-- `event.reference_date` devient uniformément une date À VENIR. Les
-- anniversaires existants portent encore une date de naissance : on les
-- recale sur leur prochaine échéance, sans quoi la règle « un événement dit
-- quand la chose sera » serait fausse dès la première lecture.
--
-- Le 29 février se ramène au 28 les années communes, comme partout ailleurs
-- dans ce produit (voir apps/api/src/me/calendrier.ts).
UPDATE "event"
SET "reference_date" = (
  CASE
    WHEN make_date(
      EXTRACT(YEAR FROM CURRENT_DATE)::int,
      EXTRACT(MONTH FROM "reference_date")::int,
      LEAST(
        EXTRACT(DAY FROM "reference_date")::int,
        EXTRACT(DAY FROM (
          date_trunc('month', make_date(
            EXTRACT(YEAR FROM CURRENT_DATE)::int,
            EXTRACT(MONTH FROM "reference_date")::int, 1
          )) + interval '1 month - 1 day'
        ))::int
      )
    ) >= CURRENT_DATE
    THEN make_date(
      EXTRACT(YEAR FROM CURRENT_DATE)::int,
      EXTRACT(MONTH FROM "reference_date")::int,
      LEAST(
        EXTRACT(DAY FROM "reference_date")::int,
        EXTRACT(DAY FROM (
          date_trunc('month', make_date(
            EXTRACT(YEAR FROM CURRENT_DATE)::int,
            EXTRACT(MONTH FROM "reference_date")::int, 1
          )) + interval '1 month - 1 day'
        ))::int
      )
    )
    ELSE make_date(
      EXTRACT(YEAR FROM CURRENT_DATE)::int + 1,
      EXTRACT(MONTH FROM "reference_date")::int,
      LEAST(
        EXTRACT(DAY FROM "reference_date")::int,
        EXTRACT(DAY FROM (
          date_trunc('month', make_date(
            EXTRACT(YEAR FROM CURRENT_DATE)::int + 1,
            EXTRACT(MONTH FROM "reference_date")::int, 1
          )) + interval '1 month - 1 day'
        ))::int
      )
    )
  END
)
WHERE "kind" = 'birthday';

-- L'information vit désormais sur le proche. La garder ici en ferait une
-- seconde vérité, et deux vérités finissent toujours par diverger.
ALTER TABLE "event" DROP COLUMN "year_known";

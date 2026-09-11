-- La fiche de soi, pour les comptes ouverts avant qu'elle existe.
--
-- `person.is_self` se lisait à cinq endroits et ne s'écrivait nulle part. Le
-- correctif de fond est la création à l'inscription — elle arrive avec cette
-- livraison —, mais elle ne vaut que pour les comptes À VENIR. Ceux qui
-- tournent depuis des semaines n'en auront jamais, et rien ne la leur donnera
-- après coup : c'est ce que cette migration répare.
--
-- Trois choses se réveillent d'un coup, pour eux comme pour les autres : une
-- wishlist peut viser une occasion, « Ma date d'anniversaire » a de quoi
-- exposer, et « Pour qui » liste enfin le titulaire du compte.
--
-- LE NOM VIENT DU PSEUDO, faute de mieux. C'est le seul dont on dispose ici, et
-- c'est celui que la création à l'inscription emploie — les deux chemins
-- doivent poser la même chose, sans quoi un compte repris se distinguerait d'un
-- compte neuf sans raison.
--
-- LE GENRE N'EST PAS ÉCRIT : la colonne porte `DEFAULT 'unspecified'` depuis
-- `20260825160000_person_complet`, et le laisser faire évite de renommer ici
-- une énumération dont le nom Postgres et le `@@map` pourraient diverger —
-- c'est déjà arrivé trois fois dans ce dépôt.
--
-- IDEMPOTENTE PAR LE `NOT EXISTS` : un compte qui a déjà sa fiche n'en reçoit
-- pas une seconde. L'index unique partiel refuserait d'ailleurs le doublon —
-- mais échouer sur une contrainte au lieu de ne rien faire transformerait une
-- reprise rejouée en migration en panne.

INSERT INTO "person" ("user_id", "display_name", "is_self")
SELECT u."id", u."username", true
  FROM "user" u
 WHERE NOT EXISTS (
   SELECT 1 FROM "person" p WHERE p."user_id" = u."id" AND p."is_self"
 );

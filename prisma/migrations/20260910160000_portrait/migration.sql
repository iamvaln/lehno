-- Le portrait produit : un texte, puis une image composée à l'approbation.
--
-- ─── DEUX TEMPS, ET C'EST LA MODÉRATION ─────────────────────────────────────
--
-- Le contrat le dit : « l'image composée, produite à l'approbation ». Le
-- lancement rend un TEXTE, que son auteur relit ; l'image ne se fabrique que
-- s'il l'approuve. Produire les deux d'un coup ferait payer une image que
-- personne ne veut, et surtout : une image se corrige moins bien qu'un texte —
-- on la refait, on ne la retouche pas.
--
-- ─── ET IL NE S'EXPOSE À AUCUNE ADRESSE PUBLIQUE ────────────────────────────
--
-- « L'utilisateur l'enregistre et l'envoie lui-même. » Aucune colonne de
-- publication ici, donc, et ce n'est pas un oubli : un portrait dit quelque
-- chose d'une personne précise, et le publier engagerait quelqu'un qui n'a rien
-- demandé. Le §7 du relevé mobile le compte parmi les manques ; c'en est
-- l'inverse.
CREATE TYPE "PortraitStatus" AS ENUM ('generated', 'approved');

CREATE TABLE "portrait" (
    "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
    -- Un portrait par exécution : relancer en produit un autre, il ne complète
    -- pas le précédent. Sans cette unicité, une reprise interrompue pourrait en
    -- écrire un second sur la même exécution, et `resultId` n'aurait plus de
    -- réponse unique.
    "action_run_id"  UUID NOT NULL,
    "user_id"        UUID NOT NULL,
    -- Le proche qu'il représente. CASCADE : la fiche effacée, ce qui la
    -- représentait n'a plus d'objet — à la différence d'une idée de cadeau, qui
    -- ne dit rien de personne et survit.
    "person_id"      UUID NOT NULL,
    "content"        TEXT NOT NULL,
    -- La version courte, pour le format vertical. Elle sort du MÊME appel que
    -- le texte : deux appels donneraient deux textes qui peuvent se
    -- contredire, et coûteraient deux fois pour un crédit débité une fois.
    "short_content"  TEXT,
    -- Le mot que l'expéditeur ajoute de sa main, à côté de ce qui a été produit.
    "sender_note"    TEXT,
    -- UNE CLÉ, JAMAIS UNE URL. Les adresses que rendent les fournisseurs
    -- d'image EXPIRENT — souvent en une heure : un portrait dont on garderait
    -- le lien s'afficherait le jour même et montrerait un trou la semaine
    -- suivante, sans que rien n'ait changé chez nous. Le serveur signe une
    -- lecture à chaque affichage.
    -- Nulle tant que l'image n'est pas composée, c'est-à-dire tant que le
    -- portrait n'est pas approuvé.
    "image_key"      TEXT,
    "status"         "PortraitStatus" NOT NULL DEFAULT 'generated',
    "created_at"     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portrait_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "portrait_action_run_id_key" ON "portrait"("action_run_id");
CREATE INDEX "portrait_user_id_created_at_idx" ON "portrait"("user_id", "created_at");
CREATE INDEX "portrait_person_id_idx" ON "portrait"("person_id");

-- L'IMAGE SUIT L'APPROBATION, dans les deux sens. Un portrait approuvé sans
-- image serait un écran qui promet une image qui n'arrive pas ; une image sur
-- un portrait non approuvé serait une dépense que personne n'a demandée.
-- Posé en base parce que les deux colonnes s'écrivent à des moments
-- différents, et qu'une seule des deux écritures qui aboutit est exactement le
-- cas qu'on ne veut pas laisser passer.
ALTER TABLE "portrait" ADD CONSTRAINT "portrait_image_suit_approbation"
    CHECK (("status" = 'approved') = ("image_key" IS NOT NULL));

ALTER TABLE "portrait" ADD CONSTRAINT "portrait_action_run_id_fkey"
    FOREIGN KEY ("action_run_id") REFERENCES "action_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "portrait" ADD CONSTRAINT "portrait_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "portrait" ADD CONSTRAINT "portrait_person_id_fkey"
    FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

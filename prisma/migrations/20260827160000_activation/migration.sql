-- Les natures d'activation, et leur désabonnement.
--
-- Elles manquaient au modèle : le produit savait relancer qui a un carnet et
-- l'a laissé dormir, jamais qui n'en a jamais commencé un.
--
-- Bornées dans le temps et plafonnées à deux envois, elles ne sont pas réglables
-- dans l'application — la fenêtre se refermerait avant que quiconque n'ouvre les
-- réglages. Le lien du courrier les coupe toutes d'un clic, sans connexion.
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'activation_first_person';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'activation_first_note';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'activation_unused_credits';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'activation_collect_link';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'activation_invite';

-- Le désabonnement vit sur le COMPTE et non dans les préférences : celles-ci se
-- règlent nature par nature dans l'application, et l'activation n'y figure pas.
-- Un booléen à part dit exactement ce qu'il est — un renoncement définitif,
-- posé depuis un courrier.
ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "activation_emails_opted_out" BOOLEAN NOT NULL DEFAULT false;

-- Les fenêtres et les plafonds, réglables sans redéploiement — comme la fenêtre
-- de vœux. Les valeurs de départ sont des paris, à corriger dès qu'on aura des
-- usages réels.
insert into "system_parameter" ("id", "key", "value", "value_type", "description", "updated_at") values
  (gen_random_uuid(), 'activation_window_days', '21', 'duration', 'Fenêtre après l''inscription pendant laquelle les relances d''activation partent', now()),
  (gen_random_uuid(), 'activation_max_sends', '2', 'number', 'Nombre maximal de relances par nature d''activation. Au-delà, on abandonne', now()),
  (gen_random_uuid(), 'nudge_silence_days', '30', 'duration', 'Sans note depuis ce délai, le compte reçoit une relance d''enrichissement', now())
on conflict ("key") do nothing;

-- Le compte : suppression en trois temps, appareils, export de données.
--
-- Écrite à la main plutôt qu'engendrée : `migrate diff` contre ce schéma sort
-- aujourd'hui une dérive préexistante sur develop (clés étrangères des
-- paiements et des crédits, jamais versionnées). Embarquer cette dérive ici
-- ferait porter à ce chantier des changements qui ne sont pas les siens, et
-- rendrait ce fichier impossible à relire. Seuls les deux changements
-- ci-dessous appartiennent à la suppression de compte.

-- La raison du code à usage unique qui confirme une suppression (§3.24,
-- troisième temps). À part de `login` : les codes s'annulent entre eux par
-- (adresse, raison), donc partager la raison ferait qu'un code demandé pour se
-- connecter suffirait à effacer le compte.
--
-- ALTER TYPE ... ADD VALUE ne peut pas servir dans la même transaction que sa
-- déclaration ; cette migration ne fait que l'ajouter, le code l'emploie
-- ensuite. Postgres 12+ accepte l'ajout en transaction, ce que Prisma exige.
ALTER TYPE "OtpReason" ADD VALUE IF NOT EXISTS 'account_deletion';

-- Deux paramètres du socle, réglables en back-office sans redéploiement —
-- comme les autres plafonds (voir la migration `notifications`).
--
-- `refund_method_min_age_days` porte une clause des CGU §6 (« enregistrée
-- depuis plus de deux semaines »). Elle vit en base parce que le contrat
-- publié promet déjà que le serveur rend le verdict d'éligibilité et que le
-- client ne le recalcule pas : une constante dans le code obligerait à
-- redéployer pour honorer un changement de conditions.
--
-- `max_devices_per_account` est GÉNÉREUX à dessein. Un jeton de notification
-- est lié à une installation, pas à un appareil : réinstaller l'application en
-- crée un nouveau. Un plafond serré ferait donc taire les notifications de
-- quelqu'un qui a simplement changé de téléphone deux fois — une panne
-- silencieuse, celle qu'on ne diagnostique jamais. Il est là pour arrêter une
-- boucle de client défaillant, pas pour rationner un usage normal.
insert into "system_parameter" ("id", "key", "value", "value_type", "description", "updated_at") values
  (gen_random_uuid(), 'refund_method_min_age_days', '14', 'number', 'Ancienneté minimale d''une méthode de paiement pour recevoir un remboursement (CGU §6), en jours', now()),
  (gen_random_uuid(), 'max_devices_per_account',    '10', 'number', 'Plafond de jetons de notification enregistrés par compte', now())
on conflict ("key") do nothing;

-- La contrainte `payment_voie_manuelle_a_un_compte` exigeait un compte de
-- collecte sur toute voie non-prestataire. Son commentaire d'origine dit
-- pourquoi : « sur les voies manuelles, l'argent ARRIVE forcément quelque
-- part » — sans ce compte, on ne saurait pas où aller vérifier la réception.
--
-- Le raisonnement vaut pour un encaissement, et seulement pour lui. Un
-- REMBOURSEMENT est de l'argent qui PART : il n'arrive sur aucun de nos
-- comptes de collecte, il quitte le service vers la méthode de paiement du
-- client, et il n'y a aucune réception à vérifier de notre côté. La contrainte
-- a été écrite quand `direction` ne valait que `charge` ; elle rendait
-- simplement impossible d'enregistrer le remboursement que les CGU §6
-- promettent à la suppression du compte.
--
-- On l'exempte donc pour les seuls remboursements, plutôt que de leur faire
-- porter `mode = 'provider'` — ce qui aurait été le contournement facile, et
-- un mensonge : aucun prestataire n'exécute ce versement aujourd'hui, et
-- déclarer la voie « prestataire » ferait attendre une notification qui ne
-- viendrait jamais.
ALTER TABLE "payment" DROP CONSTRAINT "payment_voie_manuelle_a_un_compte";
ALTER TABLE "payment" ADD CONSTRAINT "payment_voie_manuelle_a_un_compte" CHECK (
    "direction" = 'refund' OR "mode" = 'provider' OR "collection_account_id" IS NOT NULL
);

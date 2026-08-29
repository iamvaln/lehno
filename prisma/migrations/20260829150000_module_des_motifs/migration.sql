-- Le module des motifs d'administration.
--
-- Jusqu'ici le motif était une phrase libre, et les listes proposées vivaient
-- dans le dictionnaire du back-office — donc BILINGUES. Le même geste
-- s'inscrivait au journal « Fraude suspectée » ou « Suspected fraud » selon la
-- langue de l'administrateur au moment du clic. Deux textes pour un motif :
-- « combien de suspensions pour fraude » n'avait pas de réponse, non parce que
-- la donnée manquait, mais parce qu'elle existait en deux orthographes
-- qu'aucune requête ne rapproche.
--
-- Ce qu'on enregistre devient donc un CODE STABLE. Le libellé reste affichable
-- et corrigeable ; le code, lui, ne bouge jamais.

CREATE TABLE "audit_reason" (
    "id"        UUID NOT NULL DEFAULT gen_random_uuid(),
    "code"      VARCHAR(48) NOT NULL,
    "label_fr"  VARCHAR(120) NOT NULL,
    "label_en"  VARCHAR(120) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_reason_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "audit_reason_code_key" ON "audit_reason"("code");

-- Le GESTE, et non l'action journalisée. Le vocabulaire du journal est plus
-- grossier que celui des écrans : `user_status_update` couvre la suspension ET
-- le rétablissement. Ranger les motifs par action proposerait « Compte de
-- test » au moment de suspendre quelqu'un.
CREATE TABLE "audit_reason_scope" (
    "id"        UUID NOT NULL DEFAULT gen_random_uuid(),
    "reason_id" UUID NOT NULL,
    "geste"     VARCHAR(48) NOT NULL,
    "position"  SMALLINT,
    CONSTRAINT "audit_reason_scope_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "audit_reason_scope_reason_id_fkey"
        FOREIGN KEY ("reason_id") REFERENCES "audit_reason"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "audit_reason_scope_reason_id_geste_key"
    ON "audit_reason_scope"("reason_id", "geste");
CREATE INDEX "audit_reason_scope_geste_position_idx"
    ON "audit_reason_scope"("geste", "position");

-- ─── Le code retenu, sur ce qui le cite ──────────────────────────────────────

-- `reason` porte ce que l'administrateur a écrit ; celui-ci porte ce qu'on peut
-- COMPTER. Les deux, et pas l'un ou l'autre : le code sans la phrase perd la
-- nuance, la phrase sans le code ne s'agrège pas.
ALTER TABLE "audit_log" ADD COLUMN "reason_code" VARCHAR(48);
CREATE INDEX "audit_log_reason_code_idx" ON "audit_log"("reason_code", "created_at" DESC);

ALTER TABLE "payment_channel_history" ADD COLUMN "reason_code" VARCHAR(48);

-- ─── L'historisation du module lui-même ──────────────────────────────────────
--
-- Une table de motifs est une configuration d'administration comme une autre :
-- savoir quel libellé portait un code au moment d'un geste passé est
-- exactement la question à laquelle ce chantier existe pour répondre.

CREATE TABLE "audit_reason_history" (
    "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
    "audit_reason_id" UUID NOT NULL,
    "code"       VARCHAR(48) NOT NULL,
    "label_fr"   VARCHAR(120) NOT NULL,
    "label_en"   VARCHAR(120) NOT NULL,
    "is_active"  BOOLEAN NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "valid_from" TIMESTAMPTZ NOT NULL,
    "valid_to"   TIMESTAMPTZ,
    "changed_by" UUID,
    "reason"     TEXT NOT NULL,
    "reason_code" VARCHAR(48),
    CONSTRAINT "audit_reason_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "audit_reason_history_periode" CHECK ("valid_to" IS NULL OR "valid_to" >= "valid_from")
);
CREATE UNIQUE INDEX "audit_reason_history_une_seule_ouverte"
    ON "audit_reason_history"("audit_reason_id") WHERE "valid_to" IS NULL;
CREATE INDEX "audit_reason_history_par_motif_et_date"
    ON "audit_reason_history"("audit_reason_id", "valid_from" DESC);

CREATE TABLE "audit_reason_scope_history" (
    "id"                    UUID NOT NULL DEFAULT gen_random_uuid(),
    "audit_reason_scope_id" UUID NOT NULL,
    "reason_id"  UUID NOT NULL,
    "geste"      VARCHAR(48) NOT NULL,
    "position"   SMALLINT,
    "valid_from" TIMESTAMPTZ NOT NULL,
    "valid_to"   TIMESTAMPTZ,
    "changed_by" UUID,
    "reason"     TEXT NOT NULL,
    "reason_code" VARCHAR(48),
    CONSTRAINT "audit_reason_scope_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "audit_reason_scope_history_periode" CHECK ("valid_to" IS NULL OR "valid_to" >= "valid_from")
);
CREATE UNIQUE INDEX "audit_reason_scope_history_une_seule_ouverte"
    ON "audit_reason_scope_history"("audit_reason_scope_id") WHERE "valid_to" IS NULL;

-- La fonction gagne le code, sans changer de forme : cinq valeurs de queue au
-- lieu de quatre. C'est le premier bénéfice concret d'avoir écrit UNE fonction
-- pour toutes les tables — trois tables historisées, une seule instruction à
-- reprendre.
CREATE OR REPLACE FUNCTION historiser() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    table_historique text := TG_ARGV[0];
    colonne_entite   text := TG_ARGV[1];
    motif  text;
    code   text;
    acteur uuid;
    cible  uuid;
BEGIN
    motif := nullif(current_setting('app.reason', true), '');
    IF motif IS NULL THEN
        RAISE EXCEPTION
            'historisation refusée : aucune raison posée (app.reason) pour % sur %',
            TG_OP, TG_TABLE_NAME
            USING ERRCODE = 'check_violation';
    END IF;

    -- Le code, lui, peut manquer : un geste sans motif préréglé n'en a pas, et
    -- les migrations n'en ont jamais. C'est la phrase qui est obligatoire.
    code   := nullif(current_setting('app.reason_code', true), '');
    acteur := nullif(current_setting('app.actor_id', true), '')::uuid;
    cible  := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;

    EXECUTE format(
        'UPDATE %I SET valid_to = now() WHERE %I = $1 AND valid_to IS NULL',
        table_historique, colonne_entite
    ) USING cible;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    EXECUTE format(
        'INSERT INTO %I SELECT gen_random_uuid(), (jsonb_populate_record(NULL::%I, $1)).*, now(), NULL, $2, $3, $4',
        table_historique, TG_TABLE_NAME
    ) USING to_jsonb(NEW), acteur, motif, code;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "audit_reason_historiser"
    AFTER INSERT OR UPDATE OR DELETE ON "audit_reason"
    FOR EACH ROW EXECUTE FUNCTION historiser('audit_reason_history', 'audit_reason_id');

CREATE TRIGGER "audit_reason_scope_historiser"
    AFTER INSERT OR UPDATE OR DELETE ON "audit_reason_scope"
    FOR EACH ROW EXECUTE FUNCTION historiser('audit_reason_scope_history', 'audit_reason_scope_id');

-- ─── La semence ──────────────────────────────────────────────────────────────

SELECT set_config('app.reason', 'migration', true);

-- Engendré depuis dico.json du kit d'administration : les libellés sont
-- ceux du designer, dans les deux langues, repris sans réécriture.
INSERT INTO "audit_reason" ("code", "label_fr", "label_en") VALUES
  ('abuse_found', 'Abus constaté', 'Abuse found'),
  ('access_compromised', 'Accès compromis', 'Access compromised'),
  ('access_from_an_unusual_place', 'Accès depuis un lieu inhabituel', 'Access from an unusual place'),
  ('account_holder_s_request', 'Demande du titulaire', 'Account holder''s request'),
  ('accounts_on_the_same_device', 'Comptes liés au même appareil', 'Accounts on the same device'),
  ('age_verified_another_way', 'Ancienneté vérifiée autrement', 'Age verified another way'),
  ('back_after_a_trial', 'Retour après essai', 'Back after a trial'),
  ('back_on_the_team', 'Retour dans l''équipe', 'Back on the team'),
  ('back_to_normal', 'Retour à la normale', 'Back to normal'),
  ('backup_on_finances', 'Renfort sur les finances', 'Backup on finances'),
  ('campaign_over', 'Campagne terminée', 'Campaign over'),
  ('change_of_post', 'Changement de poste', 'Change of post'),
  ('code_spread_off_target', 'Code diffusé hors cible', 'Code spread off-target'),
  ('content_complies', 'Contenu conforme', 'Content complies'),
  ('contract_ended', 'Fin de contrat', 'Contract ended'),
  ('correcting_a_grant', 'Correction d''un octroi', 'Correcting a grant'),
  ('cost_too_high', 'Coût trop élevé', 'Cost too high'),
  ('deletion_triggered_by_mistake', 'Suppression déclenchée par erreur', 'Deletion triggered by mistake'),
  ('device_lost', 'Appareil perdu', 'Device lost'),
  ('disabled_by_mistake', 'Erreur de désactivation', 'Disabled by mistake'),
  ('disputed_purchase', 'Achat contesté', 'Disputed purchase'),
  ('duplicate', 'Doublon', 'Duplicate'),
  ('duplicate_payment', 'Double paiement', 'Duplicate payment'),
  ('end_of_on_call', 'Fin d''astreinte', 'End of on-call'),
  ('explicit_request_from_the_holder', 'Demande explicite du titulaire', 'Explicit request from the holder'),
  ('failed_generation', 'Génération échouée', 'Failed generation'),
  ('failed_generation_not_refunded', 'Génération échouée non recréditée', 'Failed generation not refunded'),
  ('failure_rate_too_high', 'Taux d''échec trop haut', 'Failure rate too high'),
  ('fixing_a_mistake', 'Correction d''une erreur', 'Fixing a mistake'),
  ('fixing_an_error', 'Correction d''une erreur', 'Fixing an error'),
  ('goodwill', 'Geste commercial', 'Goodwill'),
  ('goodwill_gesture', 'Geste commercial', 'Goodwill gesture'),
  ('hateful_speech', 'Propos haineux', 'Hateful speech'),
  ('holder_s_request', 'Demande du titulaire', 'Holder''s request'),
  ('impersonation', 'Usurpation d''identité', 'Impersonation'),
  ('information_about_a_hidden_item', 'Information sur un masquage', 'Information about a hidden item'),
  ('inquiry_closed', 'Enquête close', 'Inquiry closed'),
  ('instruction_to_rewrite', 'Consigne à réécrire', 'Instruction to rewrite'),
  ('internal_report', 'Signalement interne', 'Internal report'),
  ('left_the_team', 'Départ de l''équipe', 'Left the team'),
  ('legal_obligation', 'Obligation légale', 'Legal obligation'),
  ('link_spread_outside_the_circle', 'Lien diffusé hors du cercle', 'Link spread outside the circle'),
  ('load_test', 'Test de charge', 'Load test'),
  ('new_contract', 'Nouveau contrat', 'New contract'),
  ('notification_lost', 'Notification perdue', 'Notification lost'),
  ('on_call', 'Astreinte', 'On call'),
  ('operation_seen_at_the_operator', 'Opération vue chez l''opérateur', 'Operation seen at the operator'),
  ('operator_error', 'Erreur de l''opérateur', 'Operator error'),
  ('owner_s_request', 'Demande du propriétaire', 'Owner''s request'),
  ('personal_data_exposed', 'Donnée personnelle exposée', 'Personal data exposed'),
  ('product_decision', 'Décision produit', 'Product decision'),
  ('provider_down', 'Prestataire hors service', 'Provider down'),
  ('provider_incident', 'Incident chez le fournisseur', 'Provider incident'),
  ('reducing_access', 'Réduction des accès', 'Reducing access'),
  ('referee_already_signed_up', 'Filleul déjà inscrit', 'Referee already signed up'),
  ('referral_dispute', 'Litige de parrainage', 'Referral dispute'),
  ('referral_never_completed', 'Parrainage non abouti', 'Referral never completed'),
  ('rendering_fixed', 'Rendu corrigé', 'Rendering fixed'),
  ('repeated_reports', 'Signalements répétés', 'Repeated reports'),
  ('report_without_merit', 'Signalement sans objet', 'Report without merit'),
  ('request_to_comply', 'Demande de mise en conformité', 'Request to comply'),
  ('routine_check', 'Vérification de routine', 'Routine check'),
  ('series_of_refusals', 'Série de refus', 'Series of refusals'),
  ('setup_mistake', 'Erreur de paramétrage', 'Setup mistake'),
  ('sexual_content', 'Contenu sexuel', 'Sexual content'),
  ('support_decision', 'Décision de l''assistance', 'Support decision'),
  ('suspected_fraud', 'Fraude suspectée', 'Suspected fraud'),
  ('suspended_pending_an_inquiry', 'Suspension le temps d''une enquête', 'Suspended pending an inquiry'),
  ('taking_responsibility', 'Prise de responsabilité', 'Taking responsibility'),
  ('test_account', 'Compte de test', 'Test account'),
  ('third_party_report', 'Signalement d''un tiers', 'Third-party report'),
  ('too_little_use', 'Usage trop faible', 'Too little use'),
  ('tool_error', 'Erreur de l''outil', 'Tool error'),
  ('unknown_account_targeted', 'Compte inconnu visé', 'Unknown account targeted'),
  ('unlawful_content', 'Contenu illicite', 'Unlawful content'),
  ('unsatisfying_result', 'Rendu insatisfaisant', 'Unsatisfying result'),
  ('unusual_access', 'Accès inhabituel', 'Unusual access'),
  ('unusually_long_wait', 'Attente anormalement longue', 'Unusually long wait'),
  ('user_identified', 'Utilisateur identifié', 'User identified'),
  ('users_asked_for_it', 'Demande des utilisateurs', 'Users asked for it'),
  ('warning', 'Avertissement', 'Warning');

INSERT INTO "audit_reason_scope" ("reason_id", "geste", "position")
SELECT r.id, v.geste, v.position FROM (VALUES
  ('abuse_found', 'promo_code_disable', 2),
  ('access_compromised', 'admin_deactivate', 1),
  ('access_from_an_unusual_place', 'login_incident_close', 1),
  ('account_holder_s_request', 'account_suspend', 2),
  ('accounts_on_the_same_device', 'referral_correct', 0),
  ('age_verified_another_way', 'refund_block_lift', 1),
  ('back_after_a_trial', 'studio_option_enable', 2),
  ('back_on_the_team', 'admin_reactivate', 0),
  ('back_to_normal', 'ai_model_enable', 0),
  ('backup_on_finances', 'admin_promote', 1),
  ('campaign_over', 'promo_code_disable', 0),
  ('change_of_post', 'admin_demote', 0),
  ('code_spread_off_target', 'promo_code_disable', 1),
  ('content_complies', 'moderation_dismiss', 1),
  ('contract_ended', 'ai_model_disable', 3),
  ('correcting_a_grant', 'credit_adjust', 2),
  ('cost_too_high', 'ai_model_disable', 1),
  ('deletion_triggered_by_mistake', 'deletion_cancel', 1),
  ('device_lost', 'admin_session_close', 0),
  ('disabled_by_mistake', 'admin_reactivate', 2),
  ('disputed_purchase', 'payment_refund', 1),
  ('duplicate', 'moderation_dismiss', 2),
  ('duplicate_payment', 'payment_refund', 0),
  ('end_of_on_call', 'admin_demote', 2),
  ('end_of_on_call', 'admin_session_close', 2),
  ('explicit_request_from_the_holder', 'account_erase', 0),
  ('failed_generation', 'credit_adjust', 0),
  ('failed_generation_not_refunded', 'credit_adjust', 0),
  ('failure_rate_too_high', 'ai_model_disable', 0),
  ('fixing_a_mistake', 'credit_adjust', 2),
  ('fixing_an_error', 'credit_adjust', 2),
  ('goodwill', 'credit_adjust', 1),
  ('goodwill', 'payment_refund', 3),
  ('goodwill_gesture', 'credit_adjust', 1),
  ('hateful_speech', 'moderation_hide', 0),
  ('holder_s_request', 'credit_adjust', 0),
  ('holder_s_request', 'deletion_cancel', 0),
  ('impersonation', 'moderation_revoke_link', 1),
  ('information_about_a_hidden_item', 'moderation_notify', 0),
  ('inquiry_closed', 'admin_reactivate', 1),
  ('instruction_to_rewrite', 'studio_option_disable', 2),
  ('internal_report', 'login_incident_close', 3),
  ('left_the_team', 'admin_deactivate', 0),
  ('legal_obligation', 'account_erase', 2),
  ('link_spread_outside_the_circle', 'moderation_revoke_link', 0),
  ('load_test', 'ai_model_enable', 2),
  ('new_contract', 'ai_model_enable', 1),
  ('notification_lost', 'payment_confirm', 1),
  ('on_call', 'admin_promote', 2),
  ('operation_seen_at_the_operator', 'payment_confirm', 0),
  ('operator_error', 'payment_refund', 2),
  ('owner_s_request', 'moderation_disable', 2),
  ('owner_s_request', 'moderation_revoke_link', 2),
  ('personal_data_exposed', 'moderation_hide', 3),
  ('product_decision', 'studio_option_disable', 3),
  ('provider_down', 'payment_confirm', 2),
  ('provider_incident', 'ai_model_disable', 2),
  ('reducing_access', 'admin_demote', 1),
  ('referee_already_signed_up', 'referral_correct', 1),
  ('referral_dispute', 'credit_adjust', 3),
  ('referral_never_completed', 'referral_correct', 2),
  ('rendering_fixed', 'studio_option_enable', 0),
  ('repeated_reports', 'moderation_disable', 0),
  ('report_without_merit', 'moderation_dismiss', 0),
  ('request_to_comply', 'moderation_notify', 1),
  ('routine_check', 'payment_chase', 1),
  ('series_of_refusals', 'login_incident_close', 0),
  ('setup_mistake', 'promo_code_disable', 3),
  ('sexual_content', 'moderation_hide', 1),
  ('support_decision', 'refund_block_lift', 2),
  ('suspected_fraud', 'account_suspend', 1),
  ('suspended_pending_an_inquiry', 'admin_deactivate', 2),
  ('taking_responsibility', 'admin_promote', 0),
  ('test_account', 'account_erase', 1),
  ('third_party_report', 'account_suspend', 0),
  ('too_little_use', 'studio_option_disable', 0),
  ('tool_error', 'referral_correct', 3),
  ('unknown_account_targeted', 'login_incident_close', 2),
  ('unlawful_content', 'moderation_disable', 1),
  ('unlawful_content', 'moderation_hide', 2),
  ('unsatisfying_result', 'studio_option_disable', 1),
  ('unusual_access', 'admin_session_close', 1),
  ('unusually_long_wait', 'payment_chase', 0),
  ('user_identified', 'refund_block_lift', 0),
  ('users_asked_for_it', 'studio_option_enable', 1),
  ('warning', 'moderation_notify', 2)
) AS v(code, geste, position)
JOIN "audit_reason" r ON r.code = v.code;

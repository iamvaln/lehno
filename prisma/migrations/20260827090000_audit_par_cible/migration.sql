-- La traçabilité d'un objet se lit depuis son détail (ux-admin §7).
--
-- Sans cet index, ouvrir la fiche d'un compte parcourrait tout le journal :
-- celui-ci ne cesse de grossir et ne s'efface jamais, une trace qui fait foi
-- ne se purge pas. Le coût d'une lecture ne doit pas croître avec l'âge du
-- service.
--
-- Les deux colonnes ensemble, dans cet ordre : on cherche toujours un objet
-- précis d'un type donné, jamais un identifiant sans son type.
CREATE INDEX IF NOT EXISTS "audit_log_target_type_target_id_idx"
  ON "audit_log" ("target_type", "target_id");

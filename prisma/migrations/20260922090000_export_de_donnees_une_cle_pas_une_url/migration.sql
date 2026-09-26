-- `file_url` devient `file_key`, avant même sa première écriture réelle.
--
-- La colonne portait une URL, contre la règle que le reste du stockage
-- applique déjà : « ce qu'on manipule est une clé, jamais une URL » — voir
-- Payment.proof_key et stockage.port.ts. Une URL présignée expire ; ranger la
-- clé permet de recomposer un lien de lecture au moment où il sert, sans
-- jamais persister un lien déjà mort.

ALTER TABLE "data_export_request" RENAME COLUMN "file_url" TO "file_key";

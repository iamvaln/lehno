import { Logger } from "@nestjs/common";
import type { Adaptateur } from "../routeur.service.js";
import { AnthropicAdaptateur } from "./anthropic.adapter.js";
import { CompatibleOpenAIAdaptateur } from "./compatible-openai.adapter.js";
import { ImageAdaptateur } from "./image.adapter.js";

export const FOURNISSEURS_IA = "FOURNISSEURS_IA";

/* Ce qu'on sait joindre, selon ce que l'environnement porte.
 *
 * Un fournisseur sans clé N'EST PAS CONSTRUIT. Le construire quand même le
 * ferait échouer à chaque appel, donc ouvrir le disjoncteur, donc afficher
 * « momentanément injoignable » sur un modèle qui n'a jamais été joignable —
 * et on chercherait l'incident chez le fournisseur au lieu de regarder la
 * configuration. Absent de cette table, le routeur le saute et le journalise
 * comme ce qu'il est : une erreur de configuration.
 *
 * Contrairement au courrielleur, aucune clé n'est OBLIGATOIRE au démarrage :
 * l'API sert les proches, les dates et les rappels sans aucune IA. Refuser de
 * démarrer priverait le socle pour une fonctionnalité qui a son propre drapeau.
 * C'est le routeur qui refusera, tâche par tâche, au moment de générer. */
export function construireAdaptateurs(env: NodeJS.ProcessEnv = process.env): Record<string, Adaptateur> {
  const logger = new Logger("ia");
  const table: Record<string, Adaptateur> = {};

  if (env["ANTHROPIC_API_KEY"]) table["anthropic"] = new AnthropicAdaptateur(env["ANTHROPIC_API_KEY"]);

  if (env["DEEPSEEK_API_KEY"])
    table["deepseek"] = new CompatibleOpenAIAdaptateur(
      env["DEEPSEEK_API_KEY"], "https://api.deepseek.com/v1", "deepseek",
    );

  /* xAI tient les deux bouts : du texte et des images. Deux adaptateurs pour
     un seul fournisseur ne tiendraient pas dans une table indexée par
     fournisseur — c'est la CAPACITÉ du modèle qui départage, et elle est
     connue du catalogue, pas de l'appel. On aiguille donc ici, sur la clé du
     modèle demandé, plutôt que d'inventer une seconde table. */
  if (env["XAI_API_KEY"]) {
    const texte = new CompatibleOpenAIAdaptateur(env["XAI_API_KEY"], "https://api.x.ai/v1", "xai");
    // xAI EXIGE response_format pour rendre du base64 ; sans lui il rend une
    // adresse qui expire. Voir ImageAdaptateur.
    const image = new ImageAdaptateur(env["XAI_API_KEY"], "https://api.x.ai/v1", "xai", true);
    table["xai"] = {
      appeler: (modele, demande) =>
        (modele.includes("image") ? image : texte).appeler(modele, demande),
    };
  }

  if (env["OPENAI_API_KEY"])
    /* OpenAI REFUSE response_format sur gpt-image-1 — 400, « Unknown
       parameter ». Il rend déjà du base64 sans qu'on le demande. */
    table["openai"] = new ImageAdaptateur(
      env["OPENAI_API_KEY"], "https://api.openai.com/v1", "openai", false,
    );

  const connus = Object.keys(table);
  // Le journal dit ce qu'on sait joindre, jamais les clés ni leur longueur.
  logger.log(
    connus.length === 0
      ? "aucun fournisseur d'IA configuré : les générations échoueront, le reste fonctionne"
      : `fournisseurs d'IA joignables : ${connus.join(", ")}`,
  );
  return table;
}

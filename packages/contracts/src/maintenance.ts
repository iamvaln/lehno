import { z } from "zod";

/* L'arrêt pour intervention.
 *
 * Ce n'est PAS un drapeau de fonctionnalité, et les confondre coûterait cher :
 *
 * - Un drapeau éteint rend `404` — « cette surface n'existe pas ». Le contrat
 *   demande alors au client de relire sa liste et de masquer l'écran. Un arrêt
 *   de deux heures se lirait comme une suppression définitive.
 * - Un drapeau gouverne UNE surface ; un arrêt les concerne toutes.
 * - Un drapeau se lit une fois, au démarrage. Un arrêt commence au milieu
 *   d'une session : il doit se découvrir sur n'importe quel appel.
 *
 * D'où un mécanisme distinct : `503`, un délai avant nouvelle tentative, et un
 * état lisible sur un chemin qui, lui, reste toujours ouvert. */
export const maintenanceStatusSchema = z
  .object({
    maintenance: z.boolean(),
    // Combien de secondes attendre avant de réessayer. Nul hors intervention.
    // Le client l'affiche en compte à rebours ; il ne l'invente pas, sans quoi
    // deux versions du parc appliqueraient deux délais.
    retryAfterSeconds: z.number().int().positive().nullable(),
  })
  .strict();

export type MaintenanceStatus = z.infer<typeof maintenanceStatusSchema>;

// Les clés du paramétrage, employées par le serveur et citées par le contrat.
// Écrites une fois : une chaîne recopiée dans le garde et dans la migration
// finirait par diverger, et l'interrupteur ne commanderait plus rien.
export const PARAM_MAINTENANCE = "maintenance_mode";
export const PARAM_MAINTENANCE_RETRY = "maintenance_retry_after_seconds";

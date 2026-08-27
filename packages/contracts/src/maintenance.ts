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
    /* Deux valeurs, et les confondre était mon erreur.
     *
     * `retryAfterSeconds` est le RYTHME de réessai. Il existe toujours pendant
     * une intervention : sans lui, tout le parc martèle. Le client l'attend, il
     * ne l'invente pas — sinon deux versions appliqueraient deux délais.
     *
     * `until` est l'HEURE DE RETOUR ANNONCÉE, et elle est facultative. On ne la
     * connaît pas toujours, et l'écran de maintenance a raison d'en faire deux
     * états : avec elle il dit quand revenir, sans elle il dit seulement qu'une
     * mise à jour est en cours. « Pas de "bientôt", pas d'estimation inventée. »
     *
     * Dériver l'une de l'autre serait mentir : un rythme de quinze minutes ne
     * dit pas que le service revient dans quinze minutes. */
    retryAfterSeconds: z.number().int().positive().nullable(),
    // Horodatage ISO 8601, en UTC. Le client le met à l'heure du téléphone —
    // le serveur ne connaît pas son fuseau, et le format d'affichage
    // (« 14 h 30 » / « 2:30 pm ») appartient au dictionnaire du client.
    until: z.string().nullable(),
  })
  .strict();

export type MaintenanceStatus = z.infer<typeof maintenanceStatusSchema>;

// Les clés du paramétrage, employées par le serveur et citées par le contrat.
// Écrites une fois : une chaîne recopiée dans le garde et dans la migration
// finirait par diverger, et l'interrupteur ne commanderait plus rien.
export const PARAM_MAINTENANCE = "maintenance_mode";
export const PARAM_MAINTENANCE_RETRY = "maintenance_retry_after_seconds";
export const PARAM_MAINTENANCE_UNTIL = "maintenance_until";

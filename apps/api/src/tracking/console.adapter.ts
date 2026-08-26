import { Logger } from "@nestjs/common";
import type { EvenementSortant, TrackingPort } from "./tracking.port.js";

/* Adaptateur de développement. Il n'existe que si l'opérateur a posé
 * LEHNO_TRACKING_CONSOLE=1 — jamais par défaut, jamais parce que la clé
 * PostHog serait absente. Même principe que ConsoleMailAdapter : le silence
 * d'une configuration ne doit pas se traduire par un comportement qu'on n'a
 * pas choisi.
 *
 * Écrire les événements sur la console est sans risque ici, et c'est voulu :
 * le registre interdit déjà le contenu par le typage, donc rien de sensible ne
 * peut s'y trouver. C'est aussi le seul moyen de vérifier en développement
 * qu'un événement part vraiment — sans compte PostHog. */
export class ConsoleTrackingAdapter implements TrackingPort {
  private readonly logger = new Logger("tracking");

  async capture(e: EvenementSortant): Promise<void> {
    this.logger.log(`[dev] ${e.name} ${JSON.stringify({ ...e.properties, ...e.common })}`);
  }
}

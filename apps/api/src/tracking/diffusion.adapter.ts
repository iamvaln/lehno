import { Logger } from "@nestjs/common";
import type { EvenementSortant, TrackingPort } from "./tracking.port.js";

/* PLUSIEURS DESTINATIONS POUR UN MÊME ÉVÉNEMENT.
 *
 * Le choix était exclusif : la clé PostHog présente, la console ne servait
 * plus. Or les deux ne répondent pas à la même question. PostHog garde et rend
 * interrogeable ; la console dit TOUT DE SUITE ce qui part, sans attendre
 * qu'un tableau de bord se rafraîchisse. Sur un environnement de recette qu'on
 * pilote depuis un téléphone, on veut les deux — c'est même le seul moyen de
 * savoir qu'un geste a bien émis.
 *
 * UN ÉCHEC N'EMPORTE PAS LES AUTRES, et c'est la raison d'être de cette classe
 * plutôt qu'un simple `await a(); await b();`. PostHog injoignable ne doit pas
 * faire disparaître la ligne de console — ce serait perdre le témoin au moment
 * précis où il sert. Chaque destination est donc isolée.
 *
 * ON N'ATTEND PAS NON PLUS L'UNE POUR L'AUTRE : `allSettled` les lance
 * ensemble. Une destination lente ajouterait sinon son délai à la suivante, et
 * `TrackingService.emettre` — qui ne s'attend pas — verrait sa promesse
 * traîner d'autant.
 */
export class DiffusionTrackingAdapter implements TrackingPort {
  private readonly logger = new Logger("tracking");

  constructor(private readonly destinations: readonly TrackingPort[]) {}

  async capture(e: EvenementSortant): Promise<void> {
    const issues = await Promise.allSettled(
      this.destinations.map((d) => d.capture(e)),
    );

    /* On NOMME la destination qui a échoué, et on ne relève pas : l'appelant
       a déjà décidé qu'une mesure ne fait jamais échouer ce qu'elle mesure.
       Sans ce journal, une destination muette le resterait. */
    issues.forEach((issue, i) => {
      if (issue.status === "rejected") {
        const quoi = this.destinations[i]?.constructor.name ?? `destination ${i}`;
        const cause = issue.reason instanceof Error ? issue.reason.message : "cause inconnue";
        this.logger.warn(`${quoi} n'a pas pris « ${e.name} » : ${cause}`);
      }
    });
  }
}

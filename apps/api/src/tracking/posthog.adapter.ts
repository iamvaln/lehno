import { Logger } from "@nestjs/common";
import type { EvenementSortant, TrackingPort } from "./tracking.port.js";

/* PostHog par son point d'entrée de capture, sans bibliothèque cliente.
 *
 * Une dépendance de plus pour un POST de JSON ne se justifierait pas : elle
 * apporterait sa file d'attente, ses reprises et son cycle de vie, là où le
 * service appelant a déjà décidé de ne jamais attendre ni échouer. */
const DELAI_MS = 3_000;

export class PostHogAdapter implements TrackingPort {
  private readonly logger = new Logger("tracking");

  constructor(
    private readonly cle: string,
    private readonly hote: string,
  ) {}

  async capture(e: EvenementSortant): Promise<void> {
    // `distinct_id` : l'identifiant de compte quand il existe, sinon celui de
    // session. Jamais l'adresse électronique — §16.2 l'exclut nommément, et
    // une adresse déposée chez un tiers ne se rattrape pas.
    const distinctId = e.common["userId"] ?? e.common["sessionId"] ?? "anonyme";

    // Une mesure ne doit pas retenir une requête : au-delà du délai, on
    // abandonne l'événement plutôt que de faire attendre l'utilisateur.
    const minuteur = AbortSignal.timeout(DELAI_MS);
    const reponse = await fetch(`${this.hote.replace(/\/$/, "")}/i/v0/e/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: minuteur,
      body: JSON.stringify({
        api_key: this.cle,
        event: e.name,
        distinct_id: distinctId,
        properties: { ...e.properties, ...e.common },
        timestamp: new Date().toISOString(),
      }),
    });

    if (!reponse.ok) {
      // On journalise le CODE, jamais le corps : la réponse d'un tiers peut
      // renvoyer ce qu'on lui a envoyé, et le journal n'a pas à en hériter.
      this.logger.warn(`posthog a refusé ${e.name} (${reponse.status})`);
    }
  }
}

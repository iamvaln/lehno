import { Inject, Injectable, Logger } from "@nestjs/common";
import type { EvenementsMesure, NomEvenement } from "@lehno/contracts";
import { FlagsService } from "../flags/flags.service.js";
import type { TrackingPort } from "./tracking.port.js";
import { contexteCourant } from "./contexte.js";

@Injectable()
export class TrackingService {
  private readonly logger = new Logger("tracking");

  constructor(
    @Inject("TRACKING_PORT") private readonly port: TrackingPort,
    // Les drapeaux actifs accompagnent chaque événement (§16.2) : attachés
    // ici, jamais au point d'appel — un appelant qui oublierait creuserait un
    // trou dans la série, et le trou ne se verrait qu'en lisant la courbe.
    @Inject(FlagsService) private readonly flags: FlagsService,
  ) {}

  /* Émettre un fait. Le nom et la forme de ses propriétés viennent du registre
   * du contrat : ni l'un ni l'autre ne peut être inventé au point d'appel.
   *
   * NE REND RIEN, et n'est pas à attendre. Une mesure ne doit jamais faire
   * échouer ni ralentir ce qu'elle mesure : un PostHog en panne ne peut pas
   * empêcher une inscription. D'où le déclenchement sans `await` et le `catch`
   * qui absorbe tout — la seule trace d'un échec est une ligne de journal, à
   * nous, pas à l'utilisateur. */
  emettre<N extends NomEvenement>(
    userId: string | null,
    nom: N,
    proprietes: EvenementsMesure[N],
  ): void {
    void this.envoyer(userId, nom, proprietes).catch((err: unknown) => {
      this.logger.warn(
        `événement ${nom} perdu : ${err instanceof Error ? err.message : "cause inconnue"}`,
      );
    });
  }

  private async envoyer(
    userId: string | null,
    nom: string,
    proprietes: Record<string, unknown>,
  ): Promise<void> {
    const contexte = contexteCourant();
    // La surface décide de la portée : une mesure prise sans compte ne peut
    // pas rendre les drapeaux de l'application.
    const actifs = await this.flags.actifs(contexte.surface === "app" ? "app" : "public");

    await this.port.capture({
      name: nom,
      properties: proprietes,
      common: { ...contexte, userId, flags: actifs },
    });
  }
}

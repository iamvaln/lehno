import { Logger } from "@nestjs/common";
import type { EnvoiPousse, PushPort } from "./push.port.js";

/* Le repli quand OneSignal n'est pas configuré.
 *
 * Il écrit ce qui SERAIT parti plutôt que de ne rien faire. Un port muet
 * donnerait un développement où tout paraît marcher et où l'on découvre à la
 * mise en service que rien n'était branché.
 *
 * Le jeton d'abonnement n'entre PAS au journal — c'est l'identifiant d'un
 * appareil, donc de quelqu'un, et « le journal n'est pas une copie de la
 * liste ». Leur NOMBRE suffit à savoir si l'envoi aurait trouvé un
 * destinataire, qui est la seule question qu'on se pose en développement.
 */
export class PoussePourLaConsole implements PushPort {
  private readonly logger = new Logger("push");

  async envoyer(e: EnvoiPousse): Promise<void> {
    this.logger.log(`[console] vers ${e.jetons.length} appareil(s) — ${e.titre} · ${e.corps}`);
  }
}

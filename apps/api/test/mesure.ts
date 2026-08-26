import { FlagsService } from "../src/flags/flags.service.js";
import { TrackingService } from "../src/tracking/tracking.service.js";
import type { EvenementSortant } from "../src/tracking/tracking.port.js";

/* Une mesure de test qui RETIENT ce qu'on lui donne.
 *
 * Le port muet du module applicatif ne dirait rien de ce qui a été émis : un
 * événement oublié ou mal nommé passerait sans bruit, ce qui est exactement le
 * défaut que le registre existe pour empêcher. */
export function mesureDeTest(prisma: unknown): {
  service: TrackingService;
  emis: EvenementSortant[];
  attendre: () => Promise<void>;
} {
  const emis: EvenementSortant[] = [];
  const port = { capture: async (e: EvenementSortant): Promise<void> => { emis.push(e); } };
  const service = new TrackingService(port, new FlagsService(prisma as never));
  /* `emettre` ne s'attend pas — c'est tout son intérêt. Mais l'envoi lit les
     drapeaux en base avant de partir : un simple tour de boucle ne suffit pas,
     et un test qui lirait tout de suite verrait une liste vide et conclurait à
     tort que rien n'a été émis. On attend donc l'ARRIVÉE, avec une borne. */
  const attendre = async (combien = 1): Promise<void> => {
    for (let i = 0; i < 200 && emis.length < combien; i += 1) {
      await new Promise((r) => setTimeout(r, 5));
    }
  };
  return { service, emis, attendre };
}

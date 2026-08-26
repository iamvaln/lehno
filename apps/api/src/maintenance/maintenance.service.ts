import { Inject, Injectable } from "@nestjs/common";
import {
  PARAM_MAINTENANCE, PARAM_MAINTENANCE_RETRY, type MaintenanceStatus,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";

// Combien de temps demander au client d'attendre, si le paramètre manque ou
// ne dit rien de lisible. Un quart d'heure : assez long pour ne pas faire
// marteler l'API par tout le parc, assez court pour que la reprise se voie.
const RETRY_DEFAUT = 900;

@Injectable()
export class MaintenanceService {
  // @Inject explicite : voir FlagsService, même contrainte esbuild/vitest.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // Lu en base à CHAQUE appel, sans cache — même raison que FlagsService : un
  // interrupteur de secours ne doit pas avoir de délai entre « j'ai coupé » et
  // « c'est coupé », ni surtout entre « j'ai rouvert » et « c'est rouvert ».
  async etat(): Promise<MaintenanceStatus> {
    const lignes = await this.prisma.systemParameter.findMany({
      where: { key: { in: [PARAM_MAINTENANCE, PARAM_MAINTENANCE_RETRY] } },
    });
    const lire = (cle: string): string | undefined =>
      lignes.find((l) => l.key === cle)?.value;

    // Seul « true » allume. Toute autre valeur — vide, absente, mal saisie —
    // laisse l'API ouverte : le défaut d'un interrupteur d'arrêt doit être
    // « ça marche », jamais « tout est coupé parce qu'une ligne manquait ».
    const enArret = lire(PARAM_MAINTENANCE) === "true";
    if (!enArret) return { maintenance: false, retryAfterSeconds: null };

    const brut = Number(lire(PARAM_MAINTENANCE_RETRY));
    const retry = Number.isInteger(brut) && brut > 0 ? brut : RETRY_DEFAUT;
    return { maintenance: true, retryAfterSeconds: retry };
  }
}

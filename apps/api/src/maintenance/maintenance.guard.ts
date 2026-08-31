import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Inject, Injectable } from "@nestjs/common";
import { AppError } from "../common/errors.js";
import { MaintenanceService } from "./maintenance.service.js";

// Ce qui reste ouvert pendant un arrêt. Deux entrées, et pas une de plus.
//
// `/admin` D'ABORD, et par PRÉFIXE plutôt que contrôleur par contrôleur : c'est
// par là qu'on rouvre. Un décorateur posé sur quinze contrôleurs se serait
// oublié sur le seizième, et l'oubli ne se découvrirait qu'une fois l'arrêt
// déclenché — c'est-à-dire au pire moment, enfermé dehors. Le préfixe couvre
// aussi les contrôleurs d'administration qui n'existent pas encore.
//
// `/public/maintenance` ensuite : c'est l'état lui-même. Le fermer rendrait
// l'arrêt indiscernable d'une panne, et le client n'aurait rien à interroger
// pour savoir quand revenir.
//
// Filet de dernier recours, quoi qu'il arrive : l'interrupteur est une ligne de
// `system_parameter`. Un humain avec un accès à la base rouvre toujours.
const OUVERTS = ["/admin", "/public/maintenance"];

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    @Inject(MaintenanceService) private readonly maintenance: MaintenanceService,
  ) {}

  // Le chemin sans le préfixe de version : `setGlobalPrefix("v1")` le pose sur
  // l'URL, et comparer avec lui rendrait ces règles muettes le jour d'un /v2.
  private sansVersion(chemin: string): string {
    return chemin.replace(/^\/v\d+/, "");
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ path?: string; url?: string }>();
    const chemin = this.sansVersion((req.path ?? req.url ?? "").split("?")[0] ?? "");
    if (OUVERTS.some((o) => chemin === o || chemin.startsWith(`${o}/`))) return true;

    const etat = await this.maintenance.etat();
    if (!etat.maintenance) return true;

    // 503, jamais 404 : la ressource existe, elle est momentanément fermée. Le
    // délai voyage dans les détails — le client l'affiche, il ne l'invente pas.
    throw new AppError("maintenance", "service under maintenance", {
      retryAfterSeconds: etat.retryAfterSeconds,
      // L'heure annoncée voyage AVEC le refus : sans elle, le client devrait
      // faire un second appel juste pour savoir quoi afficher, au moment
      // précis où l'on cherche à réduire le trafic.
      until: etat.until,
    });
  }
}

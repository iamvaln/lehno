import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { CleDrapeau } from "@lehno/contracts";
import { AppError } from "../common/errors.js";
import { FlagsService } from "./flags.service.js";
import { FEATURE_KEY } from "./feature.decorator.js";

// Pose sur un contrôleur AVANT AuthGuard (@UseGuards(FeatureGuard, AuthGuard)) :
// une surface éteinte l'est pour tout le monde, y compris pour un jeton
// invalide. Si l'authentification passait en premier, le statut distinguerait
// « éteinte » de « non authentifiée » et raconterait quelque chose.
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(FlagsService) private readonly flags: FlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const cle = this.reflector.getAllAndOverride<CleDrapeau | undefined>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // Aucune clé posée : rien à garder, la route n'est pas concernée.
    if (!cle) return true;
    if (await this.flags.estActif(cle)) return true;
    // Même erreur que TenantRepository pour le cloisonnement (404, pas 403) :
    // une surface éteinte n'a pas à révéler qu'elle existe.
    throw new AppError("not_found", "resource not found");
  }
}

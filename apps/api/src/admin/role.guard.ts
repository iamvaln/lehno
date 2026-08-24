import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Inject, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AppError } from "../common/errors.js";

export const ROLE_REQUIS = "lehno:role";

/**
 * Réserve une route au rôle `admin`. Sans ce décorateur, toute session
 * d'administration ouverte passe — c'est le rôle `support`, celui de
 * l'assistance quotidienne.
 *
 * L'interface masque ce qu'un rôle ne peut pas faire, mais c'est le serveur qui
 * refuse (spec technique §7). Un écran qui oublierait de masquer ne donnerait
 * donc rien de plus que le droit de recevoir un 403.
 */
export const Role = (role: "admin" | "support"): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLE_REQUIS, role);

@Injectable()
export class RoleGuard implements CanActivate {
  // @Inject explicite : sous vitest/esbuild, design:paramtypes n'est pas émis
  // (pas d'emitDecoratorMetadata), donc un paramètre typé sans jeton se
  // résoudrait à `undefined` — la garde tomberait en 500 dès la première route
  // gardée, et seulement une fois authentifié.
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requis = this.reflector.getAllAndOverride<string | undefined>(ROLE_REQUIS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requis) return true;

    const req = context.switchToHttp().getRequest();
    const role: string | undefined = req.admin?.role;

    // « admin » couvre tout ce que fait « support » (ux-admin §6) ; l'inverse
    // n'est pas vrai.
    if (role === "admin") return true;
    if (role === requis) return true;

    throw new AppError("forbidden", `role ${requis} required`);
  }
}

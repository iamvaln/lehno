import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Inject, Injectable } from "@nestjs/common";
import { TokenService } from "./token.service.js";
import { AppError } from "../common/errors.js";

@Injectable()
export class AuthGuard implements CanActivate {
  // Voir AuthService : jeton explicite requis, esbuild n'émet pas design:paramtypes.
  constructor(@Inject(TokenService) private readonly tokens: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    if (!header?.startsWith("Bearer "))
      throw new AppError("unauthorized", "missing bearer token");
    req.userId = this.tokens.verifyAccess(header.slice(7)).userId;
    return true;
  }
}

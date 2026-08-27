import { Controller, Delete, Get, HttpCode, Inject, Req, UseGuards } from "@nestjs/common";
import type { IdentitiesList, SessionsList } from "@lehno/contracts";
import { AuthGuard } from "../auth/auth.guard.js";
import { SecurityService } from "./security.service.js";

// Posé par AuthGuard (voir auth/auth.guard.ts) : req.userId. Type minimal,
// pas de dépendance à @types/express (absent de ce paquet).
type AuthedRequest = { userId: string };

// Écran « Sécurité et connexions » (spec mobile §3.24) : connexions récentes,
// déconnexion de partout, moyens de connexion externes. La suppression du
// compte n'est PAS ici — chantier à part, design encore en cours.
@Controller("me")
@UseGuards(AuthGuard)
export class SecurityController {
  // @Inject explicite : voir ProfileController, même contrainte esbuild/vitest.
  constructor(@Inject(SecurityService) private readonly security: SecurityService) {}

  @Get("sessions")
  async sessions(@Req() req: AuthedRequest): Promise<SessionsList> {
    return { sessions: await this.security.listSessions(req.userId) };
  }

  // Révoque TOUTES les lignées du compte, y compris celle de l'appareil qui
  // appelle — voir TokenService.revokeAllForUser pour pourquoi. Le jeton
  // d'accès de cet appareil reste néanmoins valable jusqu'à quinze minutes
  // après cet appel : il est autoportant, sa validité ne se vérifie pas en
  // base. Ce n'est qu'à sa prochaine tentative de renouvellement que
  // l'appareil découvre la déconnexion. Le client ne doit pas attendre un
  // effet instantané de cet appel : il doit lui-même effacer ses jetons
  // locaux et revenir à l'écran de connexion, sans compter sur le serveur
  // pour couper court plus vite.
  @Delete("sessions")
  @HttpCode(204)
  async logoutEverywhere(@Req() req: AuthedRequest): Promise<void> {
    await this.security.logoutEverywhere(req.userId);
  }

  @Get("identities")
  async identities(@Req() req: AuthedRequest): Promise<IdentitiesList> {
    return { identities: await this.security.listIdentities(req.userId) };
  }
}

import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Inject, Injectable } from "@nestjs/common";
import { AdminTokenService } from "./admin-token.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";

// La troisième barrière, après la clé de signature propre à l'administration et
// la marque de type portée par le jeton. Celle-ci va en base, et c'est la seule
// qui puisse répondre à deux questions qu'une signature ne sait pas poser : ce
// sujet désigne-t-il un administrateur, et l'est-il encore ?
//
// C'est aussi ce qui rend la révocation immédiate. Le jeton vaut trente
// minutes ; désactiver un compte le coupe au geste suivant, sans attendre son
// expiration — c'est ce qu'on fait quand quelqu'un quitte l'équipe, et ça ne
// souffre pas d'attendre.
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @Inject(AdminTokenService) private readonly jetons: AdminTokenService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const entete: string | undefined = req.headers.authorization;
    if (!entete?.startsWith("Bearer "))
      throw new AppError("unauthorized", "missing bearer token");

    const { adminId } = this.jetons.verifierAcces(entete.slice(7));

    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: { id: true, role: true, isActive: true },
    });
    // Compte inconnu et compte désactivé rendent la même chose : rien à
    // apprendre en essayant.
    if (!admin || !admin.isActive)
      throw new AppError("unauthorized", "no active admin for this token");

    req.admin = { id: admin.id, role: admin.role };
    return true;
  }
}

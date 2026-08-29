import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Inject, Injectable } from "@nestjs/common";
import { TokenService } from "./token.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";

@Injectable()
export class AuthGuard implements CanActivate {
  // Voir AuthService : jeton explicite requis, esbuild n'émet pas design:paramtypes.
  constructor(
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /* DEUX vérifications, et la seconde a coûté une requête de base pour une
   * raison qu'il faut écrire ici, sinon quelqu'un l'ôtera pour gagner une
   * milliseconde.
   *
   * Le jeton d'accès est AUTOPORTANT : sa validité se lit dans sa signature,
   * jamais en base. C'est ce qui rend la garde rapide, et c'est aussi ce qui
   * fait qu'un jeton émis avant une suspension ou une demande de suppression
   * reste parfaitement valide pendant quinze minutes après. Pour une
   * déconnexion, ce délai est admis et documenté (voir SecurityController).
   * Pour un compte SUSPENDU ou EN COURS DE SUPPRESSION, il ne l'est pas :
   * §3.24 promet que « plus de connexion n'est possible » dès la
   * confirmation, et pendant ces quinze minutes le compte pourrait encore
   * dépenser ses crédits, publier son Mur, ou écrire à des proches — avec un
   * solde dont on vient peut-être d'enregistrer le remboursement.
   *
   * `/auth/otp` et `/auth/federated` refusent déjà ces comptes à l'entrée. Ne
   * garder que cette porte-là reviendrait à verrouiller la serrure en
   * laissant la fenêtre ouverte à quiconque est déjà dedans.
   *
   * Une lecture par clé primaire sur une seule colonne, sur une requête qui
   * en fera de toute façon d'autres. Le placer ICI plutôt que sur chaque
   * contrôleur est le point : un contrôleur écrit demain par une autre
   * session est couvert sans que personne ait à y penser.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    if (!header?.startsWith("Bearer "))
      throw new AppError("unauthorized", "missing bearer token");

    const { userId } = this.tokens.verifyAccess(header.slice(7));

    const compte = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    // Un jeton signé par nous dont le compte n'existe plus : 401. La session
    // ne vaut plus rien, et c'est bien « non authentifié » qu'il faut dire —
    // un 404 laisserait croire à une ressource manquante sur le chemin appelé.
    if (!compte) throw new AppError("unauthorized", "no account for this token");
    if (compte.status === "pending_deletion")
      throw new AppError("account_pending_deletion", "account is being deleted");
    if (compte.status === "suspended")
      throw new AppError("account_suspended", "account is suspended");
    /* Refus par DÉFAUT pour tout le reste — `deleted` aujourd'hui, ce qu'on
       ajoutera demain. Énumérer les états qui passent plutôt que ceux qui
       bloquent est ce qui fait qu'un statut nouveau arrive fermé : l'inverse
       le laisserait ouvert jusqu'à ce que quelqu'un pense à cette ligne. */
    if (compte.status !== "active")
      throw new AppError("unauthorized", "account is not active");

    req.userId = userId;
    return true;
  }
}

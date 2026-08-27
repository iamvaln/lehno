import { Controller, Delete, Get, Inject, Injectable, Req, UseGuards } from "@nestjs/common";
import type { ProfilAdmin } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { AdminGuard } from "./admin.guard.js";

/**
 * « Mon profil » — le compte connecté et ses sessions ouvertes (ux-admin §5.1).
 *
 * **Ouvert aux deux rôles.** C'est son propre compte qu'on regarde, et un
 * support qui ne pourrait pas voir ses sessions n'aurait aucun moyen de réagir
 * à un appareil perdu. Aucune `RoleGuard` ici, donc — l'appelant ne peut rien
 * lire d'autre que lui-même, la requête étant bornée par son propre identifiant
 * et non par un paramètre qu'il choisirait.
 *
 * **Une session est une lignée, pas un jeton.** L'échange du jeton long
 * consomme l'ancien et en crée un nouveau dans la même famille ; compter les
 * jetons ferait apparaître une session de plus à chaque rafraîchissement. On
 * compte donc les familles, et « depuis » date l'ouverture de la famille, non
 * son dernier échange — sinon l'heure reculerait toutes les demi-heures sur une
 * session qui n'a jamais été fermée.
 */

/** La tête vivante d'une lignée : ni consommée, ni révoquée, ni expirée. */
type Tete = {
  familyId: string;
  userAgent: string | null;
  ip: string | null;
};

@Injectable()
export class MeService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async profil(adminId: string, familleCourante: string | null): Promise<ProfilAdmin> {
    const compte = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: { email: true, role: true },
    });
    // Le garde a déjà vérifié que le compte existe et qu'il est actif ; s'il a
    // disparu entre-temps, on ne bricole pas une réponse vide.
    if (!compte) throw new AppError("unauthorized", "no active admin for this token");

    const tetes: Tete[] = await this.prisma.adminRefreshToken.findMany({
      where: {
        adminId,
        consumedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { familyId: true, userAgent: true, ip: true },
    });

    // Les racines de lignée : `parentId` nul marque une ouverture de session,
    // par opposition à un échange. Elles datent les sessions et la dernière
    // connexion, sans qu'un rafraîchissement puisse les rajeunir.
    const racines = await this.prisma.adminRefreshToken.findMany({
      where: { adminId, parentId: null },
      select: { familyId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    const ouverture = new Map(racines.map((r) => [r.familyId, r.createdAt]));

    const invitation = await this.prisma.auditLog.findFirst({
      where: { action: "admin_invite", targetType: "admin", targetId: adminId },
      select: { actorId: true },
      orderBy: { createdAt: "asc" },
    });
    const auteur = invitation
      ? await this.prisma.admin.findUnique({
        where: { id: invitation.actorId },
        select: { email: true },
      })
      : null;

    return {
      email: compte.email,
      role: compte.role,
      // Nul pour un compte posé à la main : avant le premier administrateur,
      // il n'y avait personne pour inviter, et l'inventer serait faux.
      ajoutePar: auteur?.email ?? null,
      derniereConnexion: racines[0]?.createdAt.toISOString() ?? null,
      sessions: tetes
        .map((tete) => ({
          id: tete.familyId,
          appareil: tete.userAgent,
          ip: tete.ip,
          depuis: (ouverture.get(tete.familyId) ?? new Date(0)).toISOString(),
          // Un jeton émis avant que la lignée voyage dans la charge n'en porte
          // pas : aucune session ne se reconnaît alors, plutôt qu'une au hasard.
          courante: familleCourante !== null && tete.familyId === familleCourante,
        }))
        // La plus récemment ouverte en tête : c'est celle qu'on vient de faire,
        // et celle qu'on reconnaît si l'on cherche un intrus.
        .sort((a, b) => b.depuis.localeCompare(a.depuis)),
    };
  }

  /**
   * Ferme toutes les sessions sauf celle d'où vient l'appel.
   *
   * C'est le geste qu'on fait quand un appareil est perdu, et il doit être
   * immédiat : on révoque la **lignée entière**, pas sa tête. Révoquer la seule
   * tête laisserait les jetons consommés en place ; ils ne s'échangent déjà
   * plus, mais la révocation est ce qui fait tomber la famille au premier
   * rejeu, et une lignée à moitié révoquée est une lignée qu'on relira mal.
   *
   * **Sans lignée connue, on refuse.** Un jeton émis avant que la famille
   * voyage dans la charge ne désigne aucune session : fermer « les autres »
   * fermerait alors tout, y compris celle qui demande. Déconnecter quelqu'un
   * qui vient sécuriser son compte serait le contraire du service rendu.
   *
   * Pas de trace au journal d'audit : celui-ci porte les gestes faits **sur
   * autrui**, avec leur motif, et c'est ce qui lui donne sa valeur de contrôle
   * (ux-admin §6). Demander un motif pour fermer ses propres sessions ajouterait
   * une friction au geste qu'on veut le plus rapide. La révocation se date
   * d'elle-même sur chaque jeton.
   */
  async fermerLesAutres(adminId: string, familleCourante: string | null): Promise<{ fermees: number }> {
    if (familleCourante === null)
      throw new AppError(
        "session_expired",
        "this access token predates session lineage; refresh before closing other sessions",
      );

    const { count } = await this.prisma.adminRefreshToken.updateMany({
      where: { adminId, familyId: { not: familleCourante }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { fermees: count };
  }
}

@Controller("admin/me")
@UseGuards(AdminGuard)
export class MeController {
  constructor(@Inject(MeService) private readonly service: MeService) {}

  @Get()
  moi(@Req() req: { admin?: { id: string; familyId: string | null } }) {
    return this.service.profil(req.admin?.id ?? "", req.admin?.familyId ?? null);
  }

  @Delete("sessions")
  fermerLesAutres(@Req() req: { admin?: { id: string; familyId: string | null } }) {
    return this.service.fermerLesAutres(req.admin?.id ?? "", req.admin?.familyId ?? null);
  }
}

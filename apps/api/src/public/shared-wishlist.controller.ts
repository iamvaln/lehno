import {
  Body, Controller, Delete, Get, Headers, HttpCode, Inject, Param, ParseUUIDPipe,
  Post, Ip, UseGuards,
} from "@nestjs/common";
import {
  ENTETE_JETON_RESERVATION, reserveWishSchema, verifyReservationSchema,
  type CancelReservationResponse, type ReserveOutcome, type ReservationConfirmed,
  type SharedWishlist,
} from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { Feature } from "../flags/feature.decorator.js";
import { FeatureGuard } from "../flags/feature.guard.js";
import { TokenService } from "../auth/token.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TrackingService } from "../tracking/tracking.service.js";
import { SharedWishlistService } from "./shared-wishlist.service.js";

/* La liste partagée, sans compte. AUCUN AuthGuard ici : l'autorisation tient au
 * jeton porté par le lien, qui désigne la ressource et vaut permission — rien
 * d'autre (§7). FeatureGuard reste, et rend 404 quand `wishlist.own` est
 * éteint : la page n'existe alors pour personne. */
@Controller("public/wishlists")
@UseGuards(FeatureGuard)
@Feature("wishlist.own")
export class SharedWishlistController {
  constructor(
    @Inject(SharedWishlistService) private readonly listes: SharedWishlistService,
    @Inject(TokenService) private readonly jetons: TokenService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TrackingService) private readonly mesure: TrackingService,
  ) {}

  @Get(":token")
  async voir(
    @Param("token") token: string,
    @Headers("authorization") autorisation?: string,
    @Headers(ENTETE_JETON_RESERVATION) jetonVisite?: string,
  ): Promise<SharedWishlist> {
    const compte = await identifier(this.jetons, this.prisma, autorisation);
    const vue = await this.listes.voir(token, {
      ...compte,
      ...(jetonVisite ? { jetonVisite } : {}),
    });
    if (vue.state === "ok") {
      // « visiteur avec ou sans compte » (§16.3) : c'est ce qui dit si la page
      // convertit des inconnus ou circule entre gens déjà inscrits.
      this.mesure.emettre(compte.userId ?? null, "shared_list.viewed", {
        authenticated: compte.userId !== undefined,
        wishCount: vue.wishes.length,
      });
    }
    return vue;
  }
}

/* La réservation, sous SON drapeau. `reservation` requiert `wishlist.own` (et
 * `wall`) : éteindre les listes éteint le geste, et la résolution se fait dans
 * FlagsService, côté serveur — le client ne connaît aucune règle de dépendance.
 *
 * Un contrôleur à part de la page, parce que les deux drapeaux ne sont pas les
 * mêmes : les loger ensemble obligerait à poser @Feature méthode par méthode,
 * et la route ajoutée demain hériterait du mauvais. */
@Controller("public/owner-wishes")
@UseGuards(FeatureGuard)
@Feature("reservation")
export class ReserveWishController {
  constructor(
    @Inject(SharedWishlistService) private readonly listes: SharedWishlistService,
    @Inject(TokenService) private readonly jetons: TokenService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TrackingService) private readonly mesure: TrackingService,
  ) {}

  /* 200, pas 201 : dans le cas ordinaire — le visiteur sans compte — RIEN
     n'est réservé au bout de cet appel. Un 201 annoncerait une ressource
     acquise, alors que le cadeau demeure disponible pour un autre tant que le
     code n'est pas saisi. */
  @Post(":id/reserve")
  @HttpCode(200)
  async reserver(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(reserveWishSchema)) body: unknown,
    @Ip() ip: string,
    @Headers("authorization") autorisation?: string,
  ): Promise<ReserveOutcome> {
    const compte = await identifier(this.jetons, this.prisma, autorisation);
    const issue = await this.listes.reserver(
      id, body as never, { ...compte, ip },
    );
    this.mesure.emettre(compte.userId ?? null, "reservation.started", {
      authenticated: compte.userId !== undefined,
    });
    if (issue.state === "confirmed") {
      this.mesure.emettre(compte.userId ?? null, "reservation.confirmed", {
        // Le FAIT qu'un nom ait été donné, jamais lequel (§16.4).
        identityRevealed: (body as { showIdentity?: boolean }).showIdentity === true,
        secondsToConfirm: 0,
      });
    }
    return issue;
  }

  /* DELETE, et sur le MÊME chemin que la réservation : c'est la même ressource
     qu'on défait. Une route « /cancel » en ferait un geste à part, alors que
     c'est exactement l'inverse du POST juste au-dessus.

     200 et non 204 : la réponse porte `cancelled: true`, comme le dépôt porte
     `submitted: true`. Un 204 muet dirait seulement que rien n'a cassé. */
  @Delete(":id/reserve")
  @HttpCode(200)
  async annuler(
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("authorization") autorisation?: string,
    @Headers(ENTETE_JETON_RESERVATION) jetonVisite?: string,
  ): Promise<CancelReservationResponse> {
    const compte = await identifier(this.jetons, this.prisma, autorisation);
    await this.listes.annuler(id, {
      ...compte,
      ...(jetonVisite ? { jetonVisite } : {}),
    });
    this.mesure.emettre(compte.userId ?? null, "reservation.cancelled", {
      authenticated: compte.userId !== undefined,
    });
    return { cancelled: true };
  }

  @Post(":id/reserve/verify")
  @HttpCode(200)
  async verifier(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(verifyReservationSchema)) body: unknown,
  ): Promise<ReservationConfirmed> {
    const { showIdentity, commenceeIlYA, ...confirmee } =
      await this.listes.verifier(id, body as never);
    // « le délai entre les deux » (§16.3) : c'est lui qui dit si l'attente du
    // code fait abandonner.
    this.mesure.emettre(null, "reservation.confirmed", {
      identityRevealed: showIdentity,
      secondsToConfirm: commenceeIlYA,
    });
    return confirmee;
  }
}

/* Reconnaître un utilisateur connecté SANS l'exiger.
 *
 * Un AuthGuard refuserait la page à qui n'a pas de compte, et c'est justement
 * l'inverse de ce qu'elle doit faire. Un jeton invalide ou expiré est donc
 * traité comme une absence de jeton : le visiteur consulte et réserve comme un
 * inconnu, plutôt que de se voir fermer une page publique. */
async function identifier(
  jetons: TokenService,
  prisma: PrismaService,
  autorisation?: string,
): Promise<{ userId?: string; email?: string }> {
  if (!autorisation?.startsWith("Bearer ")) return {};
  try {
    const { userId } = jetons.verifyAccess(autorisation.slice(7));
    const utilisateur = await prisma.user.findUnique({
      where: { id: userId }, select: { email: true },
    });
    if (!utilisateur) return {};
    return { userId, email: utilisateur.email };
  } catch {
    return {};
  }
}

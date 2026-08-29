import {
  Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe,
  Patch, Post, Req, UseGuards,
} from "@nestjs/common";
import {
  createWishlistSchema, createOwnerWishSchema, updateOwnerWishSchema,
  type CreateWishlistInput, type CreateOwnerWishInput, type UpdateOwnerWishInput,
  type MyReservation, type OwnerWish, type Wishlist, type WishlistShare,
} from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { Feature } from "../flags/feature.decorator.js";
import { FeatureGuard } from "../flags/feature.guard.js";
import { WishlistService } from "./wishlist.service.js";
import { TrackingService } from "../tracking/tracking.service.js";

type AuthedRequest = { userId: string };

/* FeatureGuard AVANT AuthGuard, comme partout : une surface éteinte l'est pour
 * tout le monde, y compris pour un jeton absent ou invalide. Dans l'autre
 * ordre, le statut distinguerait « éteinte » de « non authentifiée » — et
 * raconterait ainsi que la surface existe (§6.2). */
@Controller("me/wishlists")
@UseGuards(FeatureGuard, AuthGuard)
@Feature("wishlist.own")
export class WishlistsController {
  constructor(
    @Inject(WishlistService) private readonly listes: WishlistService,
    @Inject(TrackingService) private readonly mesure: TrackingService,
  ) {}

  @Get()
  list(@Req() req: AuthedRequest): Promise<Wishlist[]> {
    return this.listes.list(req.userId);
  }

  @Post()
  async create(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(createWishlistSchema)) body: CreateWishlistInput,
  ): Promise<Wishlist> {
    const liste = await this.listes.create(req.userId, body.occurrenceId);
    // Ni l'occasion, ni sa date : §16.4 interdit de transporter du contenu, et
    // la date d'un anniversaire en est. Le fait suffit à mesurer la boucle.
    this.mesure.emettre(req.userId, "wishlist.created", {});
    return liste;
  }

  @Get(":id/wishes")
  listWishes(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<OwnerWish[]> {
    return this.listes.listWishes(req.userId, id);
  }

  @Post(":id/wishes")
  async createWish(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createOwnerWishSchema)) body: CreateOwnerWishInput,
  ): Promise<OwnerWish> {
    const souhait = await this.listes.createWish(req.userId, id, body);
    // « avec photo ou non, prix renseigné ou non » (§16.3) : ce qui dit si les
    // listes sont soignées, sans transporter ni libellé ni montant.
    this.mesure.emettre(req.userId, "wishlist.wish_added", {
      hasPhoto: souhait.imageUrl !== null,
      hasPrice: souhait.price !== null,
    });
    return souhait;
  }

  /* L'adresse publique de la liste. IDEMPOTENT : rouvrir la feuille de partage
     rend le même jeton, sinon l'adresse déjà collée dans un groupe cesserait de
     valoir au premier réappui sur « Partager ». */
  @Get(":id/share")
  async share(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<WishlistShare> {
    const partage = await this.listes.share(req.userId, id);
    this.mesure.emettre(req.userId, "wishlist.shared", {});
    return partage;
  }

  /* La révocation. Elle n'est PAS au tableau des chemins de §5.2, qui ne cite
     que le GET — mais « un lien de partage se révoque » est une exigence du
     produit, et sans elle une liste partagée par erreur ne se reprend jamais.
     Elle vit sous `/me/wishlists*`, donc sous le même drapeau, et n'ouvre
     aucune surface nouvelle. */
  @Delete(":id/share")
  @HttpCode(204)
  revokeShare(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.listes.revokeShare(req.userId, id);
  }
}

/* Le souhait se corrige par SON identifiant, sans redire la liste — même
 * raisonnement que `/me/wishes/{id}` pour les souhaits de proche :
 * l'appartenance se vérifie en remontant souhait → occurrence → compte, et
 * faire redire la liste au client ouvrirait une incohérence à arbitrer pour
 * aucune sécurité de plus. */
@Controller("me/owner-wishes")
@UseGuards(FeatureGuard, AuthGuard)
@Feature("wishlist.own")
export class OwnerWishController {
  constructor(@Inject(WishlistService) private readonly listes: WishlistService) {}

  @Patch(":id")
  update(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateOwnerWishSchema)) body: UpdateOwnerWishInput,
  ): Promise<OwnerWish> {
    return this.listes.updateWish(req.userId, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.listes.removeWish(req.userId, id);
  }
}

/* Ce que J'AI réservé chez les autres — à ne pas confondre avec ce qu'on a
 * réservé sur MA liste, qui ne se lit nulle part sous cette forme et ne doit
 * pas se lire.
 *
 * Drapeau `reservation`, qui REQUIERT `wishlist.own` : éteindre les listes
 * éteint la réservation, et la résolution se fait côté serveur (FlagsService)
 * — le client ne connaît aucune règle de dépendance. */
@Controller("me/reservations")
@UseGuards(FeatureGuard, AuthGuard)
@Feature("reservation")
export class MyReservationsController {
  constructor(@Inject(WishlistService) private readonly listes: WishlistService) {}

  @Get()
  list(@Req() req: AuthedRequest): Promise<MyReservation[]> {
    return this.listes.myReservations(req.userId);
  }
}

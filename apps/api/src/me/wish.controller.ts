import {
  Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe,
  Patch, Post, Req, UseGuards,
} from "@nestjs/common";
import {
  createWishSchema, updateWishSchema,
  type CreateWishInput, type UpdateWishInput, type Wish, type DepotAvatar,
} from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { Feature } from "../flags/feature.decorator.js";
import { FeatureGuard } from "../flags/feature.guard.js";
import { WishService } from "./wish.service.js";
import { AvatarService } from "./avatar.service.js";
import { TrackingService } from "../tracking/tracking.service.js";

type AuthedRequest = { userId: string };

/* Un contrôleur À PART, alors que le chemin prolonge celui d'OccurrenceController.
 *
 * Les échéances relèvent du SOCLE, qui n'a pas de drapeau : les loger ensemble
 * obligerait à poser @Feature méthode par méthode, et le jour où quelqu'un
 * ajoute une route aux souhaits sans y penser, elle répondrait drapeau éteint.
 * Une surface gouvernée par un drapeau se garde par son contrôleur, pas par la
 * vigilance de qui l'étend.
 *
 * FeatureGuard AVANT AuthGuard : une surface éteinte l'est pour tout le monde,
 * y compris pour un jeton invalide ou absent. Dans l'autre ordre, le statut
 * distinguerait « éteinte » de « non authentifiée » — et raconterait ainsi
 * qu'elle existe. */
@Controller("me/occurrences/:occurrenceId/wishes")
@UseGuards(FeatureGuard, AuthGuard)
@Feature("wishlist")
export class OccurrenceWishesController {
  constructor(
    @Inject(WishService) private readonly souhaits: WishService,
    @Inject(TrackingService) private readonly mesure: TrackingService,
  ) {}

  @Get()
  list(
    @Req() req: AuthedRequest,
    @Param("occurrenceId", ParseUUIDPipe) occurrenceId: string,
  ): Promise<Wish[]> {
    return this.souhaits.listForOccurrence(req.userId, occurrenceId);
  }

  // 201 : la route rend une ressource neuve, dont le client apprend
  // l'identifiant — Nest applique déjà ce statut par défaut à un POST.
  @Post()
  create(
    @Req() req: AuthedRequest,
    @Param("occurrenceId", ParseUUIDPipe) occurrenceId: string,
    @Body(new ZodValidationPipe(createWishSchema)) body: CreateWishInput,
  ): Promise<Wish> {
    return this.souhaits.createForOccurrence(req.userId, occurrenceId, body).then((souhait) => {
      // La PROVENANCE seule (§16.3). Ni le libellé, ni le lien, ni le prix :
      // §16.4 interdit de transporter du contenu, et un souhait en est un.
      this.mesure.emettre(req.userId, "wish.added", { origin: souhait.origin });
      return souhait;
    });
  }
}

/* Le souhait se corrige par SON identifiant, sans redire l'occasion.
 *
 * Le chemin ne la reprend pas parce qu'il n'a rien à en faire : l'appartenance
 * se vérifie par la portée cloisonnée, qui remonte la chaîne souhait →
 * occurrence → compte. La faire redire au client ouvrirait une incohérence à
 * arbitrer — un souhait désigné sous une occasion qui n'est pas la sienne —
 * pour aucune sécurité de plus. */
@Controller("me/wishes")
@UseGuards(FeatureGuard, AuthGuard)
@Feature("wishlist")
export class WishController {
  constructor(
    @Inject(WishService) private readonly souhaits: WishService,
    @Inject(AvatarService) private readonly medias: AvatarService,
  ) {}

  /* LA PHOTO D'UN SOUHAIT DU CARNET, sur le chemin déjà emprunté par la photo
     de profil et par celle d'un souhait de ma liste : le serveur signe une URL,
     le téléphone dépose dessus, puis confirme. Les octets ne traversent jamais
     l'API — deux mégaoctets occuperaient une connexion pour rien, et un
     téléphone en zone lente la tiendrait longtemps.
     `image_key` existait déjà en base et la lecture la servait déjà ; seule
     l'écriture manquait, si bien que la colonne ne pouvait pas se remplir.
     200 et non 201 : rien n'est créé, on délivre une permission. */
  @Post(":id/photo/depot")
  @HttpCode(200)
  depotPhoto(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<DepotAvatar> {
    return this.medias.depotPhotoDuCarnet(req.userId, id);
  }

  /* Aucun corps, et l'identifiant du chemin ne sert PAS à choisir la cible :
     elle a été fixée au dépôt, où l'appartenance a été vérifiée. L'accepter ici
     depuis le client permettrait de rattacher sa photo au souhait d'un autre. */
  @Post(":id/photo")
  @HttpCode(204)
  async confirmerPhoto(@Req() req: AuthedRequest): Promise<void> {
    await this.medias.confirmerPhotoDuCarnet(req.userId);
  }

  @Patch(":id")
  update(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateWishSchema)) body: UpdateWishInput,
  ): Promise<Wish> {
    return this.souhaits.update(req.userId, id, body);
  }

  // 204 comme les autres suppressions du contrat : rien à rendre.
  @Delete(":id")
  @HttpCode(204)
  remove(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.souhaits.remove(req.userId, id);
  }
}

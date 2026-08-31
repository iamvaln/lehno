import {
  Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe,
  Patch, Post, Req, UseGuards,
} from "@nestjs/common";
import {
  updateWallSchema, createCollectionLinkSchema, submissionDecisionSchema,
  receivedWishDecisionSchema,
  type UpdateWallInput, type Wall, type PublicWall, type WishLink,
  type CollectionLink, type CreateCollectionLinkInput,
  type Submission, type SubmissionDecisionInput,
  type ReceivedWish, type ReceivedWishDecisionInput,
} from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { Feature } from "../flags/feature.decorator.js";
import { FeatureGuard } from "../flags/feature.guard.js";
import { MurService } from "./mur.service.js";
import { CollecteService } from "./collecte.service.js";
import { SubmissionService } from "./submission.service.js";
import { VoeuxService } from "./voeux.service.js";

type AuthedRequest = { userId: string };

/* CINQ contrôleurs pour un même domaine, et c'est le découpage des DRAPEAUX
 * qui l'impose, pas le goût de la subdivision.
 *
 * `wall`, `collect` et `wishes` gouvernent des chemins précis (voir
 * packages/contracts/src/flags.ts) : `/me/wall*` relève de `wall`, sauf
 * `/me/wall/wish-link` qui relève de `wishes`. Poser @Feature méthode par
 * méthode dans un contrôleur unique marcherait aujourd'hui et casserait au
 * premier ajout — la route ajoutée sans décorateur répondrait sans garde, ou
 * hériterait du mauvais drapeau. Une surface gouvernée par un drapeau se garde
 * par SON contrôLEUR, pas par la vigilance de qui l'étend.
 *
 * FeatureGuard AVANT AuthGuard, partout : une surface éteinte l'est pour tout
 * le monde, y compris pour un jeton absent ou invalide. Dans l'autre ordre, le
 * statut distinguerait « éteinte » de « non authentifiée » — et raconterait
 * ainsi qu'elle existe.
 */

@Controller("me/wall")
@UseGuards(FeatureGuard, AuthGuard)
@Feature("wall")
export class WallController {
  constructor(@Inject(MurService) private readonly mur: MurService) {}

  @Get()
  get(@Req() req: AuthedRequest): Promise<Wall> {
    return this.mur.get(req.userId);
  }

  @Patch()
  update(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(updateWallSchema)) body: UpdateWallInput,
  ): Promise<Wall> {
    return this.mur.update(req.userId, body);
  }

  // Le Mur tel que le public le voit, MÊME NON PUBLIÉ : c'est tout l'objet de
  // l'écran — savoir ce qu'on s'apprête à ouvrir avant de l'ouvrir.
  @Get("preview")
  preview(@Req() req: AuthedRequest): Promise<PublicWall> {
    return this.mur.preview(req.userId);
  }
}

/* `/me/wall/wish-link` prolonge le chemin du Mur mais relève du drapeau
 * `wishes`, qui REQUIERT `wall` (flags.ts) : éteindre le Mur éteint le dépôt de
 * vœux, la résolution se faisant côté serveur. Un contrôleur à part, donc — le
 * loger dans WallController lui donnerait le drapeau `wall`, et le dépôt de
 * vœux resterait ouvert quand on l'a fermé.
 *
 * Nest résout d'abord la route la plus spécifique : `me/wall/wish-link`
 * n'entre pas en conflit avec `me/wall/preview` ni avec `me/wall`.
 */
@Controller("me/wall/wish-link")
@UseGuards(FeatureGuard, AuthGuard)
@Feature("wishes")
export class WishLinkController {
  constructor(@Inject(MurService) private readonly mur: MurService) {}

  @Get()
  get(@Req() req: AuthedRequest): Promise<WishLink> {
    return this.mur.lienDeVoeux(req.userId);
  }
}

@Controller("me/collection-links")
@UseGuards(FeatureGuard, AuthGuard)
@Feature("collect")
export class CollectionLinksController {
  constructor(@Inject(CollecteService) private readonly collecte: CollecteService) {}

  @Get()
  list(@Req() req: AuthedRequest): Promise<CollectionLink[]> {
    return this.collecte.list(req.userId);
  }

  // 200 et non 201 : l'appel ROUVRE souvent un lien existant plutôt que d'en
  // créer un — annoncer « créé » serait faux une fois sur deux.
  @Post()
  @HttpCode(200)
  create(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(createCollectionLinkSchema)) body: CreateCollectionLinkInput,
  ): Promise<CollectionLink> {
    return this.collecte.create(req.userId, body);
  }

  // 204 comme les autres suppressions du contrat. Le lien n'est pas effacé
  // pour autant : il porte les contributions déjà reçues.
  @Delete(":id")
  @HttpCode(204)
  revoke(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.collecte.revoke(req.userId, id);
  }
}

@Controller("me/submissions")
@UseGuards(FeatureGuard, AuthGuard)
@Feature("collect")
export class SubmissionsController {
  constructor(@Inject(SubmissionService) private readonly soumissions: SubmissionService) {}

  @Get()
  list(@Req() req: AuthedRequest): Promise<Submission[]> {
    return this.soumissions.list(req.userId);
  }

  @Get(":id")
  get(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<Submission> {
    return this.soumissions.get(req.userId, id);
  }

  // 200 : la décision rend la contribution telle qu'elle est APRÈS coup, avec
  // le sort de chaque souhait. L'écran s'en sert pour se rafraîchir sans
  // relire, et le client voit ce que le serveur a réellement écrit.
  @Post(":id/decision")
  @HttpCode(200)
  decide(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(submissionDecisionSchema)) body: SubmissionDecisionInput,
  ): Promise<Submission> {
    return this.soumissions.decide(req.userId, id, body);
  }
}

@Controller("me/received-wishes")
@UseGuards(FeatureGuard, AuthGuard)
@Feature("wishes")
export class ReceivedWishesController {
  constructor(@Inject(VoeuxService) private readonly voeux: VoeuxService) {}

  @Get()
  list(@Req() req: AuthedRequest): Promise<ReceivedWish[]> {
    return this.voeux.list(req.userId);
  }

  @Post(":id/decision")
  @HttpCode(200)
  decide(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(receivedWishDecisionSchema)) body: ReceivedWishDecisionInput,
  ): Promise<ReceivedWish> {
    return this.voeux.decide(req.userId, id, body);
  }
}

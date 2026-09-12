import {
  Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Req, UseGuards,
} from "@nestjs/common";
import type { DepotPhotoSource, Portrait } from "@lehno/contracts";
import { AuthGuard } from "../auth/auth.guard.js";
import { Feature } from "../flags/feature.decorator.js";
import { FeatureGuard } from "../flags/feature.guard.js";
import { PortraitService } from "./portrait.service.js";
import { PhotoSourceService } from "./photo-source.service.js";

type AuthedRequest = { userId: string };

/* Les portraits produits.
 *
 * LE DRAPEAU EST ICI, à la différence du contrôleur des générations. Là-bas, la
 * route sert TROIS natures et le drapeau se lit à la main sur celle qu'on
 * demande ; ici tout est portrait, et `@Feature` suffit.
 *
 * `flags.ts` annonce ces chemins depuis le début — « /me/studio/options,
 * /me/generations, /me/portraits/* ». Le troisième n'existait pas : allumer
 * `generation.portrait` ouvrait une porte sur rien.
 */
@Controller("me/portraits")
@UseGuards(FeatureGuard, AuthGuard)
@Feature("generation.portrait")
export class PortraitController {
  constructor(
    @Inject(PortraitService) private readonly portraits: PortraitService,
    @Inject(PhotoSourceService) private readonly photo: PhotoSourceService,
  ) {}

  /* LE DÉPÔT D'UNE PHOTO SOURCE — deux temps, comme l'avatar.
   *
   * D'abord une URL signée : le client téléverse DIRECTEMENT sur le stockage,
   * l'image ne passe pas par nous. Puis il dit « c'est fait », et c'est là qu'on
   * juge — taille, luminosité, netteté — et qu'on refuse en le disant.
   *
   * SUR LE CHEMIN DU PORTRAIT et non sur celui des générations : la photo
   * appartient à ce qu'on va composer, et elle se dépose avant de payer. Le
   * drapeau `generation.portrait` la garde avec le reste — une voie photo
   * ouverte sur un portrait éteint n'aurait nulle part où aboutir. */
  @Post("photo/depot")
  @HttpCode(200)
  depotPhoto(@Req() req: AuthedRequest): Promise<DepotPhotoSource> {
    return this.photo.deposer(req.userId);
  }

  /* 204 : il n'y a rien à rendre. La clé reste au serveur — voir
     `photo-source.service` —, et le client sait déjà ce qu'il a déposé. Un
     refus, lui, part en 400 avec sa raison dans le détail. */
  @Post("photo")
  @HttpCode(204)
  confirmerPhoto(@Req() req: AuthedRequest): Promise<void> {
    return this.photo.confirmer(req.userId);
  }

  @Get()
  async lister(@Req() req: AuthedRequest): Promise<{ portraits: Portrait[] }> {
    return { portraits: await this.portraits.lister(req.userId) };
  }

  @Get(":id")
  lire(@Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string): Promise<Portrait> {
    return this.portraits.lire(req.userId, id);
  }

  /* APPROUVER FABRIQUE L'IMAGE. C'est le second temps, et la modération : on
     relit le texte avant de payer un dessin.
     200 et non 201 : le portrait existe déjà, il change d'état. Et l'appel est
     IDEMPOTENT — un portrait déjà approuvé rend le sien plutôt qu'une seconde
     image, parce que deux frappes sur le même bouton sont la chose la plus
     banale du monde sur un téléphone. */
  @Post(":id/approve")
  approuver(
    @Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string,
  ): Promise<Portrait> {
    return this.portraits.approuver(req.userId, id);
  }
}

import { Controller, Get, Inject, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import type { Portrait } from "@lehno/contracts";
import { AuthGuard } from "../auth/auth.guard.js";
import { Feature } from "../flags/feature.decorator.js";
import { FeatureGuard } from "../flags/feature.guard.js";
import { PortraitService } from "./portrait.service.js";

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
  constructor(@Inject(PortraitService) private readonly portraits: PortraitService) {}

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

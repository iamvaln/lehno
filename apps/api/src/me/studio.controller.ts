import { Controller, Get, Inject, Injectable, Req, UseGuards } from "@nestjs/common";
import { catalogueServi, type StudioOptions } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { Feature } from "../flags/feature.decorator.js";
import { FeatureGuard } from "../flags/feature.guard.js";
import { StudioConfigurationService } from "../studio/configuration.service.js";

/* Ce que le studio propose à l'utilisateur — spec technique §5.4.
 *
 * « L'écran s'ouvre déjà réglé » : le client n'a rien à deviner. Les douze
 * orientations, leurs libellés, l'ordre dans lequel elles se posent et le prix
 * viennent d'ici, et non d'un enum embarqué — un parc d'applications ne se met
 * pas à jour d'un bloc, et geler ce catalogue dans le client obligerait à
 * livrer une version pour désactiver une orientation.
 */

const ACTION_PORTRAIT = "portrait";

@Injectable()
export class StudioOptionsService {
  // @Inject explicite : esbuild/vitest n'émet pas design:paramtypes.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StudioConfigurationService) private readonly configs: StudioConfigurationService,
  ) {}

  async options(userId: string): Promise<StudioOptions> {
    /* LES DEUX configurations : le catalogue de l'application les réunit — les
       orientations viennent du message, les voies et les ambiances du portrait.
       C'est le seul endroit où elles se rejoignent, et il est en lecture. */
    const [message, portrait, action, compte] = await Promise.all([
      this.configs.enService("message"),
      this.configs.enService("portrait"),
      this.prisma.premiumAction.findUnique({ where: { code: ACTION_PORTRAIT } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { uiLanguage: true } }),
    ]);

    /* UN BROUILLON N'ATTEINT JAMAIS UN UTILISATEUR : on ne lit que l'état
     * `published`, sans repli sur les réglages du code.
     *
     * Le repli serait tentant — il rendrait cette route increvable — et c'est
     * exactement ce qui le disqualifie. Le jour où l'administration publie une
     * configuration à trois orientations, un incident de base ferait
     * silencieusement réapparaître les douze du code, et personne ne saurait
     * pourquoi une orientation désactivée est revenue. Une seule source, et
     * elle est en base ; la réconciliation au démarrage se charge qu'elle
     * existe. */
    /* On REFUSE plutôt que de servir à moitié : un catalogue sans ses
       ambiances ouvrirait l'écran sur une voie d'image qui ne mène nulle part,
       et un catalogue sans orientations n'aurait rien à proposer du tout. Le
       repli silencieux ferait croire à un studio appauvri là où il est à
       moitié absent. */
    if (!message || !portrait)
      throw new AppError("resource_inactive", "the studio has no published configuration");

    /* La langue est celle de l'INTERFACE de l'utilisateur, pas celle du
       proche : cet écran est le sien. Celle du proche décidera de la langue du
       message produit, au lancement de la génération, et les deux diffèrent
       souvent — on écrit en anglais à quelqu'un depuis une application réglée
       en français. */
    const langue = compte?.uiLanguage === "en" ? "en" : "fr";

    return {
      catalogue: catalogueServi(
        this.configs.reglagesMessageDe(message),
        this.configs.reglagesPortraitDe(portrait),
        langue,
      ),
      /* LE PRIX VIENT DE LA BASE. Il se règle en administration sans
         livraison ; une constante ici afficherait l'ancien tarif sur tout un
         parc jusqu'à la mise à jour suivante. Zéro si l'action n'existe pas
         encore — le semis la crée, et le lancement, lui, refusera. */
      creditCost: action?.creditCost ?? 0,
      version: { message: message.version, portrait: portrait.version },
    };
  }
}

/* FeatureGuard AVANT AuthGuard : une surface éteinte l'est pour tout le monde,
 * y compris pour un jeton invalide. Dans l'autre ordre, le statut distinguerait
 * « éteinte » de « non authentifiée », et raconterait donc quelque chose. */
@Controller("me/studio")
@UseGuards(FeatureGuard, AuthGuard)
@Feature("generation.portrait")
export class StudioOptionsController {
  constructor(@Inject(StudioOptionsService) private readonly service: StudioOptionsService) {}

  @Get("options")
  options(@Req() req: { userId: string }): Promise<StudioOptions> {
    return this.service.options(req.userId);
  }
}

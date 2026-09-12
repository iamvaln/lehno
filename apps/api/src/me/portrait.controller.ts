import {
  Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards,
} from "@nestjs/common";
import { updatePortraitSchema, avisSchema } from "@lehno/contracts";
import type { AvisInput, DepotPhotoSource, Portrait, UpdatePortraitInput } from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
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

  /* COMPOSER FABRIQUE L'IMAGE, et rien d'autre. C'est le second temps, et la
     modération : on relit le texte avant de payer un dessin.

     Le bouton de l'écran dit « Composer l'image » depuis le premier jour ; seul
     le serveur appelait ça « approuver », et ce nom mêlait la fabrication à
     l'acceptation. Le portrait sort d'ici en `composed` — l'avis vient après,
     sur ce qu'on a vu.

     200 et non 201 : le portrait existe déjà, il change d'état. Et l'appel est
     IDEMPOTENT — un portrait déjà composé rend le sien plutôt qu'une seconde
     image, parce que deux frappes sur le même bouton sont la chose la plus
     banale du monde sur un téléphone. */
  @Post(":id/compose")
  composer(
    @Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string,
  ): Promise<Portrait> {
    return this.portraits.composer(req.userId, id);
  }

  /* LA NOTE DE L'EXPÉDITEUR — la route qui manquait.
     L'écran envoyait ce `PATCH` depuis le premier jour ; il n'existait ni ici ni
     au contrat, donc l'interrupteur de signature échouait en silence.
     AVANT LA COMPOSITION SEULEMENT : après, la note est dans les pixels du
     fichier, et l'accepter promettrait un effet qui n'arrive pas. */
  @Patch(":id")
  changerLaNote(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updatePortraitSchema)) corps: UpdatePortraitInput,
  ): Promise<Portrait> {
    return this.portraits.changerLaNote(req.userId, id, corps.senderNote);
  }

  /* LES DEUX VERDICTS. Ils portent sur une image COMPOSÉE — juger un brief
     mesurerait la qualité du texte en laissant croire qu'il mesure celle du
     portrait.

     Ils ne détruisent rien, donc ils se reprennent : l'image reste quel que soit
     l'avis, puisque l'utilisateur l'a payée. Et ils sont facultatifs — la
     plupart des portraits resteront sans avis, ce qui est un état légitime et
     non un oubli. */
  /* PATCH et non POST : on pose un avis sur une production qui existe, on ne
     crée rien. Même chemin et même corps que sur une idée — une seule forme
     d'avis dans toute l'API. */
  @Patch(":id/feedback")
  noter(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(avisSchema)) corps: AvisInput,
  ) {
    return this.portraits.noter(req.userId, id, corps.feedback);
  }

  @Post(":id/approve")
  approuver(
    @Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string,
  ): Promise<Portrait> {
    return this.portraits.approuver(req.userId, id);
  }

  @Post(":id/reject")
  rejeter(
    @Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string,
  ): Promise<Portrait> {
    return this.portraits.rejeter(req.userId, id);
  }
}

import { Body, Controller, Delete, Get, HttpCode, Inject, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { updateProfileSchema, urlMediaSchema, usernameSchema, type DepotAvatar, type Profile, type UpdateProfileInput, type UrlMedia } from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { ProfileService } from "./profile.service.js";
import { AvatarService } from "./avatar.service.js";

// Posé par AuthGuard (voir auth/auth.guard.ts) : req.userId. Type minimal,
// pas de dépendance à @types/express (absent de ce paquet).
type AuthedRequest = { userId: string };

const usernameQuerySchema = z.object({ username: usernameSchema }).strict();

@Controller("me/profile")
@UseGuards(AuthGuard)
export class ProfileController {
  // @Inject explicite : voir ProfileService, même contrainte esbuild/vitest.
  constructor(
    @Inject(ProfileService) private readonly profile: ProfileService,
    @Inject(AvatarService) private readonly avatar: AvatarService,
  ) {}

  /* LE DÉPÔT NE PASSE PAS PAR L'API. Cette route ne rend qu'une URL signée,
     valable quelques minutes ; le client dépose dessus, puis confirme.
     Une photo de deux mégaoctets qui traverse le serveur occupe une connexion
     pour rien, et un téléphone en zone lente la tiendrait longtemps.
     200 et non 201 : rien n'est créé ici, on délivre une permission. */
  @Post("avatar/depot")
  @HttpCode(200)
  depot(@Req() req: AuthedRequest): Promise<DepotAvatar> {
    return this.avatar.depot(req.userId);
  }

  /* La confirmation ne porte AUCUN corps : le serveur sait quelle clé il a
     délivrée et à qui. Accepter une clé venue du client laisserait pointer son
     avatar vers celle d'un autre — un reçu, un export — et nous ferions ensuite
     signer une lecture dessus.
     C'est ici que les octets se relisent : type vérifié d'après le CONTENU,
     dimensions bornées, image recomposée — donc métadonnées retirées, dont la
     position géographique. */
  @Post("avatar")
  @HttpCode(200)
  confirmer(@Req() req: AuthedRequest): Promise<Profile> {
    return this.avatar.confirmer(req.userId);
  }

  // 200 avec le profil, et non 204 : l'écran vient de changer, il doit pouvoir
  // se redessiner sans redemander.
  @Delete("avatar")
  @HttpCode(200)
  retirer(@Req() req: AuthedRequest): Promise<Profile> {
    return this.avatar.retirer(req.userId);
  }

  @Get()
  get(@Req() req: AuthedRequest): Promise<Profile> {
    return this.profile.get(req.userId);
  }

  @Patch()
  update(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ): Promise<Profile> {
    return this.profile.update(req.userId, body);
  }

  // Sous la même garde que le reste : la disponibilité dépend du demandeur
  // (garder son propre pseudo n'est jamais un conflit), donc req.userId est
  // nécessaire ici aussi.
  @Get("username-available")
  async usernameAvailable(
    @Req() req: AuthedRequest,
    @Query(new ZodValidationPipe(usernameQuerySchema)) query: { username: string },
  ): Promise<{ available: boolean }> {
    return { available: await this.profile.usernameAvailable(query.username, req.userId) };
  }
}

/* LES MÉDIAS, sur leur propre chemin.
 *
 * `me/profile/media/...` les rangerait sous le profil, alors qu'ils viendront
 * aussi des souhaits et des portraits. Un chemin par ressource obligerait chaque
 * client à savoir de quelle famille vient l'image qu'il veut afficher — or il ne
 * connaît qu'une clé.
 */
@Controller("me/media")
@UseGuards(AuthGuard)
export class MediaController {
  constructor(@Inject(AvatarService) private readonly avatar: AvatarService) {}

  /* UNE URL DE LECTURE, À LA DEMANDE, pour une clé qu'on possède déjà.
   *
   * Elle existe pour le CACHE : un client qui garde ses images localement les
   * range par clé, et ne redemande une URL que lorsqu'il n'a pas le fichier.
   * Sans elle, il faudrait relire tout le profil pour un laissez-passer.
   *
   * La clé seule ne vaut RIEN — le service vérifie qu'elle appartient au
   * demandeur. Sans ce contrôle, une clé aperçue une fois se rejouerait
   * indéfiniment, et le serveur cesserait de décider à chaque lecture.
   *
   * POST et non GET : une clé dans un chemin finit dans les journaux d'accès,
   * les référents et le presse-papier de qui repartage une adresse. */
  @Post("url")
  @HttpCode(200)
  urlMedia(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(urlMediaSchema)) corps: { cle: string },
  ): Promise<UrlMedia> {
    return this.avatar.urlDe(req.userId, corps.cle);
  }
}

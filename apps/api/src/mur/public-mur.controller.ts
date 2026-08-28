import { Body, Controller, Get, HttpCode, Inject, Ip, Param, Post, UseGuards } from "@nestjs/common";
import {
  usernameSchema, collectSubmitSchema, submitWishSchema,
  type PublicWall, type PublicCollectForm, type PublicSubmissions,
  type PublicWishForm, type CollectSubmitInput, type SubmitWishInput,
} from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AppError } from "../common/errors.js";
import { Feature } from "../flags/feature.decorator.js";
import { FeatureGuard } from "../flags/feature.guard.js";
import { MurService } from "./mur.service.js";
import { CollecteService } from "./collecte.service.js";
import { VoeuxService } from "./voeux.service.js";

/* LES SURFACES SANS SESSION.
 *
 * Aucun AuthGuard ici, et ce n'est pas un oubli : ces chemins se servent sans
 * compte. Le jeton porté par le lien désigne la ressource et vaut permission,
 * rien d'autre — il n'identifie personne, et le serveur ne sait donc jamais QUI
 * frappe. C'est ce qui rend chaque champ rendu ici une décision : ce que le
 * lien ouvre, tout porteur du lien le voit.
 *
 * FeatureGuard seul, donc, mais bien présent : un drapeau éteint rend 404 sur
 * la page publique comme sur l'écran de l'application.
 *
 * `@Ip()` lit `req.ip` d'Express — l'adresse de la connexion TCP tant que
 * « trust proxy » n'est pas activé, jamais un en-tête transmis. Même
 * raisonnement que WaitlistController : se fier à un X-Forwarded-For non
 * configuré laisserait n'importe qui forger son origine et contourner le
 * plafond. Elle ne sert qu'à composer une clé de limiteur — ni journalisée, ni
 * renvoyée.
 */

// Le pseudo vient de l'URL, donc du monde. On le valide contre LA déclaration
// unique (profile.ts) avant d'en faire une requête : sans elle, n'importe
// quelle chaîne atteindrait la base, et le chemin deviendrait un moyen de
// sonder la table des comptes avec ce qu'on veut.
function pseudoValide(brut: string): string {
  const analyse = usernameSchema.safeParse(brut);
  // 404 et non 400 : un pseudo mal formé n'existe pas plus qu'un pseudo
  // inconnu, et distinguer les deux dirait quelle forme est recevable.
  if (!analyse.success) throw new AppError("not_found", "resource not found");
  return analyse.data;
}

@Controller("public/walls")
@UseGuards(FeatureGuard)
@Feature("wall")
export class PublicWallController {
  constructor(@Inject(MurService) private readonly mur: MurService) {}

  @Get(":username")
  get(@Param("username") username: string): Promise<PublicWall> {
    return this.mur.parPseudo(pseudoValide(username));
  }
}

@Controller("public/collect")
@UseGuards(FeatureGuard)
@Feature("collect")
export class PublicCollectController {
  constructor(@Inject(CollecteService) private readonly collecte: CollecteService) {}

  @Get(":token")
  form(@Param("token") token: string): Promise<PublicCollectForm> {
    return this.collecte.formulaire(token);
  }

  // 200 et non 201 : rien de ce qui est créé n'est rendu au répondant. « C'est
  // transmis », et la contribution part en validation — annoncer une ressource
  // neuve laisserait croire qu'elle est déjà entrée dans une fiche.
  @Post(":token")
  @HttpCode(200)
  submit(
    @Param("token") token: string,
    @Body(new ZodValidationPipe(collectSubmitSchema)) body: CollectSubmitInput,
    @Ip() ip: string,
  ): Promise<{ submitted: true }> {
    return this.collecte.soumettre(token, body, ip);
  }

  // Liens NOMINATIFS seulement : voir CollecteService.relire. Un lien public
  // rend 404 ici, sans quoi tout visiteur lirait ce que les autres ont écrit.
  @Get(":token/submissions")
  submissions(@Param("token") token: string): Promise<PublicSubmissions> {
    return this.collecte.relire(token);
  }
}

@Controller("public/wishes")
@UseGuards(FeatureGuard)
@Feature("wishes")
export class PublicWishesController {
  constructor(@Inject(VoeuxService) private readonly voeux: VoeuxService) {}

  // Répond MÊME hors fenêtre, avec les bornes : la page doit pouvoir dire
  // quand revenir. C'est le dépôt qui refuse, pas la lecture.
  @Get(":token")
  form(@Param("token") token: string): Promise<PublicWishForm> {
    return this.voeux.formulaire(token);
  }

  @Post(":token")
  @HttpCode(200)
  submit(
    @Param("token") token: string,
    @Body(new ZodValidationPipe(submitWishSchema)) body: SubmitWishInput,
    @Ip() ip: string,
  ): Promise<{ submitted: true }> {
    return this.voeux.deposer(token, body, ip);
  }
}

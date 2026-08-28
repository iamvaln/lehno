import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import {
  startGenerationSchema, updateMessageSchema,
  type GeneratedMessage, type Generation, type GenerationResult,
  type StartGenerationInput, type UpdateMessageInput, type Orientation,
} from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { Feature } from "../flags/feature.decorator.js";
import { FeatureGuard } from "../flags/feature.guard.js";
import { AppError } from "../common/errors.js";
import { GenerationService } from "./generation.service.js";

type AuthedRequest = { userId: string };

type LigneExecution = {
  id: string; status: string; creditsSpent: number; failureCode: string | null;
  createdAt: Date;
  premiumAction: { code: string };
  generatedMessage: {
    id: string; eventOccurrenceId: string; content: string; shortContent: string | null;
    status: string; createdAt: Date; updatedAt: Date;
  } | null;
};

/* Le lancement d'une génération et son suivi.
 *
 * FeatureGuard AVANT AuthGuard : une surface éteinte l'est pour tout le monde,
 * y compris pour un jeton invalide. Dans l'autre ordre, le statut distinguerait
 * « éteinte » de « non authentifiée », et raconterait donc quelque chose. */
@Controller("me/generations")
@UseGuards(FeatureGuard, AuthGuard)
@Feature("generation.message")
export class GenerationController {
  constructor(@Inject(GenerationService) private readonly generation: GenerationService) {}

  @Post()
  async lancer(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(startGenerationSchema)) corps: StartGenerationInput,
  ): Promise<GenerationResult> {
    /* Seul le message est ouvert. Le portrait et les idées ont leurs propres
       drapeaux et leurs propres tables — les accepter ici les ferait échouer
       APRÈS le débit, pour une fonctionnalité qui n'existe pas encore. */
    if (corps.kind !== "wish_message")
      throw new AppError("resource_inactive", `generation "${corps.kind}" is not available yet`);
    if (!corps.occurrenceId)
      throw new AppError("validation_failed", "an occurrence is required");

    /* L'orientation voyage dans `studioSelection`, que le contrat commun refuse
       pour un message — « le studio n'a de sens que pour un portrait ». Elle
       passe donc par `tone`, le seul champ libre que le lancement porte pour
       les actions sans image. C'est un pis-aller, et il est signalé : le
       contrat commun devra porter l'orientation autrement. */
    const orientation = (corps.tone ?? "notre_relation") as Orientation;

    const ligne = await this.generation.lancerMessage(
      req.userId, corps.occurrenceId, orientation,
      {
        ...(corps.language === undefined ? {} : { langue: corps.language }),
        ...(corps.briefText === undefined ? {} : { texteLibre: corps.briefText }),
      },
    );
    return this.rendre(await this.generation.lire(req.userId, ligne.actionRunId) as LigneExecution);
  }

  @Get()
  async lister(@Req() req: AuthedRequest): Promise<{ generations: GenerationResult[] }> {
    const lignes = (await this.generation.lister(req.userId)) as LigneExecution[];
    return { generations: lignes.map((l) => this.rendre(l)) };
  }

  @Get(":id")
  async suivre(
    @Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string,
  ): Promise<GenerationResult> {
    return this.rendre(await this.generation.lire(req.userId, id) as LigneExecution);
  }

  private rendre(l: LigneExecution): GenerationResult {
    const message = l.generatedMessage;
    const generation: Generation = {
      id: l.id,
      kind: l.premiumAction.code as Generation["kind"],
      status: GenerationService.ETAT[l.status] ?? "failed",
      creditsSpent: l.creditsSpent,
      /* Le CODE, jamais un message de fournisseur : ceux-là recopient parfois
         l'invite, donc les notes — les mots privés de quelqu'un sur un tiers
         n'ont rien à faire dans une réponse d'erreur. */
      failureReason: l.failureCode,
      resultId: message?.id ?? null,
      createdAt: l.createdAt.toISOString(),
    };
    return {
      generation,
      message: message === null ? null : {
        id: message.id,
        occurrenceId: message.eventOccurrenceId,
        content: message.content,
        contentShort: message.shortContent,
        status: message.status as GeneratedMessage["status"],
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt.toISOString(),
      },
    };
  }
}

/* Le brouillon se corrige APRÈS coup, et ce chemin n'est pas sous le même
 * drapeau que la génération.
 *
 * Éteindre `generation.message` doit empêcher d'en produire de nouveaux, pas
 * de relire et d'ajuster ceux qu'on a déjà payés. Les mettre sous le même
 * interrupteur ferait disparaître un contenu acheté. */
@Controller("me/messages")
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(@Inject(GenerationService) private readonly generation: GenerationService) {}

  @Patch(":id")
  async corriger(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateMessageSchema)) corps: UpdateMessageInput,
  ): Promise<GeneratedMessage> {
    const m = await this.generation.corriger(req.userId, id, corps);
    return {
      id: m.id,
      occurrenceId: m.eventOccurrenceId,
      content: m.content,
      contentShort: m.shortContent,
      status: m.status as GeneratedMessage["status"],
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }
}

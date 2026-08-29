import { Body, Controller, HttpCode, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { createFeedbackSchema, createSupportRequestSchema } from "@lehno/contracts";
import type {
  CreateFeedbackInput, CreateSupportRequestInput, SupportRequest,
} from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { RateLimitService } from "../common/rate-limit.service.js";
import { SupportService } from "./support.service.js";

type AuthedRequest = { userId: string };

/* Aide et avis — spec mobile §3.26, spec technique §5.9.
 *
 * Un seul contrôleur pour deux chemins voisins, mais deux ressources : les
 * demandes d'assistance attendent une réponse, les avis non.
 */
@Controller("me")
@UseGuards(AuthGuard)
export class SupportController {
  // @Inject explicite : voir ProfileController, même contrainte esbuild/vitest.
  constructor(
    @Inject(SupportService) private readonly support: SupportService,
    @Inject(RateLimitService) private readonly debit: RateLimitService,
  ) {}

  /* Bornés en débit tous les deux. Ce sont des chemins qui ÉCRIVENT du texte
     libre sans coût pour l'appelant : un client en boucle, ou quelqu'un qui
     s'énerve, remplirait la table qu'une personne doit lire. La limite est
     large — on ne cherche pas à rationner quelqu'un qui a un vrai problème et
     écrit trois fois de suite. */
  @Post("support-requests")
  async ecrire(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(createSupportRequestSchema)) body: CreateSupportRequestInput,
  ): Promise<SupportRequest> {
    await this.debit.hit(`support_request:${req.userId}`, 10, 60 * 60_000);
    return this.support.ecrire(req.userId, body);
  }

  // 204 : l'avis est déposé, il n'y a rien à en relire (voir SupportService).
  @Post("feedback")
  @HttpCode(204)
  async donnerSonAvis(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(createFeedbackSchema)) body: CreateFeedbackInput,
  ): Promise<void> {
    await this.debit.hit(`feedback:${req.userId}`, 10, 60 * 60_000);
    await this.support.donnerSonAvis(req.userId, body);
  }
}

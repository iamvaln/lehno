import { Body, Controller, Delete, Get, HttpCode, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { confirmDeletionSchema } from "@lehno/contracts";
import type {
  ConfirmDeletionInput, DeletionAccepted, DeletionPreview,
} from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { RateLimitService } from "../common/rate-limit.service.js";
import { AccountService } from "./account.service.js";

// Posé par AuthGuard : req.userId. Type minimal, pas de dépendance à
// @types/express (absent de ce paquet) — voir SecurityController.
type AuthedRequest = { userId: string };

/* La suppression du compte — spec mobile §3.24.
 *
 * Trois chemins pour trois temps, et non un seul DELETE. Apple exige que la
 * suppression soit possible DEPUIS l'application ; elle n'exige pas qu'elle
 * soit facile à déclencher par mégarde. L'aperçu ne change rien, le code
 * s'obtient à part, et la confirmation demande deux preuves.
 */
@Controller("me/account")
@UseGuards(AuthGuard)
export class AccountController {
  // @Inject explicite : voir ProfileController, même contrainte esbuild/vitest.
  constructor(
    @Inject(AccountService) private readonly account: AccountService,
    @Inject(RateLimitService) private readonly debit: RateLimitService,
  ) {}

  @Get("deletion-preview")
  apercu(@Req() req: AuthedRequest): Promise<DeletionPreview> {
    return this.account.apercu(req.userId);
  }

  /* La demande d'un code. Bornée en débit comme /auth/otp, et pour la même
     raison : c'est un envoi de courrier vers une boîte, et un point d'entrée
     qui envoie des courriers sans limite sert à arroser (spec technique
     §9.10). La clé porte l'identifiant du compte, pas l'adresse : ici
     l'adresse n'est pas fournie par l'appelant mais lue depuis sa session,
     donc c'est bien le compte qui est la ressource à protéger. */
  @Post("deletion-code")
  @HttpCode(202)
  async demanderCode(@Req() req: AuthedRequest): Promise<{ sent: true }> {
    await this.debit.hit(`account_deletion_code:${req.userId}`, 5, 60 * 60_000);
    await this.account.demanderCode(req.userId);
    // Le code ne descend JAMAIS dans la réponse : il part par e-mail, et
    // c'est tout l'intérêt du second facteur. Le rendre ici transformerait la
    // preuve d'accès à la boîte en simple formalité pour qui tient le jeton.
    return { sent: true };
  }

  @Delete()
  confirmer(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(confirmDeletionSchema)) body: ConfirmDeletionInput,
  ): Promise<DeletionAccepted> {
    return this.account.confirmer(req.userId, body);
  }
}

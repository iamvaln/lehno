import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import {
  registerPaymentMethodSchema,
  type PaymentMethod, type RegisterPaymentMethodInput,
} from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { MethodesService } from "./methodes.service.js";

type AuthedRequest = { userId: string };

/* Les méthodes de paiement enregistrées.
 *
 * PAS DE @Feature, et ce n'est pas un oubli. Le drapeau qui viendrait à l'esprit
 * est `topup.provider` — le canal automatique qui les débitera. Mais ces
 * méthodes servent aussi le REMBOURSEMENT promis à la suppression de compte,
 * qui n'a rien à voir avec le paiement automatique et doit fonctionner même
 * quand il est éteint.
 *
 * Les mettre sous ce drapeau rendrait donc la promesse des CGU intenable dans
 * la configuration même du lancement — où `topup.provider` est éteint. */
@Controller("me/payment-methods")
@UseGuards(AuthGuard)
export class MethodesController {
  constructor(@Inject(MethodesService) private readonly methodes: MethodesService) {}

  @Get()
  async lister(@Req() req: AuthedRequest): Promise<{ paymentMethods: PaymentMethod[] }> {
    return { paymentMethods: await this.methodes.lister(req.userId) };
  }

  @Post()
  enregistrer(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(registerPaymentMethodSchema)) corps: RegisterPaymentMethodInput,
  ): Promise<PaymentMethod> {
    return this.methodes.enregistrer(req.userId, corps);
  }

  @Delete(":id")
  @HttpCode(204)
  retirer(
    @Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.methodes.retirer(req.userId, id);
  }
}

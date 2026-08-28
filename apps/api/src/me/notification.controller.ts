import { Body, Controller, Get, HttpCode, Inject, Post, Query, Req, UseGuards } from "@nestjs/common";
import {
  listNotificationsQuerySchema, markNotificationsReadSchema,
  type MarkNotificationsReadInput, type NotificationsPage, type NotificationsReadResult,
} from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { AppError } from "../common/errors.js";
import { NotificationService } from "./notification.service.js";

type AuthedRequest = { userId: string };

// Pas de @Feature : les notifications relèvent du SOCLE, qui n'a pas de
// drapeau (spécification technique §6.3). Si le centre s'éteint, la cloche de
// l'en-tête reste allumée et ne mène nulle part.
@Controller("me/notifications")
@UseGuards(AuthGuard)
export class NotificationController {
  constructor(@Inject(NotificationService) private readonly notifications: NotificationService) {}

  // La chaîne de requête ne porte que du texte : `limit` arrive en « 20 », pas
  // en 20. On convertit AVANT de valider, sinon le schéma refuse une valeur
  // parfaitement légitime et le client reçoit un 400 incompréhensible.
  @Get()
  list(
    @Req() req: AuthedRequest,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
  ): Promise<NotificationsPage> {
    const analyse = listNotificationsQuerySchema.safeParse({
      ...(limit !== undefined ? { limit: Number(limit) } : {}),
      ...(cursor !== undefined ? { cursor } : {}),
    });
    if (!analyse.success) {
      throw new AppError("validation_failed", "invalid notifications query", {
        query: analyse.error.issues.map((i) => i.message).join(", "),
      });
    }
    return this.notifications.list(req.userId, analyse.data);
  }

  /* 200 et non 201 : marquer comme lu ne crée aucune ressource, il pose une
     date sur des lignes existantes. Un 201 ferait attendre un `Location` qui
     n'existe pas, et Nest le rendrait par défaut sur un POST. */
  @Post("read")
  @HttpCode(200)
  read(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(markNotificationsReadSchema)) body: MarkNotificationsReadInput,
  ): Promise<NotificationsReadResult> {
    return this.notifications.marquerLues(req.userId, body);
  }
}

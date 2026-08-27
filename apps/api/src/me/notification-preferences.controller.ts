import { Body, Controller, Get, Inject, Patch, Req, UseGuards } from "@nestjs/common";
import {
  updateNotificationPreferencesSchema,
  type NotificationPreferences, type UpdateNotificationPreferencesInput,
} from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { NotificationPreferencesService } from "./notification-preferences.service.js";

type AuthedRequest = { userId: string };

@Controller("me/notification-preferences")
@UseGuards(AuthGuard)
export class NotificationPreferencesController {
  // @Inject explicite : voir ProfileService, même contrainte esbuild/vitest.
  constructor(
    @Inject(NotificationPreferencesService) private readonly preferences: NotificationPreferencesService,
  ) {}

  @Get()
  get(@Req() req: AuthedRequest): Promise<NotificationPreferences> {
    return this.preferences.get(req.userId);
  }

  @Patch()
  update(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(updateNotificationPreferencesSchema)) body: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferences> {
    return this.preferences.update(req.userId, body);
  }
}

import { Body, Controller, Get, Inject, Patch, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { updateProfileSchema, usernameSchema, type Profile, type UpdateProfileInput } from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { ProfileService } from "./profile.service.js";

// Posé par AuthGuard (voir auth/auth.guard.ts) : req.userId. Type minimal,
// pas de dépendance à @types/express (absent de ce paquet).
type AuthedRequest = { userId: string };

const usernameQuerySchema = z.object({ username: usernameSchema }).strict();

@Controller("me/profile")
@UseGuards(AuthGuard)
export class ProfileController {
  // @Inject explicite : voir ProfileService, même contrainte esbuild/vitest.
  constructor(@Inject(ProfileService) private readonly profile: ProfileService) {}

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

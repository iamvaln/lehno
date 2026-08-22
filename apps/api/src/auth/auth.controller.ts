import { Body, Controller, Delete, HttpCode, Headers, Post, UseGuards } from "@nestjs/common";
import {
  refreshSchema,
  requestOtpSchema,
  verifyOtpSchema,
  type Session,
} from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthService } from "./auth.service.js";
import { TokenService } from "./token.service.js";
import { AuthGuard } from "./auth.guard.js";

type RequestOtpBody = { email: string };
type VerifyOtpBody = { email: string; code: string; deviceId?: string; referralCode?: string };
type RefreshBody = { refreshToken: string };

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  // Rend toujours { sent: true }, adresse connue ou non : voir AuthService.requestOtp.
  @Post("otp")
  @HttpCode(200)
  requestOtp(
    @Body(new ZodValidationPipe(requestOtpSchema)) body: RequestOtpBody,
  ): Promise<{ sent: true }> {
    return this.auth.requestOtp(body);
  }

  @Post("otp/verify")
  @HttpCode(200)
  verifyOtp(
    @Body(new ZodValidationPipe(verifyOtpSchema)) body: VerifyOtpBody,
    @Headers("user-agent") userAgent?: string,
  ): Promise<Session> {
    // referralCode : accepté par le contrat, câblé au crédit d'invitation dans une tâche à venir.
    return this.auth.verifyOtp({
      email: body.email,
      code: body.code,
      ...(body.deviceId !== undefined ? { deviceId: body.deviceId } : {}),
      ...(userAgent !== undefined ? { userAgent } : {}),
    });
  }

  @Post("refresh")
  @HttpCode(200)
  async refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: RefreshBody,
    @Headers("user-agent") userAgent?: string,
  ): Promise<Session> {
    const pair = await this.tokens.rotate(body.refreshToken, userAgent);
    // Un renouvellement ne crée jamais de compte : la forme reste celle d'une session.
    return { ...pair, isNewAccount: false };
  }

  @Delete("session")
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async logout(@Body(new ZodValidationPipe(refreshSchema)) body: RefreshBody): Promise<void> {
    await this.tokens.revokeFamily(body.refreshToken);
  }
}

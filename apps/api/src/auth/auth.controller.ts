import { Body, Controller, Delete, HttpCode, Headers, Inject, Ip, Post, UseGuards } from "@nestjs/common";
import {
  federatedSchema,
  refreshSchema,
  requestOtpSchema,
  verifyOtpSchema,
  type Session,
} from "@lehno/contracts";
import type { IdentityProvider } from "@prisma/client";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthService } from "./auth.service.js";
import { TokenService } from "./token.service.js";
import { FederatedService } from "./federated.service.js";
import { AuthGuard } from "./auth.guard.js";

type RequestOtpBody = { email: string };
type VerifyOtpBody = { email: string; code: string; deviceId?: string; referralCode?: string };
type RefreshBody = { refreshToken: string };
type FederatedBody = { provider: IdentityProvider; idToken: string; deviceId?: string };

@Controller("auth")
export class AuthController {
  // Voir AuthService : jeton explicite requis, esbuild n'émet pas design:paramtypes.
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject(FederatedService) private readonly federatedAuth: FederatedService,
  ) {}

  // Rend toujours { sent: true }, adresse connue ou non : voir AuthService.requestOtp.
  //
  // @Ip() lit req.ip d'Express, qui — tant que rien n'active "trust proxy" —
  // rend l'adresse de la connexion TCP elle-même, jamais un en-tête transmis
  // (X-Forwarded-For). C'est voulu : derrière un proxy inverse, se fier à un
  // tel en-tête sans l'avoir configuré laisserait n'importe qui forger son
  // origine et contourner le plafond par IP. Une fois en production derrière
  // Caddy, cette adresse deviendra celle du proxy plutôt que celle du client
  // réel — la tâche 21 configurera "trust proxy" (et Caddy) pour que req.ip
  // redevienne l'adresse d'origine.
  //
  // Cette IP ne sert qu'à composer la clé du limiteur (voir RateLimitService,
  // qui ne la laisse fuiter ni dans un journal ni dans une réponse) : elle
  // n'est ni journalisée ni renvoyée ici.
  @Post("otp")
  @HttpCode(200)
  requestOtp(
    @Body(new ZodValidationPipe(requestOtpSchema)) body: RequestOtpBody,
    @Ip() ip: string,
  ): Promise<{ sent: true }> {
    return this.auth.requestOtp({ ...body, ip });
  }

  // Voir le commentaire sur POST /otp plus haut : même capture, mêmes
  // précautions (adresse de connexion, jamais un en-tête ; jamais journalisée
  // ni renvoyée). Voir AuthService.verifyOtp pour le plafond qu'elle sert ici.
  @Post("otp/verify")
  @HttpCode(200)
  verifyOtp(
    @Body(new ZodValidationPipe(verifyOtpSchema)) body: VerifyOtpBody,
    @Ip() ip: string,
    @Headers("user-agent") userAgent?: string,
  ): Promise<Session> {
    // referralCode : accepté par le contrat, câblé au crédit d'invitation dans une tâche à venir.
    return this.auth.verifyOtp({
      email: body.email,
      code: body.code,
      ip,
      ...(body.deviceId !== undefined ? { deviceId: body.deviceId } : {}),
      ...(userAgent !== undefined ? { userAgent } : {}),
    });
  }

  @Post("federated")
  @HttpCode(200)
  federated(
    @Body(new ZodValidationPipe(federatedSchema)) body: FederatedBody,
    @Headers("user-agent") userAgent?: string,
  ): Promise<Session> {
    return this.federatedAuth.signIn({
      ...body,
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

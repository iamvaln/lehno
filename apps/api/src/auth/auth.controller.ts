import { Body, Controller, Delete, HttpCode, Headers, Inject, Ip, Post, UseGuards } from "@nestjs/common";
import {
  federatedSchema,
  refreshSchema,
  requestOtpSchema,
  verifyOtpSchema,
  type Session,
  registerSchema, type RegisterInput, type Registered, type VerifyOutcome,
} from "@lehno/contracts";
import type { IdentityProvider } from "@prisma/client";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthService } from "./auth.service.js";
import { TrackingService } from "../tracking/tracking.service.js";
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
    @Inject(TrackingService) private readonly mesure: TrackingService,
  ) {}

  // Rend toujours { sent: true }, adresse connue ou non : voir AuthService.requestOtp.
  //
  // @Ip() lit req.ip d'Express, dont la valeur dépend du réglage « trust
  // proxy » posé au démarrage (voir main.ts et common/trust-proxy.ts). Sans
  // relais déclaré, c'est l'adresse de la connexion TCP elle-même, jamais un
  // en-tête transmis : se fier à X-Forwarded-For sans l'avoir borné
  // laisserait n'importe qui forger son origine et se donner autant de
  // compteurs qu'il veut. En production, TRUST_PROXY_HOPS=1 déclare le seul
  // relais qu'on exploite, le Traefik du VPS — et cette valeur n'est sûre que
  // parce que l'API n'est joignable que par lui.
  //
  // Cette IP ne sert qu'à composer la clé du limiteur (voir RateLimitService,
  // qui ne la laisse fuiter ni dans un journal ni dans une réponse) : elle
  // n'est ni journalisée ni renvoyée ici.
  @Post("otp")
  @HttpCode(200)
  requestOtp(
    @Body(new ZodValidationPipe(requestOtpSchema)) body: RequestOtpBody,
    @Ip() ip: string,
  ): Promise<{ sent: true; retryAfterSeconds: number }> {
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
  ): Promise<VerifyOutcome> {
    return this.auth
      .verifyOtp({
        email: body.email,
        code: body.code,
        ip,
        ...(body.deviceId !== undefined ? { deviceId: body.deviceId } : {}),
        ...(body.referralCode !== undefined ? { referralCode: body.referralCode } : {}),
        ...(userAgent !== undefined ? { userAgent } : {}),
      })
      .then((issue) => {
        /* Seul signup.started part d'ici. Une inscription qui COMMENCE n'a pas
           encore de compte : `null` y est la vérité, pas un manque.
           signin.completed, lui, s'émet dans le service, où l'identifiant
           existe — VerifyOutcome ne le porte pas, et n'a pas à le porter. */
        if (issue.outcome !== "session") {
          this.mesure.emettre(null, "signup.started", { method: "code" });
        }
        return issue;
      });
  }

  // La création du compte. Le jeton d'inscription vient de /otp/verify ou de
  // /federated ; le pseudo et le code de parrainage viennent de l'écran du
  // pseudo. Tout se joue ici, en une transaction.
  @Post("register")
  @HttpCode(201)
  register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Headers("user-agent") userAgent?: string,
  ): Promise<Registered> {
    // signup.completed s'émet dans AuthService.register, où l'identifiant de
    // compte existe : voir la note là-bas.
    return this.auth.register({ ...body, ...(userAgent !== undefined ? { userAgent } : {}) });
  }

  @Post("federated")
  @HttpCode(200)
  federated(
    @Body(new ZodValidationPipe(federatedSchema)) body: FederatedBody,
    @Headers("user-agent") userAgent?: string,
  ): Promise<VerifyOutcome> {
    return this.federatedAuth
      .signIn({ ...body, ...(userAgent !== undefined ? { userAgent } : {}) })
      .then((issue) => {
        // Voir /auth/otp/verify : seul le début d'inscription part du contrôleur.
        if (issue.outcome !== "session") {
          this.mesure.emettre(null, "signup.started", { method: body.provider });
        }
        return issue;
      });
  }

  @Post("refresh")
  @HttpCode(200)
  async refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: RefreshBody,
    @Ip() ip: string,
    @Headers("user-agent") userAgent?: string,
  ): Promise<Session> {
    // L'adresse de CE tour, pas celle de l'ouverture : c'est la suite des
    // adresses d'une lignée qui montre qu'une copie circule ailleurs.
    const pair = await this.tokens.rotate(body.refreshToken, userAgent, ip);
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

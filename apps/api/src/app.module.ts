import type { MiddlewareConsumer, NestModule } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { CorrelationMiddleware } from "./common/correlation.middleware.js";
import { RateLimitService } from "./common/rate-limit.service.js";
import { PrismaService } from "./prisma/prisma.service.js";
import { AuthController } from "./auth/auth.controller.js";
import { AuthGuard } from "./auth/auth.guard.js";
import { AuthService } from "./auth/auth.service.js";
import { FederatedService } from "./auth/federated.service.js";
import { OtpService } from "./auth/otp.service.js";
import { TokenService } from "./auth/token.service.js";
import { AppleIdentityVerifier, GoogleIdentityVerifier } from "./auth/providers.js";
import { ConsoleMailAdapter, MailgunAdapter } from "./mail/mailgun.adapter.js";
import { ProfileController } from "./me/profile.controller.js";
import { ProfileService } from "./me/profile.service.js";
import { ConfigController, ConfigService } from "./public/config.controller.js";
import { LegalController, LegalService } from "./public/legal.controller.js";
import { WaitlistController } from "./public/waitlist.controller.js";
import { WaitlistService } from "./public/waitlist.service.js";

@Module({
  controllers: [AuthController, ProfileController, ConfigController, LegalController, WaitlistController],
  providers: [
    PrismaService,
    // useFactory : la valeur se lit à l'INSTANCIATION du provider, pas à
    // l'évaluation du décorateur (qui n'a lieu qu'une fois, au chargement du
    // module). Sans ça, une valeur d'environnement posée ou retirée après
    // l'import de ce fichier ne serait jamais revue. OtpService et
    // TokenService refusent de démarrer si leur secret est vide — c'est
    // voulu : mieux vaut ne pas démarrer que hacher ou signer sans clé.
    { provide: "OTP_PEPPER", useFactory: () => process.env.OTP_PEPPER },
    { provide: "JWT_SECRET", useFactory: () => process.env.JWT_SECRET },
    // Même logique pour les vérificateurs fédérés : construits à
    // l'instanciation, ils refusent de démarrer sans l'identifiant client
    // du fournisseur (voir GoogleIdentityVerifier / AppleIdentityVerifier).
    {
      provide: "IDENTITY_VERIFIERS",
      useFactory: () => ({
        google: new GoogleIdentityVerifier(process.env.GOOGLE_CLIENT_ID ?? ""),
        apple: new AppleIdentityVerifier(process.env.APPLE_CLIENT_ID ?? ""),
      }),
    },
    // Même logique : construit à l'instanciation, pas au chargement du
    // module. MailgunAdapter refuse de démarrer sans ses deux réglages ; sans
    // eux (poste de développement, sans compte Mailgun), on retombe sur la
    // console — personne n'a besoin d'un compte Mailgun pour travailler sur
    // le reste du produit.
    {
      provide: "MAIL_PORT",
      useFactory: () => {
        const apiKey = process.env.MAILGUN_API_KEY;
        const domain = process.env.MAILGUN_DOMAIN;
        return apiKey && domain ? new MailgunAdapter(apiKey, domain) : new ConsoleMailAdapter();
      },
    },
    OtpService,
    TokenService,
    RateLimitService,
    AuthService,
    FederatedService,
    AuthGuard,
    ProfileService,
    ConfigService,
    LegalService,
    WaitlistService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes("*");
  }
}

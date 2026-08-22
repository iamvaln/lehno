import type { MiddlewareConsumer, NestModule } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { CorrelationMiddleware } from "./common/correlation.middleware.js";
import { PrismaService } from "./prisma/prisma.service.js";
import { AuthController } from "./auth/auth.controller.js";
import { AuthGuard } from "./auth/auth.guard.js";
import { AuthService } from "./auth/auth.service.js";
import { OtpService } from "./auth/otp.service.js";
import { TokenService } from "./auth/token.service.js";

@Module({
  controllers: [AuthController],
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
    OtpService,
    TokenService,
    AuthService,
    AuthGuard,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes("*");
  }
}

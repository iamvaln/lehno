import type { MiddlewareConsumer, NestModule } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { CorrelationMiddleware } from "./common/correlation.middleware.js";
import { RateLimitService } from "./common/rate-limit.service.js";
import { PrismaService } from "./prisma/prisma.service.js";
import { AuthController } from "./auth/auth.controller.js";
import { AuthGuard } from "./auth/auth.guard.js";
import { SignupService } from "./onboarding/signup.service.js";
import {
  CreditsController, CreditsService, ReferralController, InvitationController,
} from "./onboarding/credits.controller.js";
import { FlagsService } from "./flags/flags.service.js";
import { FeatureGuard } from "./flags/feature.guard.js";
import { MeFeaturesController, PublicFeaturesController } from "./flags/features.controller.js";
import { AuthService } from "./auth/auth.service.js";
import { FederatedService } from "./auth/federated.service.js";
import { OtpService } from "./auth/otp.service.js";
import { TokenService } from "./auth/token.service.js";
import { AppleIdentityVerifier, GoogleIdentityVerifier } from "./auth/providers.js";
import { ConsoleMailAdapter } from "./mail/console.adapter.js";
import { ResendAdapter } from "./mail/resend.adapter.js";
import { ProfileController } from "./me/profile.controller.js";
import { ProfileService } from "./me/profile.service.js";
import { PersonController } from "./me/person.controller.js";
import { PersonService } from "./me/person.service.js";
import { EventController } from "./me/event.controller.js";
import { EventService } from "./me/event.service.js";
import { OccurrenceController } from "./me/occurrence.controller.js";
import { OccurrenceService } from "./me/occurrence.service.js";
import { NoteController, NotesController } from "./me/note.controller.js";
import { NoteService } from "./me/note.service.js";
import { HomeController } from "./me/home.controller.js";
import { HomeService } from "./me/home.service.js";
import { MetadataController } from "./me/metadata.controller.js";
import { MetadataService } from "./me/metadata.service.js";
import { TenantRepository } from "./tenancy/tenant.repository.js";
import { ConfigController, ConfigService } from "./public/config.controller.js";
import { LegalController, LegalService } from "./public/legal.controller.js";
import { WaitlistController } from "./public/waitlist.controller.js";
import { WaitlistService } from "./public/waitlist.service.js";
import { ContactController } from "./public/contact.controller.js";
import { ContactService } from "./public/contact.service.js";
import { AdminAuthController } from "./admin/admin-auth.controller.js";
import { AdminOtpService } from "./admin/admin-otp.service.js";
import { AdminTokenService } from "./admin/admin-token.service.js";
import { AdminGuard } from "./admin/admin.guard.js";
import { RoleGuard } from "./admin/role.guard.js";
import { AuditService } from "./admin/audit.service.js";
import { ParametersController, ParametersService } from "./admin/parameters.controller.js";
import { AdminFeatureFlagsController, AdminFeatureFlagsService } from "./admin/feature-flags.controller.js";
import { PaymentSettingsController, PaymentSettingsService } from "./admin/payment-settings.controller.js";
import { AdminPaymentsController, AdminCreditsController, AdminPaymentsService } from "./admin/payments.controller.js";
import { PaymentListsController, PaymentListsService } from "./admin/payment-lists.controller.js";
import { ExportsController, ExportsService } from "./admin/exports.controller.js";
import { QueuesController, QueuesService } from "./admin/queues.controller.js";
import { AdminUsersController, AdminUsersService } from "./admin/users.controller.js";
import { DeletionsController, DeletionsService } from "./admin/deletions.controller.js";
import { LecturesController, LecturesService } from "./admin/lectures.controller.js";
import { AdminsController, AdminsService } from "./admin/admins.controller.js";
import { AIModelsController, AIModelsService } from "./admin/ai-models.controller.js";
import { DashboardController, DashboardService } from "./admin/dashboard.controller.js";
import { StudioController, StudioService } from "./admin/studio.controller.js";
import { MaintenanceService } from "./maintenance/maintenance.service.js";
import { MaintenanceGuard } from "./maintenance/maintenance.guard.js";
import { MaintenanceController } from "./maintenance/maintenance.controller.js";

@Module({
  controllers: [
    AuthController, ProfileController, PersonController, EventController, OccurrenceController, NoteController, NotesController, HomeController, MetadataController, ConfigController, LegalController,
    MeFeaturesController, PublicFeaturesController, MaintenanceController,
    CreditsController, ReferralController, InvitationController,
    WaitlistController, ContactController,
    AdminAuthController, ParametersController, AdminFeatureFlagsController, PaymentSettingsController, AdminPaymentsController, AdminCreditsController, PaymentListsController, ExportsController, QueuesController, AdminUsersController, DeletionsController, LecturesController, AdminsController, AIModelsController, DashboardController, StudioController,
  ],
  providers: [
    PrismaService,
    // Garde GLOBAL, et le premier de tous : un arrêt pour intervention vaut
    // pour toute l'API, pas surface par surface. Posé ici plutôt que sur
    // chaque contrôleur — un contrôleur ajouté demain est couvert sans que
    // personne ait à y penser, et c'est exactement ce qu'on veut d'un
    // interrupteur d'arrêt. Ses exemptions vivent dans le garde.
    { provide: APP_GUARD, useClass: MaintenanceGuard },
    MaintenanceService,
    // useFactory : la valeur se lit à l'INSTANCIATION du provider, pas à
    // l'évaluation du décorateur (qui n'a lieu qu'une fois, au chargement du
    // module). Sans ça, une valeur d'environnement posée ou retirée après
    // l'import de ce fichier ne serait jamais revue. OtpService et
    // TokenService refusent de démarrer si leur secret est vide — c'est
    // voulu : mieux vaut ne pas démarrer que hacher ou signer sans clé.
    { provide: "OTP_PEPPER", useFactory: () => process.env.OTP_PEPPER },
    { provide: "JWT_SECRET", useFactory: () => process.env.JWT_SECRET },
    // Clé propre à l'administration : voir AdminTokenService. Deux mondes
    // séparés jusque dans leurs signatures, sans quoi la séparation des tables
    // ne serait qu'apparente.
    { provide: "ADMIN_JWT_SECRET", useFactory: () => process.env.ADMIN_JWT_SECRET },
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
    // Revue tour 2 (le repli "silencieux" sur la console) : même logique que
    // OTP_PEPPER/JWT_SECRET, construit à l'instanciation. Mais le repli sur
    // ConsoleMailAdapter n'est plus la valeur par défaut d'une configuration
    // absente — il faut l'adhésion EXPLICITE de LEHNO_MAIL_CONSOLE=1, sur le
    // modèle de l'ancienne LEHNO_LOG_OTP (tâche 12, retirée par la tâche 17)
    // : une variable absente ne doit jamais faire fuiter un code à usage
    // unique dans un journal, condition ou pas. Sans identifiants Resend NI
    // cette adhésion, le démarrage échoue avec un message qui dit quoi poser
    // — mieux vaut ne pas démarrer que d'envoyer (ou de journaliser) des
    // secrets par accident.
    {
      provide: "MAIL_PORT",
      useFactory: () => {
        const apiKey = process.env.RESEND_API_KEY;
        const from = process.env.RESEND_FROM;
        if (apiKey && from) return new ResendAdapter(apiKey, from);
        if (process.env.LEHNO_MAIL_CONSOLE === "1") return new ConsoleMailAdapter();
        throw new Error(
          "Aucun envoi de courrier configuré : posez RESEND_API_KEY et RESEND_FROM, " +
          "ou LEHNO_MAIL_CONSOLE=1 pour accepter explicitement la console de développement.",
        );
      },
    },
    // Adresse de destination du formulaire de contact. Ce n'est pas un secret
    // — juste l'adresse à laquelle écrire — donc un repli documenté plutôt
    // qu'un refus de démarrer : hello@lehno.app est déjà l'adresse publique
    // affichée ailleurs sur le site (voir apps/web/messages). Une variable
    // d'environnement, quand elle est posée, la remplace.
    { provide: "CONTACT_TO_EMAIL", useFactory: () => process.env.CONTACT_TO_EMAIL ?? "hello@lehno.app" },
    OtpService,
    TokenService,
    RateLimitService,
    AuthService,
    FederatedService,
    AuthGuard,
    SignupService,
    CreditsService,
    FlagsService,
    FeatureGuard,
    ProfileService,
    TenantRepository,
    EventService,
    OccurrenceService,
    PersonService,
    NoteService,
    HomeService,
    MetadataService,
    ConfigService,
    LegalService,
    WaitlistService,
    ContactService,
    AdminOtpService,
    AdminTokenService,
    AdminGuard,
    RoleGuard,
    AuditService,
    ParametersService,
    AdminFeatureFlagsService,
    PaymentSettingsService,
    AdminPaymentsService,
    PaymentListsService,
    ExportsService,
    QueuesService,
    AdminUsersService,
    DeletionsService,
    LecturesService,
    AdminsService,
    AIModelsService,
    DashboardService,
    StudioService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes("*");
  }
}

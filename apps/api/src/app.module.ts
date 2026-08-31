import type { MiddlewareConsumer, NestModule } from "@nestjs/common";
import { Logger, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
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
import { AttributsService } from "./me/attributs.service.js";
import { GenerationService } from "./me/generation.service.js";
import { GenerationController, MessagesController } from "./me/generation.controller.js";
import { RechargeService } from "./payments/recharge.service.js";
import { MethodesService } from "./payments/methodes.service.js";
import { MethodesController } from "./payments/methodes.controller.js";
import {
  CreditBundlesController, PaymentChannelsController,
  CollectionAccountsController, PaymentsController,
} from "./payments/recharge.controller.js";
import { CatalogueIAService } from "./ia/catalogue.service.js";
import { RouteurIAService } from "./ia/routeur.service.js";
import { construireAdaptateurs, FOURNISSEURS_IA } from "./ia/adaptateurs/index.js";
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
import { OccurrenceWishesController, WishController } from "./me/wish.controller.js";
import { WishService } from "./me/wish.service.js";
import {
  WishlistsController, OwnerWishController, MyReservationsController,
} from "./me/wishlist.controller.js";
import { WishlistService } from "./me/wishlist.service.js";
import {
  SharedWishlistController, ReserveWishController,
} from "./public/shared-wishlist.controller.js";
import { SharedWishlistService } from "./public/shared-wishlist.service.js";
import { HomeController } from "./me/home.controller.js";
import { HomeService } from "./me/home.service.js";
import { MetadataController } from "./me/metadata.controller.js";
import { MetadataService } from "./me/metadata.service.js";
import { NotificationPreferencesController } from "./me/notification-preferences.controller.js";
import { NotificationController } from "./me/notification.controller.js";
import { NotificationService } from "./me/notification.service.js";
import { NotificationPreferencesService } from "./me/notification-preferences.service.js";
import { SecurityController } from "./me/security.controller.js";
import { AccountController } from "./me/account.controller.js";
import { DeviceController } from "./me/device.controller.js";
import { DataExportController } from "./me/data-export.controller.js";
import { SupportController } from "./me/support.controller.js";
import { SecurityService } from "./me/security.service.js";
import { AccountService } from "./me/account.service.js";
import { DeviceService } from "./me/device.service.js";
import { DataExportService } from "./me/data-export.service.js";
import { SupportService } from "./me/support.service.js";
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
import { ReasonsController, ReasonsService } from "./admin/reasons.controller.js";
import { PaymentSettingsController, PaymentSettingsService } from "./admin/payment-settings.controller.js";
import { AdminPaymentsController, AdminCreditsController, AdminPaymentsService } from "./admin/payments.controller.js";
import { PaymentListsController, PaymentListsService } from "./admin/payment-lists.controller.js";
import { ExportsController, ExportsService } from "./admin/exports.controller.js";
import { QueuesController, QueuesService } from "./admin/queues.controller.js";
import { MeController, MeService } from "./admin/me.controller.js";
import { AdminUsersController, AdminUsersService } from "./admin/users.controller.js";
import { DeletionsController, DeletionsService } from "./admin/deletions.controller.js";
import { LecturesController, LecturesService } from "./admin/lectures.controller.js";
import { AdminsController, AdminsService } from "./admin/admins.controller.js";
import { AIModelsController, AIRoutesController, AIModelsService } from "./admin/ai-models.controller.js";
import { DashboardController, DashboardService } from "./admin/dashboard.controller.js";
import { AdminMaintenanceController, AdminMaintenanceService } from "./admin/maintenance.controller.js";
import { MetriquesController, MetriquesService } from "./admin/metriques.controller.js";
import { PaymentStatsController, PaymentStatsService } from "./admin/payment-stats.controller.js";
import { StudioController, StudioService } from "./admin/studio.controller.js";
import { PortraitStudioController, PortraitStudioService } from "./admin/portrait-studio.controller.js";
import { StudioOptionsController, StudioOptionsService } from "./me/studio.controller.js";
import { StudioConfigurationService } from "./studio/configuration.service.js";
import { StudioEssaiService } from "./studio/essai.service.js";
import { AmorceStudioService } from "./studio/amorce.service.js";
import { MaintenanceService } from "./maintenance/maintenance.service.js";
import { MaintenanceGuard } from "./maintenance/maintenance.guard.js";
import { MaintenanceController } from "./maintenance/maintenance.controller.js";
import { DeroulementService } from "./me/deroulement.service.js";
import { ProgrammationService } from "./me/programmation.service.js";
import { RelancesService } from "./me/relances.service.js";
import { EnvoiService } from "./me/envoi.service.js";
import { OrdonnanceurService } from "./me/ordonnanceur.service.js";
import {
  WallController, WishLinkController, CollectionLinksController,
  SubmissionsController, ReceivedWishesController,
} from "./mur/mur.controller.js";
import {
  PublicWallController, PublicCollectController, PublicWishesController,
} from "./mur/public-mur.controller.js";
import { MurService } from "./mur/mur.service.js";
import { CollecteService } from "./mur/collecte.service.js";
import { SubmissionService } from "./mur/submission.service.js";
import { VoeuxService } from "./mur/voeux.service.js";
import { SurfacePubliqueService } from "./mur/jetons.js";
import { EffacementService } from "./me/effacement.service.js";
import { StockageR2 } from "./stockage/r2.adapter.js";
import { StockageMemoire } from "./stockage/memoire.adapter.js";
import { PousseOneSignal } from "./notifications/onesignal.adapter.js";
import { PoussePourLaConsole } from "./notifications/console.adapter.js";
import { TrackingService } from "./tracking/tracking.service.js";
import { ConsoleTrackingAdapter } from "./tracking/console.adapter.js";
import { PostHogAdapter } from "./tracking/posthog.adapter.js";

@Module({
  /* Le déclencheur périodique de l'ordonnanceur. Il tourne DANS le processus
     plutôt que par un cron externe : le dépôt se déploie en un conteneur, et un
     déclencheur externe demanderait un chemin HTTP qu'il faudrait protéger —
     une porte de plus pour un besoin interne. Si le parc passe un jour à
     plusieurs instances, les clés uniques de la file rendent les passages
     concurrents inoffensifs. */
  imports: [ScheduleModule.forRoot()],
  controllers: [
    AuthController, ProfileController, PersonController, EventController, OccurrenceController, NoteController, NotesController, HomeController, MetadataController, NotificationPreferencesController, NotificationController, ConfigController, LegalController,
    SecurityController,
    AccountController, DeviceController, DataExportController, SupportController,
    OccurrenceWishesController, WishController,
    WishlistsController, OwnerWishController, MyReservationsController,
    SharedWishlistController, ReserveWishController,
    MeFeaturesController, PublicFeaturesController, MaintenanceController,
    CreditsController, ReferralController, InvitationController,
    WaitlistController, ContactController,
    WallController, WishLinkController, CollectionLinksController, SubmissionsController, ReceivedWishesController,
    PublicWallController, PublicCollectController, PublicWishesController,
    AdminAuthController, ParametersController, AdminFeatureFlagsController, ReasonsController, PaymentSettingsController, AdminPaymentsController, AdminCreditsController, PaymentListsController, ExportsController, QueuesController, AdminUsersController, DeletionsController, LecturesController, MethodesController, CreditBundlesController, PaymentChannelsController, CollectionAccountsController, PaymentsController, GenerationController, MessagesController, AdminsController, AIModelsController, AIRoutesController, DashboardController, MetriquesController, PaymentStatsController, AdminMaintenanceController, StudioController, PortraitStudioController, StudioOptionsController, MeController,
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
    DeroulementService,
    ProgrammationService,
    RelancesService,
    EnvoiService,
    OrdonnanceurService,
    /* Sa propre tâche, à sa propre heure : l'effacement ne rejoint pas les
       étapes de l'ordonnanceur. Il n'a rien à voir avec la file des rappels, il
       tourne plus tôt pour qu'un compte effacé ne reçoive pas le courrier du
       matin, et une nuit où il déborderait n'a aucune raison de retarder des
       envois qui, eux, ont une heure à tenir. */
    EffacementService,
    // La mesure, derrière son port (§16.5). Sans clé PostHog et sans adhésion
    // explicite à la console, l'adaptateur ne fait RIEN — contrairement au
    // courrier, l'absence de mesure n'est pas une raison de refuser de
    // démarrer : elle ne rend pas le produit faux, seulement aveugle. Et un
    // développement local ne doit pas exiger un compte chez un tiers.
    {
      provide: "TRACKING_PORT",
      useFactory: () => {
        const cle = process.env.POSTHOG_API_KEY;
        const hote = process.env.POSTHOG_HOST ?? "https://eu.i.posthog.com";
        if (cle) return new PostHogAdapter(cle, hote);
        if (process.env.LEHNO_TRACKING_CONSOLE === "1") return new ConsoleTrackingAdapter();
        return { capture: async (): Promise<void> => {} };
      },
    },
    TrackingService,
    {
      /* Le stockage des fichiers.
       *
       * R2 quand les quatre variables sont là, la mémoire sinon. Pas de repli
       * silencieux vers rien du tout, comme la mesure : un fichier qu'on croit
       * rangé et qui n'est nulle part se découvre le jour où on va le
       * chercher — et à ce moment-là il n'existe plus de moyen de le
       * retrouver. Mieux vaut une mémoire honnête, qui perd au redémarrage et
       * le dit par son nom, qu'un puits sans fond.
       *
       * Les QUATRE ensemble ou aucune : trois variables sur quatre donneraient
       * un client qui signe des URL vers un compartiment qui n'existe pas, et
       * l'erreur ne paraîtrait qu'au premier dépôt d'un utilisateur. */
      provide: "STOCKAGE_PORT",
      useFactory: () => {
        const compte = process.env.R2_ACCOUNT_ID;
        const cle = process.env.R2_ACCESS_KEY_ID;
        const secret = process.env.R2_SECRET_ACCESS_KEY;
        const seau = process.env.R2_BUCKET;
        if (compte && cle && secret && seau) return new StockageR2(compte, cle, secret, seau);
        return new StockageMemoire();
      },
    },
    {
      /* Les notifications poussées.
       *
       * OneSignal quand les deux variables sont là, la console sinon — et la
       * console ÉCRIT ce qui serait parti, elle ne se tait pas. Un port muet
       * donnerait un développement où tout paraît marcher et où l'on découvre
       * à la mise en service que rien n'était branché.
       *
       * Les deux ensemble ou aucune, comme pour R2 : un identifiant
       * d'application sans clé donnerait un client qui part en requête et se
       * fait refuser, et le refus ne paraîtrait qu'au premier rappel dû —
       * c'est-à-dire chez quelqu'un, un matin, sans que personne regarde. */
      provide: "PUSH_PORT",
      useFactory: () => {
        const app = process.env.ONESIGNAL_APP_ID;
        const cle = process.env.ONESIGNAL_API_KEY;
        if (app && cle) return new PousseOneSignal(app, cle);
        return new PoussePourLaConsole();
      },
    },
    // Le Mur et la collecte (§5.3, §5.5, §7).
    SurfacePubliqueService,
    MurService,
    CollecteService,
    SubmissionService,
    VoeuxService,
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
        /* L'ADHÉSION EXPLICITE PASSE AVANT, et l'ordre inverse rendait la
           variable INATTEIGNABLE : sur un poste de développement, Resend et
           `LEHNO_MAIL_CONSOLE=1` cohabitent toujours — l'un vient du fichier
           d'environnement partagé, l'autre est posé exprès pour développer. Le
           second ne servait donc jamais, et le parcours de connexion était
           impossible en local : Resend refuse d'écrire à un domaine non
           vérifié, le code ne partait nulle part, et rien ne disait pourquoi.

           La garde que l'ordre précédent défendait tient toujours : on ne
           TOMBE pas sur la console faute de configuration — il faut poser la
           variable à « 1 », ce qui ne s'écrit pas par accident. Et le
           démarrage l'annonce, pour qu'un environnement où elle traîne se
           remarque au lieu de journaliser des codes en silence. */
        if (process.env.LEHNO_MAIL_CONSOLE === "1") {
          new Logger("MAIL_PORT").warn(
            "LEHNO_MAIL_CONSOLE=1 : les courriels ne partent pas, leur contenu " +
            "s'écrit sur cette console — codes à usage unique compris.",
          );
          return new ConsoleMailAdapter();
        }
        if (apiKey && from) return new ResendAdapter(apiKey, from);
        throw new Error(
          "Aucun envoi de courrier configuré : posez RESEND_API_KEY et RESEND_FROM, " +
          "ou LEHNO_MAIL_CONSOLE=1 pour accepter explicitement la console de développement.",
        );
      },
    },
    // Adresse de destination du formulaire de contact. Ce n'est pas un secret
    // — juste l'adresse à laquelle écrire — donc un repli documenté plutôt
    // qu'un refus de démarrer : hello@lehno.io est déjà l'adresse publique
    // affichée ailleurs sur le site (voir apps/web/messages). Une variable
    // d'environnement, quand elle est posée, la remplace.
    { provide: "CONTACT_TO_EMAIL", useFactory: () => process.env.CONTACT_TO_EMAIL ?? "hello@lehno.io" },
    /* L'adresse du site public, celle où vivent les Murs, les formulaires de
       collecte et les liens de partage.
       Ce n'est pas un secret — le domaine s'affiche sur chaque lien — donc un
       repli documenté plutôt qu'un refus de démarrer, comme CONTACT_TO_EMAIL.
       Elle vit au SERVEUR et non au client : deux versions du parc
       fabriqueraient deux adresses différentes pour la même liste, et celle
       qu'un utilisateur a collée dans un groupe cesserait de marcher au
       changement de domaine.
       Sans barre oblique finale : les chemins la posent eux-mêmes, et
       « https://lehno.io//valentine » n'est pas la même adresse. */
    {
      provide: "PUBLIC_WEB_URL",
      useFactory: () => (process.env.PUBLIC_WEB_URL ?? "https://lehno.io").replace(/\/+$/, ""),
    },
    OtpService,
    TokenService,
    RateLimitService,
    AuthService,
    FederatedService,
    AuthGuard,
    SignupService,
    CreditsService,
    FlagsService,
    AttributsService,
    GenerationService,
    RechargeService,
    MethodesService,
    CatalogueIAService,
    RouteurIAService,
    // Construits une fois, au démarrage : les instancier à chaque génération
    // relirait l'environnement à chaque appel, et un fournisseur retiré à chaud
    // disparaîtrait sans qu'aucun journal ne le dise.
    { provide: FOURNISSEURS_IA, useFactory: () => construireAdaptateurs() },
    FeatureGuard,
    ProfileService,
    TenantRepository,
    EventService,
    OccurrenceService,
    PersonService,
    NoteService,
    WishService,
    WishlistService,
    SharedWishlistService,
    HomeService,
    MetadataService,
    NotificationPreferencesService,
    NotificationService,
    SecurityService,
    AccountService,
    DeviceService,
    DataExportService,
    SupportService,
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
    AdminFeatureFlagsService, ReasonsService,
    PaymentSettingsService,
    AdminPaymentsService,
    PaymentListsService,
    ExportsService,
    QueuesService,
    MeService,
    AdminUsersService,
    DeletionsService,
    LecturesService,
    AdminsService,
    AIModelsService,
    DashboardService,
    MetriquesService,
    PaymentStatsService,
    AdminMaintenanceService,
    StudioService,
    // Le Studio du portrait. `StudioConfigurationService` est partagé entre la
    // surface d'administration et `/me/studio/options` : deux exemplaires
    // calculeraient l'empreinte chacun de leur côté, et la règle de
    // publication cesserait d'être la même des deux côtés du mur.
    StudioConfigurationService,
    StudioEssaiService,
    AmorceStudioService,
    PortraitStudioService,
    StudioOptionsService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationMiddleware).forRoutes("*");
  }
}

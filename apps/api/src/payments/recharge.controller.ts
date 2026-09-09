import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import {
  declarePaymentSchema, paymentPreviewInputSchema, demandeDeDepotRecuSchema,
  type CreditBundle, type DeclarePaymentInput, type PaymentDetail,
  type PaymentPreview, type PaymentPreviewInput,
  type DemandeDeDepotRecu, type DepotRecu, type UrlMedia,
} from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { Feature } from "../flags/feature.decorator.js";
import { FeatureGuard } from "../flags/feature.guard.js";
import { RechargeService } from "./recharge.service.js";
import { RecuService } from "./recu.service.js";

type AuthedRequest = { userId: string };

/* Les paliers n'ont AUCUN drapeau, et ce n'est pas un oubli.
 *
 * Ils disent ce que valent les crédits ; la façon de payer est une autre
 * question, et c'est elle qui s'ouvre et se ferme. Les mettre sous le drapeau
 * d'un canal cacherait l'offre le jour où l'on bascule sur l'autre, alors que
 * rien n'aurait changé pour l'utilisateur.
 *
 * Et il n'y a plus de drapeau sur les crédits eux-mêmes : les actions payantes
 * en consomment toujours (§6.4). Ce qui reste réglable l'est par un
 * paramètre — le prix du crédit —, pas par un interrupteur. */
@Controller("me/credit-bundles")
@UseGuards(AuthGuard)
export class CreditBundlesController {
  constructor(@Inject(RechargeService) private readonly recharge: RechargeService) {}

  @Get()
  async lister(): Promise<{ bundles: CreditBundle[] }> {
    return { bundles: await this.recharge.paliers() };
  }
}

/* Tout ce qui suit relève du versement manuel.
 *
 * FeatureGuard AVANT AuthGuard : une surface éteinte l'est pour tout le monde,
 * y compris pour un jeton invalide. Dans l'autre ordre, le statut distinguerait
 * « éteinte » de « non authentifiée » — et raconterait quelque chose. */
@Controller("me/payment-channels")
@UseGuards(FeatureGuard, AuthGuard)
@Feature("topup.manual")
export class PaymentChannelsController {
  constructor(@Inject(RechargeService) private readonly recharge: RechargeService) {}

  @Get()
  async lister() {
    return { channels: await this.recharge.canaux() };
  }
}

@Controller("me/collection-accounts")
@UseGuards(FeatureGuard, AuthGuard)
@Feature("topup.manual")
export class CollectionAccountsController {
  constructor(@Inject(RechargeService) private readonly recharge: RechargeService) {}

  @Get()
  async lister() {
    return { accounts: await this.recharge.comptesDeCollecte() };
  }
}

@Controller("me/payments")
@UseGuards(FeatureGuard, AuthGuard)
@Feature("topup.manual")
export class PaymentsController {
  constructor(
    @Inject(RechargeService) private readonly recharge: RechargeService,
    @Inject(RecuService) private readonly recus: RecuService,
  ) {}

  /* `200`, pas `201` : l'aperçu ne crée rien. C'est un POST parce qu'il porte
     des paramètres, pas parce qu'il écrit — et un `201` ferait croire à
     l'inverse à un client qui lit les statuts. */
  @Post("preview")
  @HttpCode(200)
  apercu(
    @Body(new ZodValidationPipe(paymentPreviewInputSchema)) corps: PaymentPreviewInput,
  ): Promise<PaymentPreview> {
    return this.recharge.apercu(corps);
  }

  @Post()
  declarer(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(declarePaymentSchema)) corps: DeclarePaymentInput,
  ): Promise<PaymentDetail> {
    return this.recharge.declarer(req.userId, corps);
  }

  @Get()
  async lister(@Req() req: AuthedRequest): Promise<{ payments: PaymentDetail[] }> {
    return { payments: await this.recharge.lister(req.userId) };
  }

  @Get(":id")
  lire(
    @Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string,
  ): Promise<PaymentDetail> {
    return this.recharge.lire(req.userId, id);
  }

  /* LE REÇU SE JOINT APRÈS LA DÉCLARATION, sur le paiement créé.
   *
   * Pas pendant : quand quelqu'un déclare, il a DÉJÀ versé son argent. Exiger
   * le fichier à cet instant le laisserait coincé, argent parti, si son dépôt
   * échoue. La référence de transaction reste obligatoire, elle ; le reçu la
   * complète quand elle a été mal recopiée ou que le montant ne tombe pas
   * juste.
   *
   * Le chemin du dépôt : le serveur signe une URL, le téléphone dépose dessus,
   * puis confirme. Les octets ne traversent jamais l'API — un relevé de deux
   * mégaoctets occuperait une connexion pour rien.
   *
   * 200 et non 201 : rien n'est créé ici, on délivre une permission. */
  @Post(":id/proof/depot")
  @HttpCode(200)
  depotRecu(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(demandeDeDepotRecuSchema)) corps: DemandeDeDepotRecu,
  ): Promise<DepotRecu> {
    return this.recus.depot(req.userId, id, corps.contentType);
  }

  /* Aucun corps, et l'identifiant du chemin ne CHOISIT pas la cible : elle a été
     fixée au dépôt, où l'appartenance a été vérifiée. L'accepter du client
     permettrait de rattacher son reçu au paiement d'un autre. Il sert à refuser
     tôt une confirmation qui ne vise pas ce paiement-là. */
  @Post(":id/proof")
  @HttpCode(204)
  async confirmerRecu(
    @Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.recus.confirmer(req.userId, id);
  }

  /* Relire SON propre reçu. L'écran de suivi le montre — sans quoi la personne
     ne saurait pas ce qu'elle a envoyé, ni si elle doit le refaire. */
  @Get(":id/proof")
  urlDuRecu(
    @Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string,
  ): Promise<UrlMedia> {
    return this.recus.urlDe(id, { userId: req.userId });
  }
}

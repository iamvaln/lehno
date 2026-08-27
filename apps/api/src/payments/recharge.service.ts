import { Inject, Injectable } from "@nestjs/common";
import type {
  CollectionAccount, CreditBundle, DeclarePaymentInput,
  PaymentChannel, PaymentDetail, PaymentPreview, PaymentPreviewInput,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { fraisDe, type Bareme } from "./frais.js";

/* La recharge par palier, voie semi-manuelle.
 *
 * Le client choisit un palier, voit sur quel compte verser et combien, verse
 * depuis son application d'opérateur, PUIS vient déclarer son versement. L'ordre
 * n'est pas celui d'un paiement automatique : le paiement naît `pending`, et
 * c'est l'administration qui constate la réception. */
@Injectable()
export class RechargeService {
  // @Inject explicite : esbuild/vitest n'émet pas design:paramtypes.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async paliers(): Promise<CreditBundle[]> {
    const lignes = await this.prisma.creditBundle.findMany({
      where: { isActive: true },
      orderBy: { position: "asc" },
    });
    return lignes.map((b) => ({
      id: b.id,
      amount: Number(b.amount),
      currency: b.currency,
      credits: b.credits,
      bonusPercent: b.bonusPercent,
      position: b.position,
    }));
  }

  async canaux(): Promise<PaymentChannel[]> {
    const lignes = await this.prisma.paymentChannel.findMany({
      where: { isActive: true },
      orderBy: [{ position: "asc" }, { operator: "asc" }],
    });
    return lignes.map((c) => ({
      id: c.id, kind: c.kind, operator: c.operator, country: c.country,
      label: c.label, feeBorneBy: c.feeBorneBy, currency: c.currency,
    }));
  }

  /* Visible ET actif. Les deux ne disent pas la même chose : le premier décide
     de ce que le client voit, le second de ce qui reste employable. Un compte
     peut être actif pour l'administration et absent de l'application — pour le
     retirer en douceur, sans casser les paiements en cours qui le référencent. */
  async comptesDeCollecte(): Promise<CollectionAccount[]> {
    const lignes = await this.prisma.collectionAccount.findMany({
      where: { isActive: true, isVisibleInApp: true },
      orderBy: [{ position: "asc" }, { label: "asc" }],
    });
    return lignes.map((c) => ({
      id: c.id, label: c.label, operator: c.operator, number: c.number,
    }));
  }

  /* Le palier et le canal, relus EN BASE.
   *
   * Rien de ce que le client envoie ne sert au calcul : il donne deux
   * identifiants, le serveur compose le reste. Accepter un montant du corps de
   * la requête ferait acheter mille crédits pour un franc à qui sait modifier
   * une requête — et rien dans la suite du parcours ne le rattraperait. */
  private async lireOffre(bundleId: string, channelId: string) {
    const [palier, canal] = await Promise.all([
      this.prisma.creditBundle.findUnique({ where: { id: bundleId } }),
      this.prisma.paymentChannel.findUnique({ where: { id: channelId } }),
    ]);
    if (!palier || !canal) throw new AppError("not_found", "unknown bundle or channel");

    /* `resource_inactive`, pas `validation_failed` : la requête est bien
       formée, c'est l'offre qui ne l'est plus. L'écran peut alors dire « ce
       palier n'est plus proposé » au lieu de « la demande est mal formée ». */
    if (!palier.isActive) throw new AppError("resource_inactive", "this bundle is no longer offered");
    if (!canal.isActive) throw new AppError("resource_inactive", "this channel is no longer available");

    /* Un palier en francs et un canal en euros ne se combinent pas : le total à
       verser n'aurait aucun sens. Le cas n'existe pas aujourd'hui — tout est en
       XAF — et c'est précisément pourquoi il faut le fermer maintenant, tant
       qu'il ne coûte rien. */
    if (palier.currency !== canal.currency)
      throw new AppError("validation_failed", "bundle and channel use different currencies");

    return { palier, canal };
  }

  private bareme(canal: { feePercent: unknown; feeFixed: unknown; feeMin: unknown; feeMax: unknown; feeBorneBy: string }): Bareme {
    return {
      feePercent: Number(canal.feePercent),
      feeFixed: Number(canal.feeFixed),
      feeMin: canal.feeMin === null ? null : Number(canal.feeMin),
      feeMax: canal.feeMax === null ? null : Number(canal.feeMax),
      feeBorneBy: canal.feeBorneBy as "payer" | "payee",
    };
  }

  async apercu(entree: PaymentPreviewInput): Promise<PaymentPreview> {
    const { palier, canal } = await this.lireOffre(entree.bundleId, entree.channelId);
    const f = fraisDe(this.bareme(canal), Number(palier.amount));
    return {
      amount: Number(palier.amount),
      fee: f.frais,
      amountToSend: f.aVerser,
      expectedOnAccount: f.attenduSurLeCompte,
      currency: palier.currency,
      credits: palier.credits,
      bonusPercent: palier.bonusPercent,
    };
  }

  async declarer(userId: string, entree: DeclarePaymentInput): Promise<PaymentDetail> {
    const { palier, canal } = await this.lireOffre(entree.bundleId, entree.channelId);

    /* Le compte doit être visible ET actif au moment de la déclaration, pas
       seulement quand l'écran s'est ouvert. Un client qui laisse son écran
       ouvert une heure verserait sinon sur un compte qu'on vient de retirer —
       et l'argent partirait vers un numéro que plus personne ne surveille. */
    const compte = await this.prisma.collectionAccount.findUnique({
      where: { id: entree.collectionAccountId },
    });
    if (!compte) throw new AppError("not_found", "unknown collection account");
    if (!compte.isActive || !compte.isVisibleInApp)
      throw new AppError("resource_inactive", "this collection account is no longer available");

    const f = fraisDe(this.bareme(canal), Number(palier.amount));

    const ligne = await this.prisma.payment.create({
      data: {
        userId,
        mode: "semi_manual",
        // Tout vient de la base, rien du corps de la requête.
        creditBundleId: palier.id,
        amount: palier.amount,
        currency: palier.currency,
        credits: palier.credits,
        paymentChannelId: canal.id,
        collectionAccountId: compte.id,
        payerMsisdn: entree.payerMsisdn,
        ...(entree.providerRef === undefined ? {} : { providerRef: entree.providerRef }),
        /* Les frais ANNONCÉS, figés ici. Un barème change ; ce paiement garde ce
           qui lui a été dit. Relire le taux du jour pour expliquer un paiement
           d'il y a trois mois donnerait un chiffre faux, et c'est en litige
           qu'on va le lire. */
        feeAmount: f.frais,
        expectedAmount: f.attenduSurLeCompte,
        status: "pending",
      },
      include: { collectionAccount: true },
    });

    return this.rendre(ligne);
  }

  async lister(userId: string): Promise<PaymentDetail[]> {
    const lignes = await this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { collectionAccount: true },
    });
    return lignes.map((l) => this.rendre(l));
  }

  /* Le paiement d'un autre N'EXISTE PAS pour le demandeur : 404, jamais 403 —
     un 403 confirmerait qu'il existe, et l'identifiant se devine. */
  async lire(userId: string, id: string): Promise<PaymentDetail> {
    const ligne = await this.prisma.payment.findFirst({
      where: { id, userId },
      include: { collectionAccount: true },
    });
    if (!ligne) throw new AppError("not_found", "unknown payment");
    return this.rendre(ligne);
  }

  private rendre(l: {
    id: string; status: string; mode: string; amount: unknown; currency: string;
    credits: number; feeAmount: unknown; expectedAmount: unknown;
    failureReason: string | null; createdAt: Date;
    collectionAccount: { id: string; label: string; operator: string; number: string } | null;
  }): PaymentDetail {
    return {
      id: l.id,
      status: l.status as PaymentDetail["status"],
      mode: l.mode as PaymentDetail["mode"],
      amount: Number(l.amount),
      currency: l.currency,
      credits: l.credits,
      fee: l.feeAmount === null ? null : Number(l.feeAmount),
      expectedOnAccount: l.expectedAmount === null ? null : Number(l.expectedAmount),
      failureReason: l.failureReason,
      collectionAccount: l.collectionAccount === null ? null : {
        id: l.collectionAccount.id,
        label: l.collectionAccount.label,
        operator: l.collectionAccount.operator,
        number: l.collectionAccount.number,
      },
      createdAt: l.createdAt.toISOString(),
    };
  }
}

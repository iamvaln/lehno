import { Body, Controller, Inject, Injectable, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { saisiePaiementSchema } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AdminGuard } from "./admin.guard.js";
import { Role, RoleGuard } from "./role.guard.js";
import { AuditService } from "./audit.service.js";
import { fraisDe } from "../payments/frais.js";

/**
 * La saisie manuelle d'un paiement — voie `manual`.
 *
 * Un administrateur enregistre un versement qu'il a constaté : le client, le
 * palier, le compte qui a reçu, la référence, le reçu. Le paiement naît
 * `pending`. La spécification dit qu'il « se confirme du même geste » : c'est
 * l'écran qui enchaîne les deux appels, pas le serveur qui les fond. Séparer
 * garde **une seule porte de décision** — celle qui exige le montant réellement
 * constaté et journalise son motif.
 */
@Injectable()
export class AdminPaymentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly journal: AuditService,
  ) {}

  async saisir(auteurId: string, entree: z.infer<typeof saisiePaiementSchema>) {
    const [client, palier, compte, canal] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: entree.utilisateurId }, select: { id: true } }),
      this.prisma.creditBundle.findUnique({ where: { id: entree.palierId } }),
      this.prisma.collectionAccount.findUnique({ where: { id: entree.compteCollecteId } }),
      this.prisma.paymentChannel.findUnique({ where: { id: entree.canalId } }),
    ]);

    if (!client) throw new AppError("not_found", "unknown user");
    if (!palier) throw new AppError("not_found", "unknown credit bundle");
    if (!compte) throw new AppError("not_found", "unknown collection account");
    if (!canal) throw new AppError("not_found", "unknown payment channel");

    // Un palier retiré ne se vend plus, et un compte fermé ne reçoit plus.
    // Enregistrer dessus reviendrait à constater un versement sur une offre ou
    // un compte qui n'existent plus pour personne d'autre.
    if (!palier.isActive) throw new AppError("resource_inactive", "credit bundle is not active");
    if (!compte.isActive) throw new AppError("resource_inactive", "collection account is not active");
    if (!canal.isActive) throw new AppError("resource_inactive", "payment channel is not active");

    // Le montant et les crédits viennent du PALIER, jamais de la requête : « on
    // achète un palier, jamais un montant libre ». Les recopier depuis ce qu'on
    // reçoit laisserait un administrateur créditer ce qu'il veut.
    const montant = Number(palier.amount);
    const bareme = {
      feePercent: Number(canal.feePercent),
      feeFixed: Number(canal.feeFixed),
      feeMin: canal.feeMin === null ? null : Number(canal.feeMin),
      feeMax: canal.feeMax === null ? null : Number(canal.feeMax),
      feeBorneBy: canal.feeBorneBy,
    };
    // Figés ici, et jamais relus depuis le canal : le barème change, et un
    // paiement passé garde ce qui lui a été annoncé. Lire le taux du jour pour
    // expliquer un paiement d'il y a trois mois donnerait un chiffre faux, sans
    // que personne s'en aperçoive.
    const calcul = fraisDe(bareme, montant);

    return this.prisma.$transaction(async (tx) => {
      const paiement = await tx.payment.create({
        data: {
          userId: client.id,
          mode: "manual",
          creditBundleId: palier.id,
          collectionAccountId: compte.id,
          paymentChannelId: canal.id,
          amount: montant,
          currency: palier.currency,
          credits: palier.credits,
          feeAmount: calcul.frais,
          expectedAmount: calcul.attenduSurLeCompte,
          status: "pending",
          ...(entree.numeroPayeur !== undefined ? { payerMsisdn: entree.numeroPayeur } : {}),
          ...(entree.reference !== undefined ? { providerRef: entree.reference } : {}),
          ...(entree.recu !== undefined ? { proofKey: entree.recu } : {}),
        },
      });

      // L'état courant s'ouvre et ne se ferme pas : c'est la décision qui le
      // fermera. La base n'en tolère qu'un seul ouvert par paiement.
      await tx.paymentStatusHistory.create({
        data: {
          paymentId: paiement.id,
          status: "pending",
          origin: "admin",
          changedByAdminId: auteurId,
          reason: entree.reason,
        },
      });

      await this.journal.consigner({
        auteurId,
        action: "payment_manual_create",
        motif: entree.reason,
        cibleType: "payment",
        cibleId: paiement.id,
        details: {
          userId: client.id,
          bundle: palier.credits,
          amount: montant,
          expected: calcul.attenduSurLeCompte,
        },
      }, tx);

      return {
        id: paiement.id,
        etat: paiement.status,
        montant,
        frais: calcul.frais,
        attenduSurLeCompte: calcul.attenduSurLeCompte,
        credits: palier.credits,
        devise: palier.currency,
      };
    });
  }
}

// Saisir un paiement fait entrer de l'argent dans le registre : c'est un levier
// de la famille Économie, fermée au support (ux-admin §6).
@Controller("admin/payments")
@UseGuards(AdminGuard, RoleGuard)
@Role("admin")
export class AdminPaymentsController {
  constructor(@Inject(AdminPaymentsService) private readonly service: AdminPaymentsService) {}

  @Post()
  saisir(
    @Body(new ZodValidationPipe(saisiePaiementSchema)) corps: z.infer<typeof saisiePaiementSchema>,
    @Req() requete: { admin?: { id: string } },
  ) {
    return this.service.saisir(requete.admin?.id ?? "", corps);
  }
}

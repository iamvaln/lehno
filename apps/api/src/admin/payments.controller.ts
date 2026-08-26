import { Body, Controller, HttpCode, Inject, Injectable, Param, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { ajustementCreditsSchema, decisionPaiementSchema, saisiePaiementSchema } from "@lehno/contracts";
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

  /**
   * Confirmer ou rejeter un paiement en attente.
   *
   * Trois écritures qui tiennent ensemble ou pas du tout : l'état du paiement,
   * son histoire, et — à la confirmation — l'octroi des crédits. Une
   * transaction les enveloppe, et un refus à n'importe quel bout défait le
   * reste.
   *
   * **L'octroi une seule fois ne tient pas à une vérification.** Deux
   * confirmations concurrentes liraient toutes deux « aucun octroi » avant que
   * l'une n'écrive, et le compte serait crédité deux fois. C'est l'index unique
   * sur `credit_transaction.payment_id` qui tranche : le perdant échoue à
   * l'écriture, sa transaction est défaite, et on lui rend un conflit.
   */
  async decider(auteurId: string, id: string, entree: z.infer<typeof decisionPaiementSchema>) {
    const paiement = await this.prisma.payment.findUnique({ where: { id } });
    if (!paiement) throw new AppError("not_found", "unknown payment");
    // Un paiement tranché ne se retranche pas : son histoire est définitive, et
    // le rouvrir laisserait deux vérités sur le même versement.
    if (paiement.status !== "pending") throw new AppError("conflict", "payment is already settled");

    const confirme = entree.decision === "confirmer";
    const attendu = paiement.expectedAmount === null ? null : Number(paiement.expectedAmount);
    const recu = entree.montantRecu ?? null;
    // L'écart : reçu moins attendu. Négatif quand il manque. Nul — et non zéro —
    // quand on n'a pas regardé, ce qui ne peut arriver qu'au rejet.
    const ecart = recu === null || attendu === null ? null : recu - attendu;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // L'état courant se ferme, le nouveau s'ouvre. La base n'en tolère
        // qu'un seul ouvert : c'est ce qui rend la durée de chacun lisible.
        await tx.paymentStatusHistory.updateMany({
          where: { paymentId: id, endedAt: null },
          data: { endedAt: new Date() },
        });

        const etat = confirme ? "succeeded" as const : "failed" as const;
        await tx.payment.update({
          where: { id },
          data: {
            status: etat,
            ...(recu !== null ? { receivedAmount: recu } : {}),
            ...(confirme ? { providerRef: entree.reference } : { failureReason: entree.reason }),
            // Le reçu s'efface une fois la demande traitée : une photo de
            // justificatif n'a aucune raison de rester une fois qu'elle a
            // servi, et elle ne prouvait rien de toute façon.
            proofKey: null,
          },
        });

        await tx.paymentStatusHistory.create({
          data: {
            paymentId: id, status: etat, origin: "admin",
            changedByAdminId: auteurId, reason: entree.reason,
          },
        });

        let creditsOctroyes = 0;
        if (confirme) {
          await tx.creditTransaction.create({
            data: {
              userId: paiement.userId,
              type: "purchase",
              source: "purchase",
              amount: paiement.credits,
              paymentId: id,
            },
          });
          creditsOctroyes = paiement.credits;

          // Le premier paiement réussi d'une méthode renseigne sa date, et
          // c'est elle qui décide de son éligibilité à un remboursement.
          if (paiement.paymentMethodId) {
            await tx.paymentMethod.updateMany({
              where: { id: paiement.paymentMethodId, firstSuccessfulPaymentAt: null },
              data: { firstSuccessfulPaymentAt: new Date() },
            });
          }
        }

        await this.journal.consigner({
          auteurId,
          action: "payment_decision",
          motif: entree.reason,
          cibleType: "payment",
          cibleId: id,
          details: { decision: entree.decision, expected: attendu, received: recu, gap: ecart },
        }, tx);

        return { id, etat, creditsOctroyes, ecart };
      });
    } catch (echec) {
      // Le perdant de la course : l'index unique a refusé son octroi, et sa
      // transaction entière est défaite. Le paiement reste celui qu'a écrit le
      // gagnant, et on rend un conflit plutôt qu'une erreur interne.
      if (estCollisionUnique(echec)) throw new AppError("conflict", "payment already settled concurrently");
      throw echec;
    }
  }

  /**
   * Ajuster à la main le solde d'un compte.
   *
   * Le montant est **signé** : positif pour créditer, négatif pour reprendre.
   * Un champ « sens » séparé se désynchroniserait du signe au premier oubli, et
   * le mouvement écrit ne dirait plus ce qu'on a voulu faire.
   *
   * Le motif se garde **sur le mouvement** autant qu'au journal. Le journal
   * porte la vue transverse des gestes d'administration ; la note sur le
   * mouvement explique cette ligne-là, à qui lit l'historique d'un compte sans
   * ouvrir le journal.
   */
  async ajuster(auteurId: string, utilisateurId: string, entree: z.infer<typeof ajustementCreditsSchema>) {
    const client = await this.prisma.user.findUnique({
      where: { id: utilisateurId }, select: { id: true },
    });
    if (!client) throw new AppError("not_found", "unknown user");

    return this.prisma.$transaction(async (tx) => {
      // Verrou consultatif sur le compte, comme pour le plafond d'appareil.
      //
      // Lire le solde dans la transaction ne suffit pas : sous READ COMMITTED,
      // deux reprises concurrentes le liraient toutes deux suffisant avant
      // qu'aucune n'écrive, et le compte finirait négatif. Aucune contrainte de
      // base ne peut l'empêcher — « la somme des mouvements reste positive »
      // n'est pas exprimable en CHECK.
      await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${utilisateurId}))`;

      // Le solde est la somme des mouvements : aucune colonne ne le stocke,
      // donc aucune ne peut se désynchroniser.
      const somme = await tx.creditTransaction.aggregate({
        where: { userId: utilisateurId }, _sum: { amount: true },
      });
      const avant = somme._sum.amount ?? 0;
      const apres = avant + entree.montant;

      // Un solde négatif signifierait qu'une action payante s'est lancée sans
      // provision : c'est un défaut du serveur, pas un état à écrire.
      if (apres < 0) throw new AppError("insufficient_credits", "adjustment would leave a negative balance");

      await tx.creditTransaction.create({
        data: {
          userId: utilisateurId,
          type: "adjustment",
          // Ce que le client lira. Le choisir plutôt que le deviner est tout
          // l'intérêt de la scission : un dédommagement, une récompense et une
          // erreur réparée ne s'annoncent pas de la même façon.
          source: entree.nature,
          amount: entree.montant,
          reason: entree.reason,
        },
      });

      await this.journal.consigner({
        auteurId,
        action: "credit_adjustment",
        motif: entree.reason,
        cibleType: "user",
        cibleId: utilisateurId,
        details: { amount: entree.montant, nature: entree.nature, from: avant, to: apres },
      }, tx);

      return { utilisateurId, montant: entree.montant, solde: apres };
    });
  }
}

/** P2002 : violation d'une contrainte d'unicité. */
function estCollisionUnique(echec: unknown): boolean {
  return typeof echec === "object" && echec !== null && "code" in echec
    && (echec as { code?: unknown }).code === "P2002";
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

  // 200, pas 201 : une décision ne crée aucune ressource, elle change un état
  // (contrat commun §1). Le 201 apprendrait un identifiant qui existait déjà.
  @Post(":id/decision")
  @HttpCode(200)
  decider(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(decisionPaiementSchema)) corps: z.infer<typeof decisionPaiementSchema>,
    @Req() requete: { admin?: { id: string } },
  ) {
    return this.service.decider(requete.admin?.id ?? "", id, corps);
  }
}

/**
 * L'ajustement d'un solde vit sous le compte qu'il touche, pas sous les
 * paiements : c'est un geste sur un compte, et c'est là qu'on le cherche.
 *
 * « Ajuster manuellement un solde de crédits » figure parmi ce que le support
 * ne fait pas (ux-admin §6).
 */
@Controller("admin/users")
@UseGuards(AdminGuard, RoleGuard)
@Role("admin")
export class AdminCreditsController {
  constructor(@Inject(AdminPaymentsService) private readonly service: AdminPaymentsService) {}

  @Post(":id/credits")
  @HttpCode(200)
  ajuster(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(ajustementCreditsSchema)) corps: z.infer<typeof ajustementCreditsSchema>,
    @Req() requete: { admin?: { id: string } },
  ) {
    return this.service.ajuster(requete.admin?.id ?? "", id, corps);
  }
}

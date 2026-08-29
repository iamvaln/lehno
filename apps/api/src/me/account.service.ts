import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  ConfirmDeletionInput, DeletionAccepted, DeletionPreview,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { OtpService } from "../auth/otp.service.js";
import { TokenService } from "../auth/token.service.js";
import { AppError } from "../common/errors.js";
import {
  DELAI_METHODE_DEFAUT_JOURS, creditsRemboursables, methodeEligibleAuRemboursement,
  montantDuRemboursement, soldeTotal,
} from "../payments/remboursement.js";

const JOUR_MS = 24 * 60 * 60_000;
const GRACE_DEFAUT = 30;

/* La suppression du compte — spec mobile §3.24, CGU §6.
 *
 * Trois temps, et l'ordre n'est pas décoratif : on montre ce qui disparaît,
 * puis ce qu'on doit de l'argent, puis on demande deux preuves. Un bouton
 * unique effacerait des comptes par accident, et un remboursement proposé
 * après confirmation arriverait trop tard pour être un choix.
 *
 * Ce que ce service ne fait PAS, et c'est délibéré : il n'efface rien. La
 * confirmation DÉSACTIVE le compte et arme une échéance. L'effacement
 * définitif appartient au travail périodique (spec technique §15.4), au terme
 * du délai de grâce. Effacer ici rendrait la promesse de réversibilité
 * mensongère à la milliseconde où elle est faite.
 */
@Injectable()
export class AccountService {
  // @Inject explicite : voir SecurityService — sous vitest/esbuild,
  // design:paramtypes n'est pas émis et un paramètre typé sans jeton se
  // résoudrait à `undefined` chez Nest.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OtpService) private readonly otp: OtpService,
    @Inject(TokenService) private readonly tokens: TokenService,
    @Inject("CONTACT_TO_EMAIL") private readonly supportEmail: string,
  ) {}

  // Le même motif que partout ailleurs dans ce dépôt (voir signup.service.ts,
  // relances.service.ts) : le paramètre se relit à chaque appel, jamais en
  // cache. Un plafond mis en cache continuerait d'appliquer l'ancienne valeur
  // après un changement en back-office, et personne ne saurait pourquoi.
  private async param(cle: string, defaut: number): Promise<number> {
    const ligne = await this.prisma.systemParameter.findUnique({ where: { key: cle } });
    const valeur = Number(ligne?.value);
    return Number.isFinite(valeur) && valeur > 0 ? valeur : defaut;
  }

  /* L'échéance se CALCULE, elle ne se stocke pas — même raisonnement que
     DeletionsService côté administration : figer la date à l'écriture la
     rendrait fausse dès que le paramètre change, et c'est précisément un
     paramètre qu'on règle depuis le back-office. */
  private echeance(demandeeLe: Date, delaiJours: number): Date {
    return new Date(demandeeLe.getTime() + delaiJours * JOUR_MS);
  }

  private async compteActif(userId: string): Promise<{ id: string; email: string; username: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, status: true },
    });
    // Un jeton valide dont le compte n'existe plus : 401, pas 404. La
    // ressource n'est pas « introuvable », c'est la session qui ne vaut plus.
    if (!user) throw new AppError("unauthorized", "no account for this token");
    if (user.status === "pending_deletion")
      throw new AppError("account_pending_deletion", "account is already being deleted");
    if (user.status === "suspended")
      throw new AppError("account_suspended", "account is suspended");
    return { id: user.id, email: user.email, username: user.username };
  }

  /* PREMIER ET DEUXIÈME TEMPS : ce qui disparaît, et ce qu'on doit.
   *
   * Aucune écriture. On doit pouvoir ouvrir cet écran, le lire, et repartir
   * sans avoir rien engagé — y compris sans avoir déclenché l'envoi d'un code.
   */
  async apercu(userId: string): Promise<DeletionPreview> {
    // Appelé pour son REFUS, pas pour sa valeur : un compte déjà en
    // suppression ou suspendu n'a pas d'aperçu à consulter.
    await this.compteActif(userId);

    const [persons, notes, events, wishes, generatedMessages] = await Promise.all([
      this.prisma.person.count({ where: { userId } }),
      // Les notes se comptent par le PROCHE, pas par l'auteur : une note
      // déposée par un proche via un lien de collecte appartient au carnet et
      // disparaîtra avec lui, même si `authorUserId` désigne quelqu'un
      // d'autre. Compter par l'auteur en oublierait une partie, et l'écran
      // annoncerait une perte plus petite que la vraie.
      this.prisma.note.count({ where: { person: { userId } } }),
      this.prisma.event.count({ where: { person: { userId } } }),
      this.prisma.wishlistItem.count({ where: { occurrence: { userId } } }),
      this.prisma.generatedMessage.count({ where: { userId } }),
    ]);

    return {
      impact: { persons, notes, events, wishes, generatedMessages },
      refund: await this.remboursement(userId),
      gracePeriodDays: await this.param("account_grace_period_days", GRACE_DEFAUT),
      supportEmail: this.supportEmail,
    };
  }

  /* Le solde, sa part remboursable, et les méthodes qui peuvent la recevoir.
     Les règles elles-mêmes vivent dans payments/remboursement.ts — elles
     portent une clause publique, et elles serviront aussi à
     /me/payment-methods, dont le contrat déclare déjà `refundEligible`. */
  private async remboursement(userId: string): Promise<DeletionPreview["refund"]> {
    const [mouvements, paiements, methodes, delaiMethode] = await Promise.all([
      this.prisma.creditTransaction.findMany({
        where: { userId }, select: { source: true, amount: true },
      }),
      // Seuls les paiements RÉUSSIS et SORTANTS d'argent disent le prix payé.
      // Un paiement en attente n'a rien coûté ; un remboursement déjà versé
      // fausserait la moyenne dans l'autre sens.
      this.prisma.payment.findMany({
        where: { userId, status: "succeeded", direction: "charge" },
        select: { amount: true, credits: true, currency: true },
      }),
      this.prisma.paymentMethod.findMany({
        where: { userId },
        orderBy: { lastUsedAt: "desc" },
      }),
      this.param("refund_method_min_age_days", DELAI_METHODE_DEFAUT_JOURS),
    ]);

    const remboursables = creditsRemboursables(mouvements);
    const maintenant = new Date();
    const eligibles = methodes.filter((m) =>
      methodeEligibleAuRemboursement(m, maintenant, delaiMethode),
    );
    const argent = montantDuRemboursement(
      remboursables,
      paiements.map((p) => ({ amount: Number(p.amount), credits: p.credits, currency: p.currency })),
    );

    return {
      balance: soldeTotal(mouvements),
      refundable: remboursables,
      currency: argent?.currency ?? null,
      amount: argent?.amount ?? null,
      eligibleMethods: eligibles.map((m) => ({
        id: m.id,
        kind: m.kind,
        brand: m.brand,
        last4: m.last4,
        expiresAt: m.expiresAt ? m.expiresAt.toISOString().slice(0, 10) : null,
        lastUsedAt: m.lastUsedAt ? m.lastUsedAt.toISOString() : null,
        // Toujours vrai ici : cette liste EST celle des méthodes éligibles.
        // Le champ reste rendu parce que le schéma est partagé avec
        // /me/payment-methods, qui rend toutes les méthodes et distingue.
        refundEligible: true,
      })),
    };
  }

  /* TROISIÈME TEMPS, première moitié : le code par e-mail.
   *
   * Chemin séparé de la confirmation, parce que l'utilisateur doit pouvoir en
   * redemander un sans repasser par tout l'écran. La limitation de débit qui
   * protège /auth/otp vaut ici aussi : c'est le même envoi vers la même
   * boîte. Elle est posée au contrôleur, comme pour les autres chemins qui
   * écrivent à une adresse.
   */
  async demanderCode(userId: string): Promise<{ expiresAt: Date; code: string }> {
    const user = await this.compteActif(userId);
    const { code, expiresAt } = await this.otp.issue(user.email, "account_deletion");
    return { code, expiresAt };
  }

  /* TROISIÈME TEMPS, seconde moitié : la confirmation.
   *
   * Les deux preuves se vérifient dans cet ordre — pseudo, puis code — et
   * l'ordre compte. Vérifier le code d'abord le brûlerait sur une faute de
   * frappe dans le pseudo, obligeant à en redemander un pour une erreur qui
   * n'avait rien à voir avec la boîte mail.
   */
  async confirmer(userId: string, entree: ConfirmDeletionInput): Promise<DeletionAccepted> {
    const user = await this.compteActif(userId);

    /* Comparaison EXACTE du pseudo. Pas de tolérance à la casse : ce geste
       doit être délibéré, et recopier son pseudo tel qu'il s'affiche est
       précisément l'effort qu'on demande. `validation_failed` plutôt qu'un
       code dédié — l'écran sait quel champ il vient d'envoyer, et un code
       propre au pseudo apprendrait à un appelant tiers lequel des deux
       facteurs il a raté. */
    if (entree.username !== user.username)
      throw new AppError("validation_failed", "username does not match this account");

    // Lève otp_invalid / otp_expired / otp_too_many_attempts. On ne les
    // rattrape pas : ces codes disent déjà exactement ce qui s'est passé, et
    // les fondre dans un message générique priverait l'écran de sa réponse.
    await this.otp.verify(user.email, "account_deletion", entree.code);

    const delai = await this.param("account_grace_period_days", GRACE_DEFAUT);
    const demandeeLe = new Date();

    /* Tout en une transaction : le changement d'état, le motif, et la demande
       de remboursement. Séparés, une panne au milieu laisserait un compte
       désactivé sans la demande de remboursement qui allait avec — et
       personne ne saurait qu'elle a été promise, le compte n'étant plus
       joignable pour le redemander. */
    const refundRequested = await this.prisma.$transaction(async (tx) => {
      /* Écriture CONDITIONNELLE sur le statut. Deux confirmations concurrentes
         liraient toutes deux `active` avant qu'aucune n'écrive ; celle qui
         perd trouve count === 0 et s'arrête, plutôt que d'écraser la date de
         demande de la première — ce qui rallongerait le délai de grâce à
         chaque appel rejoué, et repousserait l'effacement indéfiniment. */
      const { count } = await tx.user.updateMany({
        where: { id: userId, status: "active" },
        data: {
          status: "pending_deletion",
          deletionRequestedAt: demandeeLe,
          deletionReason: this.motif(entree),
        },
      });
      if (count === 0)
        throw new AppError("account_pending_deletion", "account is already being deleted");

      return this.enregistrerRemboursement(tx, userId, entree.refundPaymentMethodId);
    });

    /* Les sessions tombent APRÈS la transaction, et hors d'elle.
       §3.24 : « plus de connexion possible ». Les révoquer dans la
       transaction ferait tenir un verrou sur toutes les lignées du compte
       pendant l'écriture ; les révoquer avant laisserait un compte déconnecté
       mais toujours actif si la transaction échouait. */
    await this.tokens.revokeAllForUser(userId);

    return {
      requestedAt: demandeeLe.toISOString(),
      erasesAt: this.echeance(demandeeLe, delai).toISOString(),
      supportEmail: this.supportEmail,
      refundRequested,
    };
  }

  /* Le motif, tel qu'on le relira. Les deux moitiés — le choix et le texte
     libre — tiennent dans une seule colonne parce que rien ne les exploite
     séparément aujourd'hui, et qu'une colonne de plus se justifie le jour où
     un tableau de bord compte les motifs. Le préfixe garde le choix
     reconnaissable pour ce jour-là. */
  private motif(entree: ConfirmDeletionInput): string | null {
    const parts: string[] = [];
    if (entree.reason) parts.push(entree.reason);
    if (entree.reasonDetails) parts.push(entree.reasonDetails);
    return parts.length > 0 ? parts.join(" — ") : null;
  }

  /* La demande de remboursement, enregistrée comme un PAIEMENT SORTANT en
   * attente.
   *
   * Pourquoi un `Payment` et pas une colonne sur le compte : c'est un
   * mouvement d'argent, il porte un montant, une devise, une destination et un
   * état, et le back-office sait déjà lister et décider des paiements en
   * attente. Une colonne `deletionRefundPaymentMethodId` sur `User` aurait
   * demandé qu'on écrive à côté tout ce que `Payment` porte déjà, et la
   * demande n'aurait paru sur aucun écran.
   *
   * Les crédits ne sont PAS débités ici. Le débit accompagne l'argent qui
   * part, pas la promesse qu'il partira : si la suppression est annulée
   * pendant le délai de grâce, un compte rétabli doit retrouver son solde
   * intact. Le mouvement `refund` s'écrira quand le versement sera constaté.
   */
  private async enregistrerRemboursement(
    tx: Prisma.TransactionClient,
    userId: string,
    methodeId: string | undefined,
  ): Promise<boolean> {
    if (!methodeId) return false;

    /* La méthode doit appartenir au compte ET être éligible, revérifié ICI.
       L'aperçu a beau les avoir filtrées, il date d'avant : entre les deux
       écrans, la méthode a pu être retirée. Et surtout, rien n'oblige un
       appelant à être passé par l'aperçu — une éligibilité vérifiée au seul
       écran précédent ne serait pas une règle, seulement une suggestion. */
    const methode = await tx.paymentMethod.findFirst({ where: { id: methodeId, userId } });
    // 404 et non 403 : une méthode qui n'est pas la sienne ne doit pas voir
    // son existence confirmée (spec technique §9.3).
    if (!methode) throw new AppError("not_found", "no such payment method");

    const ligne = await tx.systemParameter.findUnique({ where: { key: "refund_method_min_age_days" } });
    const delai = Number(ligne?.value);
    if (!methodeEligibleAuRemboursement(
      methode, new Date(), Number.isFinite(delai) && delai > 0 ? delai : DELAI_METHODE_DEFAUT_JOURS,
    ))
      throw new AppError("resource_inactive", "this payment method cannot receive a refund yet");

    const mouvements = await tx.creditTransaction.findMany({
      where: { userId }, select: { source: true, amount: true },
    });
    const credits = creditsRemboursables(mouvements);
    if (credits <= 0) return false;

    const paiements = await tx.payment.findMany({
      where: { userId, status: "succeeded", direction: "charge" },
      select: { amount: true, credits: true, currency: true },
    });
    const argent = montantDuRemboursement(
      credits,
      paiements.map((p) => ({ amount: Number(p.amount), credits: p.credits, currency: p.currency })),
    );
    // Sans montant annonçable — plusieurs devises, ou aucun achat retrouvé —
    // on n'écrit pas un paiement dont personne ne saurait quoi verser. §3.24
    // prévoit ce cas : l'assistance prend le relais.
    if (!argent) return false;

    await tx.payment.create({
      data: {
        userId,
        paymentMethodId: methode.id,
        direction: "refund",
        // `manual` : aucun prestataire n'exécute ce versement aujourd'hui, un
        // administrateur le fera. Le déclarer `provider` ferait attendre une
        // notification qui ne viendrait jamais.
        mode: "manual",
        status: "pending",
        amount: argent.amount,
        currency: argent.currency,
        credits,
        failureReason: null,
      },
    });
    return true;
  }
}

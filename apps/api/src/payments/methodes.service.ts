import { Inject, Injectable } from "@nestjs/common";
import type { PaymentMethod, RegisterPaymentMethodInput } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";

/* Les méthodes de paiement enregistrées.
 *
 * Elles servent DEUX choses, et la seconde est celle qui presse : le canal
 * automatique les débitera un jour, et le remboursement promis à la suppression
 * de compte en a besoin dès maintenant. Sans une seule méthode éligible, la
 * promesse des CGU ne peut pas se tenir — on ne sait pas où rendre l'argent. */

/* Les deux conditions des CGU §6, mot pour mot : « la méthode retenue doit
 * avoir été enregistrée DEPUIS PLUS DE DEUX SEMAINES et avoir DÉJÀ SERVI à un
 * paiement sur le Service ».
 *
 * Elles protègent d'un vol de session : quelqu'un qui prendrait un compte ne
 * pourrait pas y ajouter son propre numéro et vider le solde dans la foulée. Le
 * délai laisse le temps au titulaire de s'apercevoir de quelque chose, et
 * l'usage préalable prouve que la méthode est bien la sienne. */
const DELAI_AVANT_REMBOURSEMENT_MS = 14 * 24 * 60 * 60 * 1000;

const PLAFOND = 10;

type LigneMethode = {
  id: string; kind: string; brand: string | null; last4: string | null;
  expiresAt: Date | null; lastUsedAt: Date | null; createdAt: Date;
};

@Injectable()
export class MethodesService {
  // @Inject explicite : esbuild/vitest n'émet pas design:paramtypes.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async lister(userId: string): Promise<PaymentMethod[]> {
    const lignes = await this.prisma.paymentMethod.findMany({
      where: { userId },
      /* La plus récemment employée en tête : c'est celle que l'achat propose
         par défaut (§5.6). Les jamais employées suivent, par ordre d'ajout —
         `nulls last` explicite, sans quoi Postgres les place en premier et
         l'écran ouvrirait sur une méthode que personne n'a jamais utilisée. */
      orderBy: [{ lastUsedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    });

    /* Un paiement réussi par méthode, en UNE requête plutôt qu'une par ligne.
       « A déjà servi » veut dire réussi : un paiement en attente ou rejeté ne
       prouve rien — c'est justement celui qu'un voleur de session laisserait
       derrière lui. */
    const servies = await this.prisma.payment.groupBy({
      by: ["paymentMethodId"],
      where: { userId, status: "succeeded", paymentMethodId: { not: null } },
      _count: { _all: true },
    });
    const aServi = new Set(servies.map((s) => s.paymentMethodId));

    return lignes.map((l) => this.rendre(l, aServi.has(l.id)));
  }

  async enregistrer(userId: string, entree: RegisterPaymentMethodInput): Promise<PaymentMethod> {
    /* Un plafond, parce qu'une liste sans borne est une liste qu'on ne relit
       plus — et c'est dans une liste qu'on ne relit plus qu'un numéro étranger
       passe inaperçu. */
    const combien = await this.prisma.paymentMethod.count({ where: { userId } });
    if (combien >= PLAFOND)
      throw new AppError("validation_failed", "too many registered payment methods");

    /* L'opérateur vient du CANAL, jamais de la requête.
     *
     * Le canal est actif ou il n'est pas : enregistrer un numéro sur un
     * opérateur qu'on ne sert plus donnerait une méthode que rien ne pourrait
     * employer — ni pour payer, ni pour rembourser. */
    const canal = entree.channelId === undefined
      ? null
      : await this.prisma.paymentChannel.findFirst({
        where: { id: entree.channelId, isActive: true },
        select: { operator: true },
      });
    if (entree.channelId !== undefined && canal === null)
      throw new AppError("not_found", "no such payment channel");

    /* UN SEUL NUMÉRO PAR OPÉRATEUR, et changer de numéro est le geste ordinaire
       — pas ajouter. Refuser sèchement obligerait à supprimer puis
       ré-enregistrer sans dire pourquoi.
       
       L'ancienne ligne part, la neuve arrive : le DÉLAI DE DEUX SEMAINES avant
       qu'elle puisse recevoir un remboursement repart donc de zéro. C'est
       voulu — hériter de l'ancienneté d'un numéro qu'on vient de changer
       viderait la garde anti-fraude de son sens. L'écran doit l'annoncer AVANT
       le remplacement, pas le laisser découvrir après. */
    if (canal !== null) {
      /* SAUF SI UN REMBOURSEMENT ATTEND DESSUS.
       *
       * `payment.payment_method_id` est en `SetNull` : supprimer la méthode
       * viderait la destination du versement sans bruit, et l'argent n'aurait
       * plus où aller. On refuse plutôt que de déplacer le remboursement vers
       * le nouveau numéro — changer où part l'argent de quelqu'un ne se fait
       * pas en silence, à l'occasion d'un autre geste. */
      const attend = await this.prisma.payment.count({
        where: {
          userId, direction: "refund", status: "pending",
          paymentMethod: { operator: canal.operator },
        },
      });
      if (attend > 0)
        throw new AppError("conflict", "a refund is pending on this operator's number");

      await this.prisma.paymentMethod.deleteMany({
        where: { userId, operator: canal.operator },
      });
    }

    const ligne = await this.prisma.paymentMethod.create({
      data: {
        userId,
        kind: entree.kind,
        ...(canal === null ? {} : { operator: canal.operator }),
        ...(entree.brand === undefined ? {} : { brand: entree.brand }),
        /* Le numéro entier ne ressort JAMAIS — `paymentMethodSchema` est
           `strict` et ne le porte pas, donc un service qui le laisserait fuir
           ferait échouer le parsage plutôt que de l'envoyer jusqu'à un journal.
           Seuls les quatre derniers chiffres paraissent. */
        ...(entree.msisdn === undefined ? {} : {
          msisdn: entree.msisdn,
          last4: entree.msisdn.replace(/\D/g, "").slice(-4),
        }),
        ...(entree.providerRef === undefined ? {} : { providerRef: entree.providerRef }),
      },
    });

    /* Neuve, donc jamais éligible : les deux conditions échouent toutes les
       deux. On le calcule quand même plutôt que d'écrire `false` — le jour où
       le délai devient réglable, il n'y aura qu'un endroit à changer. */
    return this.rendre(ligne, false);
  }

  /* Retirer une méthode.
   *
   * La ligne est SUPPRIMÉE, pas désactivée — contrairement à un compte de
   * collecte, qu'un paiement passé référence et qui doit donc survivre. Ici
   * c'est l'inverse : `payment.payment_method_id` est en `SetNull`, donc
   * l'historique garde le paiement et perd seulement le moyen. C'est ce que
   * demande la §10 — une donnée personnelle qu'on retire s'en va. */
  async retirer(userId: string, id: string): Promise<void> {
    // Celle d'un autre N'EXISTE PAS pour le demandeur : 404, jamais 403 — un
    // 403 confirmerait qu'elle existe, et l'identifiant se devine.
    const ligne = await this.prisma.paymentMethod.findFirst({
      where: { id, userId }, select: { id: true },
    });
    if (!ligne) throw new AppError("not_found", "unknown payment method");
    await this.prisma.paymentMethod.delete({ where: { id } });
  }

  private rendre(l: LigneMethode, aServi: boolean): PaymentMethod {
    /* Les DEUX conditions, et l'ordre du « et » n'a pas d'importance ici — mais
       le fait qu'elles soient deux, si. Une seule des deux laisserait passer
       exactement le cas qu'elles visent : un numéro ajouté à l'instant sur un
       compte volé, ou un ancien numéro que le titulaire n'a jamais employé. */
    const assezAncienne = Date.now() - l.createdAt.getTime() > DELAI_AVANT_REMBOURSEMENT_MS;

    return {
      id: l.id,
      kind: l.kind as PaymentMethod["kind"],
      brand: l.brand,
      last4: l.last4,
      expiresAt: l.expiresAt === null ? null : l.expiresAt.toISOString().slice(0, 10),
      lastUsedAt: l.lastUsedAt === null ? null : l.lastUsedAt.toISOString(),
      /* Le serveur rend son verdict ; le client ne le recalcule pas. C'est écrit
         dans le contrat, et c'est ce qui permet de rendre la règle réglable un
         jour sans livrer une version de l'application. */
      refundEligible: assezAncienne && aServi,
    };
  }
}

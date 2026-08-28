import { Controller, Get, Inject, Injectable, Param, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AdminGuard } from "./admin.guard.js";
import { RoleGuard } from "./role.guard.js";

/**
 * Les deux vues du §5.4 : les paiements, et les mouvements de crédits.
 *
 * **Ouvertes au support.** « Consulter les paiements et les mouvements de
 * crédits » lui appartient (ux-admin §6) : c'est ce dont il a besoin pour
 * répondre à quelqu'un qui demande où en est son achat. Ce qui lui reste fermé,
 * c'est de décider — confirmer, rejeter, ajuster.
 */

const LIMITE_DEFAUT = 25;
const LIMITE_MAX = 200;

const requetePaiements = z.object({
  limit: z.coerce.number().int().min(1).max(LIMITE_MAX).optional(),
  cursor: z.string().uuid().optional(),
  etat: z.enum(["pending", "succeeded", "failed", "expired", "refunded"]).optional(),
  mode: z.enum(["provider", "semi_manual", "manual"]).optional(),
  utilisateurId: z.string().uuid().optional(),
}).strict();

const requeteMouvements = z.object({
  limit: z.coerce.number().int().min(1).max(LIMITE_MAX).optional(),
  cursor: z.string().uuid().optional(),
  type: z.enum(["grant", "purchase", "consumption", "adjustment"]).optional(),
  utilisateurId: z.string().uuid().optional(),
}).strict();

/**
 * Une méthode, telle qu'elle a le droit de paraître : opérateur et derniers
 * chiffres, jamais le numéro.
 *
 * Le numéro d'un compte mobile money est chiffré au repos, déchiffré pour la
 * seule communication avec le prestataire, et masqué partout à l'affichage —
 * **y compris pour l'administrateur**. Cette fonction est le seul endroit qui
 * compose ce libellé : ailleurs, le champ ne sort pas de la base.
 */
export function methodeLisible(m: { brand: string | null; last4: string | null } | null): string | null {
  if (!m) return null;
  const marque = m.brand ?? "";
  return m.last4 ? `${marque} ••••${m.last4}`.trim() : marque || null;
}

@Injectable()
export class PaymentListsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async paiements(requete: z.infer<typeof requetePaiements>) {
    const limite = requete.limit ?? LIMITE_DEFAUT;
    const lignes = await this.prisma.payment.findMany({
      where: {
        ...(requete.etat ? { status: requete.etat } : {}),
        ...(requete.mode ? { mode: requete.mode } : {}),
        ...(requete.utilisateurId ? { userId: requete.utilisateurId } : {}),
      },
      // Le plus récent d'abord ; l'identifiant départage deux paiements de la
      // même milliseconde, sans quoi le curseur sauterait une ligne ou la
      // rendrait deux fois.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limite + 1,
      ...(requete.cursor ? { cursor: { id: requete.cursor }, skip: 1 } : {}),
      include: {
        user: { select: { username: true } },
        paymentMethod: { select: { brand: true, last4: true } },
      },
    });

    const page = lignes.slice(0, limite);
    return {
      items: page.map((p) => this.ligne(p)),
      nextCursor: lignes.length > limite ? (page.at(-1)?.id ?? null) : null,
    };
  }

  private ligne(p: {
    id: string; user: { username: string }; mode: string; status: string;
    amount: unknown; currency: string; credits: number;
    paymentMethod: { brand: string | null; last4: string | null } | null;
    expectedAmount: unknown; receivedAmount: unknown; createdAt: Date;
  }) {
    const attendu = p.expectedAmount === null ? null : Number(p.expectedAmount);
    const recu = p.receivedAmount === null ? null : Number(p.receivedAmount);
    return {
      id: p.id,
      utilisateur: p.user.username,
      mode: p.mode as "provider" | "semi_manual" | "manual",
      etat: p.status as "pending" | "succeeded" | "failed" | "expired" | "refunded",
      montant: Number(p.amount),
      devise: p.currency,
      credits: p.credits,
      methode: methodeLisible(p.paymentMethod),
      attenduSurLeCompte: attendu,
      recuSurLeCompte: recu,
      // Nul tant que personne n'a constaté : « il n'y a pas d'écart » et
      // « personne n'a regardé » ne se disent pas de la même façon.
      ecart: attendu === null || recu === null ? null : recu - attendu,
      creeLe: p.createdAt.toISOString(),
    };
  }

  async detail(id: string) {
    const p = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        user: { select: { username: true } },
        paymentMethod: { select: { brand: true, last4: true } },
        collectionAccount: { select: { label: true } },
        history: {
          orderBy: { startedAt: "asc" },
          include: { changedByAdmin: { select: { email: true } }, changedByUser: { select: { username: true } } },
        },
      },
    });
    if (!p) throw new AppError("not_found", "unknown payment");

    return {
      ...this.ligne(p),
      reference: p.providerRef,
      motifEchec: p.failureReason,
      frais: p.feeAmount === null ? null : Number(p.feeAmount),
      compteCollecte: p.collectionAccount?.label ?? null,
      histoire: p.history.map((h) => ({
        etat: h.status as "pending" | "succeeded" | "failed" | "expired" | "refunded",
        debut: h.startedAt.toISOString(),
        fin: h.endedAt?.toISOString() ?? null,
        // La durée se lit ici plutôt qu'à l'écran : deux clients qui la
        // recalculeraient chacun de son côté finiraient par ne pas dire la même
        // chose. Nulle pour l'état courant — il dure encore.
        dureeSecondes: h.endedAt === null
          ? null
          : Math.round((h.endedAt.getTime() - h.startedAt.getTime()) / 1000),
        origine: h.origin as "user" | "webhook" | "polling" | "admin" | "system",
        parQui: h.changedByAdmin?.email ?? h.changedByUser?.username ?? null,
        motif: h.reason,
      })),
    };
  }

  async mouvements(requete: z.infer<typeof requeteMouvements>) {
    const limite = requete.limit ?? LIMITE_DEFAUT;
    const lignes = await this.prisma.creditTransaction.findMany({
      where: {
        ...(requete.type ? { type: requete.type } : {}),
        ...(requete.utilisateurId ? { userId: requete.utilisateurId } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limite + 1,
      ...(requete.cursor ? { cursor: { id: requete.cursor }, skip: 1 } : {}),
      include: { user: { select: { username: true } } },
    });

    const page = lignes.slice(0, limite);
    return {
      items: page.map((m) => ({
        id: m.id,
        utilisateur: m.user.username,
        type: m.type,
        // Le type dit ce que le mouvement est, la source ce qui l'a produit :
        // un octroi d'inscription et un bonus de parrainage sont tous deux des
        // « grant », et seule la source les sépare.
        source: m.source,
        montant: m.amount,
        paiementId: m.paymentId,
        note: m.reason,
        creeLe: m.createdAt.toISOString(),
      })),
      nextCursor: lignes.length > limite ? (page.at(-1)?.id ?? null) : null,
    };
  }
}

@Controller("admin")
@UseGuards(AdminGuard, RoleGuard)
export class PaymentListsController {
  constructor(@Inject(PaymentListsService) private readonly service: PaymentListsService) {}

  @Get("payments")
  paiements(@Query(new ZodValidationPipe(requetePaiements)) requete: z.infer<typeof requetePaiements>) {
    return this.service.paiements(requete);
  }

  @Get("payments/:id")
  detail(@Param("id") id: string) {
    return this.service.detail(id);
  }

  @Get("credit-transactions")
  mouvements(@Query(new ZodValidationPipe(requeteMouvements)) requete: z.infer<typeof requeteMouvements>) {
    return this.service.mouvements(requete);
  }
}

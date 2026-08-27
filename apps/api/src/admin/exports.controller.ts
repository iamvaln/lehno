import { Controller, Header, HttpCode, Inject, Injectable, Post, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AdminGuard } from "./admin.guard.js";
import { Role, RoleGuard } from "./role.guard.js";
import { AuditService } from "./audit.service.js";
import { documentCsv } from "./csv.js";
import { methodeLisible } from "./payment-lists.controller.js";

/**
 * L'export des deux lectures — ux-admin §5.12, §5.13 et §7.
 *
 * **POST, et non GET.** Un export s'inscrit au journal d'audit : c'est une
 * écriture, et une lecture qui écrit surprendrait qui parcourt la table des
 * routes. La convention du dépôt l'admet — un POST qui ne crée rien rend 200.
 *
 * **Synchrone, et non par courriel.** Le paquet de passation annonçait « le
 * fichier arrive par courriel » ; il n'existe ni file d'attente ni envoi de
 * pièce jointe. Promettre un courriel qui n'arrive jamais est pire qu'un
 * téléchargement direct — la copie de l'écran a été corrigée en conséquence.
 *
 * **Un plafond, et il se dit.** Un export sans borne sur une table qui grossit
 * finirait par tenir la base pendant sa lecture. Le plafond est haut, mais il
 * existe, et le nombre de lignes sorties figure au journal : un fichier tronqué
 * en silence se prendrait pour complet.
 */

const PLAFOND = 10_000;

const journalSchema = z.object({
  action: z.string().max(64).optional(),
  actorId: z.string().uuid().optional(),
  since: z.coerce.date().optional(),
}).strict();

const connexionsSchema = z.object({
  result: z.enum(["success", "failure"]).optional(),
  utilisateurId: z.string().uuid().optional(),
  since: z.coerce.date().optional(),
}).strict();

const comptesSchema = z.object({
  status: z.enum(["active", "suspended", "pending_deletion", "deleted"]).optional(),
  q: z.string().max(200).optional(),
}).strict();

const paiementsSchema = z.object({
  etat: z.enum(["pending", "succeeded", "failed", "expired", "refunded"]).optional(),
  mode: z.enum(["provider", "semi_manual", "manual"]).optional(),
  utilisateurId: z.string().uuid().optional(),
}).strict();

const mouvementsSchema = z.object({
  type: z.enum(["grant", "purchase", "consumption", "adjustment"]).optional(),
  utilisateurId: z.string().uuid().optional(),
}).strict();

/** Ce que l'export a emporté, dit en clair pour le journal. */
function resume(quoi: string, filtres: Record<string, unknown>): string {
  const dits = Object.entries(filtres)
    .filter(([, v]) => v !== undefined)
    .map(([cle, v]) => `${cle}=${v instanceof Date ? v.toISOString() : String(v)}`);
  // « Qui a sorti quoi » n'a de sens que si le quoi y figure : un motif
  // générique ne dirait rien qu'on ne sache déjà en lisant l'action.
  return dits.length > 0 ? `Export ${quoi} — ${dits.join(", ")}` : `Export ${quoi} — sans filtre`;
}

@Injectable()
export class ExportsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly journal: AuditService,
  ) {}

  async journalDAudit(auteurId: string, requete: z.infer<typeof journalSchema>): Promise<string> {
    const lignes = await this.prisma.auditLog.findMany({
      where: {
        ...(requete.action ? { action: requete.action } : {}),
        ...(requete.actorId ? { actorId: requete.actorId } : {}),
        ...(requete.since ? { createdAt: { gte: requete.since } } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PLAFOND,
    });

    const fichier = documentCsv(
      ["date", "acteurType", "acteurId", "action", "motif", "cibleType", "cibleId"],
      lignes.map((e) => [
        e.createdAt.toISOString(), e.actorType, e.actorId, e.action,
        e.reason, e.targetType, e.targetId,
      ]),
    );

    // Après la lecture : l'export ne doit pas figurer dans le fichier qu'il
    // produit, sinon il se décrirait lui-même.
    await this.journal.consigner({
      auteurId,
      action: "audit_log_export",
      motif: resume("du journal d'audit", requete),
      cibleType: "audit_log",
      details: { lignes: lignes.length, plafond: PLAFOND },
    });

    return fichier;
  }

  async connexions(auteurId: string, requete: z.infer<typeof connexionsSchema>): Promise<string> {
    const lignes = await this.prisma.loginActivity.findMany({
      where: {
        ...(requete.result ? { result: requete.result } : {}),
        ...(requete.utilisateurId ? { userId: requete.utilisateurId } : {}),
        ...(requete.since ? { createdAt: { gte: requete.since } } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PLAFOND,
      include: { user: { select: { username: true } } },
    });

    // Pas d'adresse IP. Elle sert aux investigations, pas à l'affichage — et
    // encore moins à un fichier qui circulera par courriel ou dans un tableur.
    const fichier = documentCsv(
      ["date", "compte", "adresseTentee", "resultat", "voie", "appareil", "lieu"],
      lignes.map((l) => [
        l.createdAt.toISOString(), l.user?.username ?? null, l.attemptedEmail,
        l.result, l.method, l.userAgent, l.geoApprox,
      ]),
    );

    await this.journal.consigner({
      auteurId,
      action: "login_activity_export",
      motif: resume("des connexions", requete),
      cibleType: "login_activity",
      details: { lignes: lignes.length, plafond: PLAFOND },
    });

    return fichier;
  }

  /**
   * Les trois listes d'exploitation — ux-admin §7, « les listes filtrées
   * s'exportent ».
   *
   * Chacune reprend **les filtres de sa liste**, et rien de plus : un export
   * qui ignorerait la sélection sortirait la table entière en laissant croire
   * qu'il sort ce qu'on regarde. Le résumé porté au journal les nomme, pour
   * qu'on sache après coup ce qui est parti.
   */
  async comptes(auteurId: string, requete: z.infer<typeof comptesSchema>): Promise<string> {
    const q = requete.q?.trim();
    const lignes = await this.prisma.user.findMany({
      where: {
        ...(requete.status ? { status: requete.status } : {}),
        ...(q ? { OR: [{ username: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] } : {}),

      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PLAFOND,
      select: { id: true, username: true, email: true, status: true, createdAt: true },
    });

    // Le solde est la somme des mouvements ; on l'agrège en une requête plutôt
    // qu'une par compte, sinon un export de dix mille lignes en ferait autant.
    const soldes = new Map(
      (await this.prisma.creditTransaction.groupBy({
        by: ["userId"],
        where: { userId: { in: lignes.map((u) => u.id) } },
        _sum: { amount: true },
      })).map((g) => [g.userId, g._sum.amount ?? 0]),
    );

    const fichier = documentCsv(
      ["pseudo", "email", "etat", "credits", "inscritLe"],
      lignes.map((u) => [
        u.username, u.email, u.status, String(soldes.get(u.id) ?? 0), u.createdAt.toISOString(),
      ]),
    );

    await this.journal.consigner({
      auteurId,
      action: "user_export",
      motif: resume("des comptes", requete),
      cibleType: "user",
      details: { lignes: lignes.length, plafond: PLAFOND },
    });

    return fichier;
  }

  async paiements(auteurId: string, requete: z.infer<typeof paiementsSchema>): Promise<string> {
    const lignes = await this.prisma.payment.findMany({
      where: {
        ...(requete.etat ? { status: requete.etat } : {}),
        ...(requete.mode ? { mode: requete.mode } : {}),
        ...(requete.utilisateurId ? { userId: requete.utilisateurId } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PLAFOND,
      include: {
        user: { select: { username: true } },
        paymentMethod: { select: { brand: true, last4: true } },
      },
    });

    /**
     * **Ni le numéro du payeur, ni celui du compte de collecte.** Le numéro
     * d'un compte mobile money est chiffré au repos et masqué partout à
     * l'affichage, y compris pour l'administrateur. Un fichier circule par
     * courriel et s'ouvre dans un tableur : c'est le dernier endroit où le
     * laisser passer. Seul le libellé masqué sort, composé par la fonction qui
     * le compose partout ailleurs — une seconde ferait diverger les deux.
     */
    const fichier = documentCsv(
      ["date", "utilisateur", "mode", "etat", "montant", "devise", "credits", "methode", "attendu", "recu", "ecart"],
      lignes.map((p) => {
        const attendu = p.expectedAmount === null ? null : Number(p.expectedAmount);
        const recu = p.receivedAmount === null ? null : Number(p.receivedAmount);
        return [
          p.createdAt.toISOString(), p.user.username, p.mode, p.status,
          String(Number(p.amount)), p.currency, String(p.credits),
          methodeLisible(p.paymentMethod),
          attendu === null ? null : String(attendu),
          recu === null ? null : String(recu),
          attendu === null || recu === null ? null : String(recu - attendu),
        ];
      }),
    );

    await this.journal.consigner({
      auteurId,
      action: "payment_export",
      motif: resume("des paiements", requete),
      cibleType: "payment",
      details: { lignes: lignes.length, plafond: PLAFOND },
    });

    return fichier;
  }

  async mouvements(auteurId: string, requete: z.infer<typeof mouvementsSchema>): Promise<string> {
    const lignes = await this.prisma.creditTransaction.findMany({
      where: {
        ...(requete.type ? { type: requete.type } : {}),
        ...(requete.utilisateurId ? { userId: requete.utilisateurId } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PLAFOND,
      include: { user: { select: { username: true } } },
    });

    // Le type dit ce que le mouvement est, la source ce qui l'a produit : les
    // deux sortent, sinon un ajustement de remboursement ne se distinguerait
    // pas d'une correction faite à la main.
    const fichier = documentCsv(
      ["date", "utilisateur", "type", "source", "montant", "paiementId", "note"],
      lignes.map((m) => [
        m.createdAt.toISOString(), m.user.username, m.type, m.source,
        String(m.amount), m.paymentId, m.reason,
      ]),
    );

    await this.journal.consigner({
      auteurId,
      action: "credit_transaction_export",
      motif: resume("des mouvements de crédits", requete),
      cibleType: "credit_transaction",
      details: { lignes: lignes.length, plafond: PLAFOND },
    });

    return fichier;
  }
}

@Controller("admin")
@UseGuards(AdminGuard, RoleGuard)
export class ExportsController {
  constructor(@Inject(ExportsService) private readonly service: ExportsService) {}

  // Le journal est réservé aux administrateurs (ux-admin §6) : son export
  // l'est aussi, sans quoi le support en obtiendrait par la sortie ce qu'on lui
  // refuse à l'écran.
  @Post("audit-log/export")
  @Role("admin")
  @HttpCode(200)
  @Header("content-type", "text/csv; charset=utf-8")
  @Header("content-disposition", 'attachment; filename="journal-audit.csv"')
  journal(
    @Query(new ZodValidationPipe(journalSchema)) requete: z.infer<typeof journalSchema>,
    @Req() req: { admin?: { id: string } },
  ): Promise<string> {
    return this.service.journalDAudit(req.admin?.id ?? "", requete);
  }

  @Post("login-activity/export")
  @HttpCode(200)
  @Header("content-type", "text/csv; charset=utf-8")
  @Header("content-disposition", 'attachment; filename="connexions.csv"')
  connexions(
    @Query(new ZodValidationPipe(connexionsSchema)) requete: z.infer<typeof connexionsSchema>,
    @Req() req: { admin?: { id: string } },
  ): Promise<string> {
    return this.service.connexions(req.admin?.id ?? "", requete);
  }

  /**
   * Les trois listes d'exploitation, **réservées aux administrateurs**.
   *
   * Ce n'est pas ce que la spécification dicte, et il faut le dire : §6 accorde
   * au support « consulter les comptes » et « consulter les paiements et les
   * mouvements de crédits », §7 n'assortit l'export d'aucun rôle. Les deux
   * ensemble le lui ouvriraient — comme l'export des connexions, ouvert
   * ci-dessus parce que sa liste l'est.
   *
   * Mais l'écran des comptes réserve **déjà** son bouton d'export aux
   * administrateurs, et c'est une décision livrée. Devant ce désaccord on prend
   * la lecture la plus fermée : un fichier sort de l'outil et circule ;
   * restreindre se défait d'une ligne, élargir laisse sortir des données.
   * À trancher — voir K du fichier d'écarts.
   */
  @Post("users/export")
  @Role("admin")
  @HttpCode(200)
  @Header("content-type", "text/csv; charset=utf-8")
  @Header("content-disposition", 'attachment; filename="comptes.csv"')
  comptes(
    @Query(new ZodValidationPipe(comptesSchema)) requete: z.infer<typeof comptesSchema>,
    @Req() req: { admin?: { id: string } },
  ): Promise<string> {
    return this.service.comptes(req.admin?.id ?? "", requete);
  }

  @Post("payments/export")
  @Role("admin")
  @HttpCode(200)
  @Header("content-type", "text/csv; charset=utf-8")
  @Header("content-disposition", 'attachment; filename="paiements.csv"')
  paiements(
    @Query(new ZodValidationPipe(paiementsSchema)) requete: z.infer<typeof paiementsSchema>,
    @Req() req: { admin?: { id: string } },
  ): Promise<string> {
    return this.service.paiements(req.admin?.id ?? "", requete);
  }

  @Post("credit-transactions/export")
  @Role("admin")
  @HttpCode(200)
  @Header("content-type", "text/csv; charset=utf-8")
  @Header("content-disposition", 'attachment; filename="mouvements-credits.csv"')
  mouvements(
    @Query(new ZodValidationPipe(mouvementsSchema)) requete: z.infer<typeof mouvementsSchema>,
    @Req() req: { admin?: { id: string } },
  ): Promise<string> {
    return this.service.mouvements(req.admin?.id ?? "", requete);
  }
}

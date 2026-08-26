import { Controller, Header, HttpCode, Inject, Injectable, Post, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AdminGuard } from "./admin.guard.js";
import { Role, RoleGuard } from "./role.guard.js";
import { AuditService } from "./audit.service.js";
import { documentCsv } from "./csv.js";

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
}

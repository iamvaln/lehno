import { Body, Controller, Get, Inject, Injectable, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { etatAssistanceSchema } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AdminGuard } from "./admin.guard.js";
import { RoleGuard } from "./role.guard.js";
import { AuditService } from "./audit.service.js";

/**
 * Les quatre files d'assistance.
 *
 * Trois sont des **registres qu'on lit** — messages du formulaire public,
 * inscriptions à la liste d'attente, retours laissés depuis l'application.
 * Aucune ne porte d'état : rien n'y est à solder, on les consulte.
 *
 * La quatrième est une **file de travail** : une demande d'assistance s'ouvre,
 * se répond, se clôt. C'est la seule des quatre dont le modèle porte un statut,
 * et c'est ce qui la distingue.
 *
 * Toutes sont ouvertes au support : « répondre aux utilisateurs et traiter les
 * cas courants » est sa raison d'être (ux-admin §6).
 */

const LIMITE_DEFAUT = 25;
const LIMITE_MAX = 200;

const requeteBase = {
  limit: z.coerce.number().int().min(1).max(LIMITE_MAX).optional(),
  cursor: z.string().uuid().optional(),
};

const requeteAssistance = z.object({
  ...requeteBase,
  etat: z.enum(["open", "answered", "closed"]).optional(),
}).strict();

const requeteSimple = z.object(requeteBase).strict();

@Injectable()
export class QueuesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly journal: AuditService,
  ) {}

  /** Le découpage à curseur, identique aux quatre files. */
  private page<T extends { id: string }>(lignes: T[], limite: number) {
    const page = lignes.slice(0, limite);
    return { page, nextCursor: lignes.length > limite ? (page.at(-1)?.id ?? null) : null };
  }

  async assistance(requete: z.infer<typeof requeteAssistance>) {
    const limite = requete.limit ?? LIMITE_DEFAUT;
    const lignes = await this.prisma.supportRequest.findMany({
      where: { ...(requete.etat ? { status: requete.etat } : {}) },
      // Du plus ancien au plus récent : c'est une file de travail, et c'est
      // celui qui attend depuis le plus longtemps qu'on traite d'abord.
      // L'identifiant départage deux demandes de la même milliseconde.
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limite + 1,
      ...(requete.cursor ? { cursor: { id: requete.cursor }, skip: 1 } : {}),
      include: { user: { select: { username: true } } },
    });

    const { page, nextCursor } = this.page(lignes, limite);
    return {
      items: page.map((d) => ({
        id: d.id,
        utilisateur: d.user.username,
        sujet: d.subject,
        corps: d.body,
        version: d.appVersion,
        plateforme: d.platform,
        etat: d.status,
        creeLe: d.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }

  async solder(auteurId: string, id: string, entree: z.infer<typeof etatAssistanceSchema>) {
    const avant = await this.prisma.supportRequest.findUnique({
      where: { id }, select: { id: true, status: true },
    });
    if (!avant) throw new AppError("not_found", "unknown support request");

    return this.prisma.$transaction(async (tx) => {
      await this.journal.consigner({
        auteurId,
        action: "support_request_update",
        motif: entree.reason,
        cibleType: "support_request",
        cibleId: id,
        details: { from: avant.status, to: entree.etat },
      }, tx);

      const apres = await tx.supportRequest.update({
        where: { id }, data: { status: entree.etat }, select: { id: true, status: true },
      });
      return { id: apres.id, etat: apres.status };
    });
  }

  async contact(requete: z.infer<typeof requeteSimple>) {
    const limite = requete.limit ?? LIMITE_DEFAUT;
    const lignes = await this.prisma.contactMessage.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limite + 1,
      ...(requete.cursor ? { cursor: { id: requete.cursor }, skip: 1 } : {}),
    });

    const { page, nextCursor } = this.page(lignes, limite);
    return {
      items: page.map((m) => ({
        id: m.id,
        nom: m.name,
        email: m.email,
        // Une clé, jamais un texte libre venu du client : c'est ce qui permet
        // de la traduire plutôt que de l'afficher telle quelle.
        sujet: m.subject,
        message: m.message,
        langue: m.locale,
        creeLe: m.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }

  async attente(requete: z.infer<typeof requeteSimple>) {
    const limite = requete.limit ?? LIMITE_DEFAUT;
    const lignes = await this.prisma.waitlistSignup.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limite + 1,
      ...(requete.cursor ? { cursor: { id: requete.cursor }, skip: 1 } : {}),
    });

    const { page, nextCursor } = this.page(lignes, limite);
    return {
      items: page.map((i) => ({
        id: i.id,
        // L'adresse SAISIE, pas sa forme canonique : c'est elle que la personne
        // reconnaîtra, et à elle qu'on écrira. La canonique ne sert qu'à
        // l'unicité, et n'a rien à faire à l'écran.
        email: i.email,
        langue: i.locale,
        source: i.source,
        creeLe: i.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }

  async retours(requete: z.infer<typeof requeteSimple>) {
    const limite = requete.limit ?? LIMITE_DEFAUT;
    const lignes = await this.prisma.feedback.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limite + 1,
      ...(requete.cursor ? { cursor: { id: requete.cursor }, skip: 1 } : {}),
      include: { user: { select: { username: true } } },
    });

    const { page, nextCursor } = this.page(lignes, limite);
    return {
      items: page.map((r) => ({
        id: r.id,
        // Un retour survit au compte qui l'a laissé : la relation est en
        // SetNull, et l'anonyme se dit plutôt que de faire échouer la lecture.
        utilisateur: r.user?.username ?? null,
        note: r.rating,
        corps: r.body,
        version: r.appVersion,
        creeLe: r.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }
}

// Aucun @Role : les quatre files sont ouvertes au support, dont c'est la raison
// d'être. Ce qui lui reste fermé vit ailleurs — la famille Économie et le
// journal d'audit.
@Controller("admin")
@UseGuards(AdminGuard, RoleGuard)
export class QueuesController {
  constructor(@Inject(QueuesService) private readonly service: QueuesService) {}

  @Get("support-requests")
  assistance(@Query(new ZodValidationPipe(requeteAssistance)) requete: z.infer<typeof requeteAssistance>) {
    return this.service.assistance(requete);
  }

  @Patch("support-requests/:id")
  solder(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(etatAssistanceSchema)) corps: z.infer<typeof etatAssistanceSchema>,
    @Req() req: { admin?: { id: string } },
  ) {
    return this.service.solder(req.admin?.id ?? "", id, corps);
  }

  @Get("contact-messages")
  contact(@Query(new ZodValidationPipe(requeteSimple)) requete: z.infer<typeof requeteSimple>) {
    return this.service.contact(requete);
  }

  @Get("waitlist")
  attente(@Query(new ZodValidationPipe(requeteSimple)) requete: z.infer<typeof requeteSimple>) {
    return this.service.attente(requete);
  }

  @Get("feedback")
  retours(@Query(new ZodValidationPipe(requeteSimple)) requete: z.infer<typeof requeteSimple>) {
    return this.service.retours(requete);
  }
}

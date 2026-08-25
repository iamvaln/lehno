import { Controller, Get, Inject, Injectable, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AdminGuard } from "./admin.guard.js";
import { Role, RoleGuard } from "./role.guard.js";

const LIMITE_DEFAUT = 50;
const LIMITE_MAX = 200;

const journalSchema = z.object({
  limit: z.coerce.number().int().min(1).max(LIMITE_MAX).optional(),
  cursor: z.string().uuid().optional(),
  action: z.string().max(64).optional(),
  actorId: z.string().uuid().optional(),
  since: z.coerce.date().optional(),
}).strict();

const connexionsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(LIMITE_MAX).optional(),
  cursor: z.string().uuid().optional(),
  result: z.enum(["success", "failure"]).optional(),
  since: z.coerce.date().optional(),
}).strict();

@Injectable()
export class LecturesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async journal(requete: z.infer<typeof journalSchema>) {
    const limite = requete.limit ?? LIMITE_DEFAUT;
    const lignes = await this.prisma.auditLog.findMany({
      where: {
        ...(requete.action ? { action: requete.action } : {}),
        ...(requete.actorId ? { actorId: requete.actorId } : {}),
        ...(requete.since ? { createdAt: { gte: requete.since } } : {}),
      },
      // Le plus récent en tête : on ouvre le journal pour savoir ce qui vient
      // de se passer, pas pour relire le début.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limite + 1,
      ...(requete.cursor ? { cursor: { id: requete.cursor }, skip: 1 } : {}),
    });

    const page = lignes.slice(0, limite);
    return {
      items: page.map((e) => ({
        id: e.id,
        date: e.createdAt.toISOString(),
        acteurType: e.actorType,
        // Pas de nom : actorId n'est pas une clé étrangère en base — une trace
        // qui doit faire foi ne disparaît pas avec le compte qu'elle décrit.
        acteurId: e.actorId,
        action: e.action,
        motif: e.reason,
        cibleType: e.targetType,
        cibleId: e.targetId,
        details: e.metadata ?? null,
      })),
      nextCursor: lignes.length > limite ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async connexions(requete: z.infer<typeof connexionsSchema>) {
    const limite = requete.limit ?? LIMITE_DEFAUT;
    const lignes = await this.prisma.loginActivity.findMany({
      where: {
        ...(requete.result ? { result: requete.result } : {}),
        ...(requete.since ? { createdAt: { gte: requete.since } } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limite + 1,
      ...(requete.cursor ? { cursor: { id: requete.cursor }, skip: 1 } : {}),
      include: { user: { select: { username: true } } },
    });

    const page = lignes.slice(0, limite);
    return {
      items: page.map((l) => ({
        id: l.id,
        date: l.createdAt.toISOString(),
        compte: l.user?.username ?? null,
        // L'adresse tentée reste visible : c'est elle qui permet de voir qu'on
        // essaie mille adresses à la suite. Le contrat écrit pour l'écran
        // annonçait une adresse IP — la table n'en garde pas, elle garde un
        // lieu approximatif (spec technique §9 : l'IP ne descend pas en base).
        adresseTentee: l.attemptedEmail,
        resultat: l.result,
        appareil: l.userAgent,
        lieu: l.geoApprox,
      })),
      nextCursor: lignes.length > limite ? (page.at(-1)?.id ?? null) : null,
    };
  }
}

// Deux lectures, aucune écriture. Une trace qui fait foi ne se modifie ni ne
// s'efface : il n'existe aucun chemin pour toucher au journal depuis l'extérieur.
@Controller("admin")
@UseGuards(AdminGuard, RoleGuard)
export class LecturesController {
  constructor(@Inject(LecturesService) private readonly service: LecturesService) {}

  // « Le journal d'audit est réservé aux administrateurs — c'est ce qui lui
  // donne sa valeur de contrôle sur le travail de l'équipe » (ux-admin §6). Le
  // paquet de passation l'ouvrait au support ; la spec tranche contre lui.
  @Get("audit-log")
  @Role("admin")
  journal(@Query(new ZodValidationPipe(journalSchema)) requete: z.infer<typeof journalSchema>) {
    return this.service.journal(requete);
  }

  // Les connexions restent au support : c'est ce qu'on regarde pour répondre à
  // quelqu'un qui n'arrive pas à entrer.
  @Get("login-activity")
  connexions(@Query(new ZodValidationPipe(connexionsSchema)) requete: z.infer<typeof connexionsSchema>) {
    return this.service.connexions(requete);
  }
}

import { Body, Controller, Delete, Get, HttpCode, Inject, Injectable, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { motifSchema } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AdminGuard } from "./admin.guard.js";
import { Role, RoleGuard } from "./role.guard.js";
import { AuditService } from "./audit.service.js";

const invitationSchema = z.object({
  email: z.string().email().max(254),
  displayName: z.string().max(120).optional(),
  reason: motifSchema,
  reasonCode: z.string().max(48).optional(),
}).strict();

const roleSchema = z.object({
  role: z.enum(["support", "admin"]),
  reason: motifSchema,
  reasonCode: z.string().max(48).optional(),
}).strict();

const revocationSchema = z.object({
  reason: motifSchema,
  reasonCode: z.string().max(48).optional(),
}).strict();

@Injectable()
export class AdminsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly journal: AuditService,
  ) {}

  // Ni condensé de code, ni jeton : la liste dit qui a accès, pas comment
  // entrer. Une sélection explicite plutôt qu'un objet entier — un champ
  // ajouté demain à la table ne doit pas sortir d'ici sans qu'on l'ait voulu.
  async lister() {
    const lignes = await this.prisma.admin.findMany({
      orderBy: [{ createdAt: "asc" }],
      select: { id: true, email: true, displayName: true, role: true, isActive: true, createdAt: true },
    });
    return {
      items: lignes.map((a) => ({
        id: a.id, email: a.email, displayName: a.displayName,
        role: a.role, isActive: a.isActive, createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  async inviter(auteurId: string, entree: z.infer<typeof invitationSchema>) {
    const existant = await this.prisma.admin.findUnique({ where: { email: entree.email } });
    if (existant) throw new AppError("conflict", "an admin already uses this address");

    return this.prisma.$transaction(async (tx) => {
      // Le moindre privilège : on entre en support, on monte ensuite si le
      // travail le demande. L'inverse — entrer admin et redescendre — laisse
      // des droits à qui n'en a plus besoin.
      const cree = await tx.admin.create({
        data: {
          email: entree.email,
          ...(entree.displayName === undefined ? {} : { displayName: entree.displayName }),
        },
        select: { id: true, email: true, role: true, isActive: true },
      });

      await this.journal.consigner({
        /* Inviter n'a aucun motif préréglé, et c'est cohérent : on invite
           quelqu'un de nommé, pour une raison qui tient à lui. */
        auteurId, action: "admin_invite", geste: "admin_invite", motif: entree.reason,
        ...(entree.reasonCode !== undefined ? { codeMotif: entree.reasonCode } : {}),
        cibleType: "admin", cibleId: cree.id,
        details: { email: cree.email, role: cree.role },
      }, tx);

      return cree;
    });
  }

  async changerRole(auteurId: string, id: string, entree: z.infer<typeof roleSchema>) {
    // On ne se rétrograde pas soi-même : c'est la même porte que la révocation,
    // ouverte d'un cran de moins.
    if (id === auteurId)
      throw new AppError("forbidden", "an admin cannot change their own role");

    const avant = await this.prisma.admin.findUnique({ where: { id }, select: { id: true, role: true } });
    if (!avant) throw new AppError("not_found", "unknown admin");

    return this.prisma.$transaction(async (tx) => {
      await this.journal.consigner({
        auteurId, action: "admin_role_update",
        // Monter et descendre quelqu'un ne s'expliquent pas pareil.
        geste: entree.role === "admin" ? "admin_promote" : "admin_demote",
        motif: entree.reason,
        ...(entree.reasonCode !== undefined ? { codeMotif: entree.reasonCode } : {}),
        cibleType: "admin", cibleId: id,
        details: { from: avant.role, to: entree.role },
      }, tx);

      return tx.admin.update({
        where: { id }, data: { role: entree.role },
        select: { id: true, role: true, isActive: true },
      });
    });
  }

  async revoquer(auteurId: string, id: string, entree: z.infer<typeof revocationSchema>) {
    // Un outil qui laisse fermer la dernière porte derrière soi est un outil
    // cassé : plus personne ne peut rétablir qui que ce soit.
    if (id === auteurId)
      throw new AppError("forbidden", "an admin cannot revoke themselves");

    const avant = await this.prisma.admin.findUnique({ where: { id }, select: { id: true, isActive: true } });
    if (!avant) throw new AppError("not_found", "unknown admin");

    return this.prisma.$transaction(async (tx) => {
      await this.journal.consigner({
        auteurId, action: "admin_revoke", geste: "admin_deactivate", motif: entree.reason,
        ...(entree.reasonCode !== undefined ? { codeMotif: entree.reasonCode } : {}),
        cibleType: "admin", cibleId: id,
      }, tx);

      // Désactiver, jamais effacer. Le journal garde un actor_id sans clé
      // étrangère — précisément pour que la trace survive au compte —, mais il
      // doit encore désigner quelqu'un qu'on puisse nommer.
      const apres = await tx.admin.update({
        where: { id }, data: { isActive: false },
        select: { id: true, isActive: true },
      });

      // Les sessions ouvertes tombent avec le compte. La garde rechargeant
      // l'administrateur à chaque appel, la révocation mordrait de toute façon
      // au geste suivant ; on ferme quand même, pour que rien ne traîne.
      await tx.adminRefreshToken.updateMany({
        where: { adminId: id, revokedAt: null }, data: { revokedAt: new Date() },
      });

      return apres;
    });
  }
}

@Controller("admin/admins")
@UseGuards(AdminGuard, RoleGuard)
@Role("admin")
export class AdminsController {
  constructor(@Inject(AdminsService) private readonly service: AdminsService) {}

  @Get()
  lister() {
    return this.service.lister();
  }

  @Post()
  @HttpCode(201)
  inviter(
    @Body(new ZodValidationPipe(invitationSchema)) corps: z.infer<typeof invitationSchema>,
    @Req() req: { admin: { id: string } },
  ) {
    return this.service.inviter(req.admin.id, corps);
  }

  @Patch(":id")
  changerRole(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(roleSchema)) corps: z.infer<typeof roleSchema>,
    @Req() req: { admin: { id: string } },
  ) {
    return this.service.changerRole(req.admin.id, id, corps);
  }

  @Delete(":id")
  revoquer(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(revocationSchema)) corps: z.infer<typeof revocationSchema>,
    @Req() req: { admin: { id: string } },
  ) {
    return this.service.revoquer(req.admin.id, id, corps);
  }
}

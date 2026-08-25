import { Body, Controller, Get, Inject, Injectable, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import type { UserStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AdminGuard } from "./admin.guard.js";
import { RoleGuard } from "./role.guard.js";
import { AuditService } from "./audit.service.js";

const LIMITE_DEFAUT = 25;

// Les états se disent dans les termes du contrat, pas dans ceux de la base.
// Traduire ici plutôt qu'à l'écran a une raison : le jour où Prisma renomme une
// valeur d'enum, c'est ce fichier qui ne compile plus — pas l'affichage qui
// devient faux en silence.
/** Les identifiants de la page, hors la ligne-sentinelle du curseur. */
function page_ids(lignes: { id: string }[], limite: number): string[] {
  return lignes.slice(0, limite).map((l) => l.id);
}

const ETAT: Record<UserStatus, "actif" | "suspendu" | "suppression_en_cours" | "efface"> = {
  active: "actif",
  suspended: "suspendu",
  pending_deletion: "suppression_en_cours",
  deleted: "efface",
};
const LIMITE_MAX = 200;

const requeteSchema = z.object({
  limit: z.coerce.number().int().min(1).max(LIMITE_MAX).optional(),
  cursor: z.string().uuid().optional(),
  status: z.enum(["active", "suspended", "pending_deletion", "deleted"]).optional(),
  q: z.string().max(200).optional(),
}).strict();

const changementSchema = z.object({
  status: z.enum(["active", "suspended", "pending_deletion", "deleted"]),
  reason: z.string().max(500).optional(),
}).strict();

@Injectable()
export class AdminUsersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly journal: AuditService,
  ) {}

  async lister(requete: z.infer<typeof requeteSchema>) {
    const limite = requete.limit ?? LIMITE_DEFAUT;
    const q = requete.q?.trim();

    const lignes = await this.prisma.user.findMany({
      where: {
        ...(requete.status ? { status: requete.status } : {}),
        ...(q ? { OR: [
          { username: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
        ] } : {}),
      },
      // Le curseur se lit sur un ordre stable. Trier par date de création
      // seule laisserait deux comptes de la même milliseconde s'échanger de
      // place entre deux pages — un compte sauté, un autre vu deux fois.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limite + 1,
      ...(requete.cursor ? { cursor: { id: requete.cursor }, skip: 1 } : {}),
      select: {
        id: true, username: true, email: true, status: true, createdAt: true,
      },
    });

    // On demande un élément de plus que la page : sa présence dit qu'il reste
    // quelque chose, sans avoir à compter le tout.
    // Le solde est la somme signée des mouvements — aucune colonne ne le
    // stocke, donc aucune ne peut se désynchroniser. Un seul groupBy pour toute
    // la page plutôt qu'une requête par ligne.
    const soldes = new Map<string, number>();
    if (page_ids(lignes, limite).length > 0) {
      const sommes = await this.prisma.creditTransaction.groupBy({
        by: ["userId"],
        where: { userId: { in: page_ids(lignes, limite) } },
        _sum: { amount: true },
      });
      for (const somme of sommes) soldes.set(somme.userId, somme._sum.amount ?? 0);
    }

    const page = lignes.slice(0, limite);
    return {
      items: page.map((u) => ({
        id: u.id,
        pseudo: u.username,
        email: u.email,
        etat: ETAT[u.status],
        // Zéro, et non nul : un compte sans mouvement a bien zéro crédit. Le
        // nul était réservé au temps où la table n'existait pas.
        credits: soldes.get(u.id) ?? 0,
        inscritLe: u.createdAt.toISOString(),
      })),
      nextCursor: lignes.length > limite ? (page.at(-1)?.id ?? null) : null,
    };
  }

  // Ce que l'équipe voit d'un compte : son état, ses volumétries, ses
  // mouvements. **Le contenu de ses fiches et de ses notes reste hors de
  // portée** — le cloisonnement tient aussi en administration, et c'est la
  // forme rendue qui le garantit, pas la discipline de qui écrit l'écran.
  async detail(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, username: true, email: true, status: true, uiLanguage: true,
        createdAt: true, deletionRequestedAt: true,
        _count: { select: { people: true } },
      },
    });
    if (!u) throw new AppError("not_found", "unknown user");

    // Les notes du carnet, pas celles que le titulaire a écrites : une note
    // laissée par un proche via un lien de collecte appartient au carnet sans
    // avoir d'auteur (dictionnaire, Note.author_user_id nul si contribution
    // anonyme). Compter authoredNotes l'aurait oubliée.
    const [occasions, notes, derniere, mouvements] = await Promise.all([
      this.prisma.event.count({ where: { person: { userId: id } } }),
      this.prisma.note.count({ where: { person: { userId: id } } }),
      // La dernière entrée réussie, pas la dernière tentative : une série
      // d'échecs ne doit pas se lire comme une visite.
      this.prisma.loginActivity.findFirst({
        where: { userId: id, result: "success" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      // Par type : la fiche distingue ce qui a été acheté de ce qui a été
      // offert, c'est la différence entre un compte qui paie et un compte
      // qu'on entretient.
      this.prisma.creditTransaction.groupBy({
        by: ["type"],
        where: { userId: id },
        _sum: { amount: true },
      }),
    ]);

    const parType = new Map(mouvements.map((m) => [m.type, m._sum.amount ?? 0]));
    const credits = {
      solde: [...parType.values()].reduce((total, montant) => total + montant, 0),
      achetes: parType.get("purchase") ?? 0,
      offerts: parType.get("grant") ?? 0,
    };

    return {
      id: u.id,
      pseudo: u.username,
      email: u.email,
      etat: ETAT[u.status],
      langue: u.uiLanguage === "en" ? ("en" as const) : ("fr" as const),
      inscritLe: u.createdAt.toISOString(),
      derniereConnexion: derniere?.createdAt.toISOString() ?? null,
      suppressionDemandeeLe: u.deletionRequestedAt?.toISOString() ?? null,
      volumetrie: {
        proches: u._count.people,
        occasions,
        notes,
        // Nul tant que la table des Murs n'existe pas.
        murs: null,
      },
      credits,
    };
  }

  async changerEtat(auteurId: string, id: string, entree: z.infer<typeof changementSchema>) {
    const avant = await this.prisma.user.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!avant) throw new AppError("not_found", "unknown user");

    // Le journal d'abord : s'il refuse le motif, l'état n'a pas bougé.
    return this.prisma.$transaction(async (tx) => {
      await this.journal.consigner({
        auteurId,
        action: "user_status_update",
        motif: entree.reason ?? "",
        cibleType: "user",
        cibleId: id,
        details: { from: avant.status, to: entree.status },
      }, tx);

      const apres = await tx.user.update({
        where: { id },
        data: { status: entree.status as UserStatus },
        select: { id: true, status: true },
      });
      return { id: apres.id, status: apres.status };
    });
  }
}

@Controller("admin/users")
@UseGuards(AdminGuard, RoleGuard)
export class AdminUsersController {
  constructor(@Inject(AdminUsersService) private readonly service: AdminUsersService) {}

  @Get()
  lister(@Query(new ZodValidationPipe(requeteSchema)) requete: z.infer<typeof requeteSchema>) {
    return this.service.lister(requete);
  }

  @Get(":id")
  detail(@Param("id") id: string) {
    return this.service.detail(id);
  }

  // Suspendre et rétablir appartiennent au support : c'est le geste de
  // l'assistance quotidienne (ux-admin §6). Marquer un compte effacé sans
  // attendre la fin du délai de grâce est réservé à l'admin — la garde de rôle
  // ne sachant pas lire le corps, la distinction se fait ici.
  @Patch(":id")
  async changer(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(changementSchema)) corps: z.infer<typeof changementSchema>,
    @Req() req: { admin: { id: string; role: string } },
  ) {
    if (corps.status === "deleted" && req.admin.role !== "admin")
      throw new AppError("forbidden", "role admin required to erase an account");
    return this.service.changerEtat(req.admin.id, id, corps);
  }
}

import { Controller, Get, Inject, Injectable, UseGuards } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AdminGuard } from "./admin.guard.js";
import { RoleGuard } from "./role.guard.js";

const JOUR_MS = 24 * 60 * 60_000;
const DELAI_DEFAUT = 30;
const PLAFOND_ALERTES = 3;
const FENETRE_ECHECS_H = 24;
const SEUIL_ECHECS = 20;

type Alerte = {
  cause: "suppression_echeance" | "connexions_echouees";
  libelle: string;
  ton: "danger" | "attention";
  section: string;
};

@Injectable()
export class DashboardService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async etat() {
    const maintenant = Date.now();

    const delaiLigne = await this.prisma.systemParameter.findUnique({
      where: { key: "account_grace_period_days" },
    });
    const delai = Number(delaiLigne?.value) > 0 ? Number(delaiLigne?.value) : DELAI_DEFAUT;
    const limiteEcheance = new Date(maintenant - delai * JOUR_MS);

    const [actifs, suspendus, enAttente, echues, echecs, gestes] = await Promise.all([
      this.prisma.user.count({ where: { status: "active" } }),
      this.prisma.user.count({ where: { status: "suspended" } }),
      this.prisma.user.count({ where: { status: "pending_deletion" } }),
      this.prisma.user.count({
        where: { status: "pending_deletion", deletionRequestedAt: { lte: limiteEcheance } },
      }),
      this.prisma.loginActivity.count({
        where: { result: "failure", createdAt: { gte: new Date(maintenant - FENETRE_ECHECS_H * 60 * 60_000) } },
      }),
      this.prisma.auditLog.findMany({
        where: { actorType: "admin" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 10,
        select: { id: true, createdAt: true, action: true, reason: true, targetType: true },
      }),
    ]);

    // Ce qui ne va pas, avant tout chiffre — et rien quand rien ne va mal. Une
    // file vide n'est pas une anomalie : inventer une alerte neutre pour
    // meubler le rang apprendrait à ne plus le regarder.
    const alertes: Alerte[] = [];
    if (echues > 0) {
      alertes.push({
        cause: "suppression_echeance",
        libelle: `${echues} suppression${echues > 1 ? "s" : ""} à effacer`,
        ton: "danger",
        section: "suppressions",
      });
    }
    if (echecs >= SEUIL_ECHECS) {
      alertes.push({
        cause: "connexions_echouees",
        libelle: `${echecs} connexions échouées sur ${FENETRE_ECHECS_H} h`,
        ton: "attention",
        section: "connexions",
      });
    }

    return {
      // Le plafond est tenu ici comme il l'est dans le contrat du back-office :
      // trois pastilles au plus, sur une ligne.
      alertes: alertes.slice(0, PLAFOND_ALERTES),
      comptes: { actifs, suspendus, enAttente },
      suppressions: { enCours: enAttente, echues },
      connexions: { echecs24h: echecs },
      derniersGestes: gestes.map((g) => ({
        id: g.id,
        date: g.createdAt.toISOString(),
        action: g.action,
        motif: g.reason,
        cibleType: g.targetType,
      })),
    };
  }
}

// L'accueil de l'outil, ouvert au support : « consulter le tableau de bord »
// appartient à l'assistance quotidienne (ux-admin §6).
@Controller("admin/dashboard")
@UseGuards(AdminGuard, RoleGuard)
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly service: DashboardService) {}

  @Get()
  etat() {
    return this.service.etat();
  }
}

import {
  Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards,
} from "@nestjs/common";
import { enregistrerVersionSchema, majVersionSchema, TYPES_CLIENT } from "@lehno/contracts";
import type {
  EnregistrerVersionInput, MajVersionInput, TypeClient, VersionApp, VersionsApp,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { VersionsService } from "../clients/versions.service.js";
import { AdminGuard } from "./admin.guard.js";
import { Role, RoleGuard } from "./role.guard.js";
import { AuditService } from "./audit.service.js";

type RequeteAdmin = { adminId: string };

type Ligne = {
  id: string;
  platform: string;
  version: string;
  buildNumber: number;
  forcesUpdate: boolean;
  isRetired: boolean;
  storeUrl: string | null;
  notes: string | null;
  publishedAt: Date;
};

/* Sur combien de temps on compte les appareils. Trente jours : assez pour que
   quelqu'un qui ouvre l'application une fois par mois y figure, assez peu pour
   que le chiffre parle du présent. */
const FENETRE_JOURS = 30;

/* LE REGISTRE DES VERSIONS.
 *
 * POSER `forcesUpdate` EST LE GESTE LE PLUS LOURD DE TOUT LE PANNEAU — plus
 * lourd que couper un client, parce qu'il ne se voit pas venir : il met hors
 * service tous les appareils en dessous, d'un coup, sans que personne n'ait rien
 * demandé.
 *
 * D'où le compteur rendu avec chaque ligne : le poser sans savoir combien de
 * gens il déloge serait le poser à l'aveugle.
 */
@Controller("admin/app-versions")
@UseGuards(AdminGuard, RoleGuard)
@Role("admin")
export class VersionsController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly journal: AuditService,
    @Inject(VersionsService) private readonly versions: VersionsService,
  ) {}

  /* Du build le plus récent au plus ancien — c'est l'ordre dans lequel on lit un
     registre, et celui dont la décision dépend. */
  @Get()
  async lister(@Query("platform") plateforme?: string): Promise<VersionsApp> {
    const filtre = plateforme === undefined ? {} : { platform: this.plateforme(plateforme) as never };
    const lignes = await this.prisma.appVersion.findMany({
      where: filtre,
      orderBy: [{ platform: "asc" }, { buildNumber: "desc" }],
    });
    const comptes = await this.comptesParBuild();
    return { items: lignes.map((l) => rendre(l as Ligne, comptes.get(l.buildNumber) ?? 0)) };
  }

  @Post()
  async enregistrer(
    @Req() req: RequeteAdmin,
    @Body(new ZodValidationPipe(enregistrerVersionSchema)) corps: EnregistrerVersionInput,
  ): Promise<VersionApp> {
    await this.journal.consigner({
      auteurId: req.adminId,
      action: "app_version_register",
      geste: "app_version_register",
      motif: corps.motif,
      ...(corps.reasonCode !== undefined ? { codeMotif: corps.reasonCode } : {}),
      details: {
        platform: corps.platform, version: corps.version,
        buildNumber: corps.buildNumber, forcesUpdate: corps.forcesUpdate ?? false,
      },
    });

    /* REJOUABLE : un `(plateforme, build)` déjà enregistré est mis à jour, pas
       dupliqué. Une chaîne de publication qui rejoue une étape ne doit ni créer
       un doublon ni échouer — et l'unicité en base tranche de toute façon. */
    const ligne = await this.prisma.appVersion.upsert({
      where: {
        platform_buildNumber: {
          platform: corps.platform as never, buildNumber: corps.buildNumber,
        },
      },
      create: {
        platform: corps.platform as never,
        version: corps.version,
        buildNumber: corps.buildNumber,
        forcesUpdate: corps.forcesUpdate ?? false,
        ...(corps.storeUrl === undefined ? {} : { storeUrl: corps.storeUrl }),
        ...(corps.notes === undefined ? {} : { notes: corps.notes }),
      },
      update: {
        version: corps.version,
        ...(corps.forcesUpdate === undefined ? {} : { forcesUpdate: corps.forcesUpdate }),
        ...(corps.storeUrl === undefined ? {} : { storeUrl: corps.storeUrl }),
        ...(corps.notes === undefined ? {} : { notes: corps.notes }),
      },
    });

    this.versions.oublier(corps.platform);
    return rendre(ligne as Ligne, await this.compteDe(corps.buildNumber));
  }

  @Patch(":id")
  async modifier(
    @Req() req: RequeteAdmin,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(majVersionSchema)) corps: MajVersionInput,
  ): Promise<VersionApp> {
    const existant = await this.prisma.appVersion.findUnique({ where: { id } });
    if (!existant) throw new AppError("not_found", "unknown app version");

    await this.journal.consigner({
      auteurId: req.adminId,
      action: "app_version_update",
      geste: "app_version_update",
      motif: corps.motif,
      ...(corps.reasonCode !== undefined ? { codeMotif: corps.reasonCode } : {}),
      cibleType: "app_version",
      cibleId: id,
      /* CE QUE LE GESTE CHANGE, dans les deux sens : « il valait faux » se
         relit, « il a changé » ne dit rien. Et sur ce geste-là, savoir qui a
         posé le drapeau et quand est ce qu'on ira chercher le jour où des
         utilisateurs se retrouvent dehors. */
      details: {
        platform: existant.platform, buildNumber: existant.buildNumber,
        avant: { forcesUpdate: existant.forcesUpdate, isRetired: existant.isRetired },
        apres: {
          forcesUpdate: corps.forcesUpdate ?? existant.forcesUpdate,
          isRetired: corps.isRetired ?? existant.isRetired,
        },
      },
    });

    const ligne = await this.prisma.appVersion.update({
      where: { id },
      data: {
        ...(corps.forcesUpdate === undefined ? {} : { forcesUpdate: corps.forcesUpdate }),
        ...(corps.isRetired === undefined ? {} : { isRetired: corps.isRetired }),
        ...(corps.storeUrl === undefined ? {} : { storeUrl: corps.storeUrl }),
        ...(corps.notes === undefined ? {} : { notes: corps.notes }),
      },
    });

    this.versions.oublier(existant.platform as TypeClient);
    return rendre(ligne as Ligne, await this.compteDe(existant.buildNumber));
  }

  private plateforme(brut: string): TypeClient {
    if (!(TYPES_CLIENT as readonly string[]).includes(brut))
      throw new AppError("validation_failed", `unknown platform "${brut}"`);
    return brut as TypeClient;
  }

  /* COMBIEN DE COMPTES DISTINCTS ont été vus sous chaque build, sur la fenêtre.
   *
   * Compté sur les CONNEXIONS, donc approché : quelqu'un qui ne s'est pas
   * reconnecté depuis un mois n'y figure pas. Mieux vaut un chiffre approché,
   * dit comme tel, qu'aucun chiffre — le geste qu'il éclaire met des gens
   * dehors.
   *
   * En une requête pour toute la liste : une par ligne ferait vingt allers-
   * retours à l'ouverture du panneau. */
  private async comptesParBuild(): Promise<Map<number, number>> {
    const depuis = new Date(Date.now() - FENETRE_JOURS * 86_400_000);
    const lignes = await this.prisma.$queryRaw<{ app_build: number; n: bigint }[]>`
      select "app_build", count(distinct "user_id") as n
        from "login_activity"
       where "app_build" is not null and "created_at" >= ${depuis}
       group by "app_build"
    `;
    return new Map(lignes.map((l) => [l.app_build, Number(l.n)]));
  }

  private async compteDe(build: number): Promise<number> {
    return (await this.comptesParBuild()).get(build) ?? 0;
  }
}

function rendre(l: Ligne, comptesVusRecemment: number): VersionApp {
  return {
    id: l.id,
    platform: l.platform as VersionApp["platform"],
    version: l.version,
    buildNumber: l.buildNumber,
    forcesUpdate: l.forcesUpdate,
    isRetired: l.isRetired,
    storeUrl: l.storeUrl,
    notes: l.notes,
    publishedAt: l.publishedAt.toISOString(),
    comptesVusRecemment,
  };
}

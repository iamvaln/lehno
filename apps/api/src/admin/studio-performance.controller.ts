import { Controller, Get, Inject, Param, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { NATURES_STUDIO, type NatureStudio, type Performance } from "@lehno/contracts";
import { AdminGuard } from "./admin.guard.js";
import { Role, RoleGuard } from "./role.guard.js";
import { AppError } from "../common/errors.js";
import { StudioPerformanceService } from "./studio-performance.service.js";

const natureStudioSchema = z.enum(NATURES_STUDIO);

/* LA LECTURE QUI DIT SI L'ATELIER PROGRESSE.
 *
 * À part des deux ateliers plutôt que dans l'un d'eux, et ce n'est pas de
 * l'indécision : `admin/text-studio` ne connaît que les trois natures de texte,
 * `admin/portrait-studio` que celle du portrait. La question « cette version
 * fait-elle mieux que la précédente ? » se pose pour LES QUATRE, et la ranger
 * dans l'un des deux obligerait à l'écrire deux fois — donc à la laisser
 * diverger.
 */
@Controller("admin/studio")
@UseGuards(AdminGuard, RoleGuard)
@Role("admin")
export class StudioPerformanceController {
  constructor(
    @Inject(StudioPerformanceService) private readonly service: StudioPerformanceService,
  ) {}

  /* La nature se valide DÈS LE PARAMÈTRE, comme dans l'atelier des textes : un
     chemin inconnu rend 400 avec son nom, pas une erreur de lecture trois
     couches plus bas. */
  @Get(":nature/performance")
  lire(@Param("nature") brut: string): Promise<Performance> {
    const analyse = natureStudioSchema.safeParse(brut);
    if (!analyse.success)
      throw new AppError("validation_failed", `unknown studio "${brut}"`);
    return this.service.lire(analyse.data as NatureStudio);
  }
}

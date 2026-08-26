import { Controller, Get, Inject } from "@nestjs/common";
import type { MaintenanceStatus } from "@lehno/contracts";
import { MaintenanceService } from "./maintenance.service.js";

// Le seul chemin qui répond pendant un arrêt, avec ceux d'administration.
// Sans compte : un client déconnecté doit pouvoir savoir pourquoi il n'entre
// pas, et un arrêt commence souvent avant que quiconque se soit connecté.
@Controller("public/maintenance")
export class MaintenanceController {
  constructor(
    @Inject(MaintenanceService) private readonly maintenance: MaintenanceService,
  ) {}

  @Get()
  etat(): Promise<MaintenanceStatus> {
    return this.maintenance.etat();
  }
}

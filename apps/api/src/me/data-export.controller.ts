import { Controller, Get, Inject, Post, Req, UseGuards } from "@nestjs/common";
import type { DataExportRequest } from "@lehno/contracts";
import { AuthGuard } from "../auth/auth.guard.js";
import { DataExportService } from "./data-export.service.js";

type AuthedRequest = { userId: string };

/* L'export de ses données — spec mobile §3.11, spec technique §5.7. */
@Controller("me/data-export")
@UseGuards(AuthGuard)
export class DataExportController {
  // @Inject explicite : voir ProfileController, même contrainte esbuild/vitest.
  constructor(@Inject(DataExportService) private readonly exports: DataExportService) {}

  /* Aucun corps de requête : il n'y a rien à choisir. Un export partiel se
     négocierait champ par champ, et le droit qu'il sert (portabilité,
     politique de confidentialité §8) porte sur l'ensemble. */
  @Post()
  demander(@Req() req: AuthedRequest): Promise<DataExportRequest> {
    return this.exports.demander(req.userId);
  }

  /* L'état de la dernière demande, ou `null`. Rend 200 avec un corps nul
     plutôt que 404 : « vous n'avez jamais demandé d'export » est une réponse,
     pas une absence de ressource — et l'écran affiche un bouton dans les deux
     cas. */
  @Get()
  async derniere(@Req() req: AuthedRequest): Promise<{ request: DataExportRequest | null }> {
    return { request: await this.exports.derniere(req.userId) };
  }
}

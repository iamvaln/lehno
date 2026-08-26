import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import type { Metadata } from "@lehno/contracts";
import { AuthGuard } from "../auth/auth.guard.js";
import { MetadataService } from "./metadata.service.js";

// Pas de @Feature : les métadonnées relèvent du SOCLE, qui n'a pas de
// drapeau (spécification technique §6.3).
@Controller("me/metadata")
@UseGuards(AuthGuard)
export class MetadataController {
  constructor(@Inject(MetadataService) private readonly metadata: MetadataService) {}

  @Get()
  get(): Promise<Metadata> {
    return this.metadata.get();
  }
}

import { Controller, Get, Inject, Param, ParseUUIDPipe, Query, Req, UseGuards } from "@nestjs/common";
import { listOccurrencesQuerySchema, type Occurrence } from "@lehno/contracts";
import { AuthGuard } from "../auth/auth.guard.js";
import { AppError } from "../common/errors.js";
import { OccurrenceService } from "./occurrence.service.js";

type AuthedRequest = { userId: string };

// Pas de @Feature : les dates relèvent du SOCLE, qui n'a pas de drapeau
// (spécification technique §6.3).
@Controller("me/occurrences")
@UseGuards(AuthGuard)
export class OccurrenceController {
  constructor(@Inject(OccurrenceService) private readonly occurrences: OccurrenceService) {}

  // La chaîne de requête ne porte que du texte : `limit` arrive en « 3 », pas
  // en 3. On convertit AVANT de valider, sinon le schéma refuse une valeur
  // parfaitement légitime et le client reçoit un 400 incompréhensible.
  @Get()
  list(
    @Req() req: AuthedRequest,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit") limit?: string,
  ): Promise<Occurrence[]> {
    const analyse = listOccurrencesQuerySchema.safeParse({
      ...(from !== undefined ? { from } : {}),
      ...(to !== undefined ? { to } : {}),
      ...(limit !== undefined ? { limit: Number(limit) } : {}),
    });
    if (!analyse.success) {
      throw new AppError("validation_failed", "invalid occurrences query", {
        query: analyse.error.issues.map((i) => i.message).join(", "),
      });
    }
    return this.occurrences.list(req.userId, analyse.data);
  }

  @Get(":id")
  get(@Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string): Promise<Occurrence> {
    return this.occurrences.get(req.userId, id);
  }
}

import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from "@nestjs/common";
import { createNoteSchema, listOccurrencesQuerySchema, type CreateNoteInput, type Note, type Occurrence } from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { AppError } from "../common/errors.js";
import { OccurrenceService } from "./occurrence.service.js";
import { NoteService } from "./note.service.js";
import { TrackingService } from "../tracking/tracking.service.js";

type AuthedRequest = { userId: string };

// Pas de @Feature : les dates relèvent du SOCLE, qui n'a pas de drapeau
// (spécification technique §6.3).
@Controller("me/occurrences")
@UseGuards(AuthGuard)
export class OccurrenceController {
  constructor(
    @Inject(OccurrenceService) private readonly occurrences: OccurrenceService,
    @Inject(NoteService) private readonly notes: NoteService,
    @Inject(TrackingService) private readonly mesure: TrackingService,
  ) {}

  // La chaîne de requête ne porte que du texte : `limit` arrive en « 3 », pas
  // en 3. On convertit AVANT de valider, sinon le schéma refuse une valeur
  // parfaitement légitime et le client reçoit un 400 incompréhensible.
  @Get()
  list(
    @Req() req: AuthedRequest,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("limit") limit?: string,
    @Query("personId") personId?: string,
  ): Promise<Occurrence[]> {
    const analyse = listOccurrencesQuerySchema.safeParse({
      ...(from !== undefined ? { from } : {}),
      ...(to !== undefined ? { to } : {}),
      ...(limit !== undefined ? { limit: Number(limit) } : {}),
      ...(personId !== undefined ? { personId } : {}),
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

  // Les notes de circonstance : propres à cette occasion, distinctes des
  // durables rendues par /me/persons/{id}/notes.
  @Get(":id/notes")
  listNotes(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<Note[]> {
    return this.notes.listForOccurrence(req.userId, id);
  }

  // 201 : la route rend une ressource neuve, dont le client apprend
  // l'identifiant — Nest applique déjà ce statut par défaut à un POST.
  @Post(":id/notes")
  createNote(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createNoteSchema)) body: CreateNoteInput,
  ): Promise<Note> {
    return this.notes.createForOccurrence(req.userId, id, body).then((note) => {
      this.mesure.emettre(req.userId, "note.created", {
        persons: 1, hasOccasion: true, length: body.content.length, origin: "occasion",
      });
      return note;
    });
  }
}

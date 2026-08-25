import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import { createNoteSchema, type CreateNoteInput, type Note } from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { NoteService } from "./note.service.js";

type AuthedRequest = { userId: string };

// Pas de @Feature ici : les notes relèvent du SOCLE, qui n'a pas de drapeau
// (spécification technique §6.3). S'il s'éteint, il n'y a plus d'application.
@Controller("me/persons/:personId/notes")
@UseGuards(AuthGuard)
export class NoteController {
  constructor(@Inject(NoteService) private readonly notes: NoteService) {}

  @Get()
  list(
    @Req() req: AuthedRequest,
    @Param("personId", ParseUUIDPipe) personId: string,
  ): Promise<Note[]> {
    return this.notes.listForPerson(req.userId, personId);
  }

  // 201 : la route rend une ressource neuve, dont le client apprend
  // l'identifiant. Voir la convention du contrat commun.
  @Post()
  create(
    @Req() req: AuthedRequest,
    @Param("personId", ParseUUIDPipe) personId: string,
    @Body(new ZodValidationPipe(createNoteSchema)) body: CreateNoteInput,
  ): Promise<Note> {
    return this.notes.createForPerson(req.userId, personId, body);
  }
}

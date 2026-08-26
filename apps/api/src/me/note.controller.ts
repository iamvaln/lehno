import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import {
  createNoteSchema, createNotesSchema,
  type CreateNoteInput, type CreateNotesInput, type Note,
} from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { NoteService } from "./note.service.js";
import { TrackingService } from "../tracking/tracking.service.js";

type AuthedRequest = { userId: string };

// Pas de @Feature ici : les notes relèvent du SOCLE, qui n'a pas de drapeau
// (spécification technique §6.3). S'il s'éteint, il n'y a plus d'application.
@Controller("me/persons/:personId/notes")
@UseGuards(AuthGuard)
export class NoteController {
  constructor(
    @Inject(NoteService) private readonly notes: NoteService,
    @Inject(TrackingService) private readonly mesure: TrackingService,
  ) {}

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
    return this.notes.createForPerson(req.userId, personId, body).then((note) => {
      // On compte les caractères, on ne transporte pas le texte (§16.4).
      this.mesure.emettre(req.userId, "note.created", {
        persons: 1,
        hasOccasion: note.eventOccurrenceId !== null,
        length: body.content.length,
        origin: "person",
      });
      return note;
    });
  }
}

// Une note pour PLUSIEURS proches. Son chemin est distinct de celui d'un
// proche donné parce qu'elle n'appartient à aucun d'eux en particulier : la
// loger sous /me/persons/{id}/notes obligerait à en désigner un comme
// propriétaire de l'appel, ce qu'il n'est pas.
@Controller("me/notes")
@UseGuards(AuthGuard)
export class NotesController {
  constructor(
    @Inject(NoteService) private readonly notes: NoteService,
    @Inject(TrackingService) private readonly mesure: TrackingService,
  ) {}

  @Post()
  create(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(createNotesSchema)) body: CreateNotesInput,
  ): Promise<Note[]> {
    return this.notes.createForMany(req.userId, body).then((notes) => {
      // UN événement pour UN fait (§16.2) : une note prise pour trois proches
      // est un geste, pas trois. Émettre par proche gonflerait le volume de
      // capture et ferait croire à une fréquence qui n'existe pas.
      this.mesure.emettre(req.userId, "note.created", {
        persons: notes.length,
        hasOccasion: body.eventOccurrenceId !== undefined,
        length: body.content.length,
        origin: "home",
      });
      return notes;
    });
  }
}

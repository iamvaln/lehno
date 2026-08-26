import {
  Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Query, Req,
  UseGuards,
} from "@nestjs/common";
import {
  createEventSchema, updateEventSchema, listEventsQuerySchema,
  type CreateEventInput, type UpdateEventInput, type Event as EventContrat,
} from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { AppError } from "../common/errors.js";
import { EventService } from "./event.service.js";
import { TrackingService } from "../tracking/tracking.service.js";

type AuthedRequest = { userId: string };

// Pas de @Feature : les dates relèvent du SOCLE, qui n'a pas de drapeau
// (spécification technique §6.3).
@Controller("me/events")
@UseGuards(AuthGuard)
export class EventController {
  constructor(
    @Inject(EventService) private readonly events: EventService,
    @Inject(TrackingService) private readonly mesure: TrackingService,
  ) {}

  // `personId` sert la fiche d'un proche (maquette §3.4) ; sans lui, le chemin
  // rend l'annuaire complet, comme avant.
  @Get()
  list(
    @Req() req: AuthedRequest,
    @Query("personId") personId?: string,
  ): Promise<EventContrat[]> {
    const analyse = listEventsQuerySchema.safeParse(
      personId !== undefined ? { personId } : {},
    );
    if (!analyse.success) {
      throw new AppError("validation_failed", "invalid events query", {
        query: analyse.error.issues.map((i) => i.message).join(", "),
      });
    }
    return this.events.list(req.userId, analyse.data);
  }

  @Post()
  create(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(createEventSchema)) body: CreateEventInput,
  ): Promise<EventContrat> {
    return this.events.create(req.userId, body).then((e) => {
      // « jalons multiples ou non » (§16.3) : c'est le nombre de règles qui le
      // dit, et c'est ce qui distingue un anniversaire d'un suivi à échéances.
      this.mesure.emettre(req.userId, "event.created", {
        kind: e.kind,
        scheduleCount: body.schedules?.length ?? 0,
      });
      return e;
    });
  }

  @Get(":id")
  get(@Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string): Promise<EventContrat> {
    return this.events.get(req.userId, id);
  }

  @Patch(":id")
  update(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateEventSchema)) body: UpdateEventInput,
  ): Promise<EventContrat> {
    return this.events.update(req.userId, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.events.remove(req.userId, id);
  }
}

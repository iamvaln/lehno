import {
  Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards,
} from "@nestjs/common";
import {
  createEventSchema, updateEventSchema,
  type CreateEventInput, type UpdateEventInput, type Event as EventContrat,
} from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { EventService } from "./event.service.js";

type AuthedRequest = { userId: string };

// Pas de @Feature : les dates relèvent du SOCLE, qui n'a pas de drapeau
// (spécification technique §6.3).
@Controller("me/events")
@UseGuards(AuthGuard)
export class EventController {
  constructor(@Inject(EventService) private readonly events: EventService) {}

  @Get()
  list(@Req() req: AuthedRequest): Promise<EventContrat[]> {
    return this.events.list(req.userId);
  }

  @Post()
  create(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(createEventSchema)) body: CreateEventInput,
  ): Promise<EventContrat> {
    return this.events.create(req.userId, body);
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

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { createPersonSchema, updatePersonSchema, type CreatePersonInput, type Person, type UpdatePersonInput } from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { Feature } from "../flags/feature.decorator.js";
import { FeatureGuard } from "../flags/feature.guard.js";
import { PersonService } from "./person.service.js";

// Posé par AuthGuard : req.userId. Type minimal, comme ProfileController.
type AuthedRequest = { userId: string };

@Controller("me/persons")
// FeatureGuard AVANT AuthGuard : une surface éteinte l'est pour tout le
// monde, jeton valable ou pas. Dans l'autre ordre, le statut distinguerait
// « éteinte » de « non authentifiée » et raconterait qu'elle existe.
@UseGuards(FeatureGuard, AuthGuard)
@Feature("me.persons")
export class PersonController {
  constructor(@Inject(PersonService) private readonly persons: PersonService) {}

  @Get()
  list(@Req() req: AuthedRequest): Promise<Person[]> {
    return this.persons.list(req.userId);
  }

  @Post()
  create(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(createPersonSchema)) body: CreatePersonInput,
  ): Promise<Person> {
    return this.persons.create(req.userId, body);
  }

  @Get(":id")
  get(@Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string): Promise<Person> {
    return this.persons.get(req.userId, id);
  }

  @Patch(":id")
  update(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updatePersonSchema)) body: UpdatePersonInput,
  ): Promise<Person> {
    return this.persons.update(req.userId, id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.persons.remove(req.userId, id);
  }
}

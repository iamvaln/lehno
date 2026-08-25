import { Body, Controller, Get, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { createPersonSchema, type CreatePersonInput, type Person } from "@lehno/contracts";
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
}

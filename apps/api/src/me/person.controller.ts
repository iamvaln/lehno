import { Body, Controller, Get, Inject, Post, Req, UseGuards } from "@nestjs/common";
import { createPersonSchema, type CreatePersonInput, type Person } from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { PersonService } from "./person.service.js";

// Posé par AuthGuard : req.userId. Type minimal, comme ProfileController.
type AuthedRequest = { userId: string };

@Controller("me/persons")
@UseGuards(AuthGuard)
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

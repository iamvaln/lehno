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
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  createPersonSchema, updatePersonSchema, listPersonsQuerySchema,
  type CreatePersonInput, type Person, type PersonList, type UpdatePersonInput,
} from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { AppError } from "../common/errors.js";
import { PersonService } from "./person.service.js";

// Posé par AuthGuard : req.userId. Type minimal, comme ProfileController.
type AuthedRequest = { userId: string };

@Controller("me/persons")
// Pas de @Feature ici : les proches relèvent du SOCLE, qui n'a pas de drapeau
// (spécification technique §6.3). Un interrupteur dessus ne servirait qu'à
// casser le produit — s'il s'éteint, il n'y a plus d'application.
//
// Un drapeau « me.persons » avait été posé ici avant que la règle ne soit
// écrite ; il a été retiré. Voir le test du registre, qui interdit désormais
// qu'une clé du socle y réapparaisse.
@UseGuards(AuthGuard)
export class PersonController {
  constructor(@Inject(PersonService) private readonly persons: PersonService) {}

  // La chaîne de requête ne porte que du texte : `offset` arrive en « 20 », pas
  // en 20. On convertit AVANT de valider, comme sur /me/occurrences — sinon le
  // schéma refuse une valeur légitime et le client reçoit un 400 opaque.
  @Get()
  list(
    @Req() req: AuthedRequest,
    @Query("sort") sort?: string,
    @Query("direction") direction?: string,
    @Query("offset") offset?: string,
    @Query("limit") limit?: string,
  ): Promise<PersonList> {
    const analyse = listPersonsQuerySchema.safeParse({
      ...(sort !== undefined ? { sort } : {}),
      ...(direction !== undefined ? { direction } : {}),
      ...(offset !== undefined ? { offset: Number(offset) } : {}),
      ...(limit !== undefined ? { limit: Number(limit) } : {}),
    });
    if (!analyse.success) {
      throw new AppError("validation_failed", "invalid persons query", {
        query: analyse.error.issues.map((i) => i.message).join(", "),
      });
    }
    return this.persons.list(req.userId, analyse.data);
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

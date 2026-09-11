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
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  createPersonSchema, updatePersonSchema, listPersonsQuerySchema, selfPersonSchema,
  type CreatePersonInput, type Person, type PersonAttributes, type PersonList, type UpdatePersonInput,
  type SelfPersonInput,
} from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { AppError } from "../common/errors.js";
import { AttributsService } from "./attributs.service.js";
import { PersonService } from "./person.service.js";
import { TrackingService } from "../tracking/tracking.service.js";

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
  constructor(
    @Inject(PersonService) private readonly persons: PersonService,
    @Inject(TrackingService) private readonly mesure: TrackingService,
    @Inject(AttributsService) private readonly attributs_: AttributsService,
  ) {}

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
    @Query("q") q?: string,
  ): Promise<PersonList> {
    const analyse = listPersonsQuerySchema.safeParse({
      ...(sort !== undefined ? { sort } : {}),
      ...(direction !== undefined ? { direction } : {}),
      ...(offset !== undefined ? { offset: Number(offset) } : {}),
      ...(limit !== undefined ? { limit: Number(limit) } : {}),
      ...(q !== undefined ? { q } : {}),
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
    return this.persons.create(req.userId, body).then((proche) => {
      this.mesure.emettre(req.userId, "person.created", {
        origin: "manual",
        hasBirthDate: proche.birthDate !== null,
      });
      // `person.first_created` marque LE passage à l'usage (§16.3). Le total
      // vient de la liste, qui compte tout le carnet : le premier proche est
      // celui après lequel le total vaut un. Le déduire du carnet plutôt que
      // de tenir un drapeau sur le compte évite un état de plus à maintenir.
      if (proche.notesCount === 0) {
        void this.persons.list(req.userId, { limit: 1 }).then((carnet) => {
          if (carnet.total === 1) this.mesure.emettre(req.userId, "person.first_created", {});
        });
      }
      return proche;
    });
  }

  @Get(":id")
  get(@Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string): Promise<Person> {
    return this.persons.get(req.userId, id);
  }

  /* Le topo, sur son propre chemin plutôt que dans la fiche.
   *
   * La fiche se lit à chaque ouverture d'écran ; le topo ne bouge qu'au rythme
   * des notes. Les servir ensemble ferait payer une jointure de plus au chemin
   * le plus fréquenté du carnet, pour une donnée qui n'a pas changé. */
  @Get(":id/attributes")
  async attributs(
    @Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string,
  ): Promise<PersonAttributes> {
    const lignes = await this.attributs_.lister(req.userId, id);
    return {
      attributes: lignes.map((a) => ({
        kind: a.kind, value: a.value, noteId: a.noteId,
        observedAt: a.observedAt.toISOString().slice(0, 10),
      })),
    };
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

/* LA FICHE DE SOI, SUR SON PROPRE CHEMIN.
 *
 * Pas `GET /me/persons/self` : `@Get(":id")` du carnet capterait « self » avant
 * lui — Nest résout dans l'ordre de déclaration, et le mot passerait alors au
 * `ParseUUIDPipe`, qui rendrait un 400 sur une route qui existe. Un chemin à
 * part met la question hors de portée plutôt que de la régler par un ordre de
 * lignes que le premier refactor défera.
 *
 * Pas de `@Feature` non plus : sa propre fiche relève du socle, comme le
 * carnet. */
@Controller("me/self")
@UseGuards(AuthGuard)
export class SelfPersonController {
  constructor(@Inject(PersonService) private readonly persons: PersonService) {}

  /* 404 QUAND ELLE N'EXISTE PAS, plutôt qu'un corps nul. Un écran qui reçoit
     `null` doit distinguer « pas encore répondu » de « champ vide » ; un statut
     le dit sans que personne ait à l'interpréter, et c'est la forme qu'a déjà
     toute lecture d'une ressource absente dans cette API. */
  @Get()
  async lire(@Req() req: AuthedRequest): Promise<Person> {
    const fiche = await this.persons.lireSoi(req.userId);
    if (fiche === null) throw new AppError("not_found", "resource not found");
    return fiche;
  }

  /* `PUT` et non `POST` : on ne crée pas sa propre fiche, on dit qui on est.
     Rejouer l'appel doit donner le même état, et c'est ce que le verbe promet
     — l'application n'a donc pas à lire avant d'écrire. */
  @Put()
  ecrire(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(selfPersonSchema)) body: SelfPersonInput,
  ): Promise<Person> {
    return this.persons.ecrireSoi(req.userId, body);
  }
}

import { Inject, Injectable } from "@nestjs/common";
import type { Event, EventOccurrence, Note, Person, WishlistItem } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";

// Message unique : hors périmètre et inexistant doivent être indistinguables.
const ABSENT = (): AppError => new AppError("not_found", "resource not found");

type Delegate = {
  findMany(a: { where: object }): Promise<unknown[]>;
  findFirst(a: { where: object }): Promise<unknown | null>;
  updateMany(a: { where: object; data: object }): Promise<{ count: number }>;
  deleteMany(a: { where: object }): Promise<{ count: number }>;
};

// Revue tour 1, point 2 : une colonne d'appartenance (celle qui détermine le
// périmètre — `userId` sur les tables directement rattachées à un compte,
// la clé étrangère vers le parent sur les autres) ne doit jamais pouvoir se
// réassigner via `updateOrThrow`, même si le `where` reste correctement
// filtré. Le typage l'attrape à la compilation (`Omit<T, F | "id">`) ; cette
// garde attrape ce qu'un contournement du typage (`as never`, `any`) laisse
// passer.
function assertNoOwnershipKey(data: object, forbidden: readonly string[]): void {
  for (const key of forbidden) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      throw new AppError(
        "validation_failed",
        `cannot reassign ownership column "${key}" through a scoped update`,
      );
    }
  }
}

class Scope<T extends Record<string, unknown>, F extends keyof T & string> {
  constructor(
    private readonly delegate: Delegate,
    private readonly scope: object,
    private readonly forbidden: readonly F[],
  ) {}

  // Revue tour 1, point 1 : combiner par étalement (`{ ...scope, ...where }`)
  // laisse une clé de l'appelant, écrite en second, supplanter le périmètre —
  // ce qui l'annule entièrement puisque rien n'empêche l'appelant de choisir
  // cette clé. `AND` rend les deux conditions inécrasables : aucune clé du
  // `where` ne peut plus remplacer une clé du périmètre, seulement le
  // restreindre. Deux conditions contradictoires (le périmètre visant un
  // compte, le `where` en visant un autre) ne rendent alors rien, au lieu de
  // laisser gagner la dernière écrite.
  findMany(where: object = {}): Promise<T[]> {
    return this.delegate.findMany({ where: { AND: [this.scope, where] } }) as Promise<T[]>;
  }

  async findOrThrow(id: string): Promise<T> {
    const row = await this.delegate.findFirst({ where: { AND: [this.scope, { id }] } });
    if (!row) throw ABSENT();
    return row as T;
  }

  // updateMany plutôt que update : le filtre de périmètre entre dans le WHERE,
  // donc une ressource d'autrui donne count = 0 au lieu d'être modifiée.
  async updateOrThrow(id: string, data: Partial<Omit<T, F | "id">>): Promise<T> {
    assertNoOwnershipKey(data, this.forbidden);
    const { count } = await this.delegate.updateMany({ where: { AND: [this.scope, { id }] }, data });
    if (count === 0) throw ABSENT();
    return this.findOrThrow(id);
  }

  async deleteOrThrow(id: string): Promise<void> {
    const { count } = await this.delegate.deleteMany({ where: { AND: [this.scope, { id }] } });
    if (count === 0) throw ABSENT();
  }
}

@Injectable()
export class TenantRepository {
  // @Inject explicite : voir TokenService/OtpService — sous vitest/esbuild,
  // design:paramtypes n'est pas émis, un paramètre typé sans jeton explicite
  // se résoudrait à `undefined` chez Nest.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  persons(userId: string) {
    return new Scope<Person, "userId">(this.prisma.person as never, { userId }, ["userId"]);
  }
  occurrences(userId: string) {
    return new Scope<EventOccurrence, "userId">(this.prisma.eventOccurrence as never, { userId }, ["userId"]);
  }
  // Event et Note se rattachent au propriétaire par leur parent, non par une
  // colonne directe : la colonne d'appartenance à protéger est donc la clé
  // étrangère vers ce parent (personId), pas userId.
  events(userId: string) {
    return new Scope<Event, "personId">(this.prisma.event as never, { person: { userId } }, ["personId"]);
  }
  notes(userId: string) {
    return new Scope<Note, "personId">(this.prisma.note as never, { person: { userId } }, ["personId"]);
  }
  wishes(userId: string) {
    return new Scope<WishlistItem, "eventOccurrenceId">(
      this.prisma.wishlistItem as never, { occurrence: { userId } }, ["eventOccurrenceId"],
    );
  }
}

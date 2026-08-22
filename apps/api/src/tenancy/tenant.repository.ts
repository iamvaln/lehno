import { Inject, Injectable } from "@nestjs/common";
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

class Scope<T> {
  constructor(private readonly delegate: Delegate, private readonly scope: object) {}

  findMany(where: object = {}): Promise<T[]> {
    return this.delegate.findMany({ where: { ...this.scope, ...where } }) as Promise<T[]>;
  }

  async findOrThrow(id: string): Promise<T> {
    const row = await this.delegate.findFirst({ where: { ...this.scope, id } });
    if (!row) throw ABSENT();
    return row as T;
  }

  // updateMany plutôt que update : le filtre de périmètre entre dans le WHERE,
  // donc une ressource d'autrui donne count = 0 au lieu d'être modifiée.
  async updateOrThrow(id: string, data: object): Promise<T> {
    const { count } = await this.delegate.updateMany({ where: { ...this.scope, id }, data });
    if (count === 0) throw ABSENT();
    return this.findOrThrow(id);
  }

  async deleteOrThrow(id: string): Promise<void> {
    const { count } = await this.delegate.deleteMany({ where: { ...this.scope, id } });
    if (count === 0) throw ABSENT();
  }
}

@Injectable()
export class TenantRepository {
  // @Inject explicite : voir TokenService/OtpService — sous vitest/esbuild,
  // design:paramtypes n'est pas émis, un paramètre typé sans jeton explicite
  // se résoudrait à `undefined` chez Nest.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  persons(userId: string) { return new Scope<any>(this.prisma.person as never, { userId }); }
  occurrences(userId: string) { return new Scope<any>(this.prisma.eventOccurrence as never, { userId }); }
  // Event et Note se rattachent au propriétaire par leur parent, non par une colonne.
  events(userId: string) { return new Scope<any>(this.prisma.event as never, { person: { userId } }); }
  notes(userId: string) { return new Scope<any>(this.prisma.note as never, { person: { userId } }); }
  wishes(userId: string) {
    return new Scope<any>(this.prisma.wishlistItem as never, { occurrence: { userId } });
  }
}

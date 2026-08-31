import { Inject, Injectable } from "@nestjs/common";
import type { Event, EventOccurrence, Note, Notification, Person, WishlistItem } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";

// Message unique : hors périmètre et inexistant doivent être indistinguables.
const ABSENT = (): AppError => new AppError("not_found", "resource not found");

// Ce que la lecture peut demander EN PLUS du filtre : un ordre, un plafond, un
// curseur. Ces options ne touchent pas au `where`, donc elles ne peuvent pas
// desserrer le périmètre — c'est la seule raison pour laquelle on accepte de
// les laisser traverser telles quelles.
type OptionsLecture = {
  orderBy?: object | object[];
  take?: number;
  cursor?: object;
  skip?: number;
};

type Delegate = {
  create(a: { data: object }): Promise<unknown>;
  findMany(a: { where: object } & OptionsLecture): Promise<unknown[]>;
  findFirst(a: { where: object }): Promise<unknown | null>;
  count(a: { where: object }): Promise<number>;
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
  // La création porte le même risque que `updateOrThrow` : laisser l'appelant
  // choisir à qui la ressource appartient. La parade diffère, parce qu'il n'y a
  // rien à filtrer — le périmètre s'écrit APRÈS les données fournies, donc une
  // clé d'appartenance glissée par l'appelant est écrasée, jamais honorée.
  //
  // On n'échoue pas sur une clé interdite ici, contrairement à la mise à jour :
  // un appelant qui répète `userId: <le sien>` ne fait rien de mal, et un
  // service qui compose ses données depuis un objet plus large ne devrait pas
  // avoir à les élaguer. Ce qui compte est qu'il ne puisse pas GAGNER.
  // `async` à dessein : la garde ci-dessous lève, et un refus synchrone
  // échapperait au `try` d'un appelant qui entoure son `await`. Une méthode qui
  // rend une promesse doit refuser par une promesse.
  async create(data: object): Promise<T> {
    // Toutes les portées ne se prêtent pas à la création. `events`, `notes` et
    // `wishes` filtrent par RELATION — { person: { userId } } — parce que leur
    // appartenance passe par un parent. Étalée dans les données, cette forme
    // deviendrait une écriture imbriquée : Prisma tenterait de créer une
    // personne, ou écrirait quelque chose que personne n'a voulu.
    //
    // On refuse donc franchement, avant d'atteindre la base. Ces ressources se
    // créent en vérifiant d'abord le parent par findOrThrow, puis en écrivant
    // avec sa clé — c'est ce que fait NoteService.
    const valeurs = Object.values(this.scope);
    if (valeurs.some((v) => typeof v === "object" && v !== null)) {
      throw new AppError(
        "internal_error",
        "cette portée filtre par relation : créer par le parent, pas par le périmètre",
      );
    }

    // Le périmètre s'écrit APRÈS les données fournies : une clé d'appartenance
    // glissée par l'appelant est écrasée, jamais honorée. On n'échoue pas
    // dessus, contrairement à la mise à jour — répéter son propre identifiant
    // n'est pas une faute. Ce qui compte est qu'il ne puisse pas GAGNER.
    return (await this.delegate.create({ data: { ...data, ...this.scope } })) as T;
  }

  // L'ordre, le plafond et le curseur passent à côté du `where` : ils sont
  // fournis en paramètre SÉPARÉ, jamais fondus dans le filtre. Une liste
  // paginée sans eux obligerait l'appelant à lire tous ses identifiants pour
  // n'en garder que vingt — ce que fait OccurrenceService, et qui n'est
  // tenable que parce que ses volumes sont bornés par le carnet.
  findMany(where: object = {}, options: OptionsLecture = {}): Promise<T[]> {
    return this.delegate.findMany({ where: { AND: [this.scope, where] }, ...options }) as Promise<T[]>;
  }

  count(where: object = {}): Promise<number> {
    return this.delegate.count({ where: { AND: [this.scope, where] } });
  }

  /* La mise à jour EN MASSE d'un ensemble décrit par un filtre — le geste que
     `updateOrThrow` ne couvre pas, parce qu'il vise un identifiant.
     Elle rend le nombre de lignes touchées et ne lève PAS sur zéro : le seul
     appelant d'aujourd'hui (marquer des notifications comme lues) veut
     précisément que rejouer l'appel ne soit pas une erreur.
     Même garde d'appartenance que `updateOrThrow` : le périmètre entre dans le
     `AND`, donc la ligne d'autrui n'est pas atteinte, et la colonne
     d'appartenance ne peut pas se réassigner. */
  async updateWhere(where: object, data: Partial<Omit<T, F | "id">>): Promise<number> {
    assertNoOwnershipKey(data, this.forbidden);
    const { count } = await this.delegate.updateMany({
      where: { AND: [this.scope, where] },
      data,
    });
    return count;
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
  // La notification appartient DIRECTEMENT au compte : pas de parent à faire
  // hériter, la colonne d'appartenance est `userId`.
  notifications(userId: string) {
    return new Scope<Notification, "userId">(this.prisma.notification as never, { userId }, ["userId"]);
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

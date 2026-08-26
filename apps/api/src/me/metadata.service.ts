import { Inject, Injectable } from "@nestjs/common";
import type { CategoryCode, Metadata } from "@lehno/contracts";
import {
  EVENT_KINDS, EVENT_NATURES, SCHEDULE_UNITS,
  PERSON_RELATIONS, PERSON_REGISTERS, PERSON_GENDERS, CONTACT_CHANNELS,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class MetadataService {
  // @Inject explicite : voir HomeService/OccurrenceService, même contrainte
  // esbuild/vitest — design:paramtypes n'est pas émis, un paramètre typé sans
  // jeton explicite se résoudrait à `undefined` chez Nest.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(): Promise<Metadata> {
    // La SEULE valeur lue en base : `kind` et `isConstraint` ne se déduisent
    // d'aucune énumération, et c'est la raison d'être de ce point d'entrée.
    // La table est semée par la migration `20260822154334_content` — jamais
    // recopiée en constante, qui finirait par diverger de ce qu'elle écrit
    // réellement.
    const rangees = await this.prisma.category.findMany({
      orderBy: { code: "asc" },
      select: { code: true, kind: true, isConstraint: true },
    });
    // `code` est un VARCHAR en base — rien n'y garantit à la compilation
    // qu'elle ne porte que les sept codes du socle. C'est le prix d'une table
    // éditable en administration plutôt que d'une énumération figée ; la
    // sélection ci-dessus, elle, est bien exhaustive.
    const categories = rangees.map((r) => ({ ...r, code: r.code as CategoryCode }));

    return {
      categories,
      // Le reste est figé, servi avec les catégories pour que le client
      // n'aille pas chercher la même chose à deux endroits.
      eventKinds: [...EVENT_KINDS],
      eventNatures: [...EVENT_NATURES],
      scheduleUnits: [...SCHEDULE_UNITS],
      personRelations: [...PERSON_RELATIONS],
      personRegisters: [...PERSON_REGISTERS],
      personGenders: [...PERSON_GENDERS],
      contactChannels: [...CONTACT_CHANNELS],
    };
  }
}

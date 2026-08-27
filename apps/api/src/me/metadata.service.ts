import { Inject, Injectable } from "@nestjs/common";
import type { CategoryCode, Metadata } from "@lehno/contracts";
import {
  EVENT_KINDS, EVENT_NATURES, SCHEDULE_UNITS,
  PERSON_RELATIONS, PERSON_REGISTERS, CONTACT_CHANNELS,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { FlagsService } from "../flags/flags.service.js";

@Injectable()
export class MetadataService {
  // @Inject explicite : voir HomeService/OccurrenceService, même contrainte
  // esbuild/vitest — design:paramtypes n'est pas émis, un paramètre typé sans
  // jeton explicite se résoudrait à `undefined` chez Nest.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FlagsService) private readonly flags: FlagsService,
  ) {}

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
      //
      // SAUF les types d'événement, filtrés par `events.other`. C'est ce qui
      // dispense le client de connaître le drapeau : l'écran de §3.6 propose
      // ce que cette liste contient, et le choix « autre type » disparaît de
      // lui-même. Le contrat commun l'exige — « le client ne décide de rien ».
      eventKinds: await this.typesOuverts(),
      eventNatures: [...EVENT_NATURES],
      scheduleUnits: [...SCHEDULE_UNITS],
      personRelations: [...PERSON_RELATIONS],
      personRegisters: [...PERSON_REGISTERS],
      contactChannels: [...CONTACT_CHANNELS],
    };
  }

  private async typesOuverts(): Promise<Metadata["eventKinds"]> {
    // L'anniversaire relève du SOCLE et ne s'éteint jamais : sans lui il n'y a
    // plus de produit, et un interrupteur dessus ne servirait qu'à le casser.
    if (await this.flags.estActif("events.other")) return [...EVENT_KINDS];
    return EVENT_KINDS.filter((k) => k === "birthday");
  }
}

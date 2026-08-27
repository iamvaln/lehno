import { Inject, Injectable } from "@nestjs/common";
import {
  CONFIGURABLE_NOTIFICATION_TYPES,
  type NotificationPreferences, type UpdateNotificationPreferencesInput,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class NotificationPreferencesService {
  // @Inject explicite : voir ProfileService, même contrainte esbuild/vitest.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // Filtre sur `userId` : c'est tout le cloisonnement dont cette table a
  // besoin (pas de TenantRepository — la ligne appartient directement au
  // demandeur, il n'y a rien à faire hériter d'une portée plus haut).
  async get(userId: string): Promise<NotificationPreferences> {
    const [lignes, compte] = await Promise.all([
      this.prisma.notificationPreference.findMany({
        where: { userId, type: { in: [...CONFIGURABLE_NOTIFICATION_TYPES] } },
      }),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { digestFrequency: true } }),
    ]);
    const parType = new Map(lignes.map((l) => [l.type, l]));

    return {
      // TOUS les types configurables, même ceux sans ligne : une ligne
      // absente vaut le défaut (poussée et courriel activés, §3.11), et
      // c'est le serveur qui le sait — le client n'a pas à le deviner ni à
      // le coder en dur.
      preferences: CONFIGURABLE_NOTIFICATION_TYPES.map((type) => {
        const ligne = parType.get(type);
        return {
          type,
          pushEnabled: ligne?.pushEnabled ?? true,
          emailEnabled: ligne?.emailEnabled ?? true,
        };
      }),
      digestFrequency: compte.digestFrequency,
    };
  }

  async update(userId: string, patch: UpdateNotificationPreferencesInput): Promise<NotificationPreferences> {
    // Une transaction : soit tout l'écran se pose, soit rien. Un écran de
    // réglages coupé en deux (les canaux posés, la fréquence perdue par une
    // panne entre les deux écritures) est un défaut silencieux qu'on ne
    // remarque qu'à l'usage.
    await this.prisma.$transaction(async (tx) => {
      // Pas de createMany/updateMany en une passe : chaque ligne a sa propre
      // clé composite, et le nombre de types configurables (une dizaine) ne
      // justifie pas la requête brute qu'exigerait un upsert de masse.
      for (const preference of patch.preferences ?? []) {
        await tx.notificationPreference.upsert({
          where: { userId_type: { userId, type: preference.type } },
          create: { userId, ...preference },
          update: { pushEnabled: preference.pushEnabled, emailEnabled: preference.emailEnabled },
        });
      }
      if (patch.digestFrequency) {
        await tx.user.update({ where: { id: userId }, data: { digestFrequency: patch.digestFrequency } });
      }
    });
    return this.get(userId);
  }
}

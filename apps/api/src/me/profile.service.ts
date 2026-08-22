import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import type { Profile, UpdateProfileInput } from "@lehno/contracts";

const SELECT = {
  id: true, username: true, displayName: true, avatarUrl: true, email: true,
  emailVerified: true, uiLanguage: true, theme: true, timezone: true, sendHour: true,
} as const;

@Injectable()
export class ProfileService {
  // @Inject(PrismaService) explicite : sous vitest/esbuild, design:paramtypes
  // n'est pas émis (pas de support d'emitDecoratorMetadata), donc un
  // paramètre typé sans jeton explicite se résout à `undefined` chez Nest.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<Profile> {
    return (await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: SELECT })) as Profile;
  }

  // La colonne est en citext : la comparaison est déjà insensible à la casse.
  async usernameAvailable(username: string, forUserId: string): Promise<boolean> {
    const taken = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
    return !taken || taken.id === forUserId;
  }

  async update(userId: string, patch: UpdateProfileInput): Promise<Profile> {
    if (patch.username && !(await this.usernameAvailable(patch.username, userId)))
      throw new AppError("username_taken", "username already in use");
    // `patch` vient d'un schéma `.partial()` : les clés absentes de la
    // requête n'y figurent simplement pas (zod ne les pose jamais à
    // `undefined`). `exactOptionalPropertyTypes` exige malgré tout ce cast —
    // le type généré par zod porte `| undefined` sur chaque valeur
    // optionnelle, plus large que celui, plus strict, que Prisma attend.
    return (await this.prisma.user.update({
      where: { id: userId }, data: patch as Prisma.UserUpdateInput, select: SELECT,
    })) as Profile;
  }
}

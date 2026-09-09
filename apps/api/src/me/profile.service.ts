import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import type { StockagePort } from "../stockage/stockage.port.js";
import { AppError } from "../common/errors.js";
import type { Profile, UpdateProfileInput } from "@lehno/contracts";

const SELECT = {
  id: true, username: true, displayName: true, avatarKey: true, email: true,
  emailVerified: true, uiLanguage: true, theme: true, timezone: true, sendHour: true,
  // L'accord grammatical de celui qui SIGNE — « je suis fier » ou « fière ».
  // Voir profileSchema : nul tant qu'il n'a pas répondu, l'inscription par code
  // ne posant aucune question.
  gender: true,
} as const;

@Injectable()
export class ProfileService {
  // @Inject(PrismaService) explicite : sous vitest/esbuild, design:paramtypes
  // n'est pas émis (pas de support d'emitDecoratorMetadata), donc un
  // paramètre typé sans jeton explicite se résout à `undefined` chez Nest.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject("STOCKAGE_PORT") private readonly stockage: StockagePort,
  ) {}

  async get(userId: string): Promise<Profile> {
    return this.rendre(await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: SELECT }));
  }

  // La colonne est en citext : la comparaison est déjà insensible à la casse.
  async usernameAvailable(username: string, forUserId: string): Promise<boolean> {
    const taken = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
    return !taken || taken.id === forUserId;
  }

  /* `unspecified` et `other` existent encore en colonne — un compte créé avant
     que le profil ne pose la question. Le contrat n'en connaît que deux et rend
     NULL : une absence de réponse est une absence, pas une troisième réponse.

     `avatarUrl` SE SIGNE ICI, à chaque lecture, depuis la clé rangée en base.
     Une URL présignée expire : la ranger donnerait des liens morts, et un
     compartiment public laisserait un lien partagé une fois ouvert pour
     toujours. */
  private async rendre(u: { gender: string | null; avatarKey: string | null }): Promise<Profile> {
    /* `avatarKey` ne SORT PAS : le contrat est `.strict()`, et surtout la clé
       n'a rien à faire chez le client — il ne doit jamais pouvoir la nommer. */
    const { avatarKey, ...reste } = u;
    return {
      ...(reste as unknown as Profile),
      gender: u.gender === "female" || u.gender === "male" ? u.gender : null,
      avatarUrl: avatarKey === null ? null : await this.stockage.lire(avatarKey),
    };
  }

  async update(userId: string, patch: UpdateProfileInput): Promise<Profile> {
    if (patch.username && !(await this.usernameAvailable(patch.username, userId)))
      throw new AppError("username_taken", "username already in use");
    // `patch` vient d'un schéma `.partial()` : les clés absentes de la
    // requête n'y figurent simplement pas (zod ne les pose jamais à
    // `undefined`). `exactOptionalPropertyTypes` exige malgré tout ce cast —
    // le type généré par zod porte `| undefined` sur chaque valeur
    // optionnelle, plus large que celui, plus strict, que Prisma attend.
    return this.rendre(await this.prisma.user.update({
      where: { id: userId }, data: patch as Prisma.UserUpdateInput, select: SELECT,
    }));
  }
}



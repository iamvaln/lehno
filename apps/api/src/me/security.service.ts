import { Inject, Injectable } from "@nestjs/common";
import type { ExternalIdentity, SessionSummary } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { TokenService } from "../auth/token.service.js";

type Ligne = { familyId: string; createdAt: Date; expiresAt: Date; userAgent: string | null };

@Injectable()
export class SecurityService {
  // @Inject explicite : voir TokenService/ProfileService — sous vitest/esbuild,
  // design:paramtypes n'est pas émis, un paramètre typé sans jeton explicite
  // se résoudrait à `undefined` chez Nest.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TokenService) private readonly tokens: TokenService,
  ) {}

  // Une SESSION est une lignée (familyId), pas un jeton : chaque
  // rafraîchissement crée un jeton enfant dans la même lignée, et lister les
  // jetons montrerait vingt lignes pour un seul téléphone resté ouvert deux
  // mois. On regroupe donc en mémoire — la table reste petite par compte, et
  // Prisma ne sait pas grouper tout en gardant le premier ET le dernier d'un
  // même groupe en une seule requête.
  //
  // Ni `ip` ni géolocalisation ne sont sélectionnées : voir le commentaire de
  // sessionSummarySchema (packages/contracts/src/me-security.ts) — l'adresse
  // sert aux investigations, pas à l'affichage, et rien ne la traduit
  // honnêtement en lieu pour l'instant.
  async listSessions(userId: string): Promise<SessionSummary[]> {
    const rows: Ligne[] = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: "asc" },
      select: { familyId: true, createdAt: true, expiresAt: true, userAgent: true },
    });

    const lignees = new Map<string, Ligne[]>();
    for (const row of rows) {
      const groupe = lignees.get(row.familyId);
      if (groupe) groupe.push(row);
      else lignees.set(row.familyId, [row]);
    }

    const maintenant = Date.now();
    const sessions: SessionSummary[] = [];
    for (const groupe of lignees.values()) {
      // Chaque jeton garde son propre expiresAt (soixante jours depuis SA
      // propre émission) : celui qui dit si la lignée vaut encore comme
      // session ouverte est celui du jeton le plus RÉCENT, pas du premier —
      // une lignée vieille de six mois mais rafraîchie hier reste ouverte.
      const dernier = groupe[groupe.length - 1]!;
      if (dernier.expiresAt.getTime() < maintenant) continue;
      sessions.push({
        id: dernier.familyId,
        createdAt: groupe[0]!.createdAt.toISOString(),
        lastActiveAt: dernier.createdAt.toISOString(),
        userAgent: dernier.userAgent,
      });
    }

    // La plus récemment active en tête : « connexions récentes » répond
    // d'abord à « qu'est-ce qui s'est connecté ces derniers temps ».
    sessions.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));
    return sessions;
  }

  // Voir TokenService.revokeAllForUser pour la décision sur l'appareil
  // courant : il tombe aussi, faute de moyen de le distinguer des autres.
  logoutEverywhere(userId: string, sauf: string | null): Promise<void> {
    return this.tokens.revokeAllForUser(userId, sauf);
  }

  // Les moyens de connexion EXTERNES seulement (§3.24) : la connexion par
  // e-mail et code n'a pas de ligne en base — elle est toujours active et ne
  // se détache pas, l'écran l'affiche sans appeler le serveur pour ça.
  async listIdentities(userId: string): Promise<ExternalIdentity[]> {
    const rows = await this.prisma.federatedIdentity.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { provider: true, createdAt: true, lastUsedAt: true },
    });
    return rows.map((r) => ({
      provider: r.provider,
      linkedAt: r.createdAt.toISOString(),
      lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
    }));
  }
}

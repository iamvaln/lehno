import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "./errors.js";

// Purge : « une table de compteurs grossit sans fin ». purgeOlderThan()
// est une méthode opportuniste plutôt qu'un déclenchement automatique
// interne — ce service n'a pas de notion de planification, et la tâche 21
// (traitements programmés) est le point naturel pour l'appeler
// périodiquement. Elle reste néanmoins exploitable dès maintenant depuis un
// script ou un test, sans attendre ce câblage.
@Injectable()
export class RateLimitService {
  // @Inject(PrismaService) explicite : voir OtpService/TokenService — sous
  // vitest/esbuild, design:paramtypes n'est pas émis (pas de support
  // d'emitDecoratorMetadata), donc un paramètre typé sans jeton explicite se
  // résoudrait à `undefined` chez Nest.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async hit(key: string, limit: number, windowMs: number): Promise<void> {
    const depuis = new Date(Date.now() - windowMs);
    const récents = await this.prisma.rateLimitHit.count({ where: { key, createdAt: { gte: depuis } } });
    if (récents >= limit) {
      // Le message d'une AppError atteint le journal (AppExceptionFilter)
      // ET l'enveloppe de réponse HTTP (toEnvelope) : jamais la clé telle
      // quelle, donc — un appelant compose des clés comme "otp:ip:<ip>" ou
      // "otp:email:<adresse>", et ni l'IP ni l'adresse ne doivent atteindre
      // un journal ou une réponse. Seul le "périmètre" (tout sauf le dernier
      // segment ':'-séparé, qui porte la valeur sensible) est journalisé.
      const scope = key.includes(":") ? key.slice(0, key.lastIndexOf(":")) : key;
      throw new AppError("rate_limited", `rate limit reached for scope ${scope}`);
    }
    await this.prisma.rateLimitHit.create({ data: { key } });
  }

  // Purge opportuniste : supprime les frappes plus anciennes que `olderThanMs`
  // (par défaut 24h — largement au-delà de toute fenêtre glissante utilisée
  // par ce service). Sans purge, `rate_limit_hit` grossit indéfiniment : ce
  // n'est que de l'état transitoire, jamais relu au-delà de la fenêtre
  // considérée par `hit`.
  async purgeOlderThan(olderThanMs = 24 * 3_600_000): Promise<number> {
    const avant = new Date(Date.now() - olderThanMs);
    const { count } = await this.prisma.rateLimitHit.deleteMany({ where: { createdAt: { lt: avant } } });
    return count;
  }
}

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

  // Revue tour 2, point 4 : compter puis créer, sans rien qui les lie, est le
  // même motif lire-puis-écrire déjà corrigé dans OtpService
  // (updateMany conditionnel) et AuthService.createAccountForDevice (verrou
  // consultatif). Ici, il n'y a pas de ligne UNIQUE existante à verrouiller
  // par une écriture conditionnelle (chaque frappe crée une ligne neuve) :
  // on sérialise donc les frappes concurrentes sur LA MÊME clé avec un
  // verrou consultatif transactionnel sur son hash — même outil que
  // createAccountForDevice, sans bloquer les clés différentes entre elles.
  // Deux règles pour un même point d'entrée, et elles ne servent pas la même
  // chose.
  //
  // Le PLAFOND arrête l'usage abusif : trois codes par heure, puis plus rien.
  // Il vise celui qui insiste, ou qui arrose une boîte qui n'est pas la sienne.
  //
  // Le DÉLAI arrête l'impatience : cinq secondes avant de pouvoir redemander,
  // puis vingt-cinq, puis cent vingt-cinq. Il vise le geste réflexe — on ne
  // voit pas le courriel arriver, on retape. Un délai fixe ne suffit pas : à
  // trente secondes, trois demandes partent en une minute et demie, et la
  // boîte reçoit trois codes dont deux ne serviront jamais.
  //
  // L'exponentielle laisse le premier renvoi presque immédiat — le cas
  // légitime, où le courriel a vraiment tardé — et rend le troisième assez
  // lointain pour qu'on aille regarder sa boîte plutôt que de retaper.
  //
  // Rend le délai à respecter AVANT LA PROCHAINE demande. Le client l'affiche :
  // sans lui, il devrait coder la formule de son côté, et deux versions du
  // parc appliqueraient deux règles différentes.
  async hitWithBackoff(
    key: string,
    opts: { plafond: number; fenetreMs: number; baseSecondes: number },
  ): Promise<{ retryAfterSeconds: number }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${key}))`;
      const depuis = new Date(Date.now() - opts.fenetreMs);
      const recents = await tx.rateLimitHit.findMany({
        where: { key, createdAt: { gte: depuis } },
        orderBy: { createdAt: "desc" },
      });

      // Le périmètre, jamais la clé : elle porte une adresse ou une IP, et ni
      // l'une ni l'autre ne doit atteindre un journal ou une réponse.
      const scope = key.includes(":") ? key.slice(0, key.lastIndexOf(":")) : key;

      if (recents.length >= opts.plafond) {
        // Le plafond glisse : on dit quand la plus ancienne frappe sortira de
        // la fenêtre, pas « dans une heure ». Sinon quelqu'un qui a demandé
        // son troisième code il y a cinquante-neuf minutes s'entend dire
        // d'attendre soixante de plus.
        const plusAncienne = recents[recents.length - 1]!.createdAt.getTime();
        const libreDans = Math.ceil((plusAncienne + opts.fenetreMs - Date.now()) / 1000);
        throw new AppError("rate_limited", `rate limit reached for scope ${scope}`, {
          retryAfterSeconds: Math.max(1, libreDans),
        });
      }

      if (recents.length > 0) {
        const requis = Math.pow(opts.baseSecondes, recents.length);
        const ecoule = (Date.now() - recents[0]!.createdAt.getTime()) / 1000;
        if (ecoule < requis) {
          throw new AppError("rate_limited", `too soon for scope ${scope}`, {
            retryAfterSeconds: Math.ceil(requis - ecoule),
          });
        }
      }

      await tx.rateLimitHit.create({ data: { key } });

      // Ce que le client doit attendre avant la PROCHAINE demande. Au plafond,
      // c'est la fenêtre qui commande ; en deçà, l'exponentielle.
      const desormais = recents.length + 1;
      if (desormais >= opts.plafond) {
        const plusAncienne = (recents[recents.length - 1] ?? { createdAt: new Date() }).createdAt.getTime();
        return {
          retryAfterSeconds: Math.max(1, Math.ceil((plusAncienne + opts.fenetreMs - Date.now()) / 1000)),
        };
      }
      return { retryAfterSeconds: Math.pow(opts.baseSecondes, desormais) };
    });
  }

  async hit(key: string, limit: number, windowMs: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${key}))`;
      const depuis = new Date(Date.now() - windowMs);
      const récents = await tx.rateLimitHit.count({ where: { key, createdAt: { gte: depuis } } });
      if (récents >= limit) {
        // Le message d'une AppError atteint le journal (AppExceptionFilter)
        // ET l'enveloppe de réponse HTTP (toEnvelope) : jamais la clé telle
        // quelle, donc — un appelant compose des clés comme "otp:ip:<ip>" ou
        // "otp:email:<adresse>", et ni l'IP ni l'adresse ne doivent atteindre
        // un journal ou une réponse. Seul le "périmètre" (tout sauf le
        // dernier segment ':'-séparé, qui porte la valeur sensible) est
        // journalisé.
        const scope = key.includes(":") ? key.slice(0, key.lastIndexOf(":")) : key;
        throw new AppError("rate_limited", `rate limit reached for scope ${scope}`);
      }
      await tx.rateLimitHit.create({ data: { key } });
    });
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

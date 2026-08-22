import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import type { WaitlistJoinInput } from "@lehno/contracts";

@Injectable()
export class WaitlistService {
  // @Inject(PrismaService) explicite : voir ProfileService, même contrainte
  // esbuild/vitest (pas d'emitDecoratorMetadata).
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // Idempotent, et muet sur ce qu'il savait déjà : dire « déjà inscrit »
  // ferait de ce point d'entrée un test d'appartenance. `email` est en
  // citext côté base (voir waitlist_signup) : deux casses différentes
  // désignent la même ligne, pas besoin de toLowerCase() ici.
  async join(input: WaitlistJoinInput): Promise<{ joined: true }> {
    await this.prisma.waitlistSignup.upsert({
      where: { email: input.email },
      create: { email: input.email, locale: input.locale ?? null, source: input.source ?? null },
      update: {},
    });
    return { joined: true };
  }
}

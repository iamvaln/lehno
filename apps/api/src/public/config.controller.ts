import { Controller, Get, Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { FlagsService } from "../flags/flags.service.js";
import type { PublicConfig } from "@lehno/contracts";

@Injectable()
export class ConfigService {
  // @Inject(PrismaService) explicite : voir ProfileService, même contrainte
  // esbuild/vitest (pas d'emitDecoratorMetadata).
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FlagsService) private readonly flags: FlagsService,
  ) {}

  // Lu en base à chaque appel : un prix écrit en dur devient faux le jour
  // où l'administration change `system_parameter`.
  async get(): Promise<PublicConfig> {
    const rows = await this.prisma.systemParameter.findMany();
    const num = (key: string, fallback: number): number => {
      const row = rows.find((r) => r.key === key);
      return row ? Number(row.value) : fallback;
    };
    return {
      signupFreeCredits: num("signup_free_credits", 5),
      creditUnitPrice: num("credit_unit_price", 100),
      currency: "XAF",
      referralBonusInvited: num("referral_bonus_invited", 0),
      // FlagsService.lirePublics() ne lit que les clés que le registre
      // (packages/contracts/src/flags.ts) marque publiques — un drapeau privé
      // allumé en base n'atteint jamais cette réponse.
      flags: await this.flags.lirePublics(),
    };
  }
}

@Controller("public/config")
export class ConfigController {
  constructor(@Inject(ConfigService) private readonly service: ConfigService) {}

  @Get()
  get(): Promise<PublicConfig> {
    return this.service.get();
  }
}

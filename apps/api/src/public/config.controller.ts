import { Controller, Get, Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import type { PublicConfig } from "@lehno/contracts";
import { PRIX_UNITAIRE_PAR_DEFAUT } from "../payments/prix-unitaire.js";

@Injectable()
export class ConfigService {
  // @Inject(PrismaService) explicite : voir ProfileService, même contrainte
  // esbuild/vitest (pas d'emitDecoratorMetadata).
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
      // Le MÊME défaut que la remise, et pris au même endroit : deux valeurs
      // divergentes feraient annoncer un prix ici et une réduction calculée
      // sur un autre là-bas, sur la même offre.
      creditUnitPrice: num("credit_unit_price", PRIX_UNITAIRE_PAR_DEFAUT),
      currency: "XAF",
      referralBonusInvited: num("referral_bonus_invited", 0),
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

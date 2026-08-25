import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import type { FeaturesResponse } from "@lehno/contracts";
import { AuthGuard } from "../auth/auth.guard.js";
import { FlagsService } from "./flags.service.js";

// Ce que ces deux routes rendent : la liste RÉSOLUE de ce qui est actif,
// jamais l'état brut des drapeaux (§6.2). La distinction n'est pas cosmétique.
//
// Avec un dictionnaire clé → booléen, le client saurait distinguer « éteint »
// d'« inconnu ». Avec une liste, il ne le peut pas — et c'est exactement ce
// qu'on veut, puisque les deux valent éteint et que le parc ne se met pas à
// jour d'un bloc. C'est aussi ce qui permettra d'activer par compte un jour
// sans rien changer côté client.
//
// Les dépendances sont déjà appliquées ici : le client n'a aucune règle à
// connaître (§6.4).
@Controller("public/features")
export class PublicFeaturesController {
  constructor(@Inject(FlagsService) private readonly flags: FlagsService) {}

  // Sans session : les surfaces publiques en ont besoin avant toute connexion.
  // Ne rend que les clés dont le registre dit la portée publique — un drapeau
  // d'application n'a rien à faire ici, et le filtre se pose AVANT la requête
  // plutôt qu'après coup.
  @Get()
  async list(): Promise<FeaturesResponse> {
    return { features: await this.flags.actifs("public") };
  }
}

@Controller("me/features")
@UseGuards(AuthGuard)
export class MeFeaturesController {
  constructor(@Inject(FlagsService) private readonly flags: FlagsService) {}

  // Aucun @Feature ici, et ce n'est pas un oubli : la route qui dit ce qui est
  // allumé ne peut pas être gouvernée par un drapeau. Elle s'éteindrait
  // elle-même, et l'application n'aurait plus aucun moyen de savoir quoi
  // afficher.
  @Get()
  async list(): Promise<FeaturesResponse> {
    return { features: await this.flags.actifs("app") };
  }
}

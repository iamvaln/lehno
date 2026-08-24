import { Body, Controller, HttpCode, Inject, Ip, Post } from "@nestjs/common";
import { waitlistJoinSchema } from "@lehno/contracts";
import { AppError } from "../common/errors.js";
import { WaitlistService } from "./waitlist.service.js";

// Pas de ZodValidationPipe générique ici : ce point d'entrée porte son
// propre code d'erreur (`waitlist_email_invalid`), plus parlant côté client
// que le `validation_failed` générique — la seule règle métier posée par ce
// contrat est la forme de l'adresse.
@Controller("public/waitlist")
export class WaitlistController {
  constructor(@Inject(WaitlistService) private readonly waitlist: WaitlistService) {}

  // @Ip() lit req.ip d'Express — l'adresse de la connexion TCP tant que
  // "trust proxy" n'est pas activé, jamais un en-tête transmis. Même
  // raisonnement que sur le code à usage unique : se fier à un
  // X-Forwarded-For non configuré laisserait n'importe qui forger son
  // origine et contourner le plafond. Voir la réserve consignée sur le
  // proxy inverse dans AuthController.
  //
  // Cette adresse ne sert qu'à composer une clé de limiteur : ni journalisée,
  // ni renvoyée.
  @Post()
  @HttpCode(200)
  join(@Body() body: unknown, @Ip() ip: string): Promise<{ joined: true }> {
    const result = waitlistJoinSchema.safeParse(body);
    if (!result.success)
      throw new AppError("waitlist_email_invalid", "invalid waitlist signup payload");
    return this.waitlist.join({ ...result.data, ip });
  }
}

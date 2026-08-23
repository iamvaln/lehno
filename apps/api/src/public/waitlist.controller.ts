import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
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

  @Post()
  @HttpCode(200)
  join(@Body() body: unknown): Promise<{ joined: true }> {
    const result = waitlistJoinSchema.safeParse(body);
    if (!result.success)
      throw new AppError("waitlist_email_invalid", "invalid waitlist signup payload");
    return this.waitlist.join(result.data);
  }
}

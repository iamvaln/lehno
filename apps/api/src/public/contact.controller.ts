import { Body, Controller, HttpCode, Inject, Ip, Post } from "@nestjs/common";
import { contactSendSchema } from "@lehno/contracts";
import { AppError } from "../common/errors.js";
import { ContactService } from "./contact.service.js";

// Même raisonnement que WaitlistController : pas de ZodValidationPipe
// générique — ce point d'entrée porte son propre code d'erreur
// (`contact_invalid`), la seule règle métier posée par ce contrat étant la
// forme des champs (adresse, sujet parmi les six clés fermées, longueur du
// message).
@Controller("public/contact")
export class ContactController {
  constructor(@Inject(ContactService) private readonly contact: ContactService) {}

  // @Ip() lit req.ip d'Express — même garde que WaitlistController : jamais
  // un en-tête transmis par le client, jamais journalisée ni renvoyée.
  @Post()
  @HttpCode(200)
  send(@Body() body: unknown, @Ip() ip: string): Promise<{ sent: true }> {
    const result = contactSendSchema.safeParse(body);
    if (!result.success)
      throw new AppError("contact_invalid", "invalid contact submission payload");
    return this.contact.send({ ...result.data, ip });
  }
}

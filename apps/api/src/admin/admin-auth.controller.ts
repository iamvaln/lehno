import { Body, Controller, Delete, Headers, HttpCode, Inject, Post } from "@nestjs/common";
import { z } from "zod";
import { AdminOtpService } from "./admin-otp.service.js";
import { AdminTokenService } from "./admin-token.service.js";
import type { MailPort } from "../mail/mail.port.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { rafraichissementSchema } from "@lehno/contracts";

const demandeSchema = z.object({ email: z.string().email().max(254) }).strict();
const verificationSchema = z.object({
  email: z.string().email().max(254),
  code: z.string().regex(/^\d{6}$/),
}).strict();

// La réponse est la même quoi qu'il arrive : un code est parti si l'adresse le
// méritait, et rien ne le dit. Une réponse qui varierait — corps, statut ou
// délai — laisserait énumérer les comptes d'exploitation en les essayant.
const ACCUSE = { envoye: true } as const;

@Controller("admin/auth")
export class AdminAuthController {
  constructor(
    @Inject(AdminOtpService) private readonly otp: AdminOtpService,
    @Inject(AdminTokenService) private readonly jetons: AdminTokenService,
    @Inject("MAIL_PORT") private readonly mail: MailPort,
  ) {}

  @Post("otp")
  @HttpCode(200)
  async demander(
    @Body(new ZodValidationPipe(demandeSchema)) corps: z.infer<typeof demandeSchema>,
  ): Promise<typeof ACCUSE> {
    const code = await this.otp.demander(corps.email);
    if (code) {
      await this.mail.send({
        to: corps.email,
        subject: "Votre code d'accès au back-office",
        text: `Code : ${code}\n\nIl expire dans dix minutes.`,
        locale: "fr",
      });
    }
    return ACCUSE;
  }

  @Post("otp/verify")
  @HttpCode(200)
  async verifier(
    @Body(new ZodValidationPipe(verificationSchema)) corps: z.infer<typeof verificationSchema>,
    @Headers("user-agent") userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; role: string }> {
    const admin = await this.otp.verifier(corps.email, corps.code);
    const paire = await this.jetons.ouvrir(admin.id, userAgent);
    return { ...paire, role: admin.role };
  }

  // Sans ce chemin, le jeton de rafraîchissement émis à l'entrée ne s'échange
  // nulle part : la session meurt au bout de trente minutes et l'administrateur
  // repasse par sa boîte aux lettres. Les deux mondes étant séparés — clés,
  // tables et chemins —, /v1/auth/refresh ne peut pas servir ici.
  @Post("refresh")
  @HttpCode(200)
  async rafraichir(
    @Body(new ZodValidationPipe(rafraichissementSchema)) corps: { refreshToken: string },
    @Headers("user-agent") userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; role: string }> {
    return this.jetons.tourner(corps.refreshToken, userAgent);
  }

  @Delete("session")
  @HttpCode(204)
  async fermer(@Body() corps: { refreshToken?: string }): Promise<void> {
    if (corps?.refreshToken) await this.jetons.fermer(corps.refreshToken);
  }
}

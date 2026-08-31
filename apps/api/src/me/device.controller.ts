import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import { registerDeviceSchema } from "@lehno/contracts";
import type { Device, DevicesList, RegisterDeviceInput } from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { DeviceService } from "./device.service.js";

type AuthedRequest = { userId: string };

/* Les appareils qui reçoivent les notifications — spec technique §5.7. */
@Controller("me/devices")
@UseGuards(AuthGuard)
export class DeviceController {
  // @Inject explicite : voir ProfileController, même contrainte esbuild/vitest.
  constructor(@Inject(DeviceService) private readonly devices: DeviceService) {}

  /* La spec ne cite que POST et DELETE. Cette lecture s'y ajoute parce que
     l'écran de sécurité (§3.24) doit pouvoir montrer ce qu'il propose de
     retirer : sans elle, le client devrait retenir lui-même la liste des
     appareils qu'il a enregistrés — c'est-à-dire ceux de CETTE installation,
     donc jamais celui du téléphone qu'on a perdu. */
  @Get()
  async lister(@Req() req: AuthedRequest): Promise<DevicesList> {
    return { devices: await this.devices.lister(req.userId) };
  }

  @Post()
  enregistrer(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(registerDeviceSchema)) body: RegisterDeviceInput,
  ): Promise<Device> {
    return this.devices.enregistrer(req.userId, body);
  }

  /* Le retrait désigne l'appareil par son IDENTIFIANT, jamais par son jeton.
     Un jeton dans une adresse finirait dans les journaux du relais, et il
     suffit à faire sonner un téléphone. `ParseUUIDPipe` refuse d'emblée ce
     qui n'a pas la forme d'un identifiant — reconnaître la forme ne vaut pas
     autorisation, l'appartenance se vérifie dans le service (§9.5). */
  @Delete(":id")
  @HttpCode(204)
  retirer(
    @Req() req: AuthedRequest,
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.devices.retirer(req.userId, id);
  }
}

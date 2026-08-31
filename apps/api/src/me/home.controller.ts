import { Controller, Get, Inject, Req, UseGuards } from "@nestjs/common";
import type { Home } from "@lehno/contracts";
import { AuthGuard } from "../auth/auth.guard.js";
import { HomeService } from "./home.service.js";

type AuthedRequest = { userId: string };

// Pas de @Feature : les dates relèvent du SOCLE, qui n'a pas de drapeau
// (spécification technique §6.3).
@Controller("me/home")
@UseGuards(AuthGuard)
export class HomeController {
  constructor(@Inject(HomeService) private readonly home: HomeService) {}

  @Get()
  get(@Req() req: AuthedRequest): Promise<Home> {
    return this.home.get(req.userId);
  }
}

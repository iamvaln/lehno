import { Controller, Get, Inject, Injectable, Param, Req, UseGuards } from "@nestjs/common";
import { RAISON_DE_LA_SOURCE } from "@lehno/contracts";
import type { CreditBalance, ReferralSummary, Invitation } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { FlagsService } from "../flags/flags.service.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { AppError } from "../common/errors.js";

type AuthedRequest = { userId: string };

@Injectable()
export class CreditsService {
  // @Inject explicite : voir ProfileService, même contrainte esbuild/vitest.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FlagsService) private readonly flags: FlagsService,
  ) {}

  // Le solde est la SOMME des mouvements, calculée à chaque appel. Aucune
  // colonne de solde n'existe, donc aucune ne peut diverger du registre qui
  // fait foi — et le client ne refait pas ce calcul, sous peine de deux
  // vérités qui s'écartent dès qu'un mouvement arrive hors de la page.
  async solde(userId: string): Promise<CreditBalance> {
    const [somme, mouvements] = await Promise.all([
      this.prisma.creditTransaction.aggregate({ where: { userId }, _sum: { amount: true } }),
      this.prisma.creditTransaction.findMany({
        where: { userId }, orderBy: { createdAt: "desc" }, take: 50,
      }),
    ]);
    return {
      balance: somme._sum.amount ?? 0,
      transactions: mouvements.map((m) => ({
        id: m.id,
        type: m.type,
        // La RAISON, dans le vocabulaire de l'utilisateur — jamais la source
        // comptable. `manual_topup` et `purchase` lui parviennent tous deux
        // comme un achat : il a payé, la façon dont l'argent nous est parvenu
        // ne le regarde pas.
        //
        // La note libre `reason` de la base ne sort PAS : elle est écrite en
        // français pour le journal, et finirait par afficher « erreur de manip
        // suite ticket 4412 » sur l'écran de quelqu'un.
        reason: RAISON_DE_LA_SOURCE[m.source],
        amount: m.amount,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  async parrainage(userId: string): Promise<ReferralSummary> {
    const moi = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const parrainages = await this.prisma.referral.findMany({
      where: { referrerId: userId },
      orderBy: { createdAt: "desc" },
      include: { invitedUser: { select: { username: true } } },
    });

    // Ce que CE compte a gagné par ses parrainages : ses propres mouvements
    // rattachés à l'un d'eux. Sans le filtre sur userId, on additionnerait
    // aussi les bonus versés aux filleuls — le parrain verrait le double.
    const gagnes = await this.prisma.creditTransaction.aggregate({
      where: { userId, referralId: { not: null } },
      _sum: { amount: true },
    });

    return {
      code: moi.referralCode,
      invited: parrainages
        // Une invitation sans filleul n'a personne à nommer ; et un filleul
        // qui a supprimé son compte laisse une trace anonyme (on delete set
        // null), qu'on n'affiche pas plutôt que d'inventer un nom.
        .filter((r) => r.invitedUser !== null)
        .map((r) => ({
          username: r.invitedUser!.username,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
        })),
      creditsEarned: gagnes._sum.amount ?? 0,
      bonusParInvitation: await this.bonusParInvitation(),
    };
  }

  /* Ce que le parrainage rapporte AUJOURD'HUI, ou rien.
   *
   * Le bonus s'annonce toujours, et c'est nouveau : il était conditionné au
   * drapeau `credits`, qui n'existe plus. Les actions payantes consomment du
   * crédit en permanence, donc cinq crédits offerts achètent toujours quelque
   * chose — la question « et s'ils n'achetaient rien » ne se pose plus.
   *
   * Nul reste possible pour une autre raison : le paramètre absent ou
   * illisible. Zéro dirait « le parrainage ne rapporte rien », ce qui est un
   * réglage ; nul dit « on ne sait pas », ce qui est une panne. */
  private async bonusParInvitation(): Promise<number | null> {
    const l = await this.prisma.systemParameter.findUnique({
      where: { key: "referral_bonus_invited" },
    });
    const n = l ? Number(l.value) : NaN;
    return Number.isInteger(n) && n > 0 ? n : null;
  }

  // Ouverte SANS compte : un code d'invitation circule par message, par
  // réseau, par bouche-à-oreille. Tout ce qu'on met ici circule avec lui —
  // d'où le pseudo seul, jamais l'adresse ni quoi que ce soit d'autre.
  async invitation(code: string): Promise<Invitation> {
    const parrain = await this.prisma.user.findUnique({ where: { referralCode: code } });
    // 404 plutôt qu'un message distinguant « code inconnu » d'« erreur » :
    // sinon ce point d'entrée devient un oracle pour énumérer les codes.
    if (!parrain) throw new AppError("not_found", "unknown invitation code");

    const ligne = await this.prisma.systemParameter.findUnique({
      where: { key: "referral_bonus_invited" },
    });
    return {
      code,
      inviterUsername: parrain.username,
      creditsForInvited: ligne ? Number(ligne.value) : 0,
    };
  }
}

@Controller("me/credits")
@UseGuards(AuthGuard)
export class CreditsController {
  constructor(@Inject(CreditsService) private readonly credits: CreditsService) {}

  @Get()
  solde(@Req() req: AuthedRequest): Promise<CreditBalance> {
    return this.credits.solde(req.userId);
  }
}

@Controller("me/referral")
@UseGuards(AuthGuard)
export class ReferralController {
  constructor(@Inject(CreditsService) private readonly credits: CreditsService) {}

  @Get()
  resume(@Req() req: AuthedRequest): Promise<ReferralSummary> {
    return this.credits.parrainage(req.userId);
  }
}

@Controller("public/invitations")
export class InvitationController {
  constructor(@Inject(CreditsService) private readonly credits: CreditsService) {}

  @Get(":code")
  lire(@Param("code") code: string): Promise<Invitation> {
    return this.credits.invitation(code);
  }
}

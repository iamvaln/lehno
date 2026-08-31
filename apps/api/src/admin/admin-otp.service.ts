import { Inject, Injectable } from "@nestjs/common";
import { randomInt } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service.js";
import { OtpService } from "../auth/otp.service.js";
import { AppError } from "../common/errors.js";

const TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;

// Le plancher de réponse. Un compte d'administration existe toujours : une
// adresse inconnue n'écrit rien et n'envoie rien, donc elle répond plus vite
// qu'une adresse connue si on la laisse faire. L'écran refuserait de dire ce
// que le chronomètre trahirait. On attend donc le même temps dans les deux cas.
const PLANCHER_MS = 400;

@Injectable()
export class AdminOtpService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OtpService) private readonly otp: OtpService,
  ) {}

  private async plancher<T>(depart: number, valeur: T): Promise<T> {
    const reste = PLANCHER_MS - (Date.now() - depart);
    if (reste > 0) await new Promise((r) => setTimeout(r, reste));
    return valeur;
  }

  /**
   * Émet un code pour une adresse d'administration. Rend le code lorsqu'il y a
   * lieu de l'envoyer, `null` sinon — adresse inconnue ou compte désactivé.
   * L'appelant ne distingue pas les deux : il envoie s'il reçoit un code, et
   * répond la même chose dans tous les cas.
   */
  async demander(email: string): Promise<string | null> {
    const depart = Date.now();
    const admin = await this.prisma.admin.findUnique({ where: { email } });

    // Un compte désactivé se comporte comme une adresse inconnue. Dire « ce
    // compte est suspendu » reviendrait à confirmer qu'il existe.
    if (!admin || !admin.isActive) return this.plancher(depart, null);

    // Une demande neuve annule les précédentes : sinon plusieurs codes vivent
    // en parallèle et le plafond de tentatives se contourne en en demandant un autre.
    await this.prisma.adminOtpCode.updateMany({
      where: { adminId: admin.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await this.prisma.adminOtpCode.create({
      data: {
        adminId: admin.id,
        targetEmail: email,
        codeHash: this.otp.hash(code),
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    });

    return this.plancher(depart, code);
  }

  /** Vérifie un code et rend l'administrateur. Lève sur tout échec. */
  async verifier(email: string, code: string): Promise<{ id: string; role: "support" | "admin" }> {
    const ligne = await this.prisma.adminOtpCode.findFirst({
      where: { targetEmail: email, consumedAt: null },
      orderBy: { createdAt: "desc" },
      include: { admin: true },
    });
    if (!ligne) throw new AppError("otp_invalid", "no pending code for this address");
    if (ligne.attempts >= MAX_ATTEMPTS)
      throw new AppError("otp_too_many_attempts", "code burnt after too many attempts");
    if (ligne.expiresAt.getTime() < Date.now())
      throw new AppError("otp_expired", "code expired");

    if (!this.otp.matches(ligne.codeHash, code)) {
      await this.prisma.adminOtpCode.update({
        where: { id: ligne.id },
        data: { attempts: { increment: 1 } },
      });
      throw new AppError("otp_invalid", "wrong code");
    }

    // Consommation atomique : deux vérifications concurrentes du même code ne
    // doivent pas ouvrir deux sessions.
    const consomme = await this.prisma.adminOtpCode.updateMany({
      where: { id: ligne.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consomme.count === 0) throw new AppError("otp_invalid", "code already consumed");

    // Le compte a pu être désactivé entre la demande et la vérification.
    if (!ligne.admin.isActive) throw new AppError("forbidden", "account disabled");

    return { id: ligne.admin.id, role: ligne.admin.role };
  }
}

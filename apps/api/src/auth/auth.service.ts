import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { OtpService } from "./otp.service.js";
import { TokenService, type Pair } from "./token.service.js";

type VerifyInput = { email: string; code: string; deviceId?: string; userAgent?: string };

const MAX_ACCOUNT_CREATION_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  // @Inject explicite sur chaque paramètre typé par une classe : ce projet
  // exécute les tests via esbuild (vitest), qui n'émet pas
  // `design:paramtypes` (pas de support d'`emitDecoratorMetadata`). Sans ce
  // jeton explicite, Nest résout le paramètre à `undefined` au lieu du type
  // — l'injection implicite par type ne survivrait pas au câblage réel.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OtpService) private readonly otp: OtpService,
    @Inject(TokenService) private readonly tokens: TokenService,
  ) {}

  // Rend toujours la même chose : une adresse inconnue ne doit pas se distinguer
  // d'une connue, sinon le point d'entrée énumère les comptes. Chemin unique
  // — aucune requête sur `user` — donc pas seulement la même forme de
  // réponse : le même travail est fait, dans le même ordre, quel que soit
  // le cas ; rien ne permet de les distinguer par le temps de réponse non plus.
  async requestOtp(input: { email: string }): Promise<{ sent: true }> {
    const { code } = await this.otp.issue(input.email, "login");
    // Béquille de développement, à SUPPRIMER par la tâche 17 quand elle branche
    // l'envoi réel. Adhésion explicite plutôt que défaut par omission : une
    // variable absente ne doit jamais faire fuiter un code à usage unique dans
    // un journal (contrainte globale sur le contenu sensible des journaux).
    if (process.env.LEHNO_LOG_OTP === "1") console.log(`[otp] ${input.email} → ${code}`);
    return { sent: true };
  }

  private async paramNumber(
    client: PrismaService | Prisma.TransactionClient,
    key: string,
    fallback: number,
  ): Promise<number> {
    const row = await client.systemParameter.findUnique({ where: { key } });
    return row ? Number(row.value) : fallback;
  }

  private randomAccountFields(email: string) {
    return {
      email,
      emailVerified: true,
      // Pseudo provisoire : l'écran de première connexion en fait choisir un vrai.
      username: `u${randomBytes(4).toString("hex")}`,
      referralCode: randomBytes(6).toString("base64url").slice(0, 8).toUpperCase(),
    };
  }

  // Plafond vérifié et compte créé comme UN SEUL geste atomique. Deux volets :
  //
  // 1. Verrou consultatif transactionnel sur le deviceId (pg_advisory_xact_lock
  //    sur le hash du deviceId) : sérialise les créations concurrentes d'un
  //    même appareil, sans bloquer les appareils différents. Un simple
  //    lire-le-compte-puis-écrire (comme avant cette révision) laisserait
  //    deux créations concurrentes lire toutes deux un compteur encore sous
  //    le plafond avant qu'aucune n'écrive — exactement le motif déjà corrigé
  //    dans OtpService et TokenService.
  // 2. Le pseudo provisoire tient sur 32 bits (32 bits = 8 hex, format fixé
  //    par le contrat) : une collision reste possible. Si la création échoue
  //    sur la contrainte d'unicité, on retire complètement la transaction —
  //    verrou compris — et on retire avec un nouveau tirage, plutôt que de
  //    laisser échouer un parcours qui a déjà consommé le code à usage unique.
  private async createAccountForDevice(
    email: string,
    deviceId: string,
  ): Promise<{ limitReached: true } | { limitReached: false; user: Prisma.PromiseReturnType<PrismaService["user"]["create"]> }> {
    for (let attempt = 1; attempt <= MAX_ACCOUNT_CREATION_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${deviceId}))`;
          const seuil = await this.paramNumber(tx, "max_accounts_per_device", 3);
          const déjà = await tx.deviceSignup.count({ where: { deviceId } });
          if (déjà >= seuil) return { limitReached: true as const };
          const user = await tx.user.create({ data: this.randomAccountFields(email) });
          await tx.deviceSignup.create({ data: { deviceId, userId: user.id } });
          return { limitReached: false as const, user };
        });
      } catch (e) {
        const isUniqueClash = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
        if (isUniqueClash && attempt < MAX_ACCOUNT_CREATION_ATTEMPTS) continue;
        throw e;
      }
    }
    // Inatteignable : la boucle rend ou relance à chaque itération.
    throw new AppError("internal_error", "could not allocate a unique account after several attempts");
  }

  private async recordAttempt(
    input: VerifyInput,
    userId: string | null,
    result: "success" | "failure",
  ): Promise<void> {
    await this.prisma.loginActivity.create({
      data: { userId, attemptedEmail: input.email, result, userAgent: input.userAgent ?? null },
    });
  }

  async verifyOtp(input: VerifyInput): Promise<Pair & { isNewAccount: boolean }> {
    try {
      await this.otp.verify(input.email, "login", input.code);
    } catch (e) {
      await this.recordAttempt(input, null, "failure");
      throw e;
    }

    // Passé ce point, le code était valide : tout refus qui suit doit laisser
    // une trace comme un succès l'aurait fait, sinon un porteur de code
    // valide peut buter sur ces murs sans qu'il en reste rien (device_limit_
    // reached, account_suspended, account_pending_deletion, et l'identifiant
    // d'appareil manquant ci-dessous).
    let user = await this.prisma.user.findUnique({ where: { email: input.email } });
    let isNewAccount = false;

    if (!user) {
      // deviceId est obligatoire pour CRÉER un compte — inutile pour se
      // connecter à un compte existant, qui n'écrit aucune ligne d'appareil.
      // Sans cette exigence, le plafond par appareil se contournerait en
      // omettant simplement ce champ, facultatif dans le contrat de transport.
      const deviceId = input.deviceId;
      if (!deviceId) {
        await this.recordAttempt(input, null, "failure");
        throw new AppError("validation_failed", "deviceId is required to create an account", {
          deviceId: "required to create an account",
        });
      }

      const outcome = await this.createAccountForDevice(input.email, deviceId);
      if (outcome.limitReached) {
        await this.recordAttempt(input, null, "failure");
        throw new AppError("device_limit_reached", "too many accounts from this device");
      }
      user = outcome.user;
      isNewAccount = true;
    } else if (!user.emailVerified) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    }

    if (user.status === "suspended") {
      await this.recordAttempt(input, user.id, "failure");
      throw new AppError("account_suspended", "account suspended");
    }
    if (user.status === "pending_deletion") {
      await this.recordAttempt(input, user.id, "failure");
      throw new AppError("account_pending_deletion", "account is being deleted");
    }

    await this.recordAttempt(input, user.id, "success");
    const pair = await this.tokens.issuePair(user.id, input.userAgent);
    return { ...pair, isNewAccount };
  }
}

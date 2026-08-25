import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service.js";
import { LegalService } from "../public/legal.controller.js";
import { AppError } from "../common/errors.js";

const MAX_TENTATIVES = 3;

export type IssueParrainage =
  | { etat: "aucun" }
  | { etat: "credite"; parrain: string; bonusFilleul: number }
  | { etat: "inconnu" }
  | { etat: "soi_meme" };

export type Creation =
  | { plafondAtteint: true }
  | {
      plafondAtteint: false;
      user: { id: string; email: string };
      creditsOfferts: number;
      parrainage: IssueParrainage;
    };

// LE chemin de création de compte. Les deux voies d'entrée — code par courriel
// et fournisseur fédéré — passent par ici, et c'est tout le point de la classe.
//
// Avant, chacune créait le compte de son côté : la voie par code vérifiait le
// plafond par appareil sous verrou consultatif, la voie fédérée ne le lisait
// même pas. Le plafond était donc contournable en s'inscrivant par Google ou
// Apple. Une protection posée sur une seule porte n'en est pas une ; le seul
// remède durable est qu'il n'y ait qu'une porte.
@Injectable()
export class SignupService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LegalService) private readonly legal: LegalService,
  ) {}

  private async param(
    client: PrismaService | Prisma.TransactionClient,
    key: string,
    defaut: number,
  ): Promise<number> {
    const row = await client.systemParameter.findUnique({ where: { key } });
    return row ? Number(row.value) : defaut;
  }

  private champsDeCompte(email: string, emailVerified: boolean) {
    return {
      email,
      emailVerified,
      // Pseudo provisoire : l'écran de première connexion en fait choisir un vrai.
      username: `u${randomBytes(4).toString("hex")}`,
      referralCode: randomBytes(6).toString("base64url").slice(0, 8).toUpperCase(),
    };
  }

  async creer(input: {
    email: string;
    emailVerified: boolean;
    deviceId: string;
    referralCode?: string | undefined;
  }): Promise<Creation> {
    // La version acceptée se LIT dans le document servi, jamais dans une
    // constante : une constante finirait par mentir le jour où quelqu'un met à
    // jour les conditions sans y penser, et on enregistrerait des acceptations
    // de la mauvaise version sans que rien ne le signale.
    const versionCgu = await this.legal.version("cgu", "fr");

    for (let tentative = 1; tentative <= MAX_TENTATIVES; tentative++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          // Verrou consultatif sur l'appareil : deux inscriptions simultanées
          // liraient sinon le plafond avant qu'aucune n'écrive.
          await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${input.deviceId}))`;
          const seuil = await this.param(tx, "max_accounts_per_device", 3);
          const déjà = await tx.deviceSignup.count({ where: { deviceId: input.deviceId } });
          if (déjà >= seuil) return { plafondAtteint: true as const };


          const user = await tx.user.create({
            data: {
              ...this.champsDeCompte(input.email, input.emailVerified),
              acceptedTermsAt: new Date(),
              acceptedTermsVersion: versionCgu,
            },
          });
          await tx.deviceSignup.create({ data: { deviceId: input.deviceId, userId: user.id } });

          const creditsOfferts = await this.param(tx, "signup_free_credits", 5);
          if (creditsOfferts > 0) {
            await tx.creditTransaction.create({
              data: {
                userId: user.id, type: "grant", amount: creditsOfferts,
                reason: "inscription",
              },
            });
          }

          const parrainage = await this.appliquerParrainage(tx, user.id, input.referralCode);

          return {
            plafondAtteint: false as const,
            user: { id: user.id, email: user.email },
            creditsOfferts,
            parrainage,
          };
        });
      } catch (e) {
        // Le pseudo provisoire tient sur 32 bits : une collision reste
        // possible. On retire complètement la transaction — verrou compris —
        // et on retente avec un nouveau tirage, plutôt que d'échouer un
        // parcours qui a déjà consommé son code à usage unique.
        const collision = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
        if (collision && tentative < MAX_TENTATIVES) continue;
        throw e;
      }
    }
    throw new AppError("internal_error", "could not allocate a unique account after several attempts");
  }

  // Un code de parrainage est FACULTATIF, et son échec ne casse jamais une
  // inscription (maquette §3.1) : code inconnu, expiré ou code à soi, on
  // poursuit et on le dit. Refuser la création pour un champ facultatif
  // perdrait un utilisateur pour rien.
  private async appliquerParrainage(
    tx: Prisma.TransactionClient,
    filleulId: string,
    code: string | undefined,
  ): Promise<IssueParrainage> {
    if (!code) return { etat: "aucun" };

    const parrain = await tx.user.findUnique({ where: { referralCode: code } });
    if (!parrain) return { etat: "inconnu" };
    // Se parrainer soi-même est impossible à la création — le compte vient de
    // naître avec un code neuf —, mais la garde reste : elle coûte une ligne
    // et couvre le jour où ce chemin servira ailleurs.
    if (parrain.id === filleulId) return { etat: "soi_meme" };

    const bonusParrain = await this.param(tx, "referral_bonus_referrer", 5);
    const bonusFilleul = await this.param(tx, "referral_bonus_invited", 5);

    // L'unicité sur invited_user_id fait le reste : un filleul ne peut être
    // rattaché qu'à un seul parrainage, donc crédité qu'une fois. La règle vit
    // dans le schéma, pas ici — une garde applicative se contourne par une
    // seconde voie ou une course entre deux requêtes.
    const referral = await tx.referral.create({
      data: {
        referrerId: parrain.id, invitedUserId: filleulId,
        codeUsed: code, status: "credited",
      },
    });

    if (bonusParrain > 0) {
      await tx.creditTransaction.create({
        data: {
          userId: parrain.id, type: "grant", amount: bonusParrain,
          referralId: referral.id, reason: "parrainage — filleul inscrit",
        },
      });
    }
    if (bonusFilleul > 0) {
      await tx.creditTransaction.create({
        data: {
          userId: filleulId, type: "grant", amount: bonusFilleul,
          referralId: referral.id, reason: "parrainage — arrivé par une invitation",
        },
      });
    }

    return {
      etat: "credite",
      parrain: parrain.displayName ?? parrain.username,
      bonusFilleul,
    };
  }
}

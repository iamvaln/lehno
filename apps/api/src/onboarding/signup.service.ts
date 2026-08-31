import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service.js";
import { LegalService } from "../public/legal.controller.js";
import { AppError } from "../common/errors.js";
import { canonicalEmail } from "../common/email.js";

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
      // Nul quand la personne n'attendait pas. L'écran de bienvenue ne doit
      // annoncer un cadeau que s'il y en a un.
      cadeauAttente: { credits: number } | null;
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

  private champsDeCompte(email: string, emailVerified: boolean, username: string) {
    return {
      email,
      emailVerified,
      // Choisi par l'utilisateur à l'écran du pseudo — il forme l'adresse de
      // son Mur, donc il lui appartient.
      username,
      // Son propre code de parrainage, tiré au sort : c'est celui qu'il
      // partagera. Rien à voir avec celui qu'il a éventuellement reçu.
      referralCode: randomBytes(6).toString("base64url").slice(0, 8).toUpperCase(),
    };
  }

  // Indicatif : le plafond fait foi À LA CRÉATION, sous verrou consultatif.
  // Cette lecture sert à prévenir tôt, jamais à autoriser — deux inscriptions
  // simultanées la liraient toutes deux avant qu'aucune n'écrive.
  async plafondAtteint(deviceId: string): Promise<boolean> {
    const seuil = await this.param(this.prisma, "max_accounts_per_device", 3);
    return (await this.prisma.deviceSignup.count({ where: { deviceId } })) >= seuil;
  }

  async creer(input: {
    email: string;
    emailVerified: boolean;
    deviceId: string;
    username: string;
    referralCode?: string | undefined;
    /** L'adresse au moment de la création, pour la trace de l'appareil. */
    ip?: string | undefined;
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
              ...this.champsDeCompte(input.email, input.emailVerified, input.username),
              acceptedTermsAt: new Date(),
              acceptedTermsVersion: versionCgu,
            },
          });
          await tx.deviceSignup.create({
            data: { deviceId: input.deviceId, userId: user.id, ip: input.ip ?? null },
          });

          const creditsOfferts = await this.param(tx, "signup_free_credits", 5);
          if (creditsOfferts > 0) {
            await tx.creditTransaction.create({
              data: {
                userId: user.id, type: "grant", source: "signup_grant",
                amount: creditsOfferts,
              },
            });
          }

          const parrainage = await this.appliquerParrainage(tx, user.id, input.referralCode);
          const cadeauAttente = await this.appliquerCadeauDAttente(tx, user.id, input.email);

          return {
            plafondAtteint: false as const,
            user: { id: user.id, email: user.email },
            creditsOfferts,
            cadeauAttente,
            parrainage,
          };
        });
      } catch (e) {
        const collision = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
        if (!collision) throw e;

        // Deux collisions possibles, et elles ne se traitent pas pareil.
        //
        // Le PSEUDO est un choix de l'utilisateur : s'il est pris, il doit le
        // savoir et en choisir un autre. Retenter en silence n'aurait aucun
        // sens — on ne peut pas deviner celui qu'il voulait.
        //
        // Le code de parrainage, lui, est TIRÉ AU SORT : une collision est un
        // coup de malchance, et on retire avec un nouveau tirage plutôt que
        // d'échouer un parcours qui a déjà consommé son code à usage unique.
        const cibles = (e.meta?.["target"] ?? []) as string[];
        if (cibles.includes("username")) {
          throw new AppError("username_taken", "this username is already taken");
        }
        if (tentative < MAX_TENTATIVES) continue;
        throw e;
      }
    }
    throw new AppError("internal_error", "could not allocate a unique account after several attempts");
  }

  // Un code de parrainage est FACULTATIF, et son échec ne casse jamais une
  // inscription (maquette §3.1) : code inconnu, expiré ou code à soi, on
  // poursuit et on le dit. Refuser la création pour un champ facultatif
  // perdrait un utilisateur pour rien.
  /* Le cadeau de celui qui attendait.
   *
   * La détection se fait sur l'ADRESSE, jamais sur un jeton porté par le lien.
   * C'est ce qui protège le cadeau : un bonus dans le lien serait
   * transférable — on le fait suivre à dix amis, et dix comptes touchent ce qui
   * était réservé à un inscrit. Sur l'adresse, le lien peut circuler autant
   * qu'il veut, seul celui qui attendait vraiment reçoit quelque chose.
   *
   * L'anti-double-crédit ne vit pas ici mais dans le schéma : `convertedUserId`
   * est UNIQUE. Supprimer son compte et recommencer ne rend donc pas le cadeau
   * disponible une seconde fois — le `updateMany` conditionné à
   * `convertedAt: null` échoue sans rien écrire.
   *
   * Zéro crédit est un état valide : on peut lancer sans cadeau et l'activer
   * plus tard. On marque quand même la conversion — c'est la mesure de ce que
   * la liste d'attente a rapporté, indépendamment de ce qu'on a offert. */
  private async appliquerCadeauDAttente(
    tx: Prisma.TransactionClient,
    userId: string,
    email: string,
  ): Promise<{ credits: number } | null> {
    const canonique = canonicalEmail(email);
    const attente = await tx.waitlistSignup.findUnique({
      where: { emailCanonical: canonique },
      select: { id: true, convertedAt: true },
    });
    if (!attente || attente.convertedAt !== null) return null;

    // `convertedAt: null` dans le WHERE : deux inscriptions concurrentes sur la
    // même adresse — impossible aujourd'hui, mais on ne s'appuie pas là-dessus
    // — ne créditeraient qu'une fois.
    const prise = await tx.waitlistSignup.updateMany({
      where: { id: attente.id, convertedAt: null },
      data: { convertedUserId: userId, convertedAt: new Date() },
    });
    if (prise.count === 0) return null;

    const credits = await this.param(tx, "waitlist_bonus_credits", 0);
    if (credits > 0) {
      await tx.creditTransaction.create({
        data: { userId, type: "grant", source: "waitlist_bonus", amount: credits },
      });
    }
    return { credits };
  }

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
          userId: parrain.id, type: "grant", source: "referral_bonus",
          amount: bonusParrain, referralId: referral.id,
        },
      });
    }
    if (bonusFilleul > 0) {
      await tx.creditTransaction.create({
        data: {
          userId: filleulId, type: "grant", source: "referral_bonus",
          amount: bonusFilleul, referralId: referral.id,
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

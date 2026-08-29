import { createHash, randomBytes, randomInt } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  ReserveOutcome, ReserveWishInput, ReservationConfirmed, SharedWishlist,
  VerifyReservationInput,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { RateLimitService } from "../common/rate-limit.service.js";
import { assertUsableEmail, canonicalEmail } from "../common/email.js";
import { AppError } from "../common/errors.js";
import { OtpService } from "../auth/otp.service.js";
import type { MailPort } from "../mail/mail.port.js";
import { reservationCodeEmail } from "../mail/templates.js";

const ABSENT = (): AppError => new AppError("not_found", "resource not found");

/* Un quart d'heure pour saisir un code affiché dans la page qu'on n'a pas
 * quittée. Plus long que les dix minutes du code de connexion : celui-là se
 * saisit dans l'application, celui-ci suppose d'aller chercher un courriel sur
 * un autre appareil, parfois sur un réseau lent. */
const TTL_MS = 15 * 60_000;
const MAX_TENTATIVES = 5;

/* Plafonds. « Le débit est limité par adresse destinataire autant que par
 * origine — borner la seule origine laisserait le point d'entrée servir à
 * arroser la boîte d'un tiers » (dictionnaire, WishReservation). */
const PLAFOND_ADRESSE = 5;
const PLAFOND_ORIGINE = 20;
const FENETRE_MS = 3_600_000;

// Mêmes bornes que la liste d'attente : en deçà d'une seconde personne n'a lu
// la page, au-delà d'un jour la page traînait ouverte.
const DELAI_MINIMAL_MS = 1_000;
const DELAI_MAXIMAL_MS = 24 * 3_600_000;

type Visiteur = {
  // Le compte, quand le visiteur en a un et présente son jeton de session.
  userId?: string;
  email?: string;
  ip?: string;
  // Le jeton d'une réservation déjà confirmée, présenté au retour.
  jetonVisite?: string;
};

@Injectable()
export class SharedWishlistService {
  private readonly journal = new Logger(SharedWishlistService.name);

  // @Inject explicites : voir WaitlistService, même contrainte esbuild/vitest
  // (design:paramtypes n'est pas émis).
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RateLimitService) private readonly limiter: RateLimitService,
    // Réutilisé pour son HMAC SEUL, pas pour sa table : le dictionnaire range
    // le code sur `wish_reservation.code_hash`, « même type et même règle que
    // OTPCode.code_hash ». Recopier la formule ici la ferait diverger le jour
    // d'une rotation de clé, et les anciens codes cesseraient de se vérifier
    // sans que rien ne le dise.
    @Inject(OtpService) private readonly otp: OtpService,
    @Inject("MAIL_PORT") private readonly mail: MailPort,
  ) {}

  // ── La page ───────────────────────────────────────────────────────────────

  async voir(token: string, visiteur: Visiteur = {}): Promise<SharedWishlist> {
    // Borne de longueur avant toute lecture : la colonne fait 32 caractères, et
    // une surface sans session ne doit pas accepter d'entrée non bornée. Rien à
    // chercher au-delà — c'est un refus, pas une recherche qui échoue.
    if (token.length === 0 || token.length > 32) throw ABSENT();

    const lien = await this.prisma.wishlistShareLink.findUnique({
      where: { token },
      include: {
        wishlist: {
          include: {
            occurrence: { include: { event: { include: { person: true } }, user: true } },
          },
        },
      },
    });

    /* Un jeton INCONNU rend 404 ; un jeton RÉVOQUÉ dit qu'il l'est. La
       distinction est voulue : celui qui tient un lien révoqué sait déjà qu'il
       a existé, et lui répondre « cette page n'existe pas » le ferait conclure
       à une panne et réessayer. Elle ne se paie d'aucune fuite tant que les
       jetons ne s'énumèrent pas — trente-deux caractères tirés au hasard. */
    if (!lien) throw ABSENT();
    if (!lien.isActive) return { state: "revoked" };

    const occurrence = lien.wishlist.occurrence;
    const souhaits = await this.prisma.ownerWish.findMany({
      // `isPublic` filtré EN BASE, jamais après coup : un souhait gardé pour
      // soi ne doit pas transiter, même pour être écarté au rendu.
      where: { eventOccurrenceId: occurrence.id, isPublic: true },
      orderBy: [{ position: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      include: { reservations: { where: { status: "confirmed" }, take: 1 } },
    });

    const miennes = await this.siennes(visiteur, souhaits.map((s) => s.id));

    return {
      state: "ok",
      // Le PRÉNOM d'usage, jamais l'adresse ni le nom complet : la page
      // accueille, elle ne présente pas une fiche.
      ownerFirstName: prenom(occurrence.event.person.callingName
        ?? occurrence.event.person.displayName
        ?? occurrence.user.displayName
        ?? occurrence.user.username),
      ownerAvatarUrl: occurrence.event.person.avatarUrl ?? occurrence.user.avatarUrl,
      occasionLabel: occurrence.event.label ?? null,
      occasionDate: jour(occurrence.occurrenceDate),
      // Calculé ICI, pas au client : deux versions du parc et deux fuseaux
      // donneraient deux réponses sur la même liste.
      acceptsReservations: !estPassee(occurrence.occurrenceDate),
      wishes: souhaits.map((s) => ({
        id: s.id,
        label: s.label,
        imageUrl: s.imageUrl,
        details: s.details,
        link: s.link,
        price: s.price === null ? null : s.price.toNumber(),
        currency: s.currency,
        // QUE c'est réservé. Le nom éventuellement donné l'a été au
        // propriétaire, pas aux autres visiteurs : il ne franchit jamais cette
        // frontière, pas même sous condition.
        isReserved: s.status === "reserved",
        isFulfilled: s.status === "fulfilled",
        reservedByMe: miennes.has(s.id),
      })),
    };
  }

  /* Lesquels de ces souhaits sont à MOI, et à moi seul.
   *
   * On remonte du jeton à l'ADRESSE, puis de l'adresse à toutes les
   * réservations confirmées. Le jeton est unique par réservation (contrainte de
   * la table) : s'en tenir à lui ne signalerait que le dernier cadeau réservé,
   * et le visiteur qui en a pris deux n'en reverrait qu'un. « C'est l'adresse
   * qui fait l'identité, le jeton n'étant qu'un raccourci. » */
  private async siennes(visiteur: Visiteur, ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();

    const ou: Prisma.WishReservationWhereInput[] = [];
    if (visiteur.userId) ou.push({ userId: visiteur.userId });
    if (visiteur.email) ou.push({ email: visiteur.email });
    if (visiteur.jetonVisite) {
      const porteur = await this.prisma.wishReservation.findUnique({
        where: { sessionTokenHash: condense(visiteur.jetonVisite) },
        select: { email: true },
      });
      // Jeton inconnu : on ne signale rien, et on ne le dit pas non plus. La
      // page se lit sans lui.
      if (porteur) ou.push({ email: porteur.email });
    }
    if (ou.length === 0) return new Set();

    const lignes = await this.prisma.wishReservation.findMany({
      where: { status: "confirmed", ownerWishId: { in: ids }, OR: ou },
      select: { ownerWishId: true },
    });
    return new Set(lignes.map((l) => l.ownerWishId));
  }

  // ── Réserver ──────────────────────────────────────────────────────────────

  async reserver(
    wishId: string, input: ReserveWishInput, visiteur: Visiteur,
  ): Promise<ReserveOutcome> {
    this.refuserLesRobots(input);

    /* L'adresse du COMPTE quand il y en a un : « son adresse est déjà vérifiée
       par son compte », et accepter celle du corps laisserait un utilisateur
       connecté réserver sous une adresse qui n'est pas la sienne — puis la
       retrouver dans « mes réservations » de quelqu'un d'autre. */
    const email = visiteur.email ?? input.email;
    if (!email) {
      throw new AppError("validation_failed", "une adresse est requise", {
        email: "requise pour un visiteur sans compte",
      });
    }
    assertUsableEmail(email);

    const canonique = canonicalEmail(email);
    await this.limiter.hit(`reservation:email:${canonique}`, PLAFOND_ADRESSE, FENETRE_MS);
    if (visiteur.ip) await this.limiter.hit(`reservation:ip:${visiteur.ip}`, PLAFOND_ORIGINE, FENETRE_MS);

    const souhait = await this.souhaitReservable(wishId);

    // Le nom n'est retenu que s'il doit servir : le garder sans `showIdentity`
    // serait conserver une donnée dont on s'est engagé à ne rien faire.
    const showIdentity = input.showIdentity ?? false;
    const displayName = showIdentity ? (input.displayName ?? null) : null;

    if (visiteur.userId) {
      /* L'utilisateur connecté réserve EN UN GESTE : rien à vérifier, son
         adresse l'est déjà. La ligne naît donc `confirmed`, et c'est l'index
         unique partiel — jamais une lecture préalable — qui garantit qu'un seul
         y arrive. */
      const reservation = await this.confirmerDirectement(
        souhait.id, visiteur.userId, email, displayName, showIdentity,
      );
      return {
        state: "confirmed",
        reservationId: reservation.id,
        sessionToken: reservation.jeton,
      };
    }

    /* Les demandes en attente de CETTE adresse sur CE souhait sont périmées
       avant d'en écrire une neuve : sinon plusieurs codes vivent en parallèle,
       et le plafond de tentatives se contourne en en redemandant un autre.
       Même règle que OtpService.issue. */
    await this.prisma.wishReservation.updateMany({
      where: { ownerWishId: souhait.id, email, status: "pending" },
      data: { status: "expired" },
    });

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAt = new Date(Date.now() + TTL_MS);
    const reservation = await this.prisma.wishReservation.create({
      data: {
        ownerWishId: souhait.id,
        email,
        displayName,
        showIdentity,
        codeHash: this.otp.hash(code),
        expiresAt,
      },
    });

    /* Le souhait N'EST PAS marqué réservé ici, et c'est le point du mécanisme :
       tant que la demande est en attente, le cadeau demeure disponible pour un
       autre. L'inverse laisserait une adresse inventée bloquer un cadeau
       jusqu'à l'expiration. */
    const locale = input.locale ?? "fr";
    /* L'envoi est ATTENDU, contrairement à la confirmation de liste d'attente :
       là l'adresse capturée valait plus que le courriel, ici le code EST le
       geste. Une panne d'acheminement laisserait le visiteur devant un champ
       qu'aucun code ne viendra remplir, et il n'aurait aucun moyen de le
       savoir. Mieux vaut qu'il voie l'échec et recommence. */
    await this.mail.send({ to: email, locale, ...reservationCodeEmail({ code, locale }) });

    return { state: "code_sent", reservationId: reservation.id, expiresAt: expiresAt.toISOString() };
  }

  // ── Confirmer ─────────────────────────────────────────────────────────────

  async verifier(
    wishId: string, input: VerifyReservationInput,
  ): Promise<ReservationConfirmed & { showIdentity: boolean; commenceeIlYA: number }> {
    const ligne = await this.prisma.wishReservation.findFirst({
      where: { ownerWishId: wishId, email: input.email, status: "pending" },
      orderBy: { createdAt: "desc" },
    });
    if (!ligne || !ligne.codeHash) {
      await this.direSiCaduque(wishId, input.email);
      // Même message pour « aucune demande » et « demande d'un autre souhait » :
      // distinguer les deux ferait de ce chemin un test d'existence.
      throw new AppError("otp_invalid", "no pending reservation");
    }
    if (ligne.attempts >= MAX_TENTATIVES)
      throw new AppError("otp_too_many_attempts", "code burnt after too many attempts");
    if (ligne.expiresAt.getTime() < Date.now())
      throw new AppError("otp_expired", "code expired");

    if (!this.otp.matches(ligne.codeHash, input.code)) {
      /* Incrément CONDITIONNEL : le plafond est revérifié au moment d'écrire,
         pas seulement à la lecture d'avant. Sans ça, une rafale de tentatives
         concurrentes liraient toutes un compteur encore sous le plafond et le
         dépasseraient de plusieurs essais. Même parade que OtpService. */
      const { count } = await this.prisma.wishReservation.updateMany({
        where: { id: ligne.id, attempts: { lt: MAX_TENTATIVES } },
        data: { attempts: { increment: 1 } },
      });
      if (count === 0) throw new AppError("otp_too_many_attempts", "code burnt after too many attempts");
      throw new AppError("otp_invalid", "code does not match");
    }

    const jeton = randomBytes(32).toString("hex");

    /* LE MOMENT CRITIQUE. Deux choses s'y jouent, et aucune ne se règle par une
       lecture préalable :
       — le REJEU : `status: "pending"` dans le WHERE de l'écriture. Deux appels
         avec le même bon code liraient tous deux `pending` avant que l'un
         n'écrive ; ici Postgres réévalue la condition sous verrou de ligne, et
         un seul gagne. Le perdant le sait par count === 0.
       — la COURSE ENTRE DEUX VISITEURS : l'index unique partiel sur
         (owner_wish_id) where status = 'confirmed'. Il n'y a rien à vérifier
         avant : c'est la base qui tranche, et elle ne peut pas se tromper de
         quelques millisecondes. */
    try {
      const { count } = await this.prisma.wishReservation.updateMany({
        where: { id: ligne.id, status: "pending", attempts: { lt: MAX_TENTATIVES } },
        data: {
          status: "confirmed",
          confirmedAt: new Date(),
          sessionTokenHash: condense(jeton),
          // Le code est BRÛLÉ, pas seulement consommé : même si un chemin
          // futur relisait une ligne confirmée, il n'y aurait plus rien à
          // comparer.
          codeHash: null,
        },
      });
      if (count === 0) throw new AppError("otp_invalid", "code already consumed");
    } catch (erreur) {
      if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === "P2002") {
        /* Quelqu'un a confirmé entre-temps. « La demande en attente est
           signalée comme caduque » : on la marque, pour que le visiteur ne la
           retrouve pas éternellement en attente, et on le dit franchement —
           `conflict`, pas une erreur de code, qui lui ferait croire qu'il a mal
           recopié. */
        await this.prisma.wishReservation.updateMany({
          where: { id: ligne.id, status: "pending" },
          data: { status: "expired" },
        });
        throw new AppError("conflict", "ce cadeau vient d'être réservé par quelqu'un d'autre");
      }
      throw erreur;
    }

    await this.apresConfirmation(wishId, ligne.id);

    return {
      reservationId: ligne.id,
      wishId,
      sessionToken: jeton,
      showIdentity: ligne.showIdentity,
      commenceeIlYA: Math.round((Date.now() - ligne.createdAt.getTime()) / 1000),
    };
  }

  /* « Si quelqu'un d'autre confirme entre-temps, la demande en attente est
     signalée comme CADUQUE. »
     Sans ce détour, la visiteuse dont la demande a été périmée par la
     confirmation d'un autre saisirait son code et s'entendrait dire qu'il est
     invalide : elle le retaperait, puis en redemanderait un, et ne comprendrait
     jamais. `conflict` lui dit ce qui s'est passé.

     Rien ne fuit ici : elle a reçu ce code à SON adresse sur CE cadeau, et la
     page publique affiche déjà qu'il est pris. */
  private async direSiCaduque(wishId: string, email: string): Promise<void> {
    const sienne = await this.prisma.wishReservation.findFirst({
      where: { ownerWishId: wishId, email, status: { not: "confirmed" } },
    });
    if (!sienne) return;
    const prise = await this.prisma.wishReservation.count({
      where: { ownerWishId: wishId, status: "confirmed" },
    });
    if (prise > 0) {
      throw new AppError("conflict", "ce cadeau vient d'être réservé par quelqu'un d'autre");
    }
  }

  // ── Les pièces communes ───────────────────────────────────────────────────

  private async souhaitReservable(wishId: string): Promise<{ id: string }> {
    const souhait = await this.prisma.ownerWish.findFirst({
      where: {
        id: wishId,
        // Un souhait gardé pour soi n'est pas réservable, et n'existe pas pour
        // un visiteur : 404, jamais un refus qui dirait qu'il est là.
        isPublic: true,
      },
      include: {
        occurrence: { include: { wishlist: { include: { shareLinks: { where: { isActive: true } } } } } },
        reservations: { where: { status: "confirmed" }, take: 1 },
      },
    });
    if (!souhait) throw ABSENT();

    const liste = souhait.occurrence.wishlist;
    // Sans liste ouverte ni lien actif, la page publique n'existe pas : le
    // souhait n'est atteignable que par un identifiant deviné.
    if (!liste || liste.shareLinks.length === 0) throw ABSENT();

    /* Ces trois-là sont des REFUS, pas des absences : le visiteur voit la page,
       il doit comprendre pourquoi le bouton ne marche pas. 422 (resource_inactive
       et conflict) plutôt que 404, qui lui ferait croire à une panne. */
    if (estPassee(souhait.occurrence.occurrenceDate))
      throw new AppError("resource_inactive", "cette occasion est passée");
    if (souhait.status === "fulfilled")
      throw new AppError("resource_inactive", "ce cadeau a déjà été offert");
    if (souhait.reservations.length > 0)
      throw new AppError("conflict", "ce cadeau est déjà réservé");

    return { id: souhait.id };
  }

  private async confirmerDirectement(
    wishId: string, userId: string, email: string,
    displayName: string | null, showIdentity: boolean,
  ): Promise<{ id: string; jeton: string }> {
    const jeton = randomBytes(32).toString("hex");
    try {
      const ligne = await this.prisma.wishReservation.create({
        data: {
          ownerWishId: wishId,
          userId,
          email,
          displayName,
          showIdentity,
          status: "confirmed",
          confirmedAt: new Date(),
          sessionTokenHash: condense(jeton),
          // Aucun code : son adresse est déjà vérifiée par son compte, et lui
          // en envoyer un n'apprendrait rien à personne.
          codeHash: null,
          // La colonne est requise. Une réservation confirmée ne se libère
          // jamais par le temps ; on pose donc l'instant de la confirmation
          // plutôt qu'une échéance à venir, qui laisserait croire le contraire.
          expiresAt: new Date(),
        },
      });
      await this.apresConfirmation(wishId, ligne.id);
      return { id: ligne.id, jeton };
    } catch (erreur) {
      if (erreur instanceof Prisma.PrismaClientKnownRequestError && erreur.code === "P2002") {
        throw new AppError("conflict", "ce cadeau vient d'être réservé par quelqu'un d'autre");
      }
      throw erreur;
    }
  }

  private async apresConfirmation(wishId: string, reservationId: string): Promise<void> {
    /* Les autres demandes en attente deviennent CADUQUES. Sans ça, elles
       resteraient vérifiables : un second visiteur saisirait son code et se
       heurterait à l'index unique, alors qu'on peut le lui dire plus tôt. */
    await this.prisma.wishReservation.updateMany({
      where: { ownerWishId: wishId, status: "pending" },
      data: { status: "expired" },
    });

    // `reserved` est DÉRIVÉ, et c'est ici qu'il se dérive : nulle part ailleurs
    // le statut ne se pose, et aucun chemin du propriétaire ne l'accepte.
    await this.prisma.ownerWish.update({
      where: { id: wishId },
      data: { status: "reserved" },
    });

    await this.prevenirLeProprietaire(wishId, reservationId);
  }

  /* « Le propriétaire est prévenu de chaque réservation confirmée — c'est ce
     qui rend la liste vivante après le partage. »
     Au mieux : une notification perdue ne doit pas défaire une réservation déjà
     acquise, ni faire échouer l'appel du visiteur, qui n'y peut rien. Même
     règle que la confirmation de la liste d'attente. */
  private async prevenirLeProprietaire(wishId: string, reservationId: string): Promise<void> {
    try {
      const souhait = await this.prisma.ownerWish.findUniqueOrThrow({
        where: { id: wishId },
        include: { occurrence: true, reservations: { where: { id: reservationId } } },
      });
      const reservation = souhait.reservations[0];
      await this.prisma.notification.create({
        data: {
          userId: souhait.occurrence.userId,
          type: "wish_reserved",
          eventOccurrenceId: souhait.eventOccurrenceId,
          channel: "in_app",
          titleKey: "wish_reserved",
          /* Le nom SEULEMENT s'il a été autorisé. C'est le même arbitrage que
             sur l'écran, et il doit se rejouer ici : une notification qui
             nommerait l'anonyme gâcherait la surprise plus sûrement qu'un
             écran, puisqu'elle s'affiche sans qu'on l'ait demandée. */
          bodyParams: reservation?.showIdentity && reservation.displayName
            ? { wishLabel: souhait.label, by: reservation.displayName }
            : { wishLabel: souhait.label },
          targetRoute: `/wishlists/occurrence/${souhait.eventOccurrenceId}`,
          // Une notification par réservation, pas une par passage : rejouer
          // l'appel ne doit pas en poser deux.
          dedupeKey: `wish_reserved:${reservationId}`,
          scheduledFor: new Date(),
        },
      });
    } catch (erreur) {
      this.journal.warn(
        `réservation confirmée sans notification au propriétaire : ${erreur instanceof Error ? erreur.message : "cause inconnue"}`,
      );
    }
  }

  /* Deux filtres à robots ordinaires, franchissables l'un et l'autre par qui
   * s'en donne la peine — ce sont des économies de bruit, pas des remparts. Le
   * rempart, ce sont les plafonds, qui ne dépendent d'aucune coopération.
   *
   * UN SEUL code et UN SEUL message : `AppError.toEnvelope` renvoie le message
   * au client tel quel, donc deux libellés distincts diraient au robot lequel
   * des deux filtres a mordu — et il s'ajusterait. La distinction n'existe que
   * dans le journal. */
  private refuserLesRobots(input: ReserveWishInput): void {
    const refuser = (cause: string): never => {
      this.journal.warn(`réservation écartée : ${cause}`);
      throw new AppError("reservation_rejected", "submission rejected");
    };

    if (input.website !== undefined && input.website !== "") refuser("champ leurre rempli");
    if (input.renderedAt !== undefined) {
      const ecoule = Date.now() - input.renderedAt;
      if (ecoule < DELAI_MINIMAL_MS || ecoule > DELAI_MAXIMAL_MS) {
        refuser(`délai de soumission invraisemblable (${ecoule} ms)`);
      }
    }
  }
}

// Le jeton de visite est tiré au hasard sur 256 bits : un condensé nu suffit,
// il n'y a rien à énumérer. Même raisonnement que TokenService pour le jeton de
// rafraîchissement — à l'inverse du code à six chiffres, qui exige une clé.
function condense(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

// `date` en base, sans heure ni fuseau : toISOString() ferait basculer d'un
// jour pour un client à l'ouest de Greenwich — un anniversaire du 24 se lirait
// le 23.
function jour(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function estPassee(d: Date): boolean {
  const maintenant = new Date();
  const aujourdhui = new Date(Date.UTC(
    maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate(),
  ));
  return jour(d) < jour(aujourdhui);
}

// Le premier mot du nom d'usage. « Voilà ce qui me ferait plaisir » est signé
// d'un prénom, pas d'un état civil.
function prenom(nom: string): string {
  return nom.trim().split(/\s+/)[0] ?? nom;
}

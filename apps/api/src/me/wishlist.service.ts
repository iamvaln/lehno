import { Inject, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type {
  CreateOwnerWishInput, MyReservation, OwnerWish, UpdateOwnerWishInput,
  Wishlist, WishlistShare,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";

// Message unique, comme TenantRepository : hors périmètre et inexistant doivent
// être indistinguables, sans quoi l'identifiant devient un oracle.
const ABSENT = (): AppError => new AppError("not_found", "resource not found");

// Trente-deux caractères tirés au hasard, comme `collection_link.token` : le
// jeton est l'unique autorisation de la page publique, donc il doit résister à
// l'énumération. Base32 sans caractères ambigus — un lien se recopie parfois à
// la main depuis un écran.
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
function jetonDePartage(): string {
  const octets = randomBytes(32);
  let sortie = "";
  for (const o of octets) sortie += ALPHABET[o % ALPHABET.length];
  return sortie;
}

type LigneSouhait = {
  id: string;
  eventOccurrenceId: string;
  label: string;
  link: string | null;
  imageUrl: string | null;
  details: string | null;
  price: { toNumber(): number } | null;
  currency: string | null;
  status: string;
  isPublic: boolean;
  position: number | null;
};

@Injectable()
export class WishlistService {
  // @Inject explicite : voir WishService — sous vitest/esbuild,
  // design:paramtypes n'est pas émis, et un paramètre typé sans jeton explicite
  // se résoudrait à `undefined` chez Nest.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject("PUBLIC_WEB_URL") private readonly siteWeb: string,
  ) {}

  // ── Les listes ────────────────────────────────────────────────────────────

  async list(userId: string): Promise<Wishlist[]> {
    const lignes = await this.prisma.wishlist.findMany({
      // Le cloisonnement remonte la chaîne liste → occurrence → compte, comme
      // les souhaits de proche. `event_occurrence.user_id` suffit : la colonne
      // existe et porte déjà le propriétaire de l'échéance.
      where: { occurrence: { userId } },
      include: {
        occurrence: { include: { event: true } },
        shareLinks: { where: { isActive: true } },
      },
      // Les échéances les plus proches en tête : c'est celle qui approche qu'on
      // vient tenir.
      orderBy: { occurrence: { occurrenceDate: "asc" } },
    });

    // Les comptes en UNE requête plutôt qu'une par liste : un carnet tient une
    // poignée d'occasions, mais la forme se garde de la boucle N+1 par principe.
    const ids = lignes.map((l) => l.eventOccurrenceId);
    const parOccasion = await this.prisma.ownerWish.groupBy({
      by: ["eventOccurrenceId", "status"],
      where: { eventOccurrenceId: { in: ids } },
      _count: { _all: true },
    });

    return lignes.map((l) => {
      const compte = parOccasion.filter((c) => c.eventOccurrenceId === l.eventOccurrenceId);
      const total = compte.reduce((n, c) => n + c._count._all, 0);
      const reserves = compte
        .filter((c) => c.status === "reserved")
        .reduce((n, c) => n + c._count._all, 0);
      return {
        id: l.id,
        occurrenceId: l.eventOccurrenceId,
        occurrenceDate: jour(l.occurrence.occurrenceDate),
        eventKind: l.occurrence.event.kind,
        eventLabel: l.occurrence.event.label ?? null,
        wishCount: total,
        reservedCount: reserves,
        isShared: l.shareLinks.length > 0,
        isArchived: estPassee(l.occurrence.occurrenceDate),
      };
    });
  }

  async create(userId: string, occurrenceId: string): Promise<Wishlist> {
    /* L'occasion doit être une occasion À MOI — au sens de la self-Person, pas
       seulement du compte. `event_occurrence.user_id` dit à qui appartient le
       carnet ; il vaut aussi pour l'anniversaire d'un proche. Ouvrir une liste
       dessus publierait à des visiteurs ce que ce proche m'a confié en privé,
       et c'est exactement la confusion que le dictionnaire sépare entre
       `WishlistItem` et `OwnerWish`. */
    const occurrence = await this.prisma.eventOccurrence.findFirst({
      where: { id: occurrenceId, userId, event: { person: { isSelf: true } } },
    });
    if (!occurrence) throw ABSENT();

    // `create` plutôt qu'un findFirst suivi d'un create : l'unicité de
    // `event_occurrence_id` tranche sans course, là où deux appels simultanés
    // ouvriraient deux listes sur la même occasion.
    try {
      await this.prisma.wishlist.create({ data: { eventOccurrenceId: occurrenceId } });
    } catch {
      throw new AppError("conflict", "une liste existe déjà pour cette occasion");
    }
    const rendues = await this.list(userId);
    const nouvelle = rendues.find((l) => l.occurrenceId === occurrenceId);
    if (!nouvelle) throw new AppError("internal_error", "liste créée puis introuvable");
    return nouvelle;
  }

  // La liste du demandeur, ou 404. Point de passage de toutes les écritures :
  // une garde écrite une fois ne s'oublie pas au chemin suivant.
  private async mienneOuAbsente(userId: string, wishlistId: string): Promise<{ id: string; eventOccurrenceId: string }> {
    const liste = await this.prisma.wishlist.findFirst({
      where: { id: wishlistId, occurrence: { userId } },
      select: { id: true, eventOccurrenceId: true },
    });
    if (!liste) throw ABSENT();
    return liste;
  }

  // ── Les souhaits d'une liste ──────────────────────────────────────────────

  async listWishes(userId: string, wishlistId: string): Promise<OwnerWish[]> {
    const liste = await this.mienneOuAbsente(userId, wishlistId);
    const lignes = await this.prisma.ownerWish.findMany({
      where: { eventOccurrenceId: liste.eventOccurrenceId },
      // L'ordre appartient au propriétaire (brief §3) : `position` d'abord,
      // l'ancienneté ensuite pour ce qu'il n'a pas rangé. `nulls: "last"` —
      // sans quoi Postgres remonte les non rangés en tête sur un tri croissant.
      orderBy: [{ position: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      include: {
        /* La réservation CONFIRMÉE seule, et seulement pour en tirer un nom
           autorisé. Rien d'autre de cette ligne ne remonte : ni l'adresse, ni
           l'identifiant de compte, ni la date. */
        reservations: { where: { status: "confirmed" }, take: 1 },
      },
    });
    return lignes.map((l) => rendre(liste.id, l as unknown as LigneSouhait, l.reservations[0] ?? null));
  }

  async createWish(userId: string, wishlistId: string, input: CreateOwnerWishInput): Promise<OwnerWish> {
    const liste = await this.mienneOuAbsente(userId, wishlistId);
    const ligne = await this.prisma.ownerWish.create({
      data: {
        eventOccurrenceId: liste.eventOccurrenceId,
        label: input.label,
        link: input.link ?? null,
        details: input.details ?? null,
        price: input.price ?? null,
        currency: input.currency ?? null,
        isPublic: input.isPublic ?? true,
        position: input.position ?? null,
        // `status` naît `available` par défaut de colonne : ni réservé, ni
        // offert. Le poser ici laisserait croire qu'il se choisit.
      },
    });
    return rendre(liste.id, ligne as unknown as LigneSouhait, null);
  }

  async updateWish(userId: string, id: string, input: UpdateOwnerWishInput): Promise<OwnerWish> {
    const actuel = await this.mienOuAbsent(userId, id);

    /* « Un prix porte sa devise » se vérifie sur le souhait APRÈS fusion, pas
       sur le corps envoyé : un PATCH { currency: null } le traverse sans
       encombre — il ne porte aucun prix — et laisserait un souhait à 12 000
       sans dire de quoi. La règle appartient à l'état final. */
    const prix = input.price !== undefined ? input.price : (actuel.price?.toNumber() ?? null);
    const devise = input.currency !== undefined ? input.currency : actuel.currency;
    if (prix !== null && devise === null) {
      throw new AppError("validation_failed", "un prix porte sa devise", {
        currency: "requise dès qu'un prix est fixé",
      });
    }

    /* Un souhait RÉSERVÉ ne redevient pas disponible d'un PATCH. Quelqu'un
       s'est engagé à l'offrir et a reçu la confirmation ; le repasser
       `available` le laisserait réserver une seconde fois par un autre, et les
       deux offriraient la même chose — ce que tout ce mécanisme existe pour
       éviter. Le retirer reste possible : c'est un geste explicite (DELETE),
       pas le sous-produit d'une correction de libellé. */
    if (input.status === "available" && actuel.status === "reserved") {
      throw new AppError("conflict", "un souhait réservé ne redevient pas disponible");
    }

    const { count } = await this.prisma.ownerWish.updateMany({
      // Le périmètre reste dans le WHERE de l'écriture, jamais seulement dans
      // la lecture d'avant : entre les deux, rien ne garantit que la ligne
      // n'ait pas changé de main.
      where: { id, occurrence: { userId } },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.link !== undefined ? { link: input.link } : {}),
        ...(input.details !== undefined ? { details: input.details } : {}),
        ...(input.price !== undefined ? { price: input.price } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
      },
    });
    if (count === 0) throw ABSENT();

    const ligne = await this.prisma.ownerWish.findFirstOrThrow({
      where: { id },
      include: { reservations: { where: { status: "confirmed" }, take: 1 } },
    });
    const liste = await this.prisma.wishlist.findFirst({
      where: { eventOccurrenceId: ligne.eventOccurrenceId },
      select: { id: true },
    });
    return rendre(liste?.id ?? "", ligne as unknown as LigneSouhait, ligne.reservations[0] ?? null);
  }

  async removeWish(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.ownerWish.deleteMany({
      where: { id, occurrence: { userId } },
    });
    if (count === 0) throw ABSENT();
  }

  private async mienOuAbsent(userId: string, id: string): Promise<{
    price: { toNumber(): number } | null; currency: string | null; status: string;
  }> {
    const ligne = await this.prisma.ownerWish.findFirst({
      where: { id, occurrence: { userId } },
      select: { price: true, currency: true, status: true },
    });
    if (!ligne) throw ABSENT();
    return ligne;
  }

  // ── Le partage ────────────────────────────────────────────────────────────

  /* Rend le lien actif, et en frappe un s'il n'y en a pas.
   *
   * Idempotent à dessein : rouvrir la feuille de partage ne doit pas frapper un
   * jeton neuf. Sinon l'adresse déjà collée dans un groupe cesserait de valoir
   * au premier réappui sur « Partager » — et personne ne comprendrait pourquoi. */
  async share(userId: string, wishlistId: string): Promise<WishlistShare> {
    const liste = await this.mienneOuAbsente(userId, wishlistId);
    const actif = await this.prisma.wishlistShareLink.findFirst({
      where: { wishlistId: liste.id, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    const lien = actif ?? await this.prisma.wishlistShareLink.create({
      data: { wishlistId: liste.id, token: jetonDePartage() },
    });
    return { token: lien.token, url: this.adresse(lien.token), createdAt: lien.createdAt.toISOString() };
  }

  /* Révoquer, c'est éteindre les liens actifs — jamais les effacer.
   *
   * La ligne survit pour que le lien déjà partagé puisse répondre « ce lien
   * n'est plus actif » plutôt que « cette page n'existe pas ». Un `404` sur un
   * lien qu'on tient dans la main est le pire des deux messages : il donne à
   * croire à une panne, et on réessaie. */
  async revokeShare(userId: string, wishlistId: string): Promise<void> {
    const liste = await this.mienneOuAbsente(userId, wishlistId);
    await this.prisma.wishlistShareLink.updateMany({
      where: { wishlistId: liste.id, isActive: true },
      data: { isActive: false },
    });
  }

  private adresse(token: string): string {
    return `${this.siteWeb.replace(/\/+$/, "")}/l/${token}`;
  }

  // ── Ce que J'AI réservé chez les autres (écran 3.27) ──────────────────────

  async myReservations(userId: string): Promise<MyReservation[]> {
    const moi = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId }, select: { email: true },
    });

    const lignes = await this.prisma.wishReservation.findMany({
      /* Par le compte OU par l'adresse : « les réservations faites sans compte,
         avant de s'inscrire, rejoignent cet écran dès que l'adresse coïncide »
         (UX 3.27). C'est l'adresse qui fait l'identité — la colonne est en
         citext, donc la casse ne sépare pas deux fois la même boîte. */
      where: {
        status: "confirmed",
        OR: [{ userId }, { email: moi.email }],
      },
      include: {
        ownerWish: {
          include: { occurrence: { include: { user: true } } },
        },
      },
      orderBy: { ownerWish: { occurrence: { occurrenceDate: "asc" } } },
    });

    return lignes.map((l) => ({
      id: l.id,
      wishId: l.ownerWishId,
      wishLabel: l.ownerWish.label,
      wishImageUrl: l.ownerWish.imageUrl,
      price: l.ownerWish.price === null ? null : l.ownerWish.price.toNumber(),
      currency: l.ownerWish.currency,
      ownerDisplayName: l.ownerWish.occurrence.user.displayName ?? l.ownerWish.occurrence.user.username,
      ownerUsername: l.ownerWish.occurrence.user.username,
      occurrenceDate: jour(l.ownerWish.occurrence.occurrenceDate),
      showIdentity: l.showIdentity,
      confirmedAt: (l.confirmedAt ?? l.createdAt).toISOString(),
    }));
  }
}

// La date d'échéance est un `date` en base, sans heure ni fuseau. La rendre par
// toISOString() la ferait basculer d'un jour pour un client à l'ouest de
// Greenwich — un anniversaire du 24 se lirait le 23.
function jour(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function estPassee(d: Date): boolean {
  const aujourdhui = new Date();
  return jour(d) < jour(new Date(Date.UTC(
    aujourdhui.getUTCFullYear(), aujourdhui.getUTCMonth(), aujourdhui.getUTCDate(),
  )));
}

/* LA FRONTIÈRE que ce lot ne doit pas franchir.
 *
 * Le propriétaire apprend QU'un souhait est réservé, et le NOM du réservant
 * seulement si celui-ci l'a autorisé. Rien d'autre ne sort : ni l'adresse, ni
 * l'identifiant de compte, ni l'instant de la réservation — recoupés avec un
 * Mur ou une liste d'amis, ils désignent la personne aussi sûrement qu'un nom.
 *
 * On liste donc les champs un par un plutôt que d'étaler la ligne : un
 * `...ligne` laisserait entrer, au premier champ ajouté à la table, ce que
 * personne n'a décidé d'exposer. Et cette fuite-là ne se voit qu'à l'usage,
 * quand la surprise est déjà gâchée. */
function rendre(
  wishlistId: string,
  l: LigneSouhait,
  reservation: { showIdentity: boolean; displayName: string | null } | null,
): OwnerWish {
  return {
    id: l.id,
    wishlistId,
    label: l.label,
    link: l.link,
    imageUrl: l.imageUrl,
    details: l.details,
    // Decimal → nombre : un Decimal sérialisé sortirait en chaîne, et un client
    // qui compare des prix comparerait des chaînes — « 9 000 » passerait alors
    // devant « 12 000 ».
    price: l.price === null ? null : l.price.toNumber(),
    currency: l.currency,
    status: l.status as OwnerWish["status"],
    isPublic: l.isPublic,
    position: l.position,
    reservedByName: reservation?.showIdentity ? reservation.displayName : null,
  };
}

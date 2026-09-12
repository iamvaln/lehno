import { Inject, Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import type {
  CreateOwnerWishInput, MyReservation, OwnerWish, UpdateOwnerWishInput, UpdateWishlistInput,
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
  imageKey: string | null;
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
      /* Le cloisonnement se lit EN DIRECT. Il remontait la chaîne liste →
         occurrence → compte, ce qui traversait une table qui ne répond pas à la
         question — l'occurrence dit QUAND, pas À QUI — et laissait une liste
         sans occasion hors de portée. */
      where: { userId },
      include: {
        occurrence: { include: { event: true } },
        shareLinks: { where: { isActive: true } },
      },
      /* Les échéances les plus proches en tête : c'est celle qui approche qu'on
         vient tenir. Une liste SANS occasion n'a pas de date et se range en
         queue — Postgres place les nuls en dernier sur un tri croissant, ce qui
         est ici le comportement voulu et non un hasard dont on profite : une
         liste sans échéance n'a aucune raison de passer devant l'anniversaire
         de la semaine prochaine.
         (`nulls: "last"` ne s'écrit pas à travers une relation chez Prisma —
         seulement sur un champ scalaire.) */
      orderBy: { occurrence: { occurrenceDate: "asc" } },
    });

    // Les comptes en UNE requête plutôt qu'une par liste : un carnet tient une
    // poignée d'occasions, mais la forme se garde de la boucle N+1 par principe.
    const parListe = await this.prisma.ownerWish.groupBy({
      by: ["wishlistId", "status"],
      where: { wishlistId: { in: lignes.map((l) => l.id) } },
      _count: { _all: true },
    });

    return lignes.map((l) => {
      const compte = parListe.filter((c) => c.wishlistId === l.id);
      const total = compte.reduce((n, c) => n + (c._count?._all ?? 0), 0);
      const reserves = compte
        .filter((c) => c.status === "reserved")
        .reduce((n, c) => n + (c._count?._all ?? 0), 0);
      const fin = l.closesAt !== null && l.closesAt.getTime() <= Date.now();
      return {
        id: l.id,
        occurrenceId: l.eventOccurrenceId,
        // Nul veut dire « composez-le depuis l'occasion » : le serveur ne le
        // compose pas à la place du client, qui a `eventLabel` et la date, et
        // qui sait dans quelle langue il affiche.
        name: l.name,
        /* Nuls ENSEMBLE quand la liste ne vise aucune occasion. Le client n'a
           alors que `name` pour la désigner — d'où le fait qu'il devienne le
           seul repère, et qu'on l'accepte à l'ouverture. */
        occurrenceDate: l.occurrence === null ? null : jour(l.occurrence.occurrenceDate),
        eventKind: l.occurrence?.event.kind ?? null,
        eventLabel: l.occurrence?.event.label ?? null,
        wishCount: total,
        reservedCount: reserves,
        isShared: l.shareLinks.length > 0,
        closesAt: l.closesAt?.toISOString() ?? null,
        /* DEUX CAUSES, UN SEUL DRAPEAU. L'occasion est passée, ou la clôture
           que le propriétaire a posée est franchie. Le client n'a pas à
           comparer des dates lui-même : il se tromperait de fuseau, et sa
           réponse divergerait de celle du serveur qui refuse les réservations.
           Sans occasion, seule la clôture décide — une liste qu'on tient
           indéfiniment ne s'archive jamais toute seule. */
        isArchived: (l.occurrence !== null && estPassee(l.occurrence.occurrenceDate)) || fin,
      };
    });
  }

  async create(userId: string, occurrenceId: string | null, options: { name?: string; closesAt?: string } = {}): Promise<Wishlist> {
    /* L'occasion doit être une occasion À MOI — au sens de la self-Person, pas
       seulement du compte. `event_occurrence.user_id` dit à qui appartient le
       carnet ; il vaut aussi pour l'anniversaire d'un proche. Ouvrir une liste
       dessus publierait à des visiteurs ce que ce proche m'a confié en privé,
       et c'est exactement la confusion que le dictionnaire sépare entre
       `WishlistItem` et `OwnerWish`. */
    if (occurrenceId !== null) {
      const occurrence = await this.prisma.eventOccurrence.findFirst({
        where: { id: occurrenceId, userId, event: { person: { isSelf: true } } },
      });
      if (!occurrence) throw ABSENT();
    }

    /* SANS OCCASION, IL N'Y A RIEN À VÉRIFIER — et c'est justement pourquoi la
       liste doit porter son propriétaire elle-même. Tant que le cloisonnement
       passait par l'occurrence, une liste qui n'en visait aucune était
       inaccessible à son auteur autant qu'aux autres. */

    // `create` plutôt qu'un findFirst suivi d'un create : l'unicité de
    // `event_occurrence_id` tranche sans course, là où deux appels simultanés
    // ouvriraient deux listes sur la même occasion.
    try {
      await this.prisma.wishlist.create({
        data: {
          userId,
          ...(occurrenceId === null ? {} : { eventOccurrenceId: occurrenceId }),
          ...(options.name === undefined ? {} : { name: options.name }),
          ...(options.closesAt === undefined ? {} : { closesAt: new Date(options.closesAt) }),
        },
      });
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
  /* LE PROPRIÉTAIRE SE LIT SUR LA LISTE, plus par l'occurrence. La chaîne
     traversait une table qui ne répond pas à la question, et laissait une liste
     sans occasion introuvable. */
  private async mienneOuAbsente(userId: string, wishlistId: string): Promise<{ id: string; eventOccurrenceId: string | null }> {
    const liste = await this.prisma.wishlist.findFirst({
      where: { id: wishlistId, userId },
      select: { id: true, eventOccurrenceId: true },
    });
    if (!liste) throw ABSENT();
    return liste;
  }

  // ── Les souhaits d'une liste ──────────────────────────────────────────────

  async listWishes(userId: string, wishlistId: string): Promise<OwnerWish[]> {
    const liste = await this.mienneOuAbsente(userId, wishlistId);
    const lignes = await this.prisma.ownerWish.findMany({
      where: { wishlistId: liste.id },
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

  /**
   * Renommer une liste, ou déplacer sa clôture.
   *
   * `null` REMET AU DÉFAUT, il ne vide pas un champ obligatoire : le nom
   * redevient « composé depuis l'occasion », la clôture redevient « à
   * l'occasion ». C'est la seule façon de revenir en arrière — sans lui, un nom
   * posé une fois ne pourrait plus qu'être remplacé.
   */
  async update(userId: string, id: string, input: UpdateWishlistInput): Promise<Wishlist> {
    const liste = await this.mienneOuAbsente(userId, id);
    await this.prisma.wishlist.update({
      where: { id: liste.id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.closesAt === undefined
          ? {}
          : { closesAt: input.closesAt === null ? null : new Date(input.closesAt) }),
      },
    });
    const rendues = await this.list(userId);
    const rendue = rendues.find((l) => l.id === id);
    if (!rendue) throw new AppError("internal_error", "liste modifiée puis introuvable");
    return rendue;
  }

  async createWish(userId: string, wishlistId: string, input: CreateOwnerWishInput): Promise<OwnerWish> {
    const liste = await this.mienneOuAbsente(userId, wishlistId);
    const ligne = await this.prisma.ownerWish.create({
      data: {
        wishlistId: liste.id,
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
      where: { id, wishlist: { userId } },
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
    // La liste est PORTÉE par le souhait maintenant : plus besoin de la
    // retrouver par l'occasion, ce qui échouait dès qu'il n'y en avait pas.
    return rendre(ligne.wishlistId, ligne as unknown as LigneSouhait, ligne.reservations[0] ?? null);
  }

  async removeWish(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.ownerWish.deleteMany({
      where: { id, wishlist: { userId } },
    });
    if (count === 0) throw ABSENT();
  }

  private async mienOuAbsent(userId: string, id: string): Promise<{
    price: { toNumber(): number } | null; currency: string | null; status: string;
  }> {
    const ligne = await this.prisma.ownerWish.findFirst({
      where: { id, wishlist: { userId } },
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
      /* Le propriétaire se lit maintenant SUR LA LISTE, et l'occasion à travers
         elle. Un souhait d'une liste sans occasion n'a pas de date : le tri le
         range en queue — Postgres place les nuls en dernier sur un tri
         croissant, et c'est le comportement voulu : une réservation sans
         échéance n'a pas à passer devant celle de la semaine prochaine. */
      include: {
        ownerWish: {
          include: { wishlist: { include: { occurrence: true, user: true } } },
        },
      },
      orderBy: { ownerWish: { wishlist: { occurrence: { occurrenceDate: "asc" } } } },
    });

    return lignes.map((l) => ({
      id: l.id,
      wishId: l.ownerWishId,
      wishLabel: l.ownerWish.label,
      wishImageUrl: l.ownerWish.imageUrl,
      price: l.ownerWish.price === null ? null : l.ownerWish.price.toNumber(),
      currency: l.ownerWish.currency,
      ownerDisplayName: l.ownerWish.wishlist.user.displayName ?? l.ownerWish.wishlist.user.username,
      ownerUsername: l.ownerWish.wishlist.user.username,
      // Nulle quand la liste ne vise aucune occasion : l'écran affiche alors le
      // nom de la liste, qui est le seul repère qu'elle ait.
      occurrenceDate: l.ownerWish.wishlist.occurrence === null
        ? null
        : jour(l.ownerWish.wishlist.occurrence.occurrenceDate),
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
    imageKey: l.imageKey,
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

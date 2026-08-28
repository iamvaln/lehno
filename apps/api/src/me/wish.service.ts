import { Inject, Injectable } from "@nestjs/common";
import type { CreateWishInput, UpdateWishInput, Wish } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { TenantRepository } from "../tenancy/tenant.repository.js";
import { AppError } from "../common/errors.js";

// La ligne telle que Prisma la rend. Écrite ici plutôt qu'importée de
// @prisma/client : `price` y est un Decimal, et le contrat veut un nombre —
// la conversion doit se voir, pas se deviner.
type Ligne = {
  id: string;
  eventOccurrenceId: string;
  label: string;
  link: string | null;
  imageUrl: string | null;
  details: string | null;
  price: { toNumber(): number } | null;
  currency: string | null;
  status: string;
  origin: string;
  isShortlisted: boolean;
};

@Injectable()
export class WishService {
  // @Inject explicite : voir NoteService/OccurrenceService — sous
  // vitest/esbuild, design:paramtypes n'est pas émis, et un paramètre typé
  // sans jeton explicite se résoudrait à `undefined` chez Nest.
  constructor(
    @Inject(TenantRepository) private readonly depot: TenantRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async listForOccurrence(userId: string, occurrenceId: string): Promise<Wish[]> {
    // findOrThrow d'abord, avant de lire le moindre souhait. Sans cette garde,
    // l'occasion d'un autre compte rendrait une liste VIDE — indiscernable
    // d'une occasion à soi sans souhait —, et l'identifiant deviendrait un
    // oracle : on saurait qu'une occasion existe ailleurs en essayant.
    await this.depot.occurrences(userId).findOrThrow(occurrenceId);

    const lignes = await this.prisma.wishlistItem.findMany({
      where: { eventOccurrenceId: occurrenceId },
      // Les plus récents d'abord, comme les notes : l'écran se lit du haut, et
      // ce qu'on vient de noter est ce qu'on cherche à relire. L'ordre ne suit
      // PAS le repère personnel — celui-ci sert la préparation des idées, pas
      // l'affichage ; trier dessus ferait sauter un souhait de place à chaque
      // fois qu'on le marque, et on perdrait celui qu'on venait d'ajouter.
      orderBy: { createdAt: "desc" },
    });
    return lignes.map(rendre);
  }

  async createForOccurrence(
    userId: string, occurrenceId: string, input: CreateWishInput,
  ): Promise<Wish> {
    await this.depot.occurrences(userId).findOrThrow(occurrenceId);

    const ligne = await this.prisma.wishlistItem.create({
      data: {
        eventOccurrenceId: occurrenceId,
        // L'auteur, pour que la fiche sache qui a noté quoi. Nul sur une
        // contribution anonyme — d'où la colonne facultative —, mais jamais
        // ici : ce chemin est celui du propriétaire.
        authorUserId: userId,
        label: input.label,
        link: input.link ?? null,
        details: input.details ?? null,
        price: input.price ?? null,
        currency: input.currency ?? null,
        // POSÉE PAR LE SERVEUR, jamais lue du corps. `owner` est la seule
        // provenance que ce chemin puisse produire : `collected` vient d'un
        // lien de collecte validé, `accepted_idea` d'une idée retenue à la
        // génération. Accepter la valeur du client laisserait un ajout
        // personnel se déclarer confidence du proche.
        origin: "owner",
        isShortlisted: input.isShortlisted ?? false,
      },
    });
    return rendre(ligne);
  }

  async update(userId: string, id: string, input: UpdateWishInput): Promise<Wish> {
    // La portée cloisonnée d'abord : un souhait d'un autre compte n'existe
    // pas, et le lire pour vérifier l'invariant ci-dessous le révélerait.
    const actuel = (await this.depot.wishes(userId).findOrThrow(id)) as unknown as Ligne;

    /* « Un prix porte sa devise » se vérifie sur le souhait APRÈS fusion.
     *
     * Le schéma ne voit que le corps envoyé : un PATCH { currency: null } le
     * traverse sans encombre — il ne porte aucun prix — et laisserait un
     * souhait à 12 000 sans dire de quoi. La règle appartient à l'état final,
     * pas au message ; c'est ici qu'elle tient, et nulle part ailleurs. */
    const prix = input.price !== undefined ? input.price : (actuel.price?.toNumber() ?? null);
    const devise = input.currency !== undefined ? input.currency : actuel.currency;
    if (prix !== null && devise === null) {
      throw new AppError("validation_failed", "un prix porte sa devise", { currency: "requise dès qu'un prix est fixé" });
    }

    const ligne = await this.depot.wishes(userId).updateOrThrow(id, {
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.link !== undefined ? { link: input.link } : {}),
      ...(input.details !== undefined ? { details: input.details } : {}),
      ...(input.price !== undefined ? { price: input.price } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.isShortlisted !== undefined ? { isShortlisted: input.isShortlisted } : {}),
    } as never);
    return rendre(ligne as unknown as Ligne);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.depot.wishes(userId).deleteOrThrow(id);
  }
}

function rendre(l: Ligne): Wish {
  return {
    id: l.id,
    occurrenceId: l.eventOccurrenceId,
    label: l.label,
    link: l.link,
    imageUrl: l.imageUrl,
    details: l.details,
    // Decimal → nombre : le contrat rend un nombre, et un Decimal sérialisé
    // sortirait en chaîne. Un client qui compare des prix comparerait alors
    // des chaînes, et « 9 000 » passerait devant « 12 000 ».
    price: l.price === null ? null : l.price.toNumber(),
    currency: l.currency,
    status: l.status as Wish["status"],
    origin: l.origin as Wish["origin"],
    isShortlisted: l.isShortlisted,
    /* Toujours nul : une `WishReservation` pointe un `OwnerWish`, jamais un
       souhait de proche — « aucune réservation ici, un souhait de proche se
       marque ». Le champ vit au contrat parce que l'énumération d'état est
       commune aux deux tables ; le calculer ici serait inventer une jointure
       qui n'existe pas. */
    reservedByName: null,
  };
}

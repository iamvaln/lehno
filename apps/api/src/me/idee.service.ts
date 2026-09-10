import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";

/**
 * Ce qu'on fait d'une idée une fois qu'elle est proposée.
 *
 * DEUX GESTES, ET ILS SONT INDÉPENDANTS. Noter dit ce que l'idée vaut ; retenir
 * dit qu'on va l'offrir. Quelqu'un peut trouver une idée excellente et ne pas
 * la retenir — budget, déjà offerte l'an dernier, pas pour cette personne-là.
 * « Bonne idée, mauvais moment » est précisément ce qui distingue une invite qui
 * produit du juste d'une invite qui produit du plausible ; déduire l'un de
 * l'autre mesurerait l'occasion, plus la pertinence.
 *
 * AUCUN DRAPEAU SUR CES ROUTES. `generation.ideas` garde la PRODUCTION : éteindre
 * une nature doit empêcher d'en produire de nouvelles, jamais de reprendre ce
 * qu'on a déjà payé. C'est la règle que le contrôleur des générations applique
 * déjà à la lecture d'un message.
 */
@Injectable()
export class IdeeService {
  // @Inject explicite : esbuild/vitest n'émet pas design:paramtypes.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /* L'idée doit être DANS UN JEU QUI EST À LUI, et le cloisonnement passe par le
     jeu — l'idée elle-même ne porte pas de propriétaire.
     404 et non 403 : dire « elle existe mais n'est pas à vous » apprendrait
     qu'elle existe, et un identifiant se devine moins bien qu'il ne se
     confirme. */
  private async sienne(userId: string, ideaId: string) {
    const idee = await this.prisma.generatedIdea.findFirst({
      where: { id: ideaId, set: { userId } },
      include: { set: { select: { eventOccurrenceId: true } } },
    });
    if (!idee) throw new AppError("not_found", "resource not found");
    return idee;
  }

  /**
   * Porter un avis, ou le reprendre.
   *
   * `null` retire l'avis : un avis se change et se reprend, sans quoi un doigt
   * qui glisse serait définitif — et une note qu'on ne peut pas corriger est
   * une note qu'on cesse de donner.
   *
   * LA DATE SUIT L'AVIS, toujours. La base porte la contrainte (`feedback IS
   * NULL` = `feedback_at IS NULL`) parce qu'un avis sans date ne se compare pas
   * dans le temps — or c'est exactement la question qu'on posera : « la v3 de
   * l'invite plaît-elle plus que la v2 », qui se lit sur des avis datés.
   */
  async noter(userId: string, ideaId: string, avis: "up" | "down" | null) {
    await this.sienne(userId, ideaId);
    return this.prisma.generatedIdea.update({
      where: { id: ideaId },
      data: { feedback: avis, feedbackAt: avis === null ? null : new Date() },
    });
  }

  /**
   * Retenir une idée : elle devient un souhait sur l'occasion visée.
   *
   * L'IDÉE N'EST PAS EFFACÉE, et c'est ce qui rend le lien lisible : on peut
   * répondre à « parmi ce que le modèle a proposé, qu'est-ce qui a été retenu »,
   * qui est la seconde mesure de pertinence après l'avis.
   */
  async retenir(userId: string, ideaId: string) {
    const idee = await this.sienne(userId, ideaId);

    /* Le jeu a perdu son occasion — le compte a été effacé, ou l'occasion
       supprimée. `SetNull` le prévoit : le jeu survit, ce qu'il visait non. Il
       n'y a alors nulle part où poser le souhait. */
    if (idee.set.eventOccurrenceId === null)
      throw new AppError("conflict", "this idea no longer targets an occasion");

    /* DÉJÀ RETENUE : on rend le souhait existant plutôt qu'un conflit. Deux
       frappes sur le même bouton sont la chose la plus banale du monde sur un
       téléphone, et la seconde ne doit pas produire un doublon dans la liste ni
       une erreur à l'écran.
       Si le souhait a été SUPPRIMÉ depuis, `wishlistItemId` est retombé à nul
       (`SetNull`) et on en recrée un : « retenue, abandonnée, reprise » est une
       suite légitime. */
    if (idee.wishlistItemId !== null) {
      const existant = await this.prisma.wishlistItem.findUnique({
        where: { id: idee.wishlistItemId },
      });
      if (existant) return existant;
    }

    return this.prisma.$transaction(async (tx) => {
      const souhait = await tx.wishlistItem.create({
        data: {
          eventOccurrenceId: idee.set.eventOccurrenceId!,
          authorUserId: userId,
          label: idee.label,
          /* Le « pourquoi » suit le souhait : c'est ce qui le rend retenable
             trois semaines plus tard, quand on aura oublié pourquoi cette
             idée-là paraissait juste. */
          ...(idee.details === null ? {} : { details: idee.details }),
          /* AUCUN PRIX. L'idée porte une fourchette INDICATIVE, produite par un
             modèle qui ne connaît aucun marché ; la recopier dans le champ
             `price` d'un souhait la transformerait en prix constaté. On
             blanchirait une supposition en fait, et c'est sur ce chiffre qu'un
             proche déciderait de son budget. */
          origin: "accepted_idea",
        },
      });

      await tx.generatedIdea.update({
        where: { id: ideaId },
        data: { wishlistItemId: souhait.id, acceptedAt: new Date() },
      });

      return souhait;
    });
  }
}

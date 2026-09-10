import { Body, Controller, Inject, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ideaFeedbackSchema, type IdeaFeedbackInput, type GeneratedIdea, type Wish } from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { IdeeService } from "./idee.service.js";
import { rendre as rendreLeSouhait, type Ligne } from "./wish.service.js";

type AuthedRequest = { userId: string };

/* Ce qu'on fait d'une idée proposée.
 *
 * AUCUN DRAPEAU ICI, et ce n'est pas un oubli. `generation.ideas` garde la
 * PRODUCTION : éteindre une nature doit empêcher d'en produire de nouvelles,
 * jamais de reprendre ce qu'on a déjà payé. C'est la règle que le contrôleur des
 * générations applique déjà à la relecture d'un message, et la même raison —
 * quelqu'un qui a dépensé un crédit hier ne doit pas trouver porte close parce
 * qu'on a fermé le robinet ce matin.
 *
 * Les idées ne se listent pas ici : elles arrivent avec leur génération, qui est
 * l'objet que le client suit. Une seconde adresse pour les mêmes lignes
 * laisserait deux chemins à tenir d'accord. */
@Controller("me/ideas")
@UseGuards(AuthGuard)
export class IdeeController {
  constructor(@Inject(IdeeService) private readonly idees: IdeeService) {}

  /* PATCH et non POST : on pose un avis sur une idée qui existe, on ne crée
     rien. `null` le retire — un avis se change et se reprend, sans quoi un
     doigt qui glisse serait définitif, et une note qu'on ne peut pas corriger
     est une note qu'on cesse de donner. */
  @Patch(":id/feedback")
  async noter(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ideaFeedbackSchema)) corps: IdeaFeedbackInput,
  ): Promise<GeneratedIdea> {
    const i = await this.idees.noter(req.userId, id, corps.feedback);
    return {
      id: i.id,
      label: i.label,
      details: i.details,
      // Decimal → nombre : sérialisé tel quel, il sortirait en chaîne, et un
      // client qui compare des prix comparerait des chaînes.
      priceMin: i.priceMin === null ? null : Number(i.priceMin),
      priceMax: i.priceMax === null ? null : Number(i.priceMax),
      currency: i.currency,
      feedback: i.feedback,
      wishlistItemId: i.wishlistItemId,
    };
  }

  /* Retenir : l'idée devient un souhait sur l'occasion visée.
   *
   * On rend le SOUHAIT, pas l'idée : c'est lui que l'écran doit afficher tout
   * de suite, et le redemander à `/me/wishes` coûterait un aller-retour pour
   * une ligne qu'on vient d'écrire.
   *
   * 200 et non 201 : appelé deux fois, il rend le souhait déjà créé plutôt
   * qu'un doublon — deux frappes sur le même bouton sont la chose la plus
   * banale du monde sur un téléphone. Un 201 mentirait la seconde fois. */
  @Post(":id/accept")
  async retenir(
    @Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string,
  ): Promise<Wish> {
    return rendreLeSouhait(await this.idees.retenir(req.userId, id) as Ligne);
  }
}

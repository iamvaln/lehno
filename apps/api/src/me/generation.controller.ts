import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import {
  startGenerationSchema, updateMessageSchema,
  type GeneratedMessage, type Generation, type GenerationResult,
  type StartGenerationInput, type UpdateMessageInput, type Orientation,
  type GenerationKind, type CleDrapeau,
} from "@lehno/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthGuard } from "../auth/auth.guard.js";
import { FlagsService } from "../flags/flags.service.js";
import { StudioConfigurationService } from "../studio/configuration.service.js";
import { verifierLaSelection } from "../studio/selection.js";
import { AppError } from "../common/errors.js";
import { GenerationService } from "./generation.service.js";

/* LE DRAPEAU DE CHAQUE NATURE, et il n'y a pas de valeur par défaut.
 *
 * La route portait `@Feature("generation.message")`. Trois conséquences, toutes
 * fausses : demander des idées exigeait que le MESSAGE soit allumé ; éteindre
 * le message fermait le lancement des trois ; et `generation.ideas` comme
 * `generation.portrait` s'allumaient au back-office sans rien changer.
 *
 * Le décorateur ne pouvait pas le faire : il choisit sa clé à la compilation,
 * or la nature n'est connue qu'une fois le corps lu. La garde de classe reste
 * en place — elle sert les autres routes ; celle-ci décide à la main. */
const DRAPEAU: Record<GenerationKind, CleDrapeau> = {
  wish_message: "generation.message",
  gift_ideas: "generation.ideas",
  portrait: "generation.portrait",
};

/* LA LISTE DES NATURES PRODUITES A DISPARU, et c'est ce qu'annonçait son
 * commentaire : « elle disparaîtra quand les productions existeront ». Les
 * trois en ont une.
 *
 * Ce qui la remplace n'est pas rien : un `switch` EXHAUSTIF plus bas. Sans lui,
 * une quatrième nature ajoutée au contrat retomberait en silence sur le
 * message — elle serait débitée, produite, et rendue comme un message de vœux.
 * Le compilateur refuse désormais d'ajouter une nature sans lui donner son
 * chemin. */

type AuthedRequest = { userId: string };

type LigneExecution = {
  id: string; status: string; creditsSpent: number; failureCode: string | null;
  /* Portée par l'exécution elle-même, et pas seulement par le message produit :
     une génération qui a échoué n'a pas de message, et l'écran doit quand même
     savoir de quelle occasion il s'agit pour proposer de refaire. */
  eventOccurrenceId: string | null;
  createdAt: Date;
  premiumAction: { code: string };
  generatedMessage: {
    id: string; eventOccurrenceId: string; content: string; shortContent: string | null;
    status: string; createdAt: Date; updatedAt: Date;
  } | null;
  ideaSet: {
    id: string; eventOccurrenceId: string | null; createdAt: Date;
    ideas: {
      id: string; label: string; details: string | null;
      priceMin: unknown; priceMax: unknown; currency: string | null;
      feedback: string | null; wishlistItemId: string | null;
    }[];
  } | null;
};

/* Le lancement d'une génération et son suivi.
 *
 * ─── LE DRAPEAU EST SUR LE LANCEMENT, PAS SUR LA LECTURE
 *
 * Posé sur la classe, `generation.message` fermait aussi la liste et le suivi —
 * alors qu'ils portent TOUTES les natures. Un profil où seul
 * `generation.portrait` est allumé rendait donc `404` sur la liste de ses
 * propres portraits.
 *
 * Et le raisonnement vaut au-delà de ce cas : éteindre une nature doit empêcher
 * d'en PRODUIRE de nouvelles, jamais de relire ce qu'on a déjà payé. C'est la
 * même règle que pour `/me/messages/{id}`.
 *
 * ─── ET IL SE LIT À LA MAIN, PAS PAR DÉCORATEUR
 *
 * `FeatureGuard` a disparu d'ici : il n'y avait plus de `@Feature` à lire, et
 * une garde qui ne garde rien finit par faire croire qu'elle garde quelque
 * chose. Le lancement consulte `FlagsService` lui-même (voir `DRAPEAU`) parce
 * que le décorateur fige sa clé à la compilation, alors que la nature n'est
 * connue qu'après lecture du corps.
 *
 * Le prix de ce déplacement : le drapeau est désormais consulté APRÈS
 * l'authentification, là où la garde passait avant. Il ne se paie pas ici. La
 * règle « une surface éteinte l'est aussi pour un jeton invalide » protège
 * contre la distinction entre « éteinte » et « non authentifiée » ; or cette
 * ROUTE n'est jamais éteinte — elle sert trois natures, et celle qu'on demande
 * se trouve dans un corps qu'il faut être authentifié pour envoyer. Sans jeton,
 * les trois répondent pareil. */
@Controller("me/generations")
@UseGuards(AuthGuard)
export class GenerationController {
  constructor(
    @Inject(GenerationService) private readonly generation: GenerationService,
    @Inject(FlagsService) private readonly flags: FlagsService,
    @Inject(StudioConfigurationService) private readonly configs: StudioConfigurationService,
  ) {}

  @Post()
  async lancer(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(startGenerationSchema)) corps: StartGenerationInput,
  ): Promise<GenerationResult> {
    /* LE DRAPEAU DE LA NATURE DEMANDÉE, avant toute autre chose.
     *
     * `404`, comme FeatureGuard : une nature éteinte n'a pas à révéler qu'elle
     * existe. C'est aussi ce que le client attend — il traite déjà ce statut
     * comme un écran fermé. */
    if (!(await this.flags.estActif(DRAPEAU[corps.kind])))
      throw new AppError("not_found", "resource not found");

    /* Allumée, mais pas encore construite. Un code DIFFÉRENT de l'extinction,
       parce que ce n'est pas la même chose : là il n'y a rien à allumer. Et
       AVANT le débit — les deux écrans traitent ce refus sans faire payer. */
    /* LE PORTRAIT VISE UN PROCHE, pas une occasion — le contrat le refuse
       d'ailleurs dans l'autre sens. Il se traite donc AVANT la garde ci-dessous,
       qui exige une occurrence pour les deux autres natures. */
    if (corps.kind === "portrait") {
      if (!corps.personId)
        throw new AppError("validation_failed", "a person is required");

      /* LA SÉLECTION SE VÉRIFIE CONTRE LE CATALOGUE PUBLIÉ, et avant le débit.
         Un téléphone garde son catalogue en mémoire : sans ce contrôle, une
         ambiance retirée hier passerait encore aujourd'hui, et le crédit
         partirait pour un style qu'on ne sert plus. */
      const publie = await this.configs.enService("portrait");
      if (!publie)
        throw new AppError("resource_inactive", "no published portrait configuration");
      const selection = verifierLaSelection(
        this.configs.reglagesPortraitDe(publie),
        corps.studioSelection,
      );

      const portrait = await this.generation.lancerPortrait(req.userId, corps.personId, selection, publie.id, {
        ...(corps.language === undefined ? {} : { langue: corps.language }),
        ...(corps.briefText === undefined ? {} : { texteLibre: corps.briefText }),
        ...(corps.senderNote === undefined ? {} : { motDeLExpediteur: corps.senderNote }),
        ...(corps.idempotencyKey === undefined ? {} : { cle: corps.idempotencyKey }),
      });
      return this.rendre(await this.generation.lire(req.userId, portrait.actionRunId) as LigneExecution);
    }

    if (!corps.occurrenceId)
      throw new AppError("validation_failed", "an occurrence is required");

    if (corps.kind === "gift_ideas") {
      const jeu = await this.generation.lancerIdees(req.userId, corps.occurrenceId, {
        ...(corps.language === undefined ? {} : { langue: corps.language }),
        ...(corps.briefText === undefined ? {} : { texteLibre: corps.briefText }),
        /* Les bornes seulement. LA DEVISE EST POSÉE PAR LE SERVICE, et le
           contrat ne la porte pas : la demander au client la rendrait
           négociable par qui envoie la requête, et ferait entrer « FCFA » ou
           « francs » dans une colonne de trois caractères. La poser ici plutôt
           qu'au service donnerait deux endroits où la changer. */
        ...(corps.budget === undefined ? {} : {
          budget: { min: corps.budget.min ?? null, max: corps.budget.max ?? null },
        }),
        ...(corps.idempotencyKey === undefined ? {} : { cle: corps.idempotencyKey }),
      });
      return this.rendre(await this.generation.lire(req.userId, jeu.actionRunId) as LigneExecution);
    }

    /* LA GARDE EXHAUSTIVE. `corps.kind` ne peut plus valoir que `wish_message`
       ici ; l'affectation à `never` le prouve à la compilation. Une quatrième
       nature ajoutée au contrat sans son chemin fait échouer ce fichier, au
       lieu de retomber en silence sur le message — débitée, produite, et rendue
       comme un vœu. */
    const restant: "wish_message" = corps.kind;
    void restant;

    /* L'orientation voyage dans `studioSelection`, que le contrat commun refuse
       pour un message — « le studio n'a de sens que pour un portrait ». Elle
       passe donc par `tone`, le seul champ libre que le lancement porte pour
       les actions sans image. C'est un pis-aller, et il est signalé : le
       contrat commun devra porter l'orientation autrement. */
    const orientation = (corps.tone ?? "notre_relation") as Orientation;

    const ligne = await this.generation.lancerMessage(
      req.userId, corps.occurrenceId, orientation,
      {
        ...(corps.language === undefined ? {} : { langue: corps.language }),
        ...(corps.briefText === undefined ? {} : { texteLibre: corps.briefText }),
        // « Une même demande relancée rejoint la génération en cours plutôt que
        // d'en créer une seconde, et ne débite qu'une fois » (§5.4).
        ...(corps.idempotencyKey === undefined ? {} : { cle: corps.idempotencyKey }),
      },
    );
    return this.rendre(await this.generation.lire(req.userId, ligne.actionRunId) as LigneExecution);
  }

  @Get()
  async lister(@Req() req: AuthedRequest): Promise<{ generations: GenerationResult[] }> {
    const lignes = (await this.generation.lister(req.userId)) as LigneExecution[];
    return { generations: lignes.map((l) => this.rendre(l)) };
  }

  @Get(":id")
  async suivre(
    @Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string,
  ): Promise<GenerationResult> {
    return this.rendre(await this.generation.lire(req.userId, id) as LigneExecution);
  }

  private rendre(l: LigneExecution): GenerationResult {
    const message = l.generatedMessage;
    const jeu = l.ideaSet;
    const generation: Generation = {
      id: l.id,
      kind: l.premiumAction.code as Generation["kind"],
      /* La cible, pour que l'écran d'attente ait un nom et un décompte à
         montrer. Un portrait vise un proche, un message une occasion — l'une
         des deux est donc toujours nulle, et le client affiche celle qui est
         là plutôt que d'en déduire laquelle attendre. */
      personId: null,
      occurrenceId: l.generatedMessage?.eventOccurrenceId ?? jeu?.eventOccurrenceId ?? l.eventOccurrenceId ?? null,
      status: GenerationService.ETAT[l.status] ?? "failed",
      creditsSpent: l.creditsSpent,
      /* Le CODE, jamais un message de fournisseur : ceux-là recopient parfois
         l'invite, donc les notes — les mots privés de quelqu'un sur un tiers
         n'ont rien à faire dans une réponse d'erreur. */
      failureReason: l.failureCode,
      // Le message OU le jeu d'idées : une exécution n'en produit jamais deux.
      resultId: message?.id ?? jeu?.id ?? null,
      createdAt: l.createdAt.toISOString(),
    };
    return {
      generation,
      message: message === null ? null : {
        id: message.id,
        occurrenceId: message.eventOccurrenceId,
        content: message.content,
        contentShort: message.shortContent,
        status: message.status as GeneratedMessage["status"],
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt.toISOString(),
      },
      ideas: jeu === null ? null : {
        id: jeu.id,
        occurrenceId: jeu.eventOccurrenceId,
        ideas: jeu.ideas.map((i) => ({
          id: i.id,
          label: i.label,
          details: i.details,
          /* `Decimal` se sérialise en chaîne s'il traverse tel quel, et le
             client lirait « 5000.00 » là où il attend un nombre. Nul reste nul
             — une idée sans prix n'en a pas, elle n'en a pas un qui vaut zéro. */
          priceMin: i.priceMin === null ? null : Number(i.priceMin),
          priceMax: i.priceMax === null ? null : Number(i.priceMax),
          currency: i.currency,
          feedback: i.feedback as "up" | "down" | null,
          wishlistItemId: i.wishlistItemId,
        })),
        createdAt: jeu.createdAt.toISOString(),
      },
    };
  }
}

/* Le brouillon se corrige APRÈS coup, et ce chemin n'est pas sous le même
 * drapeau que la génération.
 *
 * Éteindre `generation.message` doit empêcher d'en produire de nouveaux, pas
 * de relire et d'ajuster ceux qu'on a déjà payés. Les mettre sous le même
 * interrupteur ferait disparaître un contenu acheté. */
@Controller("me/messages")
@UseGuards(AuthGuard)
export class MessagesController {
  constructor(@Inject(GenerationService) private readonly generation: GenerationService) {}

  @Patch(":id")
  async corriger(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateMessageSchema)) corps: UpdateMessageInput,
  ): Promise<GeneratedMessage> {
    const m = await this.generation.corriger(req.userId, id, corps);
    return {
      id: m.id,
      occurrenceId: m.eventOccurrenceId,
      content: m.content,
      contentShort: m.shortContent,
      status: m.status as GeneratedMessage["status"],
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }
}

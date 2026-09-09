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

/* CE QUI SE PRODUIT VRAIMENT, aujourd'hui.
 *
 * Les trois natures existent au registre des actions payantes et ont chacune
 * leur drapeau ; une seule a une chaîne de production. Accepter les deux autres
 * ici les ferait DÉBITER puis échouer — c'est la seule chose qu'on ne veut pas :
 * le refus, lui, ne coûte rien et les deux écrans le traitent proprement.
 *
 * Cette liste disparaîtra quand les productions existeront. Elle est séparée du
 * drapeau à dessein : « éteint » et « pas encore construit » sont deux états
 * différents, et les confondre ferait croire qu'allumer suffit. */
const PRODUITES = new Set<GenerationKind>(["wish_message"]);

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
    if (!PRODUITES.has(corps.kind))
      throw new AppError("resource_inactive", `generation "${corps.kind}" is not available yet`);

    if (!corps.occurrenceId)
      throw new AppError("validation_failed", "an occurrence is required");

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
    const generation: Generation = {
      id: l.id,
      kind: l.premiumAction.code as Generation["kind"],
      /* La cible, pour que l'écran d'attente ait un nom et un décompte à
         montrer. Un portrait vise un proche, un message une occasion — l'une
         des deux est donc toujours nulle, et le client affiche celle qui est
         là plutôt que d'en déduire laquelle attendre. */
      personId: null,
      occurrenceId: l.generatedMessage?.eventOccurrenceId ?? l.eventOccurrenceId ?? null,
      status: GenerationService.ETAT[l.status] ?? "failed",
      creditsSpent: l.creditsSpent,
      /* Le CODE, jamais un message de fournisseur : ceux-là recopient parfois
         l'invite, donc les notes — les mots privés de quelqu'un sur un tiers
         n'ont rien à faire dans une réponse d'erreur. */
      failureReason: l.failureCode,
      resultId: message?.id ?? null,
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

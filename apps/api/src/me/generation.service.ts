import { Inject, Injectable, Logger } from "@nestjs/common";

import {
  consigneSysteme, invite, consigneSystemeIdees, inviteIdees, IDEES,
  consigneSystemePortrait, invitePortrait, MOTS_DU_PORTRAIT,
  MOTS_MESSAGE, MOTS_MESSAGE_COURT, ORIENTATIONS_SENSIBLES,
  type ContexteMessage, type ContexteIdees, type ContextePortrait, type Orientation,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { StudioConfigurationService } from "../studio/configuration.service.js";
import { TenantRepository } from "../tenancy/tenant.repository.js";
import { AppError } from "../common/errors.js";
import { RouteurIAService, RefusModele, type Adaptateur } from "../ia/routeur.service.js";
import { FOURNISSEURS_IA } from "../ia/adaptateurs/index.js";
import type { SelectionPortrait } from "../studio/selection.js";

/* La génération d'un message.
 *
 * Trois choses se passent dans un ordre qui n'est pas négociable : on débite, on
 * appelle, on rend. Chacune peut échouer, et ce qu'on fait alors décide de la
 * confiance qu'on garde. */

const ACTION_MESSAGE = "wish_message";
const ACTION_IDEES = "gift_ideas";
const ACTION_PORTRAIT = "portrait";

/* La devise des fourchettes de prix.
 *
 * Elle ne vient PAS du modèle : lui demander un code ISO reviendrait à ranger
 * « FCFA », « francs » ou « XOF » selon son humeur, dans une colonne de trois
 * caractères que le client affiche tel quel. Elle ne vient pas non plus du
 * palier de crédits — un prix de cadeau n'a rien à voir avec un achat de
 * crédits. C'est celle du marché servi, et le jour où il y en a deux, elle se
 * lira sur la fiche du proche ou sur le compte.  */
const DEVISE = "XAF";

/* Au-delà de quoi une exécution restée en attente est tenue pour perdue.
 *
 * Une heure, et c'est généreux à dessein : trop court, on rembourserait une
 * production qui allait aboutir — et l'utilisateur recevrait alors son message
 * ET son crédit, ce qui coûte deux fois. */
const SEUIL_ABANDON_MS = 60 * 60 * 1000;

/* Ce que le modèle rend, et rien d'autre. La sortie est structurée pour être
   VÉRIFIABLE : « le message fait-il deux à quatre phrases » ne se contrôle pas,
   « les deux champs sont-ils là » se contrôle. */
type SortieMessage = { message: string; court: string };

/** Une idée telle que le modèle la rend, une fois vérifiée. La fourchette est
 *  absente ou complète — jamais une borne seule. */
type SortieIdee = { titre: string; pourquoi: string; min?: number; max?: number };

/** Ce que le brief du portrait rend, une fois vérifié. Les mots sont ce que le
 *  dessin montrera ; la phrase est ce que le portrait dit. */
type SortiePortrait = { mots: string[]; phrase: string; phraseCourte: string | null };

const compterLesMots = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

@Injectable()
export class GenerationService {
  private readonly logger = new Logger("generation");

  // @Inject explicite : esbuild/vitest n'émet pas design:paramtypes.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantRepository) private readonly depot: TenantRepository,
    @Inject(RouteurIAService) private readonly routeur: RouteurIAService,
    @Inject(FOURNISSEURS_IA) private readonly adaptateurs: Record<string, Adaptateur>,
    @Inject(StudioConfigurationService) private readonly configs: StudioConfigurationService,
  ) {}

  /* Lancer une génération de message.
   *
   * LE DÉBIT ET L'EXÉCUTION SONT DEUX TRANSACTIONS, et c'est délibéré. Tenir
   * l'appel au modèle DANS la transaction du débit la garderait ouverte
   * plusieurs secondes sur une base partagée — et une transaction longue est
   * exactement ce qui fait tomber une base sous charge.
   *
   * Le prix : entre le débit et l'appel, un arrêt du serveur laisse un crédit
   * débité pour rien. C'est ce que rattrape `reconcilierLesEnCours`, et c'est
   * le bon compromis : perdre un crédit se répare, une base bloquée non. */
  async lancerMessage(
    userId: string, occurrenceId: string, orientation: Orientation,
    options: { langue?: "fr" | "en"; texteLibre?: string | null; cle?: string | null } = {},
  ) {
    const occurrence = await this.depot.occurrences(userId).findOrThrow(occurrenceId);
    const contexte = await this.rassembler(userId, occurrence.id, orientation, options);

    /* Le REFUS D'ENTRÉE : une orientation joyeuse sur une occasion sensible.
     *
     * Il est ici, au serveur, et pas dans le gabarit. Demander à un modèle de
     * deviner qu'une « motivation » sur un anniversaire de décès est déplacée,
     * c'est confier à un tiers la seule erreur qu'on ne peut pas rattraper —
     * et la lui confier APRÈS avoir débité le crédit. */
    if (contexte.occasionSensible && !ORIENTATIONS_SENSIBLES.includes(orientation))
      throw new AppError(
        "validation_failed",
        `orientation "${orientation}" does not suit a sensitive occasion`,
      );

    const { execution, dejaLancee } = await this.debiter(userId, occurrence.id, orientation, options.cle ?? null);

    /* La demande avait déjà été lancée sous cette clé : on REJOINT plutôt que
       de recommencer. Rien n'a été débité une seconde fois — l'unicité en base
       s'en est chargée —, et il n'y a rien à produire : soit la production
       tourne, soit elle a abouti, soit elle a échoué et le crédit est rendu.
       Dans les trois cas, le client suit la même exécution. */
    if (dejaLancee) {
      const brouillon = await this.prisma.generatedMessage.findUnique({
        where: { actionRunId: execution.id },
      });
      if (brouillon) return brouillon;
      /* Elle tourne encore, ou elle a raté. On rend l'exécution telle quelle
         plutôt que d'attendre : le client interroge, c'est son rôle. */
      throw new AppError("conflict", "this generation is already running");
    }

    try {
      const sortie = await this.produire(contexte, userId, execution.id);
      return await this.conclure(execution.id, userId, occurrence.id, sortie);
    } catch (err: unknown) {
      await this.rendreLeCredit(execution.id, userId, this.codeDe(err));
      throw err;
    }
  }

  /* Le débit, en une transaction.
   *
   * Le solde se relit DANS la transaction, pas avant : entre une lecture et une
   * écriture séparées, deux demandes simultanées liraient toutes deux un solde
   * suffisant et débiteraient deux fois un crédit qui n'existait qu'une. */
  private async debiter(
    userId: string, occurrenceId: string | null, orientation: Orientation | null, cle: string | null,
    code: string = ACTION_MESSAGE,
  ) {
    try {
      const execution = await this.prisma.$transaction(async (tx) => {
        const action = await tx.premiumAction.findUnique({ where: { code } });
        if (!action || !action.enabled)
          throw new AppError("resource_inactive", "this action is not available");

        const somme = await tx.creditTransaction.aggregate({
          where: { userId }, _sum: { amount: true },
        });
        const solde = somme._sum.amount ?? 0;

        /* `insufficient_credits`, pas `validation_failed` : la demande est bien
           formée, c'est l'état du compte qui ne s'y prête pas. L'écran mène
           alors à la recharge plutôt que d'afficher « requête invalide ». */
        if (solde < action.creditCost)
          throw new AppError("insufficient_credits", "not enough credits for this action");

        /* La violation d'unicité sur la clé sort d'ici SANS ÊTRE RATTRAPÉE, et
           c'est délibéré : une instruction en échec avorte la transaction
           Postgres, et plus rien ne s'y lit — un `findFirst` posé ici échouerait
           à son tour, sur une erreur qui ne dirait plus rien de la cause.
           On laisse donc remonter, et on relit APRÈS le retour arrière. */
        const execution = await tx.actionRun.create({
          data: {
            userId, premiumActionId: action.id, creditsSpent: action.creditCost,
            status: "pending",
            /* Nulle pour les idées : l'orientation est une notion du MESSAGE —
               « notre relation », « une motivation ». Écrire « gift_ideas » ici
               pour remplir la colonne mélangerait deux registres dans le même
               champ, et l'analyse des orientations compterait des lignes qui
               n'en ont pas. */
            ...(orientation === null ? {} : { orientation }),
            /* LA CIBLE, écrite dès le lancement et non seulement sur le message
               produit. Une génération qui échoue n'a pas de message : sans
               elle, l'écran d'attente n'aurait ni nom à afficher ni de quoi
               proposer de refaire — il dirait « une production a échoué » sans
               dire pour qui. */
            /* NULLE POUR UN PORTRAIT : il vise un proche, pas une échéance.
               L'écran d'attente prend alors son nom sur `personId` — le contrat
               dit « l'une des deux est nulle selon la nature ». */
            ...(occurrenceId === null ? {} : { eventOccurrenceId: occurrenceId }),
            ...(cle === null ? {} : { idempotencyKey: cle }),
          },
          select: { id: true },
        });

        // Le mouvement est NÉGATIF : le solde est la somme du registre, jamais
        // une colonne. Aucune valeur ne peut donc diverger de son historique.
        await tx.creditTransaction.create({
          data: {
            userId, type: "consumption", source: "consumption",
            amount: -action.creditCost,
          },
        });

        return execution;
      });
      return { execution, dejaLancee: false as const };
    } catch (err: unknown) {
      if ((err as { code?: string }).code !== "P2002" || cle === null) throw err;
      /* La transaction a été défaite : le débit n'a pas eu lieu, et rien ne
         subsiste de la tentative. On relit maintenant, sur une connexion
         saine. */
      const dejaLa = await this.prisma.actionRun.findFirstOrThrow({
        where: { userId, idempotencyKey: cle }, select: { id: true },
      });
      return { execution: dejaLa, dejaLancee: true as const };
    }
  }

  // ── Les idées de cadeaux ──────────────────────────────────────────────────

  /* Lancer une production d'idées.
   *
   * Même architecture que le message, et pour les mêmes raisons : le débit et
   * l'appel sont deux transactions, et `reconcilierLesEnCours` rattrape ce qui
   * reste en route. Elle n'est pas recopiée — `debiter`, `rendreLeCredit` et
   * la reconciliation sont partagés ; seuls le contexte, l'invite et la lecture
   * de la sortie diffèrent.
   *
   * PAS DE REFUS D'ENTRÉE sur une occasion sensible, à la différence du
   * message. On y offre des fleurs, on contribue aux frais, on paie un
   * déplacement : ce ne sont pas de moindres cadeaux, ce sont ceux qui
   * comptent. C'est le GABARIT qui réoriente vers le soutien — voir
   * `consigneSystemeIdees` — pas une garde qui ferme. */
  async lancerIdees(
    userId: string, occurrenceId: string,
    options: {
      langue?: "fr" | "en";
      texteLibre?: string | null;
      budget?: { min: number | null; max: number | null } | null;
      cle?: string | null;
    } = {},
  ) {
    const occurrence = await this.depot.occurrences(userId).findOrThrow(occurrenceId);
    const contexte = await this.rassemblerIdees(userId, occurrence.id, options);

    const { execution, dejaLancee } = await this.debiter(
      userId, occurrence.id, null, options.cle ?? null, ACTION_IDEES,
    );

    /* Déjà lancée sous cette clé : on REJOINT plutôt que de recommencer. Même
       raisonnement que pour le message — rien n'a été débité deux fois,
       l'unicité en base s'en est chargée. */
    if (dejaLancee) {
      const jeu = await this.prisma.generatedIdeaSet.findUnique({
        where: { actionRunId: execution.id },
        include: { ideas: { orderBy: { position: "asc" } } },
      });
      if (jeu) return jeu;
      throw new AppError("conflict", "this generation is already running");
    }

    try {
      const idees = await this.produireIdees(contexte, userId, execution.id);
      return await this.conclureIdees(execution.id, userId, occurrence.id, idees);
    } catch (err: unknown) {
      await this.rendreLeCredit(execution.id, userId, this.codeDe(err));
      throw err;
    }
  }

  /* La matière des idées.
   *
   * Une différence avec le message, et elle compte : les notes rangées en
   * `gift_ideas` sont ÉCARTÉES du message — « les idées de cadeaux n'ont rien à
   * faire dans un message » — et ce sont ici les plus utiles de toutes. C'est
   * ce que la personne a noté en pensant précisément à quoi offrir. */
  private async rassemblerIdees(
    userId: string, occurrenceId: string,
    options: {
      langue?: "fr" | "en";
      texteLibre?: string | null;
      budget?: { min: number | null; max: number | null } | null;
    },
  ): Promise<ContexteIdees> {
    const occurrence = await this.prisma.eventOccurrence.findUniqueOrThrow({
      where: { id: occurrenceId },
      include: { event: { include: { person: true } } },
    });
    const proche = occurrence.event.person;
    /* LA LANGUE VIENT DU COMPTE, pas du proche — et c'est l'inverse du message.
     *
     * Un message est ADRESSÉ au proche : il part chez lui, il doit être dans sa
     * langue, et `rassembler` lit donc `person.language`. Une liste d'idées
     * n'est envoyée à personne : c'est celui qui cherche qui la lit, pour
     * décider quoi acheter. La rendre dans la langue de sa marraine anglophone
     * lui donnerait des idées qu'il ne peut pas lire, et qu'il a payées.
     *
     * `user.ui_language` est d'ailleurs la seule des deux qui soit sûre : elle
     * est non nulle avec un défaut, là où `person.language` est facultative et
     * vide sur la plupart des fiches. */
    const moi = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId }, select: { uiLanguage: true },
    });

    const notes = await this.prisma.note.findMany({
      where: { personId: proche.id },
      orderBy: { createdAt: "desc" },
      include: { categories: { include: { category: true } } },
    });

    /* `dislikes_nogo` part À PART, comme une interdiction — et l'enjeu est plus
       direct que pour un message : mêlée à la matière, « elle déteste le
       parfum » deviendrait une idée de parfum. */
    const aEviter: string[] = [];
    const matiere: ContexteIdees["notes"][number][] = [];
    for (const n of notes) {
      const codes = n.categories.map((c) => c.category.code);
      if (codes.includes("dislikes_nogo")) { aEviter.push(n.content); continue; }
      matiere.push({
        categorie: codes[0] ?? null,
        date: n.createdAt.toISOString().slice(0, 10),
        contenu: n.content,
      });
    }

    /* Ce que l'atelier a publié pour le MESSAGE ne s'applique pas ici : ses
       consignes parlent de ton et de tournure, pas d'objets. On ne lit donc que
       ce qui vaut pour toutes les productions, et rien tant que le studio n'a
       pas de configuration propre aux idées. */
    return {
      langue: options.langue ?? (moi.uiLanguage === "en" ? "en" : "fr"),
      nomDUsage: proche.callingName ?? proche.displayName,
      relation: proche.relationHint ?? proche.relation ?? null,
      genreDuProche: proche.gender ?? "unspecified",
      occasionSensible: occurrence.event.eventNature === "sensitive",
      /* Nul, exactement comme pour le message : « on ne rappelle pas son âge à
         quelqu'un sur une déduction ». Le gabarit sait s'en passer, et le jour
         où la fiche portera un âge assumé, les deux le liront au même endroit. */
      age: null,
      notes: matiere,
      aEviter,
      texteLibre: options.texteLibre ?? null,
      // La devise se pose ICI et nulle part ailleurs — voir DEVISE.
      budget: options.budget ? { ...options.budget, devise: DEVISE } : null,
    };
  }

  private async produireIdees(
    contexte: ContexteIdees, userId: string, actionRunId: string,
  ): Promise<SortieIdee[]> {
    const reponse = await this.routeur.executer(
      "gift_ideas",
      { invite: inviteIdees(contexte), systeme: consigneSystemeIdees(contexte) },
      this.adaptateurs,
      { userId, actionRunId, origine: "user_action" },
    );
    return this.lireLesIdees(reponse.contenu);
  }

  /* Ce que le modèle rend, vérifié.
   *
   * ON GARDE CE QUI EST UTILISABLE plutôt que de tout refuser. Un modèle qui
   * rend huit idées au lieu de cinq n'a pas suivi la consigne, mais les cinq
   * premières valent ce qu'elles valent : reprendre un crédit pour un excès de
   * zèle serait une punition à l'envers. On refuse seulement en dessous du
   * minimum, où il n'y a plus de liste à montrer. */
  private lireLesIdees(brut: string): SortieIdee[] {
    let objet: unknown;
    try {
      objet = JSON.parse(brut.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "").trim());
    } catch {
      throw new RefusModele("unparseable");
    }

    const brutes = (objet as { idees?: unknown }).idees;
    if (!Array.isArray(brutes)) throw new RefusModele("empty_message");

    const retenues: SortieIdee[] = [];
    for (const x of brutes.slice(0, IDEES.max)) {
      const o = x as Partial<{ titre: string; pourquoi: string; prixMin: number; prixMax: number }>;
      if (typeof o.titre !== "string" || o.titre.trim().length === 0) continue;
      if (typeof o.pourquoi !== "string" || o.pourquoi.trim().length === 0) continue;

      /* La fourchette ne s'accepte QUE complète et ordonnée. Une borne seule ou
         inversée serait rangée telle quelle et affichée telle quelle — mieux
         vaut ne rien annoncer qu'un prix qu'on ne sait pas lire. La base porte
         d'ailleurs la même règle, et refuserait la ligne. */
      const min = typeof o.prixMin === "number" && Number.isFinite(o.prixMin) ? o.prixMin : null;
      const max = typeof o.prixMax === "number" && Number.isFinite(o.prixMax) ? o.prixMax : null;
      const fourchette = min !== null && max !== null && min >= 0 && min <= max
        ? { min, max }
        : null;

      retenues.push({
        titre: o.titre.trim(),
        pourquoi: o.pourquoi.trim(),
        ...(fourchette === null ? {} : fourchette),
      });
    }

    /* Sous le minimum, il n'y a plus de liste : deux idées ne donnent rien à
       comparer, et le refus d'une seule la vide. On rend le crédit. */
    if (retenues.length < IDEES.min) throw new RefusModele("length_out_of_range");
    return retenues;
  }

  private async conclureIdees(
    actionRunId: string, userId: string, occurrenceId: string, idees: SortieIdee[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const depense = await tx.aIUsage.aggregate({
        where: { actionRunId }, _sum: { cost: true },
      });
      await tx.actionRun.update({
        where: { id: actionRunId },
        data: { status: "success", internalCost: depense._sum.cost },
      });

      return tx.generatedIdeaSet.create({
        data: {
          actionRunId, userId, eventOccurrenceId: occurrenceId,
          ideas: {
            create: idees.map((i, rang) => ({
              label: i.titre,
              details: i.pourquoi,
              position: rang,
              /* La devise vient de la CONFIGURATION, jamais du modèle : lui
                 demander un code ISO reviendrait à ranger « FCFA », « francs »
                 ou « XOF » selon son humeur, dans une colonne de trois
                 caractères que le client affiche tel quel. */
              ...(i.min === undefined ? {} : { priceMin: i.min, priceMax: i.max, currency: DEVISE }),
            })),
          },
        },
        include: { ideas: { orderBy: { position: "asc" } } },
      });
    });
  }

  // ── Le portrait ───────────────────────────────────────────────────────────

  /* Lancer un portrait : LE TEXTE, et lui seul.
   *
   * L'image se compose à l'approbation — le contrat le dit, et c'est aussi la
   * modération : on relit avant de fabriquer. Produire les deux d'un coup
   * ferait payer une image que personne ne veut, et une image se refait au lieu
   * de se retoucher.
   *
   * Un portrait vise UN PROCHE, jamais une occasion : il se génère à tout
   * moment depuis sa fiche, hors de toute échéance. `debiter` accepte donc une
   * occurrence nulle, et l'écran d'attente prend son nom sur `personId`. */
  async lancerPortrait(
    userId: string, personId: string, selection: SelectionPortrait, configId: string,
    options: { langue?: "fr" | "en"; texteLibre?: string | null; motDeLExpediteur?: string | null; cle?: string | null } = {},
  ) {
    const proche = await this.depot.persons(userId).findOrThrow(personId);
    const contexte = await this.rassemblerPortrait(userId, proche.id, selection, options);

    const { execution, dejaLancee } = await this.debiter(
      userId, null, selection.orientation, options.cle ?? null, ACTION_PORTRAIT,
    );

    if (dejaLancee) {
      const deja = await this.prisma.portrait.findUnique({ where: { actionRunId: execution.id } });
      if (deja) return deja;
      throw new AppError("conflict", "this generation is already running");
    }

    try {
      const brief = await this.produireLeBrief(contexte, userId, execution.id);
      return await this.conclurePortrait(
        execution.id, userId, proche.id, selection, configId, brief, options.motDeLExpediteur ?? null,
      );
    } catch (err: unknown) {
      await this.rendreLeCredit(execution.id, userId, this.codeDe(err));
      throw err;
    }
  }

  /* LA MATIÈRE DU BRIEF, et elle est plus large que celle d'un message.
   *
   * Les ATTRIBUTS entrent — couleur, animal, style, loisir. Un message n'en a
   * que faire : il parle. Un dessin, lui, a besoin de ce qui se montre, et un
   * attribut le dit mieux qu'une phrase en texte libre. */
  private async rassemblerPortrait(
    userId: string, personId: string, selection: SelectionPortrait,
    options: { langue?: "fr" | "en"; texteLibre?: string | null },
  ): Promise<ContextePortrait> {
    const proche = await this.prisma.person.findUniqueOrThrow({ where: { id: personId } });
    const moi = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId }, select: { uiLanguage: true },
    });

    const [notes, attributs] = await Promise.all([
      this.prisma.note.findMany({
        where: { personId },
        orderBy: { createdAt: "desc" },
        include: { categories: { include: { category: true } } },
      }),
      this.prisma.personAttribute.findMany({
        where: { personId },
        orderBy: { observedAt: "desc" },
        select: { kind: true, value: true },
      }),
    ]);

    /* `dislikes_nogo` part À PART, comme une interdiction. C'est ICI qu'elle
       devient tenable : le modèle d'image ne verra jamais que le brief, donc
       seul le modèle de texte peut savoir qu'on lui défend un sujet. */
    const aEviter: string[] = [];
    const matiere: ContextePortrait["notes"][number][] = [];
    for (const n of notes) {
      const codes = n.categories.map((c) => c.category.code);
      if (codes.includes("dislikes_nogo")) { aEviter.push(n.content); continue; }
      matiere.push({ categorie: codes[0] ?? null, contenu: n.content });
    }

    /* `avoid` EST AUSSI UN REJET, du côté des attributs. Le laisser dans la
       matière ferait dessiner ce que la personne fuit — et il y arriverait par
       une autre porte que les notes, ce qui rendrait la garde à moitié
       efficace. */
    const gouts = attributs.filter((a) => a.kind !== "avoid");
    for (const a of attributs) if (a.kind === "avoid") aEviter.push(a.value);

    return {
      // La langue du COMPTE : le portrait se lit par celui qui l'offre, comme
      // les idées. Le message, lui, part chez le proche et prend la sienne.
      langue: options.langue ?? (moi.uiLanguage === "en" ? "en" : "fr"),
      orientation: selection.orientation,
      nomDUsage: proche.callingName ?? proche.displayName,
      relation: proche.relationHint ?? proche.relation ?? null,
      genreDuProche: proche.gender ?? "unspecified",
      notes: matiere,
      attributs: gouts.map((a) => ({ nature: a.kind, valeur: a.value })),
      aEviter,
      texteLibre: options.texteLibre ?? null,
      consigneAmbiance: selection.ambiance?.consigne[options.langue ?? (moi.uiLanguage === "en" ? "en" : "fr")] ?? null,
    };
  }

  private async produireLeBrief(
    contexte: ContextePortrait, userId: string, actionRunId: string,
  ): Promise<SortiePortrait> {
    const reponse = await this.routeur.executer(
      "portrait_brief",
      { invite: invitePortrait(contexte), systeme: consigneSystemePortrait(contexte) },
      this.adaptateurs,
      { userId, actionRunId, origine: "user_action" },
    );
    return this.lireLeBrief(reponse.contenu);
  }

  /* Ce que le brief rend, vérifié.
   *
   * ON GARDE CE QUI EST UTILISABLE, comme pour les idées : un modèle qui rend
   * douze mots n'a pas suivi la consigne, mais les premiers valent ce qu'ils
   * valent. On refuse sous le minimum, où il n'y a plus de portrait à
   * composer. */
  private lireLeBrief(brut: string): SortiePortrait {
    let objet: unknown;
    try {
      objet = JSON.parse(brut.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "").trim());
    } catch {
      throw new RefusModele("unparseable");
    }
    const o = objet as Partial<{ mots: unknown; phrase: unknown; phraseCourte: unknown }>;

    const mots = Array.isArray(o.mots)
      ? o.mots
        .filter((m): m is string => typeof m === "string" && m.trim().length > 0)
        .map((m) => m.trim())
        .slice(0, MOTS_DU_PORTRAIT.max)
      : [];
    if (mots.length < MOTS_DU_PORTRAIT.min) throw new RefusModele("length_out_of_range");

    if (typeof o.phrase !== "string" || o.phrase.trim().length === 0)
      throw new RefusModele("empty_message");

    /* La version courte manque parfois. Elle n'a pas de crédit à elle : mieux
       vaut rendre le portrait sans elle que perdre les deux. Même arbitrage que
       pour le message. */
    const courte = typeof o.phraseCourte === "string" && o.phraseCourte.trim().length > 0
      ? o.phraseCourte.trim()
      : null;

    return { mots, phrase: o.phrase.trim(), phraseCourte: courte };
  }

  private async conclurePortrait(
    actionRunId: string, userId: string, personId: string, selection: SelectionPortrait,
    configId: string, brief: SortiePortrait, motDeLExpediteur: string | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const depense = await tx.aIUsage.aggregate({
        where: { actionRunId }, _sum: { cost: true },
      });
      await tx.actionRun.update({
        where: { id: actionRunId },
        data: { status: "success", internalCost: depense._sum.cost },
      });

      /* LES MOTS SONT LE CONTENU. C'est eux que le nuage affiche, et eux qui
         partiront au modèle d'image à l'approbation — on les range donc, plutôt
         que de refaire un appel pour les retrouver.
         La phrase les accompagne : elle s'affiche AVEC l'image. */
      return tx.portrait.create({
        data: {
          actionRunId, userId, personId,
          /* CE QUI A ÉTÉ CHOISI, figé. L'approbation reprenait sinon la première
             voie active du catalogue — « abstrait » rendait un paysage. Et le
             brief ci-dessus a été composé avec la consigne de CETTE
             ambiance-là : en employer une autre pour l'image rendrait un dessin
             qui ne correspond pas au texte qu'on vient de relire. */
          visualPath: selection.voie,
          ...(selection.ambiance === null ? {} : { ambianceId: selection.ambiance.id }),
          // La gamme se relira dans la configuration : on fige LEQUEL, pas les
          // quatre couleurs — les recopier ici les ferait diverger d'elle.
          compositionId: selection.composition.id,
          /* LA CONFIGURATION QUI A PRODUIT CE BRIEF. L'approbation relira SA
             consigne, pas celle du catalogue courant : reformuler une ambiance
             entre les deux temps composerait l'image avec un texte et le brief
             avec un autre. L'historique existait — il ne manquait que ce
             lien. */
          studioConfigId: configId,
          content: JSON.stringify({ mots: brief.mots, phrase: brief.phrase }),
          ...(brief.phraseCourte === null ? {} : { shortContent: brief.phraseCourte }),
          ...(motDeLExpediteur === null ? {} : { senderNote: motDeLExpediteur }),
        },
      });
    });
  }

  /* Le rattrapage des exécutions restées en attente.
   *
   * Le débit et l'appel sont deux transactions — voir `lancerMessage`. Entre
   * les deux, un arrêt du serveur laisse une exécution `pending` pour toujours
   * et un crédit débité pour rien. Personne ne le signale : l'utilisateur voit
   * un écran qui tourne, puis passe à autre chose.
   *
   * Le SEUIL est généreux. Une génération dure quelques secondes ; une heure
   * laisse largement de quoi absorber une lenteur de fournisseur, un
   * redémarrage lent, une reprise. Trop court, on rembourserait une production
   * qui allait aboutir — et on écrirait alors deux fois le même message. */
  async reconcilierLesEnCours(): Promise<number> {
    const limite = new Date(Date.now() - SEUIL_ABANDON_MS);
    const perdues = await this.prisma.actionRun.findMany({
      where: { status: "pending", createdAt: { lt: limite } },
      select: { id: true, userId: true },
    });

    for (const p of perdues) {
      /* `rendreLeCredit` est conditionné sur `pending` : si la production a
         abouti entre-temps, le remboursement ne part pas. C'est la même garde
         qui empêche de rendre deux fois. */
      await this.rendreLeCredit(p.id, p.userId, "abandoned");
    }
    if (perdues.length > 0)
      this.logger.warn(`${perdues.length} génération(s) abandonnée(s), crédits rendus`);
    return perdues.length;
  }

  private async produire(
    contexte: ContexteMessage, userId: string, actionRunId: string,
  ): Promise<SortieMessage> {
    const reponse = await this.routeur.executer(
      "message",
      { invite: invite(contexte), systeme: consigneSysteme(contexte) },
      this.adaptateurs,
      { userId, actionRunId, origine: "user_action" },
    );
    return this.lireLaSortie(reponse.contenu);
  }

  /* Le modèle rend du JSON, parfois enrobé d'une clôture de code. On la retire
     avant de lire plutôt que de l'interdire dans le gabarit : l'interdire ne
     marche qu'à peu près, et un texte utilisable jeté pour une clôture serait
     un crédit repris pour rien. */
  private lireLaSortie(brut: string): SortieMessage {
    let objet: unknown;
    try {
      objet = JSON.parse(brut.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "").trim());
    } catch {
      throw new RefusModele("unparseable");
    }
    const o = objet as Partial<SortieMessage>;
    if (typeof o.message !== "string" || o.message.trim().length === 0)
      throw new RefusModele("empty_message");

    /* On vérifie que les CHAMPS sont là, pas que le style est bon.
     *
     * Les bornes de mots sont larges à dessein : une génération refusée se
     * repaie, et l'utilisateur relit et ajuste de toute façon. Refuser un texte
     * un peu long lui reprendrait un crédit pour un résultat qu'il aurait gardé.
     * La longueur est l'affaire du gabarit, pas d'une garde qui refait payer. */
    const mots = compterLesMots(o.message);
    if (mots < MOTS_MESSAGE.min || mots > MOTS_MESSAGE.max * 2)
      throw new RefusModele("length_out_of_range");

    /* La version courte manque parfois. Elle n'a pas de crédit à elle : mieux
       vaut rendre le message sans elle que perdre les deux. Le client se replie
       sur le message long. */
    const court = typeof o.court === "string" && compterLesMots(o.court) >= MOTS_MESSAGE_COURT.min
      ? o.court.trim()
      : null;

    return { message: o.message.trim(), court: court ?? "" };
  }

  /* L'état sur le fil est plus riche que celui de la base, et la traduction se
     fait ICI, une seule fois. `pending` en base devient `running` au contrat :
     le premier dit qu'une ligne attend, le second qu'un travail est en cours —
     et le client n'a pas à connaître notre vocabulaire de persistance. */
  static readonly ETAT: Record<string, "running" | "succeeded" | "failed"> = {
    pending: "running", success: "succeeded", failure: "failed",
  };

  private async conclure(
    actionRunId: string, userId: string, occurrenceId: string, sortie: SortieMessage,
  ) {
    return this.prisma.$transaction(async (tx) => {
      /* Le coût RÉEL, agrégé depuis les tentatives. Un repli en produit
         plusieurs, et c'est leur somme qui dit ce que cette production a
         coûté — face au crédit unique qu'elle a facturé. C'est cet écart, tenu
         dans le temps, qui dit si le prix couvre l'exploitation. */
      const depense = await tx.aIUsage.aggregate({
        where: { actionRunId }, _sum: { cost: true },
      });

      await tx.actionRun.update({
        where: { id: actionRunId },
        data: { status: "success", internalCost: depense._sum.cost },
      });

      return tx.generatedMessage.create({
        data: {
          actionRunId, userId, eventOccurrenceId: occurrenceId,
          content: sortie.message,
          ...(sortie.court ? { shortContent: sortie.court } : {}),
        },
      });
    });
  }

  /* Relire une exécution et son résultat. Passe par le dépôt cloisonné : celle
     d'un autre compte N'EXISTE PAS pour le demandeur — 404, jamais 403, un 403
     confirmerait qu'elle existe et l'identifiant se devine. */
  async lire(userId: string, id: string) {
    const execution = await this.prisma.actionRun.findFirst({
      where: { id, userId },
      /* Le jeu d'idées voyage avec l'exécution, comme le message : le client
         suit UN SEUL objet, et lui faire recoller un état et un résultat venus
         de deux chemins l'obligerait à gérer le moment où l'un est arrivé et
         l'autre pas. */
      include: {
        premiumAction: true, generatedMessage: true,
        ideaSet: { include: { ideas: { orderBy: { position: "asc" } } } },
      },
    });
    if (!execution) throw new AppError("not_found", "unknown generation");
    return execution;
  }

  async lister(userId: string) {
    return this.prisma.actionRun.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        premiumAction: true, generatedMessage: true,
        ideaSet: { include: { ideas: { orderBy: { position: "asc" } } } },
      },
    });
  }

  /* Corriger un brouillon, ou le marquer envoyé.
   *
   * `edited` se pose dès la première correction et ne se retire plus : savoir
   * qu'un texte a été retouché est ce qui rend le taux de régénération lisible.
   * `sent` l'emporte ensuite — un message envoyé puis corrigé reste envoyé,
   * puisque le destinataire a déjà lu la version d'avant. */
  async corriger(userId: string, id: string, patch: { content?: string | undefined; markSent?: boolean | undefined }) {
    const brouillon = await this.prisma.generatedMessage.findFirst({ where: { id, userId } });
    if (!brouillon) throw new AppError("not_found", "unknown message");

    const etat = patch.markSent === true
      ? "sent" as const
      : (patch.content !== undefined && brouillon.status === "generated" ? "edited" as const : brouillon.status);

    return this.prisma.generatedMessage.update({
      where: { id },
      data: {
        ...(patch.content === undefined ? {} : { content: patch.content }),
        status: etat,
      },
    });
  }

  /* Rendre le crédit — la promesse déjà écrite en toutes lettres dans la
   * traduction de `generation_unavailable` : « vos crédits n'ont pas été
   * débités ». Elle est en ligne ; il faut qu'elle soit vraie.
   *
   * Un mouvement NOUVEAU, jamais la suppression du débit : le registre est
   * l'historique, et effacer une ligne effacerait la preuve qu'on a débité puis
   * rendu. Quelqu'un qui relit son compte doit voir les deux. */
  /* Exposé plutôt que privé, comme `OrdonnanceurService.executer` et pour la
     même raison : c'est ce qui rend la garde éprouvable sans dépendre d'une
     course. Le cas qu'elle protège — deux passes qui concluent la même
     exécution — ne se provoque pas de façon fiable en concurrence, et un test
     qui ne mord qu'une fois sur deux passera en intégration continue en
     cachant la régression. */
  async rendreLeCredit(actionRunId: string, userId: string, code: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const execution = await tx.actionRun.updateMany({
          where: { id: actionRunId, status: "pending" },
          data: { status: "failure", failureCode: code.slice(0, 40) },
        });
        /* Conditionné sur `pending` : si une autre passe a déjà conclu cette
           exécution, on ne rend pas une seconde fois. Sans cette condition, un
           rattrapage concurrent doublerait le remboursement — et le solde
           deviendrait faux à la hausse, ce que personne ne signale jamais. */
        if (execution.count === 0) return;

        const ligne = await tx.actionRun.findUniqueOrThrow({
          where: { id: actionRunId }, select: { creditsSpent: true },
        });
        await tx.creditTransaction.create({
          data: { userId, type: "adjustment", source: "refund", amount: ligne.creditsSpent },
        });
      });
    } catch (err: unknown) {
      /* Le remboursement qui échoue ne doit pas masquer la cause première :
         l'utilisateur doit apprendre que sa génération a raté, pas que le
         remboursement a raté. Le journal garde de quoi réparer à la main. */
      this.logger.error(
        `remboursement impossible pour ${actionRunId} : ${err instanceof Error ? err.message : "cause inconnue"}`,
      );
    }
  }

  private codeDe(err: unknown): string {
    if (err instanceof RefusModele) return `refused:${err.code}`;
    if (err instanceof AppError) return err.code;
    return "unknown";
  }

  /* Rassembler la matière. Rien de ce que le client envoie n'entre ici sauf
     l'orientation, la langue et le texte libre : tout le reste vient de la
     fiche, que le serveur tient à jour (§5.4). */
  private async rassembler(
    userId: string, occurrenceId: string, orientation: Orientation,
    options: { langue?: "fr" | "en"; texteLibre?: string | null },
  ): Promise<ContexteMessage> {
    const occurrence = await this.prisma.eventOccurrence.findUniqueOrThrow({
      where: { id: occurrenceId },
      include: { event: { include: { person: true } } },
    });
    const proche = occurrence.event.person;
    const moi = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId }, select: { gender: true, uiLanguage: true },
    });

    const notes = await this.prisma.note.findMany({
      where: { personId: proche.id },
      orderBy: { createdAt: "desc" },
      include: { categories: { include: { category: true } } },
    });

    /* `dislikes_nogo` sort du lot et part À PART, comme une interdiction.
     *
     * C'est la seule catégorie que la base marque `isConstraint`. Mêlée aux
     * autres notes, elle serait lue comme une matière à employer — et « toi qui
     * détestes l'alcool » est une phrase que rien n'interdit à un modèle bien
     * intentionné. */
    const aEviter: string[] = [];
    const matiere: ContexteMessage["notes"][number][] = [];
    for (const n of notes) {
      const codes = n.categories.map((c) => c.category.code);
      if (codes.includes("dislikes_nogo")) { aEviter.push(n.content); continue; }
      // Les idées de cadeaux n'ont rien à faire dans un message.
      if (codes.length === 1 && codes[0] === "gift_ideas") continue;
      matiere.push({
        categorie: codes[0] ?? null,
        date: n.createdAt.toISOString().slice(0, 10),
        contenu: n.content,
      });
    }

    /* CE QUE L'ATELIER A PUBLIÉ, et c'est tout l'intérêt du Studio : sans cette
     * lecture, publier une consigne ne changerait rien à ce que les
     * utilisateurs reçoivent — on aurait construit un écran de réglage qui ne
     * règle rien.
     *
     * On ne lit que l'état `published`, jamais un brouillon : un essai en cours
     * de composition ne doit atteindre personne.
     *
     * ET ON N'ÉCHOUE PAS SANS LUI. Le gabarit du code reste le repli, à la
     * différence de `/me/studio/options` qui refuse — et l'asymétrie est
     * délibérée. Là-bas, un repli silencieux ferait réapparaître des
     * orientations qu'on venait de désactiver, donc mentirait sur ce qui est
     * en service. Ici, il n'y a rien à cacher : le repli produit un message
     * correct au lieu de reprendre un crédit à quelqu'un parce qu'une table
     * d'administration était vide. */
    /* La configuration du MESSAGE, et elle seule. Avant le découpage, ce
       service lisait « la » configuration — celle qui portait aussi les
       ambiances du portrait. Nommer la nature n'est pas une précision : c'est
       ce qui empêche une consigne de dessin d'entrer dans un texte. */
    const publie = await this.configs.enService("message").catch(() => null);
    const reglages = publie === null ? null : this.configs.reglagesMessageDe(publie);
    const orientationPubliee = reglages?.orientations.find((o) => o.id === orientation);

    return {
      langue: options.langue ?? (proche.language === "en" ? "en" : "fr"),
      orientation,
      ...(orientationPubliee ? { consigneOrientation: orientationPubliee.consigne } : {}),
      ...(reglages?.consigneCommune ? { consigneCommune: reglages.consigneCommune } : {}),
      ...(reglages && reglages.gardeFous.length > 0 ? { gardeFous: reglages.gardeFous } : {}),
      // Le nom par lequel le message s'adresse à lui, jamais le nom de liste.
      nomDUsage: proche.callingName ?? proche.displayName,
      registre: proche.register ?? "amical",
      relation: proche.relationHint ?? proche.relation ?? null,
      genreDuProche: proche.gender ?? "unspecified",
      genreDeLAuteur: moi.gender ?? "unspecified",
      occasionSensible: occurrence.event.eventNature === "sensitive",
      notes: matiere,
      aEviter,
      texteLibre: options.texteLibre ?? null,
      // L'âge ne part que si l'année de naissance est connue : on ne rappelle
      // pas son âge à quelqu'un sur une déduction.
      age: null,
    };
  }
}

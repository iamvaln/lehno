import { Inject, Injectable, Logger } from "@nestjs/common";

import {
  consigneSysteme, invite,
  MOTS_MESSAGE, MOTS_MESSAGE_COURT, ORIENTATIONS_SENSIBLES,
  type ContexteMessage, type Orientation,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { StudioConfigurationService } from "../studio/configuration.service.js";
import { TenantRepository } from "../tenancy/tenant.repository.js";
import { AppError } from "../common/errors.js";
import { RouteurIAService, RefusModele, type Adaptateur } from "../ia/routeur.service.js";
import { FOURNISSEURS_IA } from "../ia/adaptateurs/index.js";

/* La génération d'un message.
 *
 * Trois choses se passent dans un ordre qui n'est pas négociable : on débite, on
 * appelle, on rend. Chacune peut échouer, et ce qu'on fait alors décide de la
 * confiance qu'on garde. */

const ACTION_MESSAGE = "wish_message";

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

    const { execution, dejaLancee } = await this.debiter(userId, orientation, options.cle ?? null);

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
  private async debiter(userId: string, orientation: Orientation, cle: string | null) {
    try {
      const execution = await this.prisma.$transaction(async (tx) => {
        const action = await tx.premiumAction.findUnique({ where: { code: ACTION_MESSAGE } });
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
            status: "pending", orientation,
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
      include: { premiumAction: true, generatedMessage: true },
    });
    if (!execution) throw new AppError("not_found", "unknown generation");
    return execution;
  }

  async lister(userId: string) {
    return this.prisma.actionRun.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { premiumAction: true, generatedMessage: true },
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
    const publie = await this.configs.enService().catch(() => null);
    const reglages = publie === null ? null : this.configs.reglagesDe(publie);
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

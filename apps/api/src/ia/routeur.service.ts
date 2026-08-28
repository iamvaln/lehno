import { Inject, Injectable, Logger } from "@nestjs/common";
import { SEUIL_PANNE, DUREE_PANNE_MS, type TacheIA } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";

/* Ce qu'un adaptateur de fournisseur doit savoir faire, et rien de plus.
 *
 * Le routeur ne connaît ni les jetons d'authentification, ni les formats de
 * requête : il ne sait qu'essayer, compter et replier. C'est ce qui permet de
 * l'éprouver sans réseau ni clé d'API — sinon aucun de ces cas ne tournerait en
 * intégration continue, et le repli ne serait vérifié qu'en production. */
export type Adaptateur = {
  appeler(modele: string, demande: DemandeIA): Promise<ReponseIA>;
};

/* À quoi rattacher la dépense d'un appel.
 *
 * Les quatre champs répondent à quatre questions distinctes, et aucun ne se
 * déduit d'un autre : QUI (userId), POURQUOI on a payé (actionRunId, l'exécution
 * facturée), QU'EST-CE QUI a déclenché (origine), et OÙ retrouver la trace
 * technique (correlationId). Sans le deuxième, on sait qu'on a payé mais pas
 * pour quoi — et ce rattachement ne se reconstitue pas après coup. */
export type ContexteAppel = {
  readonly userId?: string | null;
  readonly actionRunId?: string | null;
  readonly origine?: "user_action" | "scheduled_job" | "retry" | "studio_trial";
  readonly correlationId?: string | null;
};

export type DemandeIA = {
  readonly invite: string;
  readonly systeme?: string;
};

export type ReponseIA = {
  readonly contenu: string;
  readonly jetonsEntree?: number;
  readonly jetonsSortie?: number;
};

/* Une panne du fournisseur : c'est ce qui doit faire replier. */
export class PanneFournisseur extends Error {
  constructor(readonly code: string) { super(`fournisseur en échec : ${code}`); }
}

/* Un refus du modèle, ou une réponse inexploitable.
 *
 * À part de PanneFournisseur, et la distinction n'est pas cosmétique : un refus
 * NE SE REPLIE PAS. Le modèle suivant refusera la même demande, et on aura payé
 * deux fois pour le même non. Confondre les deux transforme chaque refus en
 * facture multipliée par la longueur de la chaîne. */
export class RefusModele extends Error {
  constructor(readonly code: string) { super(`modèle en refus : ${code}`); }
}

type Candidat = {
  id: string; provider: string; modelKey: string; rank: number;
  costInput: unknown; costOutput: unknown;
};

@Injectable()
export class RouteurIAService {
  private readonly logger = new Logger("ia");

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /* La chaîne d'une tâche, dans l'ordre des rangs, PRIVÉE de ce qui n'est pas
     appelable maintenant.
   *
   * Deux exclusions, deux origines : `enabled` vient de l'administration,
   * `outageUntil` du disjoncteur. On les lit ensemble ici, mais on ne les écrit
   * jamais au même endroit — voir le commentaire d'AIModel. */
  async chaine(tache: TacheIA): Promise<Candidat[]> {
    const maintenant = new Date();
    const routes = await this.prisma.aITaskRoute.findMany({
      where: {
        task: tache,
        model: {
          enabled: true,
          OR: [{ outageUntil: null }, { outageUntil: { lte: maintenant } }],
        },
      },
      orderBy: { rank: "asc" },
      include: { model: true },
    });
    return routes.map((r) => ({
      id: r.model.id, provider: r.model.provider, modelKey: r.model.modelKey,
      rank: r.rank, costInput: r.model.costInput, costOutput: r.model.costOutput,
    }));
  }

  /* Essaie les modèles de la tâche dans l'ordre, et rend la première réponse.
   *
   * Chaque tentative laisse sa ligne, y compris les échouées : sans elles, les
   * pannes seraient gratuites dans les statistiques et la chaîne aurait l'air
   * parfaite.
   *
   * Le CONTEXTE dit à quoi rattacher la dépense. Il est facultatif parce que la
   * plupart des appels n'ont rien à quoi se rattacher — une passe
   * d'arrière-plan n'a pas d'exécution payante —, mais son absence par défaut
   * est `user_action`, la valeur la plus coûteuse à confondre : mieux vaut
   * qu'un appel de fond mal étiqueté gonfle la facture « utilisateur » et se
   * remarque, plutôt que l'inverse. */
  async executer(
    tache: TacheIA,
    demande: DemandeIA,
    adaptateurs: Record<string, Adaptateur>,
    contexte: ContexteAppel = {},
  ): Promise<{ contenu: string; modele: string; fournisseur: string; rang: number }> {
    const candidats = await this.chaine(tache);

    /* Une chaîne vide échoue EXPLICITEMENT. Rendre une réponse vide la ferait
       passer pour « rien à générer », et le contenu manquant se découvrirait à
       l'écran de l'utilisateur au lieu du journal. */
    if (candidats.length === 0)
      throw new AppError("generation_unavailable", `no usable model for task "${tache}"`);

    let dernier: unknown = null;

    for (const c of candidats) {
      const adaptateur = adaptateurs[c.provider];
      if (!adaptateur) {
        /* Un fournisseur sans adaptateur est une erreur de configuration, pas
           une panne : on n'ouvre pas le disjoncteur dessus — il se rouvrirait
           cinq minutes plus tard pour échouer pareil — mais on saute au suivant
           plutôt que de tout arrêter. */
        this.logger.error(`aucun adaptateur pour « ${c.provider} », rang ${c.rank} sauté`);
        continue;
      }

      const debut = Date.now();
      try {
        const reponse = await adaptateur.appeler(c.modelKey, demande);
        const latence = Date.now() - debut;
        await this.consigner(c, tache, contexte, "success", reponse, latence, null);
        await this.succes(c.id);
        return { contenu: reponse.contenu, modele: c.modelKey, fournisseur: c.provider, rang: c.rank };
      } catch (err: unknown) {
        const latence = Date.now() - debut;

        if (err instanceof RefusModele) {
          await this.consigner(c, tache, contexte, "refused", null, latence, err.code);
          /* On s'arrête là. Le suivant refusera la même demande — replier
             paierait le même non autant de fois qu'il y a de rangs. Et un refus
             ne compte pas dans les échecs consécutifs : le fournisseur va très
             bien, c'est la demande qui ne passe pas. */
          throw err;
        }

        const estDelai = err instanceof PanneFournisseur && err.code === "timeout";
        const code = err instanceof PanneFournisseur
          ? err.code
          : (err instanceof Error ? err.name : "unknown");
        await this.consigner(c, tache, contexte, estDelai ? "timeout" : "error", null, latence, code);
        await this.echec(c.id, code);
        dernier = err;
      }
    }

    throw new AppError(
      "generation_unavailable",
      `every model failed for task "${tache}"`,
      { cause: dernier instanceof Error ? dernier.message : "cause inconnue" },
    );
  }

  /* Le compteur repart de zéro au premier succès. Compter les échecs CUMULÉS
     ouvrirait le disjoncteur sur un modèle qui rate une fois par semaine depuis
     six mois — c'est-à-dire un modèle qui va bien. */
  private async succes(modelId: string): Promise<void> {
    await this.prisma.aIModel.updateMany({
      where: { id: modelId, OR: [{ consecutiveFailures: { gt: 0 } }, { outageUntil: { not: null } }] },
      data: { consecutiveFailures: 0, outageUntil: null, outageReason: null },
    });
  }

  /* Au seuil, on écarte le modèle pour un temps borné. On n'écrit QUE dans les
     champs du disjoncteur : `enabled` appartient à l'administration, et le
     toucher ici ferait qu'une panne passagère éteindrait définitivement un
     modèle que personne ne penserait à rallumer. */
  private async echec(modelId: string, code: string): Promise<void> {
    const apres = await this.prisma.aIModel.update({
      where: { id: modelId },
      data: { consecutiveFailures: { increment: 1 } },
      select: { consecutiveFailures: true },
    });
    if (apres.consecutiveFailures < SEUIL_PANNE) return;

    await this.prisma.aIModel.update({
      where: { id: modelId },
      data: {
        outageUntil: new Date(Date.now() + DUREE_PANNE_MS),
        outageReason: code.slice(0, 200),
      },
    });
  }

  /* Une ligne par TENTATIVE. Le tarif est celui du catalogue AU MOMENT de
     l'appel : le recalculer plus tard donnerait le prix d'aujourd'hui sur la
     dépense d'hier. Nul quand le modèle n'est pas tarifé — « on ne sait pas »,
     jamais « gratuit ». */
  private async consigner(
    c: Candidat, purpose: TacheIA, contexte: ContexteAppel,
    status: "success" | "error" | "timeout" | "refused",
    reponse: ReponseIA | null, latencyMs: number, errorCode: string | null,
  ): Promise<void> {
    const entree = reponse?.jetonsEntree ?? null;
    const sortie = reponse?.jetonsSortie ?? null;
    const tarifEntree = c.costInput === null ? null : Number(c.costInput);
    const tarifSortie = c.costOutput === null ? null : Number(c.costOutput);

    // Les tarifs sont par million de jetons — c'est ainsi que les fournisseurs
    // les publient, et les convertir à la saisie ferait diverger l'écran de la
    // page tarifaire qu'on recopie.
    const cout = (tarifEntree === null && tarifSortie === null) || (entree === null && sortie === null)
      ? null
      : ((entree ?? 0) * (tarifEntree ?? 0) + (sortie ?? 0) * (tarifSortie ?? 0)) / 1_000_000;

    try {
      await this.prisma.aIUsage.create({
        data: {
          purpose,
          origin: contexte.origine ?? "user_action",
          userId: contexte.userId ?? null,
          actionRunId: contexte.actionRunId ?? null,
          correlationId: contexte.correlationId?.slice(0, 64) ?? null,
          modelId: c.id, provider: c.provider, modelKey: c.modelKey,
          attempt: c.rank, status,
          tokensIn: entree, tokensOut: sortie,
          cost: cout, latencyMs, errorCode: errorCode?.slice(0, 80) ?? null,
        },
      });
    } catch (err: unknown) {
      /* La mesure ne fait PAS tomber la génération. Perdre une ligne de
         comptabilité coûte une statistique ; perdre la réponse coûte le crédit
         déjà débité au demandeur. */
      this.logger.error(
        `mesure d'usage perdue : ${err instanceof Error ? err.message : "cause inconnue"}`,
      );
    }
  }
}

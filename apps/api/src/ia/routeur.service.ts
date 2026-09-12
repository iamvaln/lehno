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
  /**
   * L'IMAGE DONT ON S'INSPIRE, en octets bruts — jamais en base64.
   *
   * Présente, l'adaptateur d'image appelle `images/edits` au lieu de
   * `images/generations` : ce sont deux points d'entrée, deux dialectes, et le
   * second n'accepte pas d'image. Un seul champ facultatif plutôt que deux
   * méthodes — la tâche, le modèle et l'invite sont les mêmes, et deux méthodes
   * auraient fait recopier le repli, le disjoncteur et la mesure d'usage.
   *
   * EN OCTETS parce que `images/edits` attend du multipart : le base64 le
   * ferait décoder pour rien, et une photo de trois mégaoctets pèserait quatre
   * en mémoire le temps du transit.
   */
  readonly image?: Buffer;
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

/* Le coût d'un appel, au tarif du catalogue AU MOMENT de l'appel.
 *
 * Exporté, et non recopié chez l'appelant : l'essai d'administration a besoin
 * du même chiffre que la production, et deux formules donneraient deux
 * factures pour un seul appel. Les tarifs sont par MILLION de jetons — c'est
 * ainsi que les fournisseurs les publient, et les convertir à la saisie ferait
 * diverger l'écran de la page tarifaire qu'on recopie.
 *
 * Nul quand le modèle n'est pas tarifé, ou quand on ne connaît pas les jetons :
 * « on ne sait pas », jamais « gratuit ». */
export function coutDeLAppel(
  tarifs: { costInput: unknown; costOutput: unknown },
  jetonsEntree: number | null,
  jetonsSortie: number | null,
): number | null {
  const tarifEntree = tarifs.costInput === null || tarifs.costInput === undefined ? null : Number(tarifs.costInput);
  const tarifSortie = tarifs.costOutput === null || tarifs.costOutput === undefined ? null : Number(tarifs.costOutput);
  if (tarifEntree === null && tarifSortie === null) return null;
  if (jetonsEntree === null && jetonsSortie === null) return null;
  return ((jetonsEntree ?? 0) * (tarifEntree ?? 0) + (jetonsSortie ?? 0) * (tarifSortie ?? 0)) / 1_000_000;
}

/* Ce que rend un appel SANS REPLI. Un résultat plutôt qu'une exception, parce
 * que l'appelant doit consigner l'échec autant que le succès : un essai raté
 * laisse une ligne — c'est ce qui distingue « le modèle a refusé » de « le
 * modèle n'a pas répondu », et le brief de design §12 en fait deux gestes
 * différents. Une exception ferait perdre cette distinction au premier
 * `catch` un peu large. */
export type ResultatDirect =
  | { readonly etat: "success"; readonly contenu: string; readonly cout: number | null; readonly latenceMs: number }
  | { readonly etat: "error" | "timeout" | "refused"; readonly code: string; readonly cout: null; readonly latenceMs: number };

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

  /* Le modèle désigné passe DEVANT, et ne figure qu'une fois.
   *
   * Trois cas, et le troisième est celui qui compte. S'il est déjà dans la
   * chaîne, on le remonte — le laisser à sa place le ferait appeler après un
   * autre. S'il n'y est pas, on l'ajoute : le disjoncteur et l'interrupteur
   * d'administration gouvernent le ROUTAGE, pas ce qu'une configuration publiée
   * désigne, et refuser ici obligerait à rallumer un modèle en production pour
   * pouvoir servir une configuration qu'on vient d'éprouver.
   *
   * Et s'il est introuvable au catalogue, on ne rend pas une chaîne vide : on
   * garde celle de la tâche. Une configuration qui nomme un modèle disparu ne
   * doit pas arrêter une génération déjà payée — elle doit se voir dans le
   * journal, par le rang. */
  private async enTete(chaine: Candidat[], tete: string | null): Promise<Candidat[]> {
    if (tete === null) return chaine;
    const [provider, ...reste] = tete.split(":");
    const modelKey = reste.join(":");
    if (!provider || !modelKey) return chaine;

    /* RANG 0 DANS LES DEUX CAS, y compris quand le modèle figure déjà dans la
       chaîne. Lui laisser son rang d'origine ferait dire au journal « servi par
       le rang 2 » là où il a été servi PAR LA CONFIGURATION — et l'écart entre
       ce qu'on a éprouvé et ce qui tourne redeviendrait invisible, qui est
       exactement ce qu'on répare. */
    const deja = chaine.find((c) => c.provider === provider && c.modelKey === modelKey);
    if (deja) return [{ ...deja, rank: 0 }, ...chaine.filter((c) => c !== deja)];

    const modele = await this.prisma.aIModel.findUnique({
      where: { provider_modelKey: { provider, modelKey } },
    });
    if (!modele) return chaine;
    return [
      {
        id: modele.id, provider: modele.provider, modelKey: modele.modelKey,
        /* Rang 0 : la chaîne commence à 1. Le journal distingue ainsi « servi
           par la configuration » de « servi par le rang 1 de la chaîne », et
           l'écart entre l'essai et la production se lit sans enquête. */
        rank: 0, costInput: modele.costInput, costOutput: modele.costOutput,
      },
      ...chaine,
    ];
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
  /**
   * @param tete le modèle que la CONFIGURATION PUBLIÉE désigne, s'il y en a
   *   une. Il passe en tête, et la chaîne devient son repli.
   *
   *   C'EST CE QUI REND « RIEN NE SE PUBLIE SANS ESSAI » VRAI. Le brief §11.1 le
   *   pose : « le modèle appelé » est rangé dans la partie lue par le modèle,
   *   donc dans l'empreinte, et l'essai appelle exactement lui. Si la production
   *   déroulait la chaîne en l'ignorant, l'essai aurait tourné sur un modèle et
   *   la production sur un autre — la garantie serait vraie au dossier et fausse
   *   en fait. C'est ce qui se passait pour les trois générations de texte,
   *   pendant que le portrait, lui, lisait bien sa configuration.
   *
   *   LE REPLI RESTE SOUS LUI, et ce n'est pas une entorse. Le §11.1 interdit le
   *   repli à L'ESSAI — pour qu'aucun `StudioTrial` ne soit consigné en
   *   `success` sous une empreinte désignant un modèle qui n'a rien produit. En
   *   production, une panne du modèle configuré doit être rattrapée : l'écart
   *   est alors tracé, `AIUsage` porte le rang, et il se lit après coup.
   */
  async executer(
    tache: TacheIA,
    demande: DemandeIA,
    adaptateurs: Record<string, Adaptateur>,
    contexte: ContexteAppel = {},
    tete: string | null = null,
  ): Promise<{ contenu: string; modele: string; fournisseur: string; rang: number }> {
    const candidats = await this.enTete(await this.chaine(tache), tete);

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
    const cout = coutDeLAppel(c, entree, sortie);

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

  /* UN SEUL MODÈLE, NOMMÉ, SANS REPLI — pour l'essai d'administration.
   *
   * `executer` replie parce qu'il sert ce qui tourne SANS TÉMOIN : une passe
   * d'arrière-plan, une génération lancée par un utilisateur qui n'attend pas
   * de savoir quel modèle a répondu. L'établi, lui, essaie *celle-là*.
   *
   * Si un repli muet servait l'essai, on enregistrerait un `StudioTrial` en
   * `success` portant une empreinte qui désigne un modèle qui n'a rien produit
   * — et la règle « rien ne se publie sans essai » autoriserait une mise en
   * service sur la foi d'un résultat obtenu ailleurs. La garantie serait vraie
   * au dossier et fausse en fait (brief fonctionnel §11.1).
   *
   * IL NE NOURRIT PAS LE DISJONCTEUR, ni au succès ni à l'échec. Le
   * disjoncteur protège le routage AUTOMATIQUE, et il se nourrit du trafic
   * réel. Un administrateur qui éprouve une consigne bancale sur le modèle de
   * premier rang écarterait sinon ce modèle de la PRODUCTION pour cinq
   * minutes — trois essais suffisent — sans rien avoir dit à personne. */
  async appelerUnSeulModele(
    tache: TacheIA,
    demande: DemandeIA,
    adaptateur: Adaptateur,
    modele: { id: string; provider: string; modelKey: string; costInput: unknown; costOutput: unknown },
    contexte: ContexteAppel = {},
  ): Promise<ResultatDirect> {
    /* `attempt: 1` : c'est le premier essai, et il n'y en aura pas d'autre.
       Recopier un rang de chaîne serait faux — le modèle demandé n'est pas
       forcément dans la chaîne de la tâche, et c'est même souvent la raison
       pour laquelle on l'essaie. */
    const candidat: Candidat = { ...modele, rank: 1 };
    const debut = Date.now();

    try {
      const reponse = await adaptateur.appeler(modele.modelKey, demande);
      const latenceMs = Date.now() - debut;
      await this.consigner(candidat, tache, contexte, "success", reponse, latenceMs, null);
      return {
        etat: "success",
        contenu: reponse.contenu,
        cout: coutDeLAppel(modele, reponse.jetonsEntree ?? null, reponse.jetonsSortie ?? null),
        latenceMs,
      };
    } catch (err: unknown) {
      const latenceMs = Date.now() - debut;
      const refus = err instanceof RefusModele;
      const code = err instanceof RefusModele || err instanceof PanneFournisseur
        ? err.code
        : (err instanceof Error ? err.name : "unknown");
      const etat = refus ? "refused" : (code === "timeout" ? "timeout" : "error");
      await this.consigner(candidat, tache, contexte, etat, null, latenceMs, code);
      return { etat, code, cout: null, latenceMs };
    }
  }
}

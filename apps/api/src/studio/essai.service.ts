import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  consigneSysteme, invite, profilContenuSchema,
  type ContexteMessage, type EssaiStudio, type ProfilContenu, type StudioReglages,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { RouteurIAService, type Adaptateur } from "../ia/routeur.service.js";
import { FOURNISSEURS_IA } from "../ia/adaptateurs/index.js";
import { StudioConfigurationService } from "./configuration.service.js";

/* L'essai d'administration — le geste qui enregistre.
 *
 * Il ne consomme aucun crédit, ne touche aucun compte réel, et son profil ne
 * correspond à personne. Il coûte en revanche de l'argent réel, et c'est
 * pourquoi il laisse deux traces : une ligne `StudioTrial` et une ligne
 * `AIUsage` marquée `studio_trial`. Sans la seconde, la facture des réglages
 * se confondrait avec celle de la production, et on ne pourrait répondre ni à
 * « combien nous coûtent les réglages » ni à « combien nous coûtent les
 * utilisateurs ».
 */

type LigneEssai = {
  id: string; studioConfigId: string; studioProfileId: string | null; adminId: string | null;
  provider: string; modelKey: string; status: string; output: unknown;
  cost: unknown; errorCode: string | null; createdAt: Date;
};

@Injectable()
export class StudioEssaiService {
  // @Inject explicite : esbuild/vitest n'émet pas design:paramtypes.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StudioConfigurationService) private readonly configs: StudioConfigurationService,
    @Inject(RouteurIAService) private readonly routeur: RouteurIAService,
    @Inject(FOURNISSEURS_IA) private readonly adaptateurs: Record<string, Adaptateur>,
  ) {}

  /* LE BROUILLON NAÎT AVANT L'APPEL, et l'ordre décide de ce qu'on perd.
   *
   * Un appel à un tiers échoue. Si le brouillon n'était écrit qu'au retour, un
   * fournisseur en panne effacerait dix minutes de composition — c'est ce qui
   * fait détester un outil. En créant d'abord, un essai raté laisse un `draft`
   * sans essai réussi : la publication reste fermée, ce qui est correct, mais
   * le travail est là.
   *
   * C'est aussi ce qui rend la règle de publication EXACTE : un `StudioTrial`
   * porte `studio_config_id`, donc la configuration doit exister quand l'essai
   * commence. */
  async essayer(
    adminId: string,
    reglages: StudioReglages,
    profileId: string,
  ): Promise<{ configId: string; essai: EssaiStudio }> {
    const profil = await this.prisma.studioProfile.findUnique({ where: { id: profileId } });
    if (!profil) throw new AppError("not_found", "unknown simulation profile");
    const contenu = profilContenuSchema.parse(profil.payload);

    const cle = reglages.modeles.message;
    const modele = await this.modeleDemande(cle);

    const config = await this.configs.deposerBrouillon(reglages);

    const adaptateur = this.adaptateurs[modele.provider];
    if (!adaptateur) {
      /* Aucun adaptateur pour ce fournisseur : la clé d'API manque. Le routeur
         saute au rang suivant dans ce cas ; ici il n'y a pas de suivant, et
         c'est le propos. On consigne l'échec EN LE NOMMANT plutôt que de
         rendre une erreur nue — le brouillon est déjà écrit, et l'établi doit
         pouvoir dire lequel des trois cas s'est produit.
         Aucune ligne `AIUsage` : rien n'a été appelé, donc rien n'a coûté. */
      return {
        configId: config.id,
        essai: this.rendre(await this.consigner(config.id, profil.id, adminId, modele, {
          status: "error", errorCode: `no_adapter_for_${modele.provider}`,
        })),
      };
    }

    const { systeme, invite: demande } = this.composer(reglages, contenu);

    const resultat = await this.routeur.appelerUnSeulModele(
      "message",
      { invite: demande, systeme },
      adaptateur,
      modele,
      /* `origin: studio_trial` et AUCUN `actionRunId` : un essai n'a pas
         d'exécution payante derrière lui. C'est ce couple qui permet de lire,
         après coup, « jeudi, six appels pour la configuration du studio » sans
         les compter dans la facture des utilisateurs. */
      { origine: "studio_trial", userId: null, actionRunId: null },
    );

    const ligne = await this.consigner(config.id, profil.id, adminId, modele,
      resultat.etat === "success"
        ? { status: "success", output: { message: resultat.contenu }, cost: resultat.cout }
        : { status: resultat.etat, errorCode: resultat.code });

    return { configId: config.id, essai: this.rendre(ligne) };
  }

  /* Le modèle DEMANDÉ, résolu dans le catalogue.
   *
   * Absent du catalogue, on refuse AVANT de créer quoi que ce soit : ce n'est
   * pas une panne mais une erreur de saisie, et l'appeler quand même écrirait
   * une ligne de dépense qui ne se rattache à aucun modèle connu.
   *
   * Coupé (`enabled: false`) ou écarté par le disjoncteur, on l'appelle QUAND
   * MÊME. Les deux interrupteurs gouvernent le routage automatique ; l'établi
   * est précisément l'endroit où l'on va voir si un modèle qu'on avait coupé
   * mérite de revenir. Refuser ici obligerait à le rallumer en production pour
   * pouvoir l'essayer. */
  private async modeleDemande(cle: string) {
    const [provider, ...reste] = cle.split(":");
    const modelKey = reste.join(":");
    const modele = provider && modelKey
      ? await this.prisma.aIModel.findUnique({
        where: { provider_modelKey: { provider, modelKey } },
        select: { id: true, provider: true, modelKey: true, costInput: true, costOutput: true },
      })
      : null;

    if (!modele)
      throw new AppError("validation_failed", `no model named "${cle}" in the catalogue`);
    return modele;
  }

  /* La CONSIGNE ET L'INVITE, assemblées depuis les réglages.
   *
   * On réemploie `consigneSysteme` et `invite` du contrat commun plutôt que
   * d'écrire un second assemblage : un essai qui composerait autrement que la
   * production ne prouverait rien de ce que la production rendra, et l'établi
   * prétend justement montrer ce qui tournera.
   *
   * Ce que les réglages ajoutent passe donc PAR-DESSUS, jamais à la place :
   * la consigne complémentaire et les garde-fous s'ajoutent aux règles
   * absolues, et la consigne d'orientation est injectée par la couture prévue
   * pour elle (`consigneOrientation`). */
  private composer(reglages: StudioReglages, profil: ProfilContenu): { systeme: string; invite: string } {
    const contexte = this.contexteDe(reglages, profil);
    const fr = profil.langue === "fr";

    const parties = [consigneSysteme(contexte)];
    if (reglages.consigneCommune.length > 0)
      parties.push("", fr ? "CONSIGNE COMPLÉMENTAIRE" : "ADDITIONAL DIRECTION", reglages.consigneCommune);
    if (reglages.gardeFous.length > 0)
      parties.push("", fr ? "GARDE-FOUS" : "GUARDRAILS", ...reglages.gardeFous.map((g) => `- ${g}`));

    return { systeme: parties.join("\n"), invite: invite(contexte) };
  }

  /* Le contexte du proche simulé, PRIVÉ de ce que les réglages ne retiennent
   * pas.
   *
   * C'est ici que « les champs du proche que le gabarit a le droit de lire »
   * devient un fait et non une case à cocher décorative. Un champ non retenu
   * vaut ABSENT — nul, ou tableau vide — parce que c'est la seule forme que
   * l'invite sait omettre proprement ; une chaîne vide y laisserait une ligne
   * d'étiquette sans valeur, que le modèle lirait comme une information
   * manquante plutôt que comme une information non fournie. */
  private contexteDe(reglages: StudioReglages, p: ProfilContenu): ContexteMessage {
    const retient = (champ: (typeof reglages.champsDuProche)[number]): boolean =>
      reglages.champsDuProche.includes(champ);
    const orientation = reglages.orientations.find((o) => o.id === p.orientation);

    return {
      langue: p.langue,
      orientation: p.orientation,
      nomDUsage: p.nomDUsage,
      registre: p.registre,
      relation: retient("relation") ? p.relation : null,
      genreDuProche: p.genreDuProche,
      genreDeLAuteur: p.genreDeLAuteur,
      occasionSensible: p.occasionSensible,
      notes: retient("notes") ? p.notes : [],
      // `aEviter` n'est PAS filtrable : c'est une interdiction, pas une
      // matière. Voir CHAMPS_DU_PROCHE dans le contrat commun.
      aEviter: p.aEviter,
      texteLibre: retient("texte_libre") ? p.texteLibre : null,
      age: retient("age") ? p.age : null,
      /* La consigne vient des RÉGLAGES, pas du registre en code : c'est tout
         l'objet de l'établi. Nulle si l'orientation du profil ne figure pas
         dans les réglages essayés — `invite` retombe alors sur le registre,
         plutôt que d'échouer sur un profil qu'on venait d'écrire. */
      consigneOrientation: orientation ? orientation.consigne : null,
    };
  }

  private async consigner(
    configId: string, profilId: string, adminId: string,
    modele: { provider: string; modelKey: string },
    issue: { status: string; output?: unknown; cost?: number | null; errorCode?: string },
  ): Promise<LigneEssai> {
    return this.prisma.studioTrial.create({
      data: {
        studioConfigId: configId,
        studioProfileId: profilId,
        adminId,
        provider: modele.provider,
        modelKey: modele.modelKey,
        status: issue.status as "success" | "error" | "timeout" | "refused",
        ...(issue.output === undefined ? {} : { output: issue.output as Prisma.InputJsonValue }),
        ...(issue.cost === undefined || issue.cost === null ? {} : { cost: issue.cost }),
        ...(issue.errorCode === undefined ? {} : { errorCode: issue.errorCode.slice(0, 80) }),
      },
    });
  }

  async lister(configId?: string): Promise<EssaiStudio[]> {
    const lignes = await this.prisma.studioTrial.findMany({
      ...(configId === undefined ? {} : { where: { studioConfigId: configId } }),
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { admin: { select: { email: true } } },
    });
    return lignes.map((l) => this.rendre(l, l.admin?.email ?? null));
  }

  private rendre(l: LigneEssai, parQui: string | null = null): EssaiStudio {
    return {
      id: l.id,
      configId: l.studioConfigId,
      profilId: l.studioProfileId,
      etat: l.status as EssaiStudio["etat"],
      // Le modèle demandé, qui est aussi le seul appelé : l'essai ne replie pas.
      modele: { fournisseur: l.provider, cle: l.modelKey },
      sortie: l.output ?? null,
      // `Decimal` de Prisma : `Number` ici, jamais à l'écran — une chaîne
      // « 0.000123 » se trierait alphabétiquement dans un tableau.
      cout: l.cost === null || l.cost === undefined ? null : Number(l.cost),
      erreur: l.errorCode,
      parQui,
      quand: l.createdAt.toISOString(),
    };
  }
}

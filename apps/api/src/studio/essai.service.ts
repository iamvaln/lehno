import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  consigneSysteme, invite, profilContenuSchema,
  type ContexteMessage, type EssaiStudio, type ProfilContenu,
  type ReglagesMessage, type ReglagesPortrait,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { RouteurIAService, type Adaptateur } from "../ia/routeur.service.js";
import { FOURNISSEURS_IA } from "../ia/adaptateurs/index.js";
import { StudioConfigurationService } from "./configuration.service.js";
import type { StockagePort } from "../stockage/stockage.port.js";

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
    @Inject("STOCKAGE_PORT") private readonly stockage: StockagePort,
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
    reglages: ReglagesMessage,
    profileId: string,
  ): Promise<{ configId: string; essai: EssaiStudio }> {
    const profil = await this.prisma.studioProfile.findUnique({ where: { id: profileId } });
    if (!profil) throw new AppError("not_found", "unknown simulation profile");
    const contenu = profilContenuSchema.parse(profil.payload);

    const cle = reglages.modele;
    const modele = await this.modeleDemande(cle);

    const config = await this.configs.deposerBrouillon("message", reglages);

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
        essai: await this.rendre(await this.consigner(config.id, profil.id, adminId, modele, {
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

    return { configId: config.id, essai: await this.rendre(ligne) };
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
  /* L'ESSAI DU PORTRAIT — celui qui manquait.
   *
   * Jusqu'ici l'établi du portrait lançait un essai de MESSAGE : il appelait
   * `modeles.message` et rendait un texte. Publier un changement de style de
   * dessin se débloquait donc avec un essai que personne n'avait regardé comme
   * une image. C'est exactement la faute que « rien ne se publie sans essai »
   * existe pour empêcher, passée par le trou entre les deux générations.
   *
   * L'AMBIANCE décide du modèle : une famille d'illustration et un style de
   * photo ne passent pas par le même. C'est aussi elle qui porte la consigne
   * lue par le modèle — le reste des réglages ne dit rien à une image.
   */
  async essayerPortrait(
    adminId: string,
    reglages: ReglagesPortrait,
    profileId: string,
    ambianceId: string,
  ): Promise<{ configId: string; essai: EssaiStudio }> {
    const profil = await this.prisma.studioProfile.findUnique({ where: { id: profileId } });
    if (!profil) throw new AppError("not_found", "unknown simulation profile");
    const contenu = profilContenuSchema.parse(profil.payload);

    const ambiance = reglages.ambiances.find((a): boolean => a.id === ambianceId);
    /* 404 et non 422 : une ambiance qu'on ne trouve pas dans les réglages
       qu'on vient d'envoyer est une erreur d'appel, pas un état du monde. */
    if (!ambiance) throw new AppError("not_found", "unknown ambiance");

    const cle = ambiance.groupe === "photo_style"
      ? reglages.modeles.photo_style
      : reglages.modeles.illustration;
    const modele = await this.modeleDemande(cle);

    const config = await this.configs.deposerBrouillon("portrait", reglages);
    const adaptateur = this.adaptateurs[modele.provider];
    if (!adaptateur) {
      return {
        configId: config.id,
        essai: await this.rendre(await this.consigner(config.id, profil.id, adminId, modele, {
          status: "error", errorCode: `no_adapter_for_${modele.provider}`,
        })),
      };
    }

    const tache = ambiance.groupe === "photo_style" ? "photo_style" as const : "illustration" as const;
    const resultat = await this.routeur.appelerUnSeulModele(
      tache,
      { invite: this.composerPortrait(ambiance.consigne[contenu.langue], contenu) },
      adaptateur,
      modele,
      { origine: "studio_trial", userId: null, actionRunId: null },
    );

    /* CE QU'ON GARDE EST UNE CLÉ, jamais l'image.
     *
     * Un modèle rend du base64 — un à deux mégaoctets. Le ranger dans
     * `output` gonflerait la table des essais de la taille de tout ce qu'on a
     * essayé, et chaque lecture de la liste les traînerait tous. La clé pèse
     * soixante caractères, et l'image se lit par une URL signée à la demande.
     */
    let sortie: { cle: string } | null = null;
    if (resultat.etat === "success") {
      sortie = { cle: await this.stockage.ecrire("portraits", Buffer.from(resultat.contenu, "base64"), "image/png") };
    }

    const ligne = await this.consigner(config.id, profil.id, adminId, modele,
      resultat.etat === "success"
        ? { status: "success", output: sortie, cost: resultat.cout }
        : { status: resultat.etat, errorCode: resultat.code });
    return { configId: config.id, essai: await this.rendre(ligne) };
  }

  /* La consigne de l'ambiance, et le profil. RIEN D'AUTRE.
   *
   * Les garde-fous et la consigne commune appartiennent au message : les
   * glisser ici enverrait au modèle d'image des instructions sur des tournures
   * de phrase, et l'empreinte du portrait retomberait à chaque fois qu'on
   * reformulerait un garde-fou du texte. */
  private composerPortrait(consigne: string, profil: ProfilContenu): string {
    const parties = [consigne];
    /* Le CONTENU des notes, pas leur structure : le modèle d'image n'a que
       faire d'une catégorie ou d'une date. */
    if (profil.notes.length > 0) parties.push(profil.notes.map((n) => n.contenu).join(" "));
    if (profil.texteLibre) parties.push(profil.texteLibre);
    return parties.join("\n\n");
  }

  private composer(reglages: ReglagesMessage, profil: ProfilContenu): { systeme: string; invite: string } {
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
  private contexteDe(reglages: ReglagesMessage, p: ProfilContenu): ContexteMessage {
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
    return Promise.all(lignes.map((l) => this.rendre(l, l.admin?.email ?? null)));
  }

  /* La CLÉ devient une URL au moment de rendre, jamais avant.
   *
   * L'essai garde une clé — soixante caractères — et l'écran a besoin d'un lien
   * qu'un navigateur sait suivre. La signature se fait donc ici, à la dernière
   * seconde, et le lien ne vaut que quelques minutes.
   *
   * C'est ce qui interdit de la ranger : un lien mis en cache par l'écran, ou
   * collé dans un message, serait mort avant d'être ouvert. L'écran redemande,
   * et le serveur redécide à chaque fois si celui qui demande a le droit — ce
   * qu'un compartiment public ne permettrait jamais.
   *
   * La signature est locale (un HMAC), pas un appel réseau : cent essais
   * coûtent cent calculs, pas cent allers-retours. */
  private async rendre(l: LigneEssai, parQui: string | null = null): Promise<EssaiStudio> {
    const sortie = await this.sortieServie((l.output ?? null) as Prisma.JsonValue | null);
    return {
      id: l.id,
      configId: l.studioConfigId,
      profilId: l.studioProfileId,
      etat: l.status as EssaiStudio["etat"],
      // Le modèle demandé, qui est aussi le seul appelé : l'essai ne replie pas.
      modele: { fournisseur: l.provider, cle: l.modelKey },
      sortie,
      // `Decimal` de Prisma : `Number` ici, jamais à l'écran — une chaîne
      // « 0.000123 » se trierait alphabétiquement dans un tableau.
      cout: l.cost === null || l.cost === undefined ? null : Number(l.cost),
      erreur: l.errorCode,
      parQui,
      quand: l.createdAt.toISOString(),
    };
  }
  /* Une sortie d'image porte `{ cle }` ; une sortie de texte porte `{ message }`.
     On ne signe que la première, et on laisse la seconde telle quelle : deviner
     la nature d'après la présence d'une clé vaut mieux qu'un champ « type » que
     personne ne penserait à remplir. */
  private async sortieServie(output: Prisma.JsonValue | null): Promise<Prisma.JsonValue | null> {
    if (output === null || typeof output !== "object" || Array.isArray(output)) return output ?? null;
    const cle = (output as Record<string, unknown>)["cle"];
    if (typeof cle !== "string") return output;
    return { cle, url: await this.stockage.lire(cle) };
  }

}

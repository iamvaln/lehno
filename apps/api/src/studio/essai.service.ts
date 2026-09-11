import { Inject, Injectable } from "@nestjs/common";
import type { Prisma, StudioConfigKind } from "@prisma/client";
import {
  consigneSysteme, invite, profilContenuSchema,
  consigneSystemeIdees, inviteIdees,
  consigneSystemePortrait, invitePortrait, inviteImagePortrait,
  type ContexteIdees, type ContexteMessage, type ContextePortrait,
  type EssaiStudio, type NatureTexte, type ProfilContenu,
  type ReglagesBriefPortrait, type ReglagesIdees,
  type ReglagesMessage, type ReglagesPortrait, type ReglagesTexte, type VerdictEssai,
} from "@lehno/contracts";

/* LA TÂCHE D'IA QUE CHAQUE NATURE ÉPROUVE. Les deux vocabulaires existaient
   déjà et ne se recouvrent pas : `StudioConfigKind` nomme ce qui se règle,
   `AITask` ce qui s'appelle. La table les relie en un seul endroit — les
   confondre ferait consigner un essai d'idées sous la tâche du message, et les
   dépenses du studio deviendraient illisibles. */
const TACHE_DE: Record<NatureTexte, "message" | "gift_ideas" | "portrait_brief"> = {
  message: "message",
  idees: "gift_ideas",
  portrait_brief: "portrait_brief",
};
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
  /* La nature vient de la CONFIGURATION, jamais d'une colonne recopiée ici :
     une ligne d'essai ne peut pas changer de nature, et la recopier ouvrirait
     la possibilité qu'elle contredise sa configuration. Toutes les lectures
     joignent donc `config`. */
  config: { kind: StudioConfigKind };
  id: string; studioConfigId: string; studioProfileId: string | null; adminId: string | null;
  provider: string; modelKey: string; status: string; output: unknown;
  cost: unknown; errorCode: string | null; createdAt: Date;
  verdict?: "kept" | "discarded" | null;
  ambianceId?: string | null;
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
  /**
   * L'ESSAI D'UNE GÉNÉRATION DE TEXTE — message, idées, brief du portrait.
   *
   * UN SEUL CHEMIN POUR LES TROIS, et non trois copies. Tout est commun : le
   * brouillon déposé avant l'appel, le modèle tiré des réglages, le refus nommé
   * quand l'adaptateur manque, la consignation du résultat. Seule la
   * COMPOSITION de l'invite diffère, et c'est `composerTexte` qui la porte.
   *
   * Cette méthode s'appelait `essayer` et ne servait que le message — et n'était
   * branchée à AUCUN contrôleur. Les réglages des trois générations de texte
   * étaient donc figés à ce que le semis avait posé.
   */
  async essayerTexte(
    nature: NatureTexte,
    adminId: string,
    reglages: ReglagesTexte,
    profileId: string,
  ): Promise<{ configId: string; essai: EssaiStudio }> {
    const profil = await this.prisma.studioProfile.findUnique({ where: { id: profileId } });
    if (!profil) throw new AppError("not_found", "unknown simulation profile");
    const contenu = profilContenuSchema.parse(profil.payload);

    const cle = reglages.modele;
    const modele = await this.modeleDemande(cle);

    const config = await this.configs.deposerBrouillon(nature, reglages);

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
        essai: await this.rendre(await this.consigner(config.id, profil.id, adminId, null, modele, {
          status: "error", errorCode: `no_adapter_for_${modele.provider}`,
        })),
      };
    }

    const { systeme, invite: demande } = this.composerTexte(nature, reglages, contenu);

    const resultat = await this.routeur.appelerUnSeulModele(
      TACHE_DE[nature],
      { invite: demande, systeme },
      adaptateur,
      modele,
      /* `origin: studio_trial` et AUCUN `actionRunId` : un essai n'a pas
         d'exécution payante derrière lui. C'est ce couple qui permet de lire,
         après coup, « jeudi, six appels pour la configuration du studio » sans
         les compter dans la facture des utilisateurs. */
      { origine: "studio_trial", userId: null, actionRunId: null },
    );

    const ligne = await this.consigner(config.id, profil.id, adminId, null, modele,
      resultat.etat === "success"
        ? { status: "success", output: { message: resultat.contenu }, cost: resultat.cout }
        : { status: resultat.etat, errorCode: resultat.code });

    return { configId: config.id, essai: await this.rendre(ligne) };
  }

  /** Le message, par son ancien nom. Gardé pour les appelants qui l'emploient. */
  async essayer(
    adminId: string, reglages: ReglagesMessage, profileId: string,
  ): Promise<{ configId: string; essai: EssaiStudio }> {
    return this.essayerTexte("message", adminId, reglages, profileId);
  }

  /* LA COMPOSITION, PAR NATURE — et une table, jamais un `switch` à trois
     branches dont on oublierait une. Le `Record` indexé sur l'énumération
     oblige le compilateur : une quatrième nature de texte non traitée ici ne
     compile pas. */
  private composerTexte(
    nature: NatureTexte, reglages: ReglagesTexte, profil: ProfilContenu,
  ): { systeme: string; invite: string } {
    if (nature === "message") return this.composer(reglages as ReglagesMessage, profil);
    if (nature === "idees") return this.composerIdees(reglages as ReglagesIdees, profil);
    return this.composerBrief(reglages as ReglagesBriefPortrait, profil);
  }

  /* LES IDÉES. Le profil ne porte pas de budget — il décrit un proche, pas une
     demande —, et c'est honnête : un essai sans budget éprouve le cas le plus
     dur, celui où le modèle doit proposer au hasard de l'échelle. */
  private composerIdees(
    reglages: ReglagesIdees, p: ProfilContenu,
  ): { systeme: string; invite: string } {
    const retient = (champ: (typeof reglages.champsDuProche)[number]): boolean =>
      reglages.champsDuProche.includes(champ);
    const contexte: ContexteIdees = {
      langue: p.langue,
      nomDUsage: p.nomDUsage,
      relation: retient("relation") ? p.relation : null,
      genreDuProche: p.genreDuProche,
      occasionSensible: p.occasionSensible,
      age: retient("age") ? p.age : null,
      notes: retient("notes") ? p.notes : [],
      // `aEviter` n'est PAS filtrable : c'est une interdiction, pas une matière.
      aEviter: p.aEviter,
      texteLibre: retient("texte_libre") ? p.texteLibre : null,
      budget: null,
      ...(reglages.consigneCommune ? { consigneCommune: reglages.consigneCommune } : {}),
      ...(reglages.gardeFous.length > 0 ? { gardeFous: reglages.gardeFous } : {}),
      nombreDemande: reglages.nombreDemande,
    };
    return { systeme: consigneSystemeIdees(contexte), invite: inviteIdees(contexte) };
  }

  /* LE BRIEF, SANS AMBIANCE. Elle appartient à la configuration de l'IMAGE, et
     l'essai du brief éprouve le texte : lui en poser une ferait éprouver un
     couple qu'aucune des deux natures ne gouverne seule. L'essai du PORTRAIT,
     lui, en pose une — c'est là qu'elle compte. */
  private composerBrief(
    reglages: ReglagesBriefPortrait, p: ProfilContenu,
  ): { systeme: string; invite: string } {
    const retient = (champ: (typeof reglages.champsDuProche)[number]): boolean =>
      reglages.champsDuProche.includes(champ);
    const contexte: ContextePortrait = {
      langue: p.langue,
      orientation: p.orientation,
      nomDUsage: p.nomDUsage,
      relation: retient("relation") ? p.relation : null,
      genreDuProche: p.genreDuProche,
      notes: retient("notes") ? p.notes.map((n) => ({ categorie: n.categorie, contenu: n.contenu })) : [],
      // Un profil simulé porte des notes et un texte libre, pas de goûts relevés.
      attributs: [],
      aEviter: p.aEviter,
      texteLibre: retient("texte_libre") ? p.texteLibre : null,
      consigneAmbiance: null,
      ...(reglages.consigneCommune ? { consigneCommune: reglages.consigneCommune } : {}),
      ...(reglages.gardeFous.length > 0 ? { gardeFous: reglages.gardeFous } : {}),
      motsDuPortrait: reglages.motsDuPortrait,
      motsDeLaPhrase: reglages.motsDeLaPhrase,
    };
    return { systeme: consigneSystemePortrait(contexte), invite: invitePortrait(contexte) };
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
        essai: await this.rendre(await this.consigner(config.id, profil.id, adminId, ambianceId, modele, {
          status: "error", errorCode: `no_adapter_for_${modele.provider}`,
        })),
      };
    }

    /* LE BRIEF D'ABORD, comme en production.
     *
     * L'essai envoyait les notes du profil DIRECTEMENT au modèle d'image. Ce
     * n'est plus ce que fait la production : un modèle de texte lit les notes
     * et rend les mots qui comptent, et c'est eux seuls qui traversent.
     *
     * Sans ce premier appel ici, l'établi n'éprouverait plus ce que la
     * production rend — le trou même que le découpage en deux configurations a
     * bouché ailleurs : « publier un changement de style de dessin se
     * débloquait avec un essai qui avait produit un texte ».
     *
     * Le modèle du brief n'est PAS un réglage de CETTE configuration : il vient
     * de celle de `portrait_brief`, comme en production. Le studio du portrait
     * règle ce qui touche à l'image ; le brief est du texte, et il a sa propre
     * nature, ses propres essais et sa propre publication. */
    const gammeActive = reglages.compositions.find((c) => c.actif);
    if (!gammeActive) throw new AppError("validation_failed", "no active composition");
    const gamme = gammeActive.palette;

    const brief = await this.briefDuProfil(ambiance, contenu);
    if (brief === null) {
      return {
        configId: config.id,
        essai: await this.rendre(await this.consigner(config.id, profil.id, adminId, ambianceId, modele, {
          status: "error", errorCode: "brief_failed",
        })),
      };
    }

    const tache = ambiance.groupe === "photo_style" ? "photo_style" as const : "illustration" as const;
    const resultat = await this.routeur.appelerUnSeulModele(
      tache,
      {
        // La MÊME palette que la production : l'établi doit montrer la gamme
        // qui sortira, pas celle du modèle laissé libre.
        /* La gamme de la PREMIÈRE composition active — l'essai éprouve les
           réglages qu'on vient d'envoyer, et le studio ne demande pas de
           composition : il montre ce qu'une gamme donne, pas ce qu'un client
           choisira. */
        invite: inviteImagePortrait(
          brief, ambiance.consigne[contenu.langue], gamme, contenu.langue,
        ),
      },
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

    const ligne = await this.consigner(config.id, profil.id, adminId, ambianceId, modele,
      resultat.etat === "success"
        ? { status: "success", output: sortie, cost: resultat.cout }
        : { status: resultat.etat, errorCode: resultat.code });
    return { configId: config.id, essai: await this.rendre(ligne) };
  }

  /* LE BRIEF DU PROFIL SIMULÉ, par le même gabarit que la production.
   *
   * Il remplace un assemblage qui collait les notes du profil derrière la
   * consigne d'ambiance et envoyait le tout au modèle d'image. Deux raisons de
   * l'avoir retiré : la production ne fait plus ça, et l'établi doit montrer ce
   * qui tournera ; et les notes du profil ne traversent plus jusqu'au
   * fournisseur d'image, comme celles d'un vrai carnet.
   *
   * `null` quand le brief échoue. L'essai le consigne alors comme une erreur
   * nommée plutôt que de remonter : un établi doit dire LEQUEL des deux appels
   * a raté, sans quoi on reprend un réglage d'image pour un défaut de texte. */
  private async briefDuProfil(
    ambiance: { groupe: string; consigne: { fr: string; en: string } },
    profil: ProfilContenu,
  ): Promise<{ mots: string[] } | null> {
    /* LA CONFIGURATION PUBLIÉE DU BRIEF, lue AVANT de composer le contexte :
       elle décide à la fois de ce qu'on demande et du modèle qui répond. La
       lire plus bas reviendrait à composer l'invite sans elle. */
    const publie = await this.configs.enService("portrait_brief").catch(() => null);
    const reglagesDuBrief = publie === null ? null : (() => {
      try { return this.configs.reglagesBriefPortraitDe(publie); } catch { return null; }
    })();

    const contexte: ContextePortrait = {
      langue: profil.langue,
      orientation: profil.orientation,
      nomDUsage: profil.nomDUsage,
      relation: profil.relation,
      genreDuProche: profil.genreDuProche,
      notes: profil.notes.map((n) => ({ categorie: n.categorie, contenu: n.contenu })),
      /* LES BORNES PUBLIÉES, comme en production : un essai qui demanderait
         trois à sept mots là où la configuration en demande huit à dix
         montrerait un nuage qui n'est pas celui qu'on mettra en service. */
      ...(reglagesDuBrief ? {
        ...(reglagesDuBrief.consigneCommune ? { consigneCommune: reglagesDuBrief.consigneCommune } : {}),
        ...(reglagesDuBrief.gardeFous.length > 0 ? { gardeFous: reglagesDuBrief.gardeFous } : {}),
        motsDuPortrait: reglagesDuBrief.motsDuPortrait,
        motsDeLaPhrase: reglagesDuBrief.motsDeLaPhrase,
      } : {}),
      /* Un profil simulé n'a pas d'attributs : il porte des notes et un texte
         libre, pas de goûts relevés. Le gabarit sait s'en passer — il le dit
         quand il n'a ni l'un ni l'autre. */
      attributs: [],
      /* Le profil PORTE ses rejets — le schéma l'exige. Ils entrent dans le
         brief comme une interdiction, exactement comme un `dislikes_nogo` d'un
         vrai carnet : c'est le seul endroit où ils sont tenables, puisque le
         modèle d'image ne verra jamais que les mots retenus. */
      aEviter: profil.aEviter,
      texteLibre: profil.texteLibre,
      consigneAmbiance: ambiance.consigne[profil.langue],
    };

    try {
      /* LE MÊME MODÈLE QU'EN PRODUCTION, tiré de la configuration publiée du
         brief. Sans lui, l'essai du portrait tournerait sur la tête de chaîne
         pendant que la production suit la configuration — et l'image éprouvée
         ne serait pas celle qu'on met en service. */
      const reponse = await this.routeur.executer(
        "portrait_brief",
        { invite: invitePortrait(contexte), systeme: consigneSystemePortrait(contexte) },
        this.adaptateurs,
        { origine: "studio_trial", userId: null, actionRunId: null },
        reglagesDuBrief?.modele ?? null,
      );
      const objet = JSON.parse(
        reponse.contenu.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "").trim(),
      ) as { mots?: unknown };
      const mots = Array.isArray(objet.mots)
        ? objet.mots.filter((m): m is string => typeof m === "string")
        : [];
      return mots.length > 0 ? { mots } : null;
    } catch {
      return null;
    }
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
    /* Nulle pour un essai de MESSAGE : il n'éprouve pas d'ambiance. Ce n'est
       pas une donnée manquante, c'est une donnée qui n'existe pas pour cette
       nature — d'où le nul plutôt qu'une chaîne vide. */
    ambianceId: string | null,
    modele: { provider: string; modelKey: string },
    issue: { status: string; output?: unknown; cost?: number | null; errorCode?: string },
  ): Promise<LigneEssai> {
    return this.prisma.studioTrial.create({
      include: { config: { select: { kind: true } } },
      data: {
        studioConfigId: configId,
        studioProfileId: profilId,
        adminId,
        // Recopiée : une ambiance retirée des réglages n'efface pas la trace
        // de ce qu'on a essayé.
        ambianceId,
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
      include: { admin: { select: { email: true } }, config: { select: { kind: true } } },
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
      nature: l.config.kind,
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
      verdict: l.verdict ?? null,
      ambianceId: l.ambianceId ?? null,
    };
  }

  /* Le sort d'un essai : ce qu'on a PENSÉ du résultat.
   *
   * Il se pose depuis l'Atelier, par le geste qui SUIT l'essai — garder retient
   * le brouillon et retient l'essai avec lui, écarter fait l'inverse. Aucun
   * geste de plus à apprendre, et c'est pourquoi il n'y a pas de motif : un
   * essai ne change rien pour personne, et une séance en compte trente.
   *
   * Il se REPOSE : on se ravise en regardant la vignette du lendemain, et
   * refuser le second geste obligerait à refaire l'essai pour changer d'avis. */
  async juger(id: string, verdict: VerdictEssai, reference = false): Promise<EssaiStudio> {
    const ligne = await this.prisma.studioTrial.findUnique({ where: { id } });
    if (!ligne) throw new AppError("not_found", "resource not found");

    /* LA RÉFÉRENCE S'ÉCRIT AVANT LE VERDICT, et l'ordre compte : si le dépôt du
       brouillon refuse — parce que l'essai n'a pas d'image, ou parce qu'aucune
       configuration n'est en service —, le verdict n'a pas bougé. L'inverse
       laisserait un essai « retenu » sans la vignette qu'on venait de demander,
       et personne ne saurait que la moitié du geste a échoué. */
    if (reference) await this.poserLaReference(ligne, verdict);

    const misAJour = await this.prisma.studioTrial.update({
      where: { id },
      data: { verdict },
      include: { admin: { select: { email: true } }, config: { select: { kind: true } } },
    });
    return this.rendre(misAJour, misAJour.admin?.email ?? null);
  }

  /**
   * Faire de l'image d'un essai la VIGNETTE de son ambiance.
   *
   * « Ce n'est pas une chaîne de production nouvelle : c'est un chemin de
   * publication. » L'image existe déjà dans le stockage — l'essai l'y a rangée.
   * Il ne manquait que de dire laquelle représente quoi.
   *
   * PAR L'ENREGISTREMENT DIRECT, et c'est ce qui rend le geste gratuit : une
   * vignette n'entre pas dans l'empreinte, donc la modification ne réclame pas
   * de nouvel essai. Si elle y entrait, choisir une miniature ferait retomber
   * toute la couverture et il faudrait repayer une génération pour la publier.
   */
  private async poserLaReference(
    essai: { id: string; status: string; output: Prisma.JsonValue | null; ambianceId: string | null },
    verdict: VerdictEssai,
  ): Promise<void> {
    if (verdict !== "kept")
      throw new AppError("validation_failed", "only a kept trial can represent its ambiance");
    if (essai.status !== "success")
      throw new AppError("validation_failed", "this trial produced nothing to show");
    if (essai.ambianceId === null)
      throw new AppError("validation_failed", "this trial has no ambiance to represent");

    /* La clé de l'IMAGE, pas la sortie entière. Un essai de texte porte
       `{ message }` et n'a rien à montrer — le distinguer par la présence d'une
       clé vaut mieux qu'un champ « type » que personne ne remplirait. */
    const sortie = essai.output;
    const cle = sortie !== null && typeof sortie === "object" && !Array.isArray(sortie)
      ? (sortie as Record<string, unknown>)["cle"]
      : null;
    if (typeof cle !== "string")
      throw new AppError("validation_failed", "this trial produced no image");

    /* LA TÊTE, et non la configuration sur laquelle l'essai a tourné. C'est
       celle que l'administration a sous les yeux ; repartir d'une ligne
       antérieure défferait en silence ce qui a été composé depuis. */
    const tete = (await this.configs.brouillon("portrait"))
      ?? (await this.configs.enService("portrait"));
    if (!tete) throw new AppError("resource_inactive", "no portrait configuration to adjust");

    const reglages = this.configs.reglagesPortraitDe(tete);
    if (!reglages.ambiances.some((a) => a.id === essai.ambianceId))
      throw new AppError("validation_failed", "this ambiance is no longer in the configuration");

    await this.configs.enregistrerDirect("portrait", {
      ...reglages,
      ambiances: reglages.ambiances.map((a) =>
        (a.id === essai.ambianceId ? { ...a, apercuCle: cle } : a)),
    });
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

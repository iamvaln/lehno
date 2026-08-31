import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { Prisma, StudioConfigKind } from "@prisma/client";
import {
  matierePourEmpreinteMessage, matierePourEmpreintePortrait,
  reglagesMessageSchema, reglagesPortraitSchema,
  type BlocagePublication, type ReglagesMessage, type ReglagesPortrait,
  type ConfigurationMessage, type ConfigurationPortrait,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { AuditService } from "../admin/audit.service.js";

/* La configuration du Studio : la chaîner, la publier, y revenir.
 *
 * Une seule règle gouverne tout le fichier : ON NE MUTE JAMAIS UNE LIGNE DE
 * RÉGLAGES. Chaque écriture en crée une neuve et dépasse la précédente. Voir
 * le commentaire du modèle `StudioConfig` — la règle « rien ne se publie sans
 * essai » n'est vraie que par ce chaînage.
 */

/* La règle de publication, ÉNONCÉE UNE SEULE FOIS.
 *
 * Elle est lue à deux endroits — la publication, qui refuse, et le rendu, qui
 * grise le bouton. Deux formulations divergeraient au premier durcissement
 * (par exemple « au moins un essai sur un profil sensible », §9 non tranché),
 * et l'écran proposerait alors ce que le serveur refuse. C'est la pire des
 * divergences : elle se découvre en cliquant.
 *
 * Pure à dessein : le COMPTE d'essais lui est passé, elle ne va pas le
 * chercher. C'est ce qui permet de la lire depuis un rendu de liste, où le
 * compte a déjà été groupé. */
function blocagePour(etat: string, essaisReussis: number): BlocagePublication | null {
  if (etat === "published") return "deja_en_service";
  if (etat === "superseded") return "etat_depasse";
  return essaisReussis === 0 ? "aucun_essai_reussi" : null;
}

/* Une configuration n'a QU'UNE forme ; seuls ses réglages changent selon la
   nature. L'écrire ainsi plutôt qu'en union laisse le compilateur vérifier
   l'assemblage — une union l'obligerait à corréler `kind` et `reglages`, ce
   qu'il ne sait pas faire sur un littéral, et on en serait réduit à forcer. */
type ConfigurationDe<R> = Omit<ConfigurationMessage, "reglages"> & { reglages: R };

type LigneConfig = {
  id: string; kind: StudioConfigKind; version: number | null; state: string; settings: unknown;
  fingerprint: string; publishedAt: Date | null; publishedByAdminId: string | null;
  note: string | null; createdAt: Date;
};

@Injectable()
export class StudioConfigurationService {
  // @Inject explicite : esbuild/vitest n'émet pas design:paramtypes.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly journal: AuditService,
  ) {}

  /* L'empreinte : SHA-256 de la partie lue par le modèle, jamais de `settings`
     entier. Le tri des champs vit dans le contrat commun, pour que
     l'administration puisse prédire à l'écran si sa modification exigera une
     prévisualisation — sans quoi elle le découvrirait au moment de publier. */
  /* Deux empreintes, et c'est tout l'objet du découpage : reformuler un
     garde-fou du message ne doit plus faire retomber les essais du portrait, ni
     l'inverse. Une seule empreinte rendait chaque réglage à éprouver dès que
     l'AUTRE bougeait. */
  empreinte(nature: StudioConfigKind, reglages: ReglagesMessage | ReglagesPortrait): string {
    const matiere = nature === "message"
      ? matierePourEmpreinteMessage(reglages as ReglagesMessage)
      : matierePourEmpreintePortrait(reglages as ReglagesPortrait);
    return createHash("sha256").update(matiere).digest("hex");
  }

  /** Les réglages relus de la base, revalidés. */
  reglagesDe(ligne: { kind: StudioConfigKind; settings: unknown }): ReglagesMessage | ReglagesPortrait {
    return ligne.kind === "message"
      ? reglagesMessageSchema.parse(ligne.settings)
      : reglagesPortraitSchema.parse(ligne.settings);
  }

  /* Deux lectures typées, pour que les appelants n'aient pas à faire
     l'affirmation eux-mêmes : `generation.service` ne lit QUE le message, le
     studio du portrait QUE le portrait. Une assertion posée chez l'appelant
     laisserait passer l'inversion sans que rien ne le dise. */
  reglagesMessageDe(ligne: { settings: unknown }): ReglagesMessage {
    return reglagesMessageSchema.parse(ligne.settings);
  }

  reglagesPortraitDe(ligne: { settings: unknown }): ReglagesPortrait {
    return reglagesPortraitSchema.parse(ligne.settings);
  }

  async enService(nature: StudioConfigKind): Promise<LigneConfig | null> {
    return this.prisma.studioConfig.findFirst({ where: { kind: nature, state: "published" } });
  }

  async brouillon(nature: StudioConfigKind): Promise<LigneConfig | null> {
    return this.prisma.studioConfig.findFirst({ where: { kind: nature, state: "draft" } });
  }

  /* Le CHAÎNAGE, en une transaction : la ligne courante recule, la neuve prend
   * sa place.
   *
   * L'ordre n'est pas indifférent — l'index unique partiel n'admet qu'un seul
   * `draft`, et refuserait l'insertion dans l'ordre inverse. C'est le même
   * piège que la chaîne des gabarits, et il se paie de la même façon : par une
   * violation de contrainte que rien n'explique à l'écran. */
  async deposerBrouillon(
    nature: StudioConfigKind,
    reglages: ReglagesMessage | ReglagesPortrait,
    tx?: Prisma.TransactionClient,
  ): Promise<LigneConfig> {
    const ecrire = async (client: Prisma.TransactionClient): Promise<LigneConfig> => {
      /* Le dépassement ne vaut QUE pour sa nature : sans ce filtre, composer un
         message ferait passer le brouillon du portrait en `superseded` — on
         perdrait un travail en cours en travaillant sur autre chose. */
      await client.studioConfig.updateMany({
        where: { kind: nature, state: "draft" }, data: { state: "superseded" },
      });
      return client.studioConfig.create({
        data: {
          kind: nature,
          state: "draft",
          settings: reglages as unknown as Prisma.InputJsonValue,
          fingerprint: this.empreinte(nature, reglages),
        },
      });
    };
    return tx ? ecrire(tx) : this.prisma.$transaction(ecrire);
  }

  /* L'ENREGISTREMENT DIRECT : ce que seule l'application lit (brief §3).
   *
   * Il crée une ligne comme une prévisualisation, mais sans appel de modèle.
   * C'est ce qui rend la §3 tenable : régénérer pour enregistrer un ordre
   * d'affichage produirait une image identique à la précédente, et une
   * validation qui ne prouve rien s'apprend très vite à cliquer sans regarder.
   *
   * Le CONTRÔLE est ici, et il est le pivot du dispositif : si l'empreinte a
   * bougé, la modification touche à ce que le modèle lit et doit passer par
   * une prévisualisation. Sans ce refus, ce chemin deviendrait la porte de
   * service par laquelle on publie une consigne que personne n'a vue tourner.
   */
  async enregistrerDirect(
    nature: StudioConfigKind, reglages: ReglagesMessage | ReglagesPortrait,
  ): Promise<LigneConfig> {
    const tete = (await this.brouillon(nature)) ?? (await this.enService(nature));
    if (!tete)
      throw new AppError("resource_inactive", "the studio has no configuration to adjust yet");

    const empreinte = this.empreinte(nature, reglages);
    if (empreinte !== tete.fingerprint)
      throw new AppError(
        "trial_required",
        "this change alters what the model reads: it must go through a preview",
        { empreinteAttendue: tete.fingerprint, empreinteRecue: empreinte },
      );

    return this.deposerBrouillon(nature, reglages);
  }

  /* La PUBLICATION, en une transaction.
   *
   * Trois choses tiennent ensemble ou rien ne bouge : le motif (le journal
   * refuse une note trop courte), le retrait de la version en service, et la
   * prise de fonction du brouillon. Une publication sans trace, ou une trace
   * sans publication, valent toutes deux moins que rien.
   *
   * Le journal écrit EN PREMIER : s'il refuse la note, l'état n'a pas bougé. */
  async publier(adminId: string, configId: string, note: string): Promise<LigneConfig> {
    const cible = await this.prisma.studioConfig.findUnique({ where: { id: configId } });
    if (!cible) throw new AppError("not_found", "unknown studio configuration");

    const blocage = await this.blocageDe(cible);
    if (blocage) throw this.erreurDe(blocage);

    return this.prisma.$transaction(async (tx) => {
      await this.journal.consigner({
        auteurId: adminId, action: "studio_config_publish", motif: note,
        cibleType: "studio_config", cibleId: cible.id,
        details: { empreinte: cible.fingerprint },
      }, tx);

      /* La sortante D'ABORD. L'index unique partiel n'admet qu'une seule ligne
         `published` : dans l'ordre inverse, l'insertion tombe sur une
         violation de contrainte, et l'écran lirait « erreur interne » là où il
         n'y a qu'un ordre d'écriture. */
      /* DÉPUBLIER SEULEMENT SA NATURE.
       *
       * Sans ce filtre, publier le portrait faisait passer la configuration du
       * message en `superseded` : le studio se retrouvait à moitié servi, et
       * `/me/studio/options` refusait tout — la moitié qu'on venait de publier
       * emportait l'autre.
       *
       * L'index unique ne l'aurait pas rattrapé : il n'admet qu'une publiée PAR
       * NATURE, et zéro en satisfait la lettre. */
      await tx.studioConfig.updateMany({
        where: { kind: cible.kind, state: "published" }, data: { state: "superseded" },
      });

      const dernier = await tx.studioConfig.aggregate({ _max: { version: true } });

      return tx.studioConfig.update({
        where: { id: cible.id },
        data: {
          state: "published",
          version: (dernier._max.version ?? 0) + 1,
          publishedAt: new Date(),
          publishedByAdminId: adminId,
          note,
        },
      });
    });
  }

  /* LE RETOUR ARRIÈRE : une version antérieure reprend la main, sans être
   * reconstruite.
   *
   * TROIS CHOSES QU'IL NE FAIT PAS, et chacune répare une lecture possible :
   *
   * - il ne crée pas de version. C'est la MÊME qui revient, avec son numéro ;
   *   en fabriquer une nouvelle ferait cesser le numéro de désigner un
   *   contenu, et l'historique deviendrait illisible au bout de dix retours.
   * - il ne touche pas à `published_at` ni à `published_by_admin_id` : ils
   *   disent qui a mis ce contenu au monde, pas quand il tourne. Le fait qu'on
   *   y soit revenu est un ÉVÉNEMENT, et c'est le journal d'audit qui le
   *   porte.
   * - il ne touche pas au brouillon. Revenir en arrière pendant que quelqu'un
   *   compose ne doit pas effacer son travail — d'où le `where` sur
   *   `published` seul.
   */
  async retourArriere(adminId: string, configId: string, motif: string): Promise<LigneConfig> {
    const cible = await this.prisma.studioConfig.findUnique({ where: { id: configId } });
    if (!cible) throw new AppError("not_found", "unknown studio configuration");

    if (cible.state === "published")
      throw new AppError("conflict", "this configuration is already in service");
    /* On ne revient QUE sur ce qui a servi. Un brouillon abandonné n'a jamais
       été vu par personne : y « revenir » le mettrait en service sans qu'aucune
       publication ne l'ait jamais validé — le contournement exact que la règle
       de publication interdit. */
    if (cible.version === null)
      throw new AppError("conflict", "this configuration has never been published");

    return this.prisma.$transaction(async (tx) => {
      await this.journal.consigner({
        auteurId: adminId, action: "studio_config_rollback", motif,
        cibleType: "studio_config", cibleId: cible.id,
        details: { version: cible.version },
      }, tx);

      await tx.studioConfig.updateMany({
        where: { state: "published" }, data: { state: "superseded" },
      });

      return tx.studioConfig.update({ where: { id: cible.id }, data: { state: "published" } });
    });
  }

  /* Ce qui empêche de publier, nommé. Nul veut dire « publiable ».
   *
   * La règle du brief §4, énoncée exactement : il faut au moins un
   * `StudioTrial` en `success` sur une configuration dont L'EMPREINTE est
   * identique — pas forcément celle-ci. C'est ce qui rend la §3 praticable :
   * un changement de libellé crée une ligne neuve, mais elle hérite de la
   * couverture d'essai de la précédente, puisque l'empreinte n'a pas bougé. */
  private async blocageDe(ligne: LigneConfig): Promise<BlocagePublication | null> {
    return blocagePour(ligne.state, await this.essaisReussis(ligne.fingerprint));
  }

  private erreurDe(blocage: BlocagePublication): AppError {
    if (blocage === "aucun_essai_reussi")
      return new AppError("trial_required", "no successful trial covers this configuration");
    return new AppError("conflict", `this configuration cannot be published (${blocage})`);
  }

  async essaisReussis(empreinte: string): Promise<number> {
    return this.prisma.studioTrial.count({
      where: { status: "success", config: { fingerprint: empreinte } },
    });
  }

  /** Une ligne, rendue au contrat. Le compte d'essais est résolu à la lecture. */
  /* Deux lectures typées, comme pour les réglages : l'appelant n'a pas à
     affirmer ce qu'il reçoit. Le studio du portrait ne sert QUE du portrait,
     l'atelier du message QUE du message — et une inversion ne se compile pas.
     Une union rendue ici obligerait chaque appelant à la rétrécir lui-même,
     c'est-à-dire à se porter garant de ce que le service sait déjà. */
  async rendrePortrait(ligne: LigneConfig): Promise<ConfigurationPortrait> {
    return (await this.rendre(ligne)) as ConfigurationPortrait;
  }

  async rendreMessage(ligne: LigneConfig): Promise<ConfigurationMessage> {
    return (await this.rendre(ligne)) as ConfigurationMessage;
  }

  async rendre(ligne: LigneConfig): Promise<ConfigurationDe<ReglagesMessage | ReglagesPortrait>> {
    const [essais, auteur] = await Promise.all([
      this.essaisReussis(ligne.fingerprint),
      ligne.publishedByAdminId === null
        ? Promise.resolve(null)
        : this.prisma.admin.findUnique({
          where: { id: ligne.publishedByAdminId }, select: { email: true },
        }),
    ]);
    return this.assembler(ligne, essais, auteur?.email ?? null);
  }

  private assembler(
    ligne: LigneConfig, essaisReussis: number, parQui: string | null,
  ): ConfigurationDe<ReglagesMessage | ReglagesPortrait> {
    /* Le blocage se DÉDUIT du compte déjà lu, il ne se relit pas : une seconde
       interrogation rendrait la ligne vue en liste incohérente avec la même
       ligne vue en détail dès qu'un essai tombe entre les deux. */
    const blocage = blocagePour(ligne.state, essaisReussis);

    return {
      id: ligne.id,
      etat: ligne.state as ConfigurationMessage["etat"],
      version: ligne.version,
      empreinte: ligne.fingerprint,
      reglages: this.reglagesDe(ligne),
      note: ligne.note,
      publieeLe: ligne.publishedAt?.toISOString() ?? null,
      /* Nul plutôt qu'« inconnu » pour la configuration posée par la
         réconciliation au démarrage : personne ne l'a publiée, et « inconnu »
         laisserait croire qu'on a perdu le nom. Même règle que les gabarits. */
      parQui,
      creeeLe: ligne.createdAt.toISOString(),
      essaisReussis,
      publiable: blocage === null,
      blocage,
    };
  }

  /* Une LISTE se résout en deux requêtes, pas en deux par ligne.
   *
   * `rendre` interroge la base deux fois — le compte d'essais et l'auteur —
   * ce qui est juste pour une ligne et ruineux pour l'historique : une séance
   * de réglage produit trente lignes, et l'écran en montre deux cents. On
   * groupe donc en amont, puis on assemble en mémoire.
   *
   * Le rendu reste UN SEUL chemin : `assembler` est la même fonction pour une
   * ligne et pour cent. Deux formes de rendu pour une seule chose finissent
   * toujours par diverger — c'est ce qui fait qu'un champ ajouté n'apparaît
   * que sur l'un des deux écrans. */
  async rendreTous(lignes: LigneConfig[]): Promise<ConfigurationDe<ReglagesMessage | ReglagesPortrait>[]> {
    if (lignes.length === 0) return [];

    const empreintes = [...new Set(lignes.map((l) => l.fingerprint))];
    const auteurs = [...new Set(lignes.flatMap((l) => (l.publishedByAdminId ? [l.publishedByAdminId] : [])))];

    const [comptes, comptables] = await Promise.all([
      this.prisma.studioTrial.groupBy({
        by: ["studioConfigId"],
        where: { status: "success", config: { fingerprint: { in: empreintes } } },
        _count: { _all: true },
      }),
      this.prisma.studioConfig.findMany({
        where: { fingerprint: { in: empreintes } },
        select: { id: true, fingerprint: true },
      }),
    ]);

    /* Le compte se fait par EMPREINTE, jamais par configuration : la règle du
       §4 accepte un essai venu d'un état antérieur à empreinte identique.
       Compter par ligne rendrait « 0 essai » sur un brouillon qui hérite
       pourtant de la couverture du précédent, et l'écran grisrait un bouton
       que le serveur, lui, accepterait. */
    const empreinteDe = new Map(comptables.map((c) => [c.id, c.fingerprint]));
    const parEmpreinte = new Map<string, number>();
    for (const c of comptes) {
      const e = empreinteDe.get(c.studioConfigId);
      if (e === undefined) continue;
      parEmpreinte.set(e, (parEmpreinte.get(e) ?? 0) + c._count._all);
    }

    const parAuteur = new Map(
      (auteurs.length === 0 ? [] : await this.prisma.admin.findMany({
        where: { id: { in: auteurs } }, select: { id: true, email: true },
      })).map((a) => [a.id, a.email]),
    );

    return lignes.map((l) => this.assembler(
      l,
      parEmpreinte.get(l.fingerprint) ?? 0,
      (l.publishedByAdminId ? parAuteur.get(l.publishedByAdminId) : undefined) ?? null,
    ));
  }
}

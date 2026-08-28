import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import {
  matierePourEmpreinte, studioReglagesSchema,
  type BlocagePublication, type ConfigurationStudio, type StudioReglages,
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

type LigneConfig = {
  id: string; version: number | null; state: string; settings: unknown;
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
  empreinte(reglages: StudioReglages): string {
    return createHash("sha256").update(matierePourEmpreinte(reglages)).digest("hex");
  }

  /** Les réglages relus de la base, revalidés. */
  reglagesDe(ligne: { settings: unknown }): StudioReglages {
    return studioReglagesSchema.parse(ligne.settings);
  }

  async enService(): Promise<LigneConfig | null> {
    return this.prisma.studioConfig.findFirst({ where: { state: "published" } });
  }

  async brouillon(): Promise<LigneConfig | null> {
    return this.prisma.studioConfig.findFirst({ where: { state: "draft" } });
  }

  /* Le CHAÎNAGE, en une transaction : la ligne courante recule, la neuve prend
   * sa place.
   *
   * L'ordre n'est pas indifférent — l'index unique partiel n'admet qu'un seul
   * `draft`, et refuserait l'insertion dans l'ordre inverse. C'est le même
   * piège que la chaîne des gabarits, et il se paie de la même façon : par une
   * violation de contrainte que rien n'explique à l'écran. */
  async deposerBrouillon(reglages: StudioReglages, tx?: Prisma.TransactionClient): Promise<LigneConfig> {
    const ecrire = async (client: Prisma.TransactionClient): Promise<LigneConfig> => {
      await client.studioConfig.updateMany({
        where: { state: "draft" }, data: { state: "superseded" },
      });
      return client.studioConfig.create({
        data: {
          state: "draft",
          settings: reglages as unknown as Prisma.InputJsonValue,
          fingerprint: this.empreinte(reglages),
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
  async enregistrerDirect(reglages: StudioReglages): Promise<LigneConfig> {
    const tete = (await this.brouillon()) ?? (await this.enService());
    if (!tete)
      throw new AppError("resource_inactive", "the studio has no configuration to adjust yet");

    const empreinte = this.empreinte(reglages);
    if (empreinte !== tete.fingerprint)
      throw new AppError(
        "trial_required",
        "this change alters what the model reads: it must go through a preview",
        { empreinteAttendue: tete.fingerprint, empreinteRecue: empreinte },
      );

    return this.deposerBrouillon(reglages);
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
      await tx.studioConfig.updateMany({
        where: { state: "published" }, data: { state: "superseded" },
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
    if (ligne.state === "published") return "deja_en_service";
    if (ligne.state === "superseded") return "etat_depasse";
    return (await this.essaisReussis(ligne.fingerprint)) === 0 ? "aucun_essai_reussi" : null;
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
  async rendre(ligne: LigneConfig): Promise<ConfigurationStudio> {
    const [essais, auteur] = await Promise.all([
      this.essaisReussis(ligne.fingerprint),
      ligne.publishedByAdminId === null
        ? Promise.resolve(null)
        : this.prisma.admin.findUnique({
          where: { id: ligne.publishedByAdminId }, select: { email: true },
        }),
    ]);
    const blocage = await this.blocageDe(ligne);

    return {
      id: ligne.id,
      etat: ligne.state as ConfigurationStudio["etat"],
      version: ligne.version,
      empreinte: ligne.fingerprint,
      reglages: this.reglagesDe(ligne),
      note: ligne.note,
      publieeLe: ligne.publishedAt?.toISOString() ?? null,
      /* Nul plutôt qu'« inconnu » pour la configuration posée par la
         réconciliation au démarrage : personne ne l'a publiée, et « inconnu »
         laisserait croire qu'on a perdu le nom. Même règle que les gabarits. */
      parQui: auteur?.email ?? null,
      creeeLe: ligne.createdAt.toISOString(),
      essaisReussis: essais,
      publiable: blocage === null,
      blocage,
    };
  }

  async rendreTous(lignes: LigneConfig[]): Promise<ConfigurationStudio[]> {
    // Une ligne suit le même chemin qu'une liste : deux formes de rendu pour
    // une seule chose finissent toujours par diverger.
    return Promise.all(lignes.map((l) => this.rendre(l)));
  }
}

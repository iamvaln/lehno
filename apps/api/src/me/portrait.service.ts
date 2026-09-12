import { Inject, Injectable } from "@nestjs/common";
import {
  inviteImagePortrait,
  type Portrait as PortraitRendu, type ReglagesPortrait, type VoieImage,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { RouteurIAService, type Adaptateur } from "../ia/routeur.service.js";
import { FOURNISSEURS_IA } from "../ia/adaptateurs/index.js";
import { StudioConfigurationService } from "../studio/configuration.service.js";
import type { StockagePort } from "../stockage/stockage.port.js";
import { PhotoSourceService } from "./photo-source.service.js";
import { composerLePortrait } from "./composition.js";

/* Dix minutes pour une lecture : le temps de télécharger sur un réseau lent,
   sans qu'un lien recopié survive à la séance. Même durée que l'avatar et le
   reçu — trois valeurs différentes n'auraient aucune raison de l'être. */
const DUREE_LECTURE = 600;

/**
 * Le portrait, une fois son texte produit.
 *
 * DEUX TEMPS, ET LE SECOND EST LA MODÉRATION. Le lancement rend un texte que
 * son auteur relit ; l'image ne se fabrique qu'à l'approbation. Produire les
 * deux d'un coup ferait payer une image que personne ne veut — et une image se
 * refait, elle ne se retouche pas.
 *
 * CE QUI PART AU MODÈLE D'IMAGE N'EST JAMAIS UNE NOTE. Le brief a déjà retenu
 * les mots ; `inviteImagePortrait` ne reçoit qu'eux, l'ambiance et le motif.
 * C'est ce qui empêche les confidences de traverser chez un fournisseur tiers.
 */
@Injectable()
export class PortraitService {
  // @Inject explicites : esbuild/vitest n'émet pas design:paramtypes.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RouteurIAService) private readonly routeur: RouteurIAService,
    @Inject(FOURNISSEURS_IA) private readonly adaptateurs: Record<string, Adaptateur>,
    @Inject(StudioConfigurationService) private readonly configs: StudioConfigurationService,
    @Inject("STOCKAGE_PORT") private readonly stockage: StockagePort,
    @Inject(PhotoSourceService) private readonly photos: PhotoSourceService,
  ) {}

  /* 404 et non 403 : dire « il existe mais n'est pas à vous » apprendrait qu'il
     existe, et un identifiant se confirme plus facilement qu'il ne se devine. */
  private async sien(userId: string, id: string) {
    const ligne = await this.prisma.portrait.findFirst({ where: { id, userId } });
    if (!ligne) throw new AppError("not_found", "resource not found");
    return ligne;
  }

  async lire(userId: string, id: string): Promise<PortraitRendu> {
    return this.rendre(await this.sien(userId, id));
  }

  /* L'AVIS — ce qu'on en a PENSÉ, et non ce qu'on en a fait.
   *
   * `approved` est un GESTE : je garde ce portrait. L'avis est un JUGEMENT, et
   * les deux se séparent dans la vraie vie — on approuve un portrait passable
   * parce qu'on a payé et qu'il faut bien en sortir un. Ranger le jugement dans
   * l'état ferait perdre les deux : on ne distinguerait plus « pas approuvé »
   * de « jugé mauvais ».
   *
   * `null` retire l'avis et sa date avec lui — la contrainte en base l'exige. */
  async noter(userId: string, id: string, avis: "up" | "down" | null): Promise<PortraitRendu> {
    await this.sien(userId, id);
    return this.rendre(await this.prisma.portrait.update({
      where: { id },
      data: { feedback: avis, feedbackAt: avis === null ? null : new Date() },
    }));
  }

  async lister(userId: string): Promise<PortraitRendu[]> {
    const lignes = await this.prisma.portrait.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return Promise.all(lignes.map((l) => this.rendre(l)));
  }

  /**
   * Approuver : c'est ici que l'image se fabrique.
   *
   * IDEMPOTENT. Un portrait déjà approuvé rend le sien plutôt qu'un conflit ou
   * une seconde image : deux frappes sur le même bouton sont la chose la plus
   * banale du monde sur un téléphone, et la seconde ne doit pas coûter un appel
   * de modèle. La contrainte en base lie d'ailleurs l'image et l'approbation
   * dans les deux sens — un portrait approuvé a toujours son image.
   */
  async approuver(userId: string, id: string): Promise<PortraitRendu> {
    const ligne = await this.sien(userId, id);
    if (ligne.status === "approved") return this.rendre(ligne);

    /* LA CONFIGURATION QUI A PRODUIT LE BRIEF, pas celle en service.
     *
     * On lisait la courante. Reformuler la consigne d'une ambiance entre le
     * lancement et l'approbation composait donc l'image avec un texte, et le
     * brief avec un autre — le dessin ne correspondait plus à ce qu'on venait
     * de relire pour l'approuver.
     *
     * L'historique existait déjà : chaque publication est une ligne, celle
     * qu'on remplace passe en `superseded`. Il ne manquait que ce lien.
     *
     * ET ÇA SUPPRIME UN REFUS qu'on n'aurait pas dû avoir à écrire : une
     * ambiance retirée du catalogue faisait échouer l'approbation. Dans la
     * configuration d'origine, elle y est toujours — un portrait payé
     * s'approuve, quoi qu'on ait publié depuis. */
    const reglages = await this.reglagesDuPortrait(ligne.studioConfigId);
    const { mots, phrase } = this.motsDe(ligne.content);

    /* LA VOIE ET L'AMBIANCE SONT CELLES QU'ON A CHOISIES, figées au lancement.
     *
     * Elles étaient relues du catalogue — la première active —, si bien que
     * « abstrait » rendait un paysage sans qu'aucune erreur ne s'affiche. Pire :
     * le brief a été composé avec la consigne de l'ambiance choisie, donc
     * l'image ne correspondait pas au texte qu'on venait de relire.
     *
     * ON NE RELIT PAS LE CATALOGUE POUR VÉRIFIER qu'elles y sont encore. Le
     * catalogue peut changer entre le lancement et l'approbation ; désactiver
     * une ambiance ne doit pas transformer un portrait déjà payé en refus.
     * Même doctrine que `payment.feeAmount` : ce qui a été annoncé fait foi. */
    const voie = ligne.visualPath as VoieImage | null;
    if (voie === null) throw new AppError("conflict", "this portrait has no visual path");

    const ambiance = ligne.ambianceId === null
      ? null
      : reglages.ambiances.find((a) => a.id === ligne.ambianceId) ?? null;
    /* Elle y est, par construction : c'est la configuration qui l'a proposée.
       Le refus qui vivait ici — « l'ambiance n'est plus publiée » — n'avait de
       sens que tant qu'on relisait le catalogue courant. */
    if (ligne.ambianceId !== null && ambiance === null)
      throw new AppError("internal_error", "the recorded ambiance is absent from its own configuration");

    /* LA GAMME DE LA COMPOSITION CHOISIE, relue dans la configuration d'origine
       — et non « la première » ni « celle par défaut ». Une illustration
       destinée à un fond d'encre n'emploie pas la gamme du papier : elle y
       disparaîtrait. C'est la composition qui pose le fond, donc elle qui
       décide de ce qui s'y voit. */
    const composition = ligne.compositionId === null
      ? null
      : reglages.compositions.find((c) => c.id === ligne.compositionId) ?? null;
    if (composition === null)
      throw new AppError("resource_inactive", "the chosen composition is no longer published");
    const gamme = composition.palette;

    const cle = voie === "photo" ? reglages.modeles.photo_style : reglages.modeles.illustration;
    const modele = await this.modeleDemande(cle);
    const adaptateur = this.adaptateurs[modele.provider];
    /* Aucune clé d'API pour ce fournisseur. `resource_inactive` et non
       `internal_error` : ce n'est pas une panne, c'est une configuration
       absente, et l'écran doit dire « indisponible » plutôt que « réessayez ».
       AUCUN CRÉDIT N'EST REPRIS : il a payé le texte, qui est là. */
    if (!adaptateur) throw new AppError("resource_inactive", "no image provider configured");

    /* LE MOTIF NE PART PLUS AU MODÈLE. Il recevait la chaîne
       `trame_de_hampes` — un identifiant, du charabia —, pour un motif que
       `PortraitComposition` dessine de toute façon. Le fond, la bande, le texte
       et la marque du pied appartiennent à la composition, qui les pose au
       pixel près et à l'identique. Le modèle rend une ILLUSTRATION SEULE.
       Ce qui part à sa place : LA PALETTE. C'est elle qui rend une image Lehno
       reconnaissable au-delà de son cadre. */
    /* LA PHOTO, LUE ICI ET CONSOMMÉE, quand c'est la voie choisie.
     *
     * Elle a été déposée et jugée AVANT le paiement — trop petite, trop sombre,
     * trop plate se disent alors, pendant que le geste peut encore se refaire.
     * Ici elle ne peut plus qu'être absente, et c'est un refus honnête : la
     * voie photo sans photo ne produirait qu'une illustration, et l'utilisateur
     * aurait payé autre chose que ce qu'il a demandé. */
    const photoCle = voie === "photo" ? await this.photos.lire(userId) : null;
    const photo = photoCle === null ? undefined : await this.stockage.contenu(photoCle);

    const resultat = await this.routeur.appelerUnSeulModele(
      voie === "photo" ? "photo_style" : "illustration",
      {
        invite: inviteImagePortrait(
          { mots }, ambiance?.consigne.fr ?? null, gamme, "fr",
          /* LA CONSIGNE DE LA PHOTO n'accompagne que la photo. Sans image, elle
             demanderait au modèle de s'inspirer d'une photo qu'il n'a pas. */
          voie === "photo" ? reglages.photo?.consigne.fr ?? null : null,
        ),
        ...(photo === undefined ? {} : { image: photo }),
      },
      adaptateur,
      modele,
      { origine: "user_action", userId, actionRunId: ligne.actionRunId },
    );

    /* LA SOURCE RESTE — voir `photo-source.service`. On refait un portrait pour
       en voir un autre, et redemander un téléversement à chaque essai
       transformerait la recherche du bon rendu en corvée. Elle ne s'en va qu'au
       dépôt d'une autre.

       CE QUI SUIT EST DONC LE CHEMIN COURANT, pas une exception : la photo est
       toujours là quand on repasse ici. */

    if (resultat.etat !== "success")
      throw new AppError("generation_unavailable", `image generation failed: ${resultat.code}`);

    /* LA COMPOSITION, AU SERVEUR. Le modèle a rendu une illustration seule —
       l'invite lui interdit texte, cadre et signature. C'est ici qu'elle entre
       dans son cadre, avec la phrase et la mention `lehno.io`.
       Pourquoi ici et pas seulement au client : le fichier rangé dans le
       stockage est CELUI QU'ON PARTAGE. S'il sortait nu, il ne porterait rien
       de Lehno hors de l'application. */
    const proche = await this.prisma.person.findUniqueOrThrow({
      where: { id: ligne.personId },
      select: { callingName: true, displayName: true },
    });
    const finie = await composerLePortrait(
      Buffer.from(resultat.contenu, "base64"),
      composition.cadre,
      { phrase, nom: proche.callingName ?? proche.displayName },
    );

    /* CE QU'ON RANGE EST UNE CLÉ, jamais l'image. Un modèle rend un à deux
       mégaoctets de base64 ; la clé pèse soixante caractères, et l'image se lit
       par une URL signée à la demande. */
    const cleImage = await this.stockage.ecrire("portraits", finie, "image/png");

    const approuve = await this.prisma.portrait.update({
      where: { id },
      data: { status: "approved", imageKey: cleImage },
    });
    return this.rendre(approuve);
  }

  /* Les réglages du portrait : les SIENS quand il les a notés, ceux en service
   * sinon.
   *
   * Le repli couvre les lignes écrites avant que le lien n'existe. Il ne couvre
   * rien d'autre : un portrait produit depuis porte toujours sa configuration,
   * et `Restrict` en base empêche de la supprimer sous ses pieds.
   *
   * ON REFUSE PLUTÔT QUE DE RETOMBER SUR LE GABARIT DU CODE, à la différence du
   * message. Là-bas, un repli produit un texte correct ; ici il ferait composer
   * une image avec des réglages que personne n'a publiés — donc une image
   * qu'aucun essai n'a montrée. C'est ce que « rien ne se publie sans essai »
   * existe pour empêcher. */
  private async reglagesDuPortrait(configId: string | null): Promise<ReglagesPortrait> {
    const ligne = configId === null
      ? await this.configs.enService("portrait")
      : await this.prisma.studioConfig.findUnique({ where: { id: configId } });
    if (!ligne) throw new AppError("resource_inactive", "no published portrait configuration");
    return this.configs.reglagesPortraitDe(ligne);
  }

  private async modeleDemande(cle: string) {
    const [provider, ...reste] = cle.split(":");
    const modelKey = reste.join(":");
    const modele = provider && modelKey
      ? await this.prisma.aIModel.findUnique({
        where: { provider_modelKey: { provider, modelKey } },
        select: { id: true, provider: true, modelKey: true, costInput: true, costOutput: true },
      })
      : null;
    if (!modele) throw new AppError("resource_inactive", `no model named "${cle}" in the catalogue`);
    return modele;
  }

  /* Les mots du brief, relus depuis `content`.
   *
   * Ils y sont rangés en JSON parce que le nuage en a besoin un par un : les
   * recoller en une phrase obligerait à les redécouper, et un découpage sur les
   * virgules casserait « les mains dans la terre ». */
  private motsDe(contenu: string): { mots: string[]; phrase: string } {
    try {
      const o = JSON.parse(contenu) as { mots?: unknown; phrase?: unknown };
      return {
        mots: Array.isArray(o.mots) ? o.mots.filter((m): m is string => typeof m === "string") : [],
        phrase: typeof o.phrase === "string" ? o.phrase : "",
      };
    } catch {
      /* Un contenu qui n'est pas du JSON vient d'une ligne écrite avant ce
         format. On rend la chaîne comme phrase plutôt que d'échouer : le
         portrait existe, son auteur l'a payé. */
      return { mots: [], phrase: contenu };
    }
  }

  private async rendre(l: {
    id: string; personId: string; status: string; content: string;
    shortContent: string | null; senderNote: string | null; imageKey: string | null; createdAt: Date;
  }): Promise<PortraitRendu> {
    const { phrase } = this.motsDe(l.content);
    return {
      id: l.id,
      personId: l.personId,
      status: l.status as PortraitRendu["status"],
      content: phrase,
      contentShort: l.shortContent,
      senderNote: l.senderNote,
      /* UNE URL SIGNÉE, refaite à chaque lecture. La ranger donnerait des liens
         morts : celles des fournisseurs expirent, et les nôtres aussi — c'est
         le propos. */
      imageUrl: l.imageKey === null ? null : await this.stockage.lire(l.imageKey, DUREE_LECTURE),
      createdAt: l.createdAt.toISOString(),
    };
  }
}

export type { VoieImage };

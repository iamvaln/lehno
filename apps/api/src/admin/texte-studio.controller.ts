import {
  Body, Controller, Get, HttpCode, Inject, Injectable,
  Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import {
  NATURES_TEXTE, reglagesTexteSchemas,
  lancementEssaiTexteSchema, publicationStudioSchema, retourArriereStudioSchema,
  verdictEssaiTexteSchema, type VerdictEssai,
  type ConfigurationTexte, type EssaiStudio, type EtatTexte,
  type HistoriqueTexte, type MesuresStudio, type NatureTexte, type ReglagesTexte,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AdminGuard } from "./admin.guard.js";
import { Role, RoleGuard } from "./role.guard.js";
import { StudioConfigurationService } from "../studio/configuration.service.js";
import { StudioEssaiService } from "../studio/essai.service.js";
import { MesuresStudioService } from "../studio/mesures.service.js";

/**
 * L'ATELIER DES TEXTES — le message, les idées, le brief du portrait.
 *
 * ─── POURQUOI UN SEUL JEU DE ROUTES POUR TROIS NATURES
 *
 * Le geste est rigoureusement le même : lire ce qui tourne et ce qu'on compose,
 * enregistrer, essayer sur un profil, publier, revenir en arrière. Seule la
 * FORME des réglages diffère. Trois contrôleurs jumeaux divergeraient au premier
 * durcissement — l'un garderait l'ancienne règle, et personne ne le verrait
 * avant qu'un administrateur ne publie par le mauvais chemin.
 *
 * Ce qui distingue les natures est validé À L'ENTRÉE, par le schéma de la
 * nature demandée : un corps d'idées posté sur le chemin du message est refusé
 * par le `.strict()` du schéma, jamais par un contrôle écrit à la main.
 *
 * ─── POURQUOI IL N'EXISTAIT PAS
 *
 * `admin/portrait-studio` porte un nom qui trompe : toutes ses routes passent
 * « portrait » en dur au service de configuration. Aucune route de l'API
 * n'écrivait la configuration du message — `StudioEssaiService.essayer` était
 * écrit, testé, et branché à rien. Les réglages des trois générations de texte
 * étaient donc figés à ce que le semis avait posé, et il fallait une livraison
 * pour en changer un.
 *
 * ─── LE RÔLE
 *
 * Fermé au `support`, Y COMPRIS EN LECTURE, comme l'atelier du portrait : lire
 * montre la consigne en préparation et engage une dépense à chaque essai. Le
 * `@Role("admin")` est posé sur la CLASSE — une route ajoutée demain hériterait
 * sinon du droit le plus large sans que personne ne le remarque.
 */

/* La nature arrive par le CHEMIN, donc en texte libre. On la valide avant de
   la porter nulle part : sans ce refus, « portrait » posté ici ferait servir la
   configuration de l'image par l'atelier des textes, et son schéma la
   refuserait plus loin avec un message incompréhensible. */
const natureSchema = z.enum(NATURES_TEXTE);

/* `.passthrough()` et non `.strict()` : le corps de l'ESSAI porte aussi
   `profileId`, validé à part. Le refus des clés inconnues se fait où il compte,
   c'est-à-dire sur les réglages eux-mêmes. */
const corpsEnregistrementSchema = z.object({
  reglages: z.unknown(),
}).passthrough();

@Injectable()
export class TexteStudioService {
  // @Inject explicites : esbuild/vitest n'émet pas design:paramtypes.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StudioConfigurationService) private readonly configs: StudioConfigurationService,
    @Inject(StudioEssaiService) private readonly essais_: StudioEssaiService,
  ) {}

  /* Les deux écrans du brief de design en un seul appel : ce qui tourne, et ce
     qu'on compose. Deux points d'entrée feraient payer un aller-retour à
     l'établi, qui les montre côte à côte — c'est tout son propos. */
  async etat(nature: NatureTexte): Promise<EtatTexte> {
    const [enService, brouillon] = await Promise.all([
      this.configs.enService(nature), this.configs.brouillon(nature),
    ]);
    return {
      enService: enService === null ? null : await this.configs.rendre(enService),
      brouillon: brouillon === null ? null : await this.configs.rendre(brouillon),
    } as EtatTexte;
  }

  /* LES ESSAIS D'UNE NATURE, et la nature se déduit de la CONFIGURATION.
   *
   * `StudioTrial` ne porte pas de nature : il porte `studio_config_id`, et
   * c'est la configuration qui dit laquelle. Filtrer sur elle plutôt que
   * d'ajouter une colonne évite une seconde vérité à tenir d'accord — et un
   * essai dont la nature contredirait celle de sa configuration serait
   * indéchiffrable.
   *
   * Sans cette route, les essais du message se lisaient par
   * `admin/portrait-studio/trials` — `lister` ne filtre pas par nature, donc
   * ça MARCHAIT. C'est bien le problème : un chemin qui s'appelle
   * « portrait-studio » et qui sert les essais du message est exactement le
   * nom qui trompe, et j'en ai retiré un aujourd'hui pour cette raison. */
  async essais(nature: NatureTexte, configId?: string): Promise<{ items: EssaiStudio[] }> {
    if (configId !== undefined) {
      const cible = await this.prisma.studioConfig.findUnique({ where: { id: configId } });
      /* 404 plutôt qu'une liste vide : demander les essais d'une configuration
         de portrait par le chemin du texte est une erreur d'appel, pas un
         résultat vide. Une liste vide la laisserait passer pour un fait. */
      if (!cible || cible.kind !== nature)
        throw new AppError("not_found", "resource not found");
      return { items: await this.essais_.lister(configId) };
    }

    /* Sans configuration désignée : tous ceux de cette nature. Deux requêtes
       plutôt qu'une jointure — `lister` est partagé avec l'atelier du portrait,
       et lui apprendre les natures ferait porter à un service commun une
       distinction qui n'appartient qu'à celui-ci. */
    const siennes = await this.prisma.studioConfig.findMany({
      where: { kind: nature }, select: { id: true }, orderBy: { createdAt: "desc" }, take: 50,
    });
    const tous = await Promise.all(siennes.map((c) => this.essais_.lister(c.id)));
    return { items: tous.flat().slice(0, 100) };
  }

  async historique(nature: NatureTexte): Promise<HistoriqueTexte> {
    const lignes = await this.prisma.studioConfig.findMany({
      where: { kind: nature },
      orderBy: { createdAt: "desc" }, take: 200,
    });
    return { items: await this.configs.rendreTous(lignes) } as HistoriqueTexte;
  }

  /* L'ENREGISTREMENT DIRECT, et son refus.
   *
   * `enregistrerDirect` compare l'empreinte : si la modification touche à ce
   * que le modèle lit, elle exige une prévisualisation. Sans ce refus, ce
   * chemin serait la porte de service par laquelle on publie une consigne que
   * personne n'a vue tourner. */
  async enregistrer(nature: NatureTexte, corps: unknown): Promise<ConfigurationTexte> {
    const reglages = this.valider(nature, corps);
    return await this.configs.rendre(
      await this.configs.enregistrerDirect(nature, reglages),
    ) as ConfigurationTexte;
  }

  /* L'ESSAI. Le brouillon naît AVANT l'appel (brief §11.2) : un fournisseur en
     panne ne doit pas effacer dix minutes de composition. */
  async essayer(
    nature: NatureTexte, adminId: string, corps: { reglages?: unknown; profileId?: unknown },
  ): Promise<{ configId: string; essai: EssaiStudio }> {
    /* Le profil et les réglages arrivent dans le MÊME corps, et se valident
       séparément : le premier par un schéma commun aux trois natures, les
       seconds par celui de la nature demandée. */
    const { profileId } = lancementEssaiTexteSchema.parse({ profileId: corps.profileId });
    return this.essais_.essayerTexte(nature, adminId, this.valider(nature, corps), profileId);
  }

  /* LE SORT D'UN ESSAI. Il se pose sur un identifiant, et l'essai dit à quelle
     configuration il appartient — donc à quelle nature. Le chemin n'a pas à la
     répéter, pour la même raison que la publication : une nature au chemin qui
     contredirait la ligne obligerait à décider laquelle ment. */
  async juger(id: string, verdict: VerdictEssai): Promise<EssaiStudio> {
    /* `reference` n'est jamais posée ici : un essai de texte n'a pas d'image à
       faire représenter une ambiance. Le schéma du corps la refuse déjà ; ce
       `false` explicite dit que ce n'est pas un oubli. */
    return this.essais_.juger(id, verdict, false);
  }

  async publier(adminId: string, entree: z.infer<typeof publicationStudioSchema>) {
    return this.configs.rendre(await this.configs.publier(adminId, entree.configId, entree.note));
  }

  async retourArriere(adminId: string, entree: z.infer<typeof retourArriereStudioSchema>) {
    return this.configs.rendre(await this.configs.retourArriere(adminId, entree.configId, entree.reason));
  }

  /* LA VALIDATION PAR LA NATURE DU CHEMIN, et c'est ce qui rend le contrôleur
     unique tenable : le schéma refuse un corps qui n'est pas de cette
     nature-là, et `.strict()` refuse une clé de trop. Un `as` posé ici à la
     place laisserait passer des réglages d'idées sur le chemin du message,
     qui seraient alors enregistrés tels quels. */
  private valider(nature: NatureTexte, corps: unknown): ReglagesTexte {
    const { reglages } = corpsEnregistrementSchema.parse(corps);
    const analyse = reglagesTexteSchemas[nature].safeParse(reglages);
    if (!analyse.success)
      throw new AppError("validation_failed", `these settings do not match the "${nature}" studio`, {
        detail: analyse.error.message,
      });
    return analyse.data as ReglagesTexte;
  }
}

@Controller("admin/text-studio")
@UseGuards(AdminGuard, RoleGuard)
@Role("admin")
export class TexteStudioController {
  constructor(
    @Inject(TexteStudioService) private readonly service: TexteStudioService,
    @Inject(MesuresStudioService) private readonly mesures$: MesuresStudioService,
  ) {}

  /* La nature se valide DÈS LE PARAMÈTRE, jamais au fond du service. Un chemin
     inconnu doit rendre 400 avec son nom, pas une erreur de lecture trois
     couches plus bas. */
  private nature(brut: string): NatureTexte {
    const analyse = natureSchema.safeParse(brut);
    if (!analyse.success)
      throw new AppError("validation_failed", `unknown text studio "${brut}"`);
    return analyse.data;
  }

  @Get(":nature/config")
  etat(@Param("nature") nature: string): Promise<EtatTexte> {
    return this.service.etat(this.nature(nature));
  }

  /* LES MESURES — ce qui donne son sens à l'atelier : on publiait sans jamais
     savoir si l'on avait amélioré quoi que ce soit.
     Sous `:nature`, comme la configuration et l'historique : on compare une
     version à la précédente DE LA MÊME nature, jamais d'une nature à l'autre. */
  @Get(":nature/metrics")
  mesures(@Param("nature") nature: string): Promise<MesuresStudio> {
    return this.mesures$.mesurer(this.nature(nature));
  }

  @Get(":nature/config/history")
  historique(@Param("nature") nature: string): Promise<HistoriqueTexte> {
    return this.service.historique(this.nature(nature));
  }

  /* `configId` FACULTATIF : sans lui, les essais de toute la nature — c'est ce
     qu'on regarde pour comparer deux versions. Avec lui, ceux d'une version
     précise, comme le fait l'atelier du portrait. */
  @Get(":nature/trials")
  essais(
    @Param("nature") nature: string, @Query("configId") configId?: string,
  ): Promise<{ items: EssaiStudio[] }> {
    return this.service.essais(this.nature(nature), configId);
  }

  @Patch(":nature/config")
  enregistrer(
    @Param("nature") nature: string, @Body() corps: unknown,
  ): Promise<ConfigurationTexte> {
    return this.service.enregistrer(this.nature(nature), corps);
  }

  /* 201 : un essai crée DEUX ressources — un brouillon et sa ligne d'essai —,
     et l'atelier apprend leurs identifiants par la réponse. */
  @Post(":nature/trials")
  @HttpCode(201)
  essayer(
    @Param("nature") nature: string,
    @Body() corps: { reglages?: unknown; profileId?: unknown },
    @Req() req: { admin?: { id: string } },
  ) {
    return this.service.essayer(this.nature(nature), req.admin?.id ?? "", corps);
  }

  /* `trials/:id` NE SE FAIT PAS CAPTER PAR `:nature/config`, et ce n'est pas un
     hasard d'ordre : le second exige littéralement « config » en deuxième
     segment, et un identifiant n'en est pas un. Le noter ici parce que c'est
     exactement le genre de voisinage qu'un déplacement de ligne casse — et que
     la panne serait alors « nature inconnue : trials », incompréhensible. */
  @Patch("trials/:id")
  juger(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(verdictEssaiTexteSchema)) corps: z.infer<typeof verdictEssaiTexteSchema>,
  ): Promise<EssaiStudio> {
    return this.service.juger(id, corps.verdict);
  }

  /* PUBLICATION ET RETOUR ARRIÈRE NE PORTENT PAS LA NATURE, et c'est correct :
     ils visent une configuration par son identifiant, et c'est elle qui dit sa
     nature. La faire répéter au chemin ouvrirait la possibilité qu'elle
     contredise la ligne — et il faudrait alors décider laquelle ment. */
  @Post("config/publish")
  publier(
    @Body(new ZodValidationPipe(publicationStudioSchema)) corps: z.infer<typeof publicationStudioSchema>,
    @Req() req: { admin?: { id: string } },
  ) {
    return this.service.publier(req.admin?.id ?? "", corps);
  }

  @Post("config/rollback")
  retourArriere(
    @Body(new ZodValidationPipe(retourArriereStudioSchema)) corps: z.infer<typeof retourArriereStudioSchema>,
    @Req() req: { admin?: { id: string } },
  ) {
    return this.service.retourArriere(req.admin?.id ?? "", corps);
  }
}

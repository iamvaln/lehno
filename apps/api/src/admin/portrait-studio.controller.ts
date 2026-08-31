import {
  Body, Controller, Delete, Get, HttpCode, Inject, Injectable,
  Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import {
  CHAMPS_DU_PROCHE, GROUPES_AMBIANCE, MOTIFS_IDENTITAIRES, ORIENTATIONS,
  creationProfilSchema, enregistrementPortraitSchema, lancementEssaiPortraitSchema,
  modificationProfilSchema, profilContenuSchema, publicationStudioSchema,
  retourArriereStudioSchema, verdictEssaiSchema,
  type CandidatsStudio, type ConfigurationPortrait, type EssaiStudio, type EtatPortrait,
  type ReglagesPortrait, type VerdictEssai,
  type ProfilStudio, type ProfilsStudio,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AdminGuard } from "./admin.guard.js";
import { Role, RoleGuard } from "./role.guard.js";
import { AuditService } from "./audit.service.js";
import { StudioConfigurationService } from "../studio/configuration.service.js";
import { StudioEssaiService } from "../studio/essai.service.js";
import { axesManquants } from "../studio/couverture.js";

/* Le Studio du portrait, côté administration.
 *
 * Toute la section est fermée au rôle `support`, Y COMPRIS EN LECTURE
 * (ux-admin §5.9). Ce n'est pas une pudeur : le studio règle ce qu'on demande
 * aux modèles et engage une dépense réelle à chaque essai. Un `@Role("admin")`
 * posé sur la CLASSE plutôt que route par route, parce qu'une route ajoutée
 * demain hériterait sinon du droit le plus large sans que personne ne le
 * remarque.
 *
 * À comparer avec `/admin/portrait-studio/templates` (studio.controller.ts),
 * qui laisse le support LIRE : comprendre ce qui a produit un contenu raté
 * fait partie de l'assistance. Ici, même la lecture montre la consigne en
 * préparation et le coût des essais.
 */

const filtreEssaisSchema = z.object({
  configId: z.string().uuid().optional(),
}).strict();

@Injectable()
export class PortraitStudioService {
  // @Inject explicite : esbuild/vitest n'émet pas design:paramtypes.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly journal: AuditService,
    @Inject(StudioConfigurationService) private readonly configs: StudioConfigurationService,
    @Inject(StudioEssaiService) private readonly essais: StudioEssaiService,
  ) {}

  /* Les deux écrans du brief de design en un seul appel : ce qui tourne, et ce
     qu'on compose. Deux points d'entrée feraient payer un aller-retour à
     l'établi, qui les montre côte à côte — c'est tout son propos. */
  /* CE CONTRÔLEUR NE SERT QUE LE PORTRAIT, et le nomme partout.
   *
   * Avant le découpage il servait « la » configuration — celle qui portait
   * aussi les orientations du message. L'établi du portrait affichait donc, et
   * faisait publier, des réglages de texte. */
  async etat(): Promise<EtatPortrait> {
    const [enService, brouillon] = await Promise.all([
      this.configs.enService("portrait"), this.configs.brouillon("portrait"),
    ]);
    return {
      enService: enService === null ? null : await this.configs.rendrePortrait(enService),
      brouillon: brouillon === null ? null : await this.configs.rendrePortrait(brouillon),
    };
  }

  async historique() {
    const lignes = await this.prisma.studioConfig.findMany({
      where: { kind: "portrait" },
      orderBy: { createdAt: "desc" }, take: 200,
    });
    return { items: await this.configs.rendreTous(lignes) };
  }

  async enregistrerDirect(reglages: ReglagesPortrait): Promise<ConfigurationPortrait> {
    return this.configs.rendrePortrait(await this.configs.enregistrerDirect("portrait", reglages));
  }

  async publier(adminId: string, entree: z.infer<typeof publicationStudioSchema>) {
    return this.configs.rendre(await this.configs.publier(adminId, entree.configId, entree.note));
  }

  async retourArriere(adminId: string, entree: z.infer<typeof retourArriereStudioSchema>) {
    return this.configs.rendre(await this.configs.retourArriere(adminId, entree.configId, entree.reason));
  }

  // ── Les profils de simulation ─────────────────────────────────────────────

  async listerProfils(): Promise<ProfilsStudio> {
    const lignes = await this.prisma.studioProfile.findMany({ orderBy: { createdAt: "asc" } });
    const items = lignes.map((l) => this.rendreProfil(l));
    return {
      items,
      manquant: axesManquants(items.map((p) => ({ sensible: p.sensible, contenu: p.contenu }))),
    };
  }

  async creerProfil(entree: z.infer<typeof creationProfilSchema>): Promise<ProfilStudio> {
    return this.rendreProfil(await this.prisma.studioProfile.create({
      data: {
        label: entree.libelle,
        isSensitive: entree.sensible,
        payload: entree.contenu as unknown as Prisma.InputJsonValue,
      },
    }));
  }

  async modifierProfil(id: string, entree: z.infer<typeof modificationProfilSchema>): Promise<ProfilStudio> {
    const existe = await this.prisma.studioProfile.findUnique({ where: { id } });
    if (!existe) throw new AppError("not_found", "unknown simulation profile");

    return this.rendreProfil(await this.prisma.studioProfile.update({
      where: { id },
      data: {
        ...(entree.libelle === undefined ? {} : { label: entree.libelle }),
        ...(entree.sensible === undefined ? {} : { isSensitive: entree.sensible }),
        ...(entree.contenu === undefined ? {} : { payload: entree.contenu as unknown as Prisma.InputJsonValue }),
      },
    }));
  }

  /* Un profil se SUPPRIME, les essais qui s'en servaient DEMEURENT.
   *
   * La clé étrangère est en `SET NULL`, jamais en cascade : la couverture
   * d'essai porte sur l'empreinte des réglages, pas sur le profil. Effacer les
   * essais avec le profil rendrait d'un coup impubliables des configurations
   * qu'on avait bel et bien vues tourner — et le lien entre le ménage d'hier
   * et le refus d'aujourd'hui ne se ferait pas. */
  async supprimerProfil(id: string): Promise<void> {
    const existe = await this.prisma.studioProfile.findUnique({ where: { id } });
    if (!existe) throw new AppError("not_found", "unknown simulation profile");
    await this.prisma.studioProfile.delete({ where: { id } });
  }

  private rendreProfil(l: { id: string; label: string; isSensitive: boolean; payload: unknown; createdAt: Date }): ProfilStudio {
    return {
      id: l.id,
      libelle: l.label,
      sensible: l.isSensitive,
      // Relu par le schéma : un profil écrit par une version antérieure doit
      // tomber ici, à la lecture, et non au milieu d'un essai déjà payé.
      contenu: profilContenuSchema.parse(l.payload),
      creeLe: l.createdAt.toISOString(),
    };
  }

  // ── Les essais ────────────────────────────────────────────────────────────

  async essayer(adminId: string, entree: z.infer<typeof lancementEssaiPortraitSchema>) {
    return this.essais.essayerPortrait(adminId, entree.reglages, entree.profileId, entree.ambianceId);
  }

  async listerEssais(configId?: string): Promise<{ items: EssaiStudio[] }> {
    return { items: await this.essais.lister(configId) };
  }

  async juger(id: string, verdict: VerdictEssai): Promise<EssaiStudio> {
    return this.essais.juger(id, verdict);
  }

  // ── Les valeurs candidates ────────────────────────────────────────────────

  /* Ce dans quoi l'établi choisit. Les modèles viennent du CATALOGUE en base,
   * pas du registre en code : c'est là que vivent l'interrupteur, le tarif et
   * l'état de panne, et c'est ce qu'un administrateur regarde pour décider.
   *
   * Les tarifs sont rendus tels quels, nuls compris. « Non tarifé » est un
   * état normal à afficher — les prix changent sans nous prévenir, et zéro se
   * prendrait pour un fait. */
  async candidats(): Promise<CandidatsStudio> {
    const [modeles, gabarits] = await Promise.all([
      this.prisma.aIModel.findMany({ orderBy: [{ provider: "asc" }, { modelKey: "asc" }] }),
      this.prisma.promptTemplate.findMany({
        where: { isActive: true },
        orderBy: [{ kind: "asc" }, { key: "asc" }],
        select: { id: true, kind: true, key: true, version: true },
      }),
    ]);

    return {
      modeles: modeles.map((m) => ({
        id: m.id,
        cle: `${m.provider}:${m.modelKey}`,
        fournisseur: m.provider,
        modele: m.modelKey,
        capacite: m.capability,
        actif: m.enabled,
        enPanneJusqua: m.outageUntil?.toISOString() ?? null,
        tarifs: {
          entree: m.costInput === null ? null : Number(m.costInput),
          sortie: m.costOutput === null ? null : Number(m.costOutput),
        },
      })),
      orientations: [...ORIENTATIONS],
      groupesAmbiance: [...GROUPES_AMBIANCE],
      motifs: [...MOTIFS_IDENTITAIRES],
      champsDuProche: [...CHAMPS_DU_PROCHE],
      gabarits: gabarits.map((g) => ({ id: g.id, genre: g.kind, cle: g.key, version: g.version })),
    };
  }
}

@Controller("admin/portrait-studio")
@UseGuards(AdminGuard, RoleGuard)
@Role("admin")
export class PortraitStudioController {
  constructor(@Inject(PortraitStudioService) private readonly service: PortraitStudioService) {}

  @Get("config")
  etat(): Promise<EtatPortrait> {
    return this.service.etat();
  }

  @Get("config/history")
  historique() {
    return this.service.historique();
  }

  /* L'enregistrement DIRECT : libellés, ordre, activation.
   *
   * Pas de motif, et c'est délibéré : un brouillon ne change rien pour
   * personne. Exiger une phrase à chaque réordonnancement en ferait taper une
   * vide — et une trace vide vaut moins que pas de trace, parce qu'elle a l'air
   * d'en être une. Le motif arrive à la publication, qui est le geste qui
   * engage. */
  @Patch("config")
  enregistrer(
    @Body(new ZodValidationPipe(enregistrementPortraitSchema)) corps: z.infer<typeof enregistrementPortraitSchema>,
  ) {
    return this.service.enregistrerDirect(corps.reglages);
  }

  @Post("config/publish")
  @HttpCode(200)
  publier(
    @Body(new ZodValidationPipe(publicationStudioSchema)) corps: z.infer<typeof publicationStudioSchema>,
    @Req() req: { admin?: { id: string } },
  ) {
    return this.service.publier(req.admin?.id ?? "", corps);
  }

  @Post("config/rollback")
  @HttpCode(200)
  revenir(
    @Body(new ZodValidationPipe(retourArriereStudioSchema)) corps: z.infer<typeof retourArriereStudioSchema>,
    @Req() req: { admin?: { id: string } },
  ) {
    return this.service.retourArriere(req.admin?.id ?? "", corps);
  }

  @Get("profiles")
  profils(): Promise<ProfilsStudio> {
    return this.service.listerProfils();
  }

  @Post("profiles")
  @HttpCode(201)
  creerProfil(
    @Body(new ZodValidationPipe(creationProfilSchema)) corps: z.infer<typeof creationProfilSchema>,
  ): Promise<ProfilStudio> {
    return this.service.creerProfil(corps);
  }

  @Patch("profiles/:id")
  modifierProfil(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(modificationProfilSchema)) corps: z.infer<typeof modificationProfilSchema>,
  ): Promise<ProfilStudio> {
    return this.service.modifierProfil(id, corps);
  }

  @Delete("profiles/:id")
  @HttpCode(204)
  supprimerProfil(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.service.supprimerProfil(id);
  }

  @Get("trials")
  essais(
    @Query(new ZodValidationPipe(filtreEssaisSchema)) requete: z.infer<typeof filtreEssaisSchema>,
  ) {
    return this.service.listerEssais(requete.configId);
  }

  /* PRÉVISUALISER EST LE GESTE QUI ENREGISTRE : il n'y a pas d'« enregistrer ».
   *
   * Aucun motif ici non plus. Un essai ne change rien pour personne — ni
   * compte, ni solde, ni contenu public — et une séance de réglage en compte
   * trente : la phrase serait vide dès la troisième. Il laisse trace ailleurs,
   * et c'est suffisant : une ligne `StudioTrial`, une ligne `AIUsage` marquée
   * `studio_trial`. */
  @Post("trials")
  @HttpCode(201)
  essayer(
    @Body(new ZodValidationPipe(lancementEssaiPortraitSchema)) corps: z.infer<typeof lancementEssaiPortraitSchema>,
    @Req() req: { admin?: { id: string } },
  ) {
    return this.service.essayer(req.admin?.id ?? "", corps);
  }

  /* LE SORT D'UN ESSAI se pose depuis l'Atelier, par le geste qui SUIT l'essai.
   *
   * PATCH et non POST : on ne crée rien, on tranche sur une ligne qui existe.
   * Et il se REPOSE — on se ravise en regardant la vignette du lendemain, et
   * refuser le second geste obligerait à refaire l'essai pour changer d'avis.
   *
   * Aucun motif, comme la prévisualisation : un essai ne change rien pour
   * personne, et une séance de réglage en compte trente — la phrase serait vide
   * dès la troisième. */
  @Patch("trials/:id")
  @Role("admin")
  juger(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(verdictEssaiSchema)) corps: z.infer<typeof verdictEssaiSchema>,
  ) {
    return this.service.juger(id, corps.verdict);
  }

  @Get("candidates")
  candidats(): Promise<CandidatsStudio> {
    return this.service.candidats();
  }
}

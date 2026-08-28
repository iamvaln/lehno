import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { reglagesDeDepart, type ProfilContenu } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { StudioConfigurationService } from "./configuration.service.js";

/* Le Studio au démarrage : une configuration en service, et de quoi l'essayer.
 *
 * Même mécanique que `CatalogueIAService`, et pour la même raison : un serveur
 * neuf doit être utilisable sans qu'un humain ait rien saisi. Sans ce semis,
 * `/me/studio/options` n'a rien à rendre au premier démarrage — l'écran du
 * studio s'ouvre vide, et l'application ne peut pas produire.
 *
 * ON POURRAIT OBJECTER que le §1 du brief fonctionnel interdit un réglage
 * enregistré que personne n'a vu tourner. La règle gouverne ce qu'un
 * ADMINISTRATEUR retient ; elle ne peut pas gouverner l'état d'un serveur que
 * personne n'a encore ouvert. C'est le même compromis que le registre des
 * modèles, et il est visible : cette version-là porte `published_by_admin_id`
 * nul, et sa note dit d'où elle vient.
 *
 * PAS DE MODULE À PART : l'AppModule est plat, et un module dédié déclarerait
 * sa PROPRE instance de PrismaService, donc un second pool de connexions pour
 * rien.
 */
@Injectable()
export class AmorceStudioService implements OnModuleInit {
  // @Inject explicite : esbuild/vitest n'émet pas design:paramtypes.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StudioConfigurationService) private readonly configs: StudioConfigurationService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.reconcilier();
  }

  async reconcilier(): Promise<void> {
    await this.semerLaConfiguration();
    await this.semerLesProfils();
  }

  /* UNE SEULE FOIS, jamais rejouée.
   *
   * `count() > 0` plutôt qu'un `skipDuplicates` : la table ne porte aucune clé
   * naturelle sur laquelle un doublon se reconnaîtrait, et surtout, la seule
   * chose à ne pas faire ici est de remettre en service les réglages du code
   * par-dessus ce que l'administration a publié. On chercherait longtemps
   * pourquoi « le réglage ne tient pas », comme on l'a cherché pour les tarifs
   * des modèles. */
  private async semerLaConfiguration(): Promise<void> {
    if ((await this.prisma.studioConfig.count()) > 0) return;

    const reglages = reglagesDeDepart();
    await this.prisma.studioConfig.create({
      data: {
        state: "published",
        version: 1,
        settings: reglages as unknown as Prisma.InputJsonValue,
        fingerprint: this.configs.empreinte(reglages),
        publishedAt: new Date(),
        // Personne ne l'a publiée : voir le commentaire de tête.
        publishedByAdminId: null,
        note: "Réglages de départ, tirés du registre des gabarits.",
      },
    });
  }

  /* Les profils de simulation.
   *
   * Ils sont semés parce que sans aucun profil, `POST /trials` ne peut rien
   * lancer : la première prévisualisation exigerait qu'un administrateur
   * compose une fiche complète avant d'avoir pu essayer quoi que ce soit.
   *
   * TROIS profils couvrent les neuf axes que le dictionnaire exige — fiche
   * riche et pauvre, nom court et long, les deux langues, relation familiale
   * et professionnelle, et un cas sensible. Le brief de design §6 le dit
   * mieux : « ce n'est pas une liste, c'est une couverture ». En semer sept
   * qui couvriraient trois axes ne servirait personne. */
  private async semerLesProfils(): Promise<void> {
    if ((await this.prisma.studioProfile.count()) > 0) return;

    await this.prisma.studioProfile.createMany({
      data: PROFILS_DE_DEPART.map((p) => ({
        label: p.libelle,
        isSensitive: p.sensible,
        payload: p.contenu as unknown as Prisma.InputJsonValue,
      })),
    });
  }
}

const PROFILS_DE_DEPART: { libelle: string; sensible: boolean; contenu: ProfilContenu }[] = [
  {
    libelle: "Fiche riche · nom court · français · famille",
    sensible: false,
    contenu: {
      langue: "fr",
      orientation: "notre_relation",
      nomDUsage: "Léa",
      registre: "familier",
      lien: "famille_proche",
      relation: "ma sœur",
      genreDuProche: "female",
      genreDeLAuteur: "male",
      occasionSensible: false,
      notes: [
        { categorie: "loisirs", date: "2026-02-11", contenu: "Elle a repris la poterie le samedi matin." },
        { categorie: "travail", date: "2026-03-02", contenu: "Titularisée après trois ans de remplacements." },
        { categorie: "gouts", date: "2026-04-19", contenu: "Ne jure que par le thé fumé." },
        { categorie: "sante", date: "2026-05-30", contenu: "Court trois fois par semaine depuis l'automne." },
        { categorie: "famille", date: "2026-06-14", contenu: "Emménagé avec Karim au printemps." },
        { categorie: "loisirs", date: "2026-07-08", contenu: "Première exposition collective de ses pièces." },
      ],
      aEviter: ["les surprises organisées sans la prévenir"],
      texteLibre: null,
      age: null,
    },
  },
  {
    libelle: "Fiche pauvre · nom long · anglais · professionnel",
    sensible: false,
    contenu: {
      langue: "en",
      orientation: "ma_gratitude",
      // Un nom volontairement long : la mise en page casse sur les extrêmes.
      nomDUsage: "Ekaterina Vasilievna",
      registre: "formel",
      lien: "relation_pro",
      relation: "my project manager",
      genreDuProche: "female",
      genreDeLAuteur: "unspecified",
      occasionSensible: false,
      // Deux notes suffisent à faire une fiche pauvre (brief de design §6) :
      // un gabarit qui tient sur du matériau abondant peut s'effondrer sur du
      // maigre, et c'est là qu'il se met à inventer.
      notes: [
        { categorie: "travail", date: "2026-01-20", contenu: "Took over the migration when it was going badly." },
        { categorie: "travail", date: "2026-05-05", contenu: "Always answers before the question is finished." },
      ],
      aEviter: [],
      texteLibre: null,
      age: null,
    },
  },
  {
    libelle: "Cas sensible · hommage · français",
    sensible: true,
    contenu: {
      langue: "fr",
      orientation: "un_hommage",
      nomDUsage: "Papi Jean",
      registre: "amical",
      lien: "famille_etendue",
      relation: "mon grand-père",
      genreDuProche: "male",
      genreDeLAuteur: "female",
      /* C'est CE profil qui révèle si un gabarit dérape. Un essai sur une
         fiche riche et sympathique ne prouve rien de ce qu'on craint : une
         réjouissance sur une mémoire est la seule faute de ce parcours qui ne
         se rattrape pas. */
      occasionSensible: true,
      notes: [
        { categorie: "souvenirs", date: "2025-11-02", contenu: "Il tenait à ce que la table soit mise avant d'appeler." },
        { categorie: "souvenirs", date: "2025-12-24", contenu: "Réparait tout, même ce qui n'était pas cassé." },
      ],
      aEviter: [],
      texteLibre: null,
      age: null,
    },
  },
];

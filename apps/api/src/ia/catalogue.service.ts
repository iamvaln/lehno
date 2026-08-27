import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import {
  MODELES_IA, CLES_MODELES, CHAINES_PAR_DEFAUT, TACHES_IA,
  ACTIONS_PAYANTES, CODES_ACTIONS_PAYANTES,
  type TacheIA,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";

/* Le catalogue au démarrage : ce qui existe, et l'ordre par défaut.
 *
 * Même mécanique que FlagsService, et pour la même raison — un serveur neuf
 * doit être utilisable sans qu'un humain ait rien saisi. Pas de module à part :
 * l'AppModule est plat, et un module dédié déclarerait sa PROPRE instance de
 * PrismaService, donc un second pool de connexions pour rien. */
@Injectable()
export class CatalogueIAService implements OnModuleInit {
  // @Inject explicite : esbuild/vitest n'émet pas design:paramtypes.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.reconcilier();
  }

  async reconcilier(): Promise<void> {
    await this.semerLesModeles();
    for (const tache of TACHES_IA) await this.semerLaChaine(tache);
    await this.semerLesActions();
  }

  /* Les actions payantes. Même règle que partout : `skipDuplicates`, donc un
     prix réglé en administration survit au déploiement. Sans ce semis, aucune
     génération n'est facturable — ActionRun exige une action existante. */
  private async semerLesActions(): Promise<void> {
    await this.prisma.premiumAction.createMany({
      data: CODES_ACTIONS_PAYANTES.map((code) => {
        const a = ACTIONS_PAYANTES[code]!;
        return { code, label: a.libelle, creditCost: a.cout };
      }),
      skipDuplicates: true,
    });
  }

  /* `skipDuplicates` : une ligne déjà présente n'est JAMAIS touchée. Sans ça,
     chaque déploiement rallumerait un modèle que l'administration avait coupé,
     ou écraserait le tarif qu'elle venait de saisir — et on chercherait
     longtemps pourquoi le réglage « ne tient pas ». */
  private async semerLesModeles(): Promise<void> {
    await this.prisma.aIModel.createMany({
      data: CLES_MODELES.map((cle) => {
        const m = MODELES_IA[cle]!;
        return { provider: m.fournisseur, modelKey: m.modele, capability: m.capacite };
      }),
      skipDuplicates: true,
    });
  }

  /* Une chaîne se sème ENTIÈRE ou pas du tout.
   *
   * Compléter rang par rang serait pire que ne rien faire : la base porte une
   * unicité sur (tâche, rang), donc insérer un rang 1 par défaut sur une chaîne
   * que l'administration a réordonnée échouerait — ou, pire, réussirait dans un
   * trou laissé par un déclassement et remettrait en tête un modèle qu'on
   * venait d'écarter. Une chaîne est un ordre, pas une collection de lignes
   * indépendantes ; elle se configure d'un bloc. */
  private async semerLaChaine(tache: TacheIA): Promise<void> {
    const dejaLa = await this.prisma.aITaskRoute.count({ where: { task: tache } });
    if (dejaLa > 0) return;

    const modeles = await this.prisma.aIModel.findMany({
      where: {
        OR: CHAINES_PAR_DEFAUT[tache].map((cle) => {
          const m = MODELES_IA[cle]!;
          return { provider: m.fournisseur, modelKey: m.modele };
        }),
      },
      select: { id: true, provider: true, modelKey: true },
    });
    const parCle = new Map(modeles.map((m) => [`${m.provider}:${m.modelKey}`, m.id]));

    /* Le rang vient de la POSITION dans le tableau retenu, pas de l'index
       d'origine : si un modèle du registre manquait en base, garder son index
       laisserait un trou dans les rangs. Un trou n'est pas faux — le routeur
       trie — mais il fait mentir l'écran, qui affiche « rang 3 » sur ce qui est
       en réalité le second essai. */
    const retenus = CHAINES_PAR_DEFAUT[tache]
      .map((cle) => parCle.get(cle))
      .filter((id): id is string => id !== undefined);

    if (retenus.length === 0) return;

    await this.prisma.aITaskRoute.createMany({
      data: retenus.map((modelId, i) => ({ task: tache, modelId, rank: i + 1 })),
      skipDuplicates: true,
    });
  }
}

import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import {
  DRAPEAUX, CLES_DRAPEAUX, CLES_PUBLIQUES, CLES_APPLICATION,
  type CleDrapeau, type PorteeDrapeau,
} from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
// Pas de module à part : ce dépôt a un AppModule plat, et un FlagsModule
// aurait déclaré sa PROPRE instance de PrismaService — un second pool de
// connexions, et un second cycle de vie, pour rien.
export class FlagsService implements OnModuleInit {
  // @Inject explicite : voir ConfigService/ProfileService, même contrainte
  // esbuild/vitest (pas d'emitDecoratorMetadata).
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // L'état BRUT d'un drapeau, sans ses dépendances. Ne sert qu'en interne et
  // à l'administration : le reste du serveur passe par estActif(), et les
  // clients ne reçoivent jamais que la liste résolue (§6.2).
  //
  // Lu en base à CHAQUE appel, sans cache, comme ConfigService : un cache
  // introduirait un délai entre « j'ai éteint » et « c'est éteint », ce qu'un
  // interrupteur de secours ne doit jamais avoir.
  private async etats(): Promise<Map<string, boolean>> {
    const lignes = await this.prisma.featureFlag.findMany({
      where: { key: { in: [...CLES_DRAPEAUX] } },
    });
    return new Map(lignes.map((l) => [l.key, l.enabled]));
  }

  // Un drapeau est actif si SON état est allumé ET si tous ses prérequis le
  // sont, de proche en proche. La résolution se fait ici, côté serveur, pour
  // que le client n'ait aucune règle à connaître (§6.4) — et pour qu'une
  // version installée qui ignore une dépendance ne puisse pas passer outre.
  //
  // Ligne absente = éteint, même règle que partout ailleurs dans ce projet.
  private resoudre(cle: CleDrapeau, etats: Map<string, boolean>): boolean {
    if (!(etats.get(cle) ?? false)) return false;
    return DRAPEAUX[cle].requiert.every((r) => this.resoudre(r as CleDrapeau, etats));
  }

  async estActif(cle: CleDrapeau): Promise<boolean> {
    return this.resoudre(cle, await this.etats());
  }

  // La liste résolue pour une portée : CE QUI EST ACTIF, jamais l'état brut.
  // Le jour où l'activation deviendra sélective par compte, rien ne changera
  // côté client — c'est précisément pourquoi on ne rend pas un dictionnaire
  // clé → booléen (§6.2). Un drapeau absent de cette liste est éteint, et un
  // drapeau inconnu du client l'est aussi : les deux se confondent, à dessein.
  async actifs(portee: PorteeDrapeau): Promise<CleDrapeau[]> {
    const etats = await this.etats();
    const candidates = portee === "public" ? CLES_PUBLIQUES : CLES_APPLICATION;
    return candidates.filter((c) => this.resoudre(c, etats));
  }

  // Au démarrage, avant qu'aucune requête gardée par @Feature ne soit servie.
  // Si la base est injoignable, l'API ne démarre pas — c'est voulu : toutes ses
  // routes en dépendent de toute façon, et le dépôt préfère déjà deux fois ne
  // pas démarrer plutôt que de servir à moitié (voir OTP_PEPPER, MAIL_PORT).
  async onModuleInit(): Promise<void> {
    await this.reconcilier();
  }

  // Insère les lignes manquantes du registre, à l'état éteint, pour que
  // l'administration puisse voir (et allumer) un drapeau qu'elle ne verrait
  // pas sinon. `skipDuplicates` : une ligne déjà présente n'est JAMAIS
  // touchée, sous peine de rallumer ou d'éteindre au déploiement ce qu'un
  // humain avait réglé.
  async reconcilier(): Promise<void> {
    await this.prisma.featureFlag.createMany({
      data: CLES_DRAPEAUX.map((key) => ({ key, enabled: false })),
      skipDuplicates: true,
    });
  }
}

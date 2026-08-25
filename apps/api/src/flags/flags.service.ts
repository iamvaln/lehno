import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import { DRAPEAUX, CLES_PUBLIQUES, type CleDrapeau } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
// Pas de module à part : ce dépôt a un AppModule plat, et un FlagsModule
// aurait déclaré sa PROPRE instance de PrismaService — un second pool de
// connexions, et un second cycle de vie, pour rien.
export class FlagsService implements OnModuleInit {
  // @Inject explicite : voir ConfigService/ProfileService, même contrainte
  // esbuild/vitest (pas d'emitDecoratorMetadata).
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // Lu en base à CHAQUE appel, sans cache, comme ConfigService : un cache
  // introduirait un délai entre « j'ai éteint » et « c'est éteint », ce
  // qu'un interrupteur de secours ne doit jamais avoir.
  async estActif(cle: CleDrapeau): Promise<boolean> {
    const ligne = await this.prisma.featureFlag.findUnique({ where: { key: cle } });
    // Ligne absente = éteint — même règle que le reste du projet (pas de
    // domaine configuré -> aucune origine CORS autorisée).
    return ligne?.enabled ?? false;
  }

  // Lecture groupée, en UNE requête, des drapeaux PUBLICS et eux seuls —
  // /v1/public/config en a besoin pour ne jamais fuiter un drapeau privé.
  // Filtrer sur CLES_PUBLIQUES ici, avant la requête, plutôt que de tout lire
  // puis trier après coup : une clé qui n'a jamais quitté la base ne peut pas
  // fuiter par un tri oublié demain. Ligne absente = éteint, même règle
  // qu'estActif().
  async lirePublics(): Promise<Record<string, boolean>> {
    const lignes = await this.prisma.featureFlag.findMany({
      where: { key: { in: [...CLES_PUBLIQUES] } },
    });
    const etatParCle = new Map(lignes.map((ligne) => [ligne.key, ligne.enabled]));
    return Object.fromEntries(CLES_PUBLIQUES.map((cle) => [cle, etatParCle.get(cle) ?? false]));
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
      data: (Object.keys(DRAPEAUX) as CleDrapeau[]).map((key) => ({ key, enabled: false })),
      skipDuplicates: true,
    });
  }
}

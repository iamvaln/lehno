import { Inject, Injectable } from "@nestjs/common";
import type { Device, RegisterDeviceInput } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";

const PLAFOND_DEFAUT = 10;

/* Les appareils qui reçoivent les notifications poussées — spec technique
 * §5.7 et §16 (OneSignal). Un « appareil » est ici un JETON D'INSTALLATION :
 * réinstaller l'application sur le même téléphone en produit un nouveau.
 */
@Injectable()
export class DeviceService {
  // @Inject explicite : voir SecurityService, même contrainte esbuild/vitest.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async plafond(): Promise<number> {
    const ligne = await this.prisma.systemParameter.findUnique({
      where: { key: "max_devices_per_account" },
    });
    const valeur = Number(ligne?.value);
    return Number.isFinite(valeur) && valeur > 0 ? valeur : PLAFOND_DEFAUT;
  }

  private rendu(d: {
    id: string; platform: string; appVersion: string | null;
    lastSeenAt: Date | null; createdAt: Date;
  }): Device {
    return {
      id: d.id,
      platform: d.platform as Device["platform"],
      appVersion: d.appVersion,
      lastSeenAt: d.lastSeenAt ? d.lastSeenAt.toISOString() : null,
      createdAt: d.createdAt.toISOString(),
    };
  }

  async lister(userId: string): Promise<Device[]> {
    const lignes = await this.prisma.device.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, platform: true, appVersion: true, lastSeenAt: true, createdAt: true },
    });
    return lignes.map((d) => this.rendu(d));
  }

  /* L'ENREGISTREMENT, et c'est un `upsert` plutôt qu'un `create`.
   *
   * L'application appelle ce chemin à chaque démarrage : elle ne sait pas si
   * son jeton a changé, et lui demander de le savoir reviendrait à lui faire
   * tenir un état qu'elle perd à la moindre réinstallation. Un `create`
   * ferait donc échouer un démarrage sur deux sur l'unicité (userId,
   * pushToken), ou pire, remplirait la table d'un doublon par ouverture.
   *
   * Le même appel rafraîchit `lastSeenAt` et la version de l'application :
   * c'est le seul moment où le serveur apprend que cette installation est
   * toujours là, et c'est ce qui distinguera plus tard un appareil vivant d'un
   * jeton mort.
   */
  async enregistrer(userId: string, entree: RegisterDeviceInput): Promise<Device> {
    const maintenant = new Date();

    /* Le plafond se vérifie SOUS VERROU, et seulement pour un jeton NOUVEAU.
     *
     * Le verrou consultatif porte sur le compte — même motif que le plafond de
     * comptes par appareil (signup.service.ts) : deux enregistrements
     * simultanés liraient sinon le compte d'appareils avant qu'aucun n'écrive,
     * et le dépasseraient tous les deux. Une lecture suivie d'une écriture
     * sans verrou n'est pas un plafond, c'est une suggestion.
     *
     * Réenregistrer un jeton DÉJÀ connu ne compte pas contre le plafond : le
     * démarrage quotidien d'une application ne doit pas se heurter à une
     * limite qu'il ne fait pas bouger.
     */
    const ligne = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${`device:${userId}`}))`;

      const existant = await tx.device.findUnique({
        where: { userId_pushToken: { userId, pushToken: entree.pushToken } },
        select: { id: true },
      });

      if (!existant) {
        const seuil = await this.plafond();
        const deja = await tx.device.count({ where: { userId, isActive: true } });
        if (deja >= seuil)
          throw new AppError("device_limit_reached", "too many devices for this account");
      }

      return tx.device.upsert({
        where: { userId_pushToken: { userId, pushToken: entree.pushToken } },
        create: {
          userId,
          pushToken: entree.pushToken,
          platform: entree.platform,
          appVersion: entree.appVersion ?? null,
          lastSeenAt: maintenant,
        },
        update: {
          platform: entree.platform,
          appVersion: entree.appVersion ?? null,
          lastSeenAt: maintenant,
          // Un jeton qu'on avait désactivé et qui se represente est vivant :
          // le service de notification l'avait rejeté, l'application le
          // reprend. Le laisser à faux le condamnerait à ne plus rien recevoir
          // sans que personne ne s'en aperçoive.
          isActive: true,
        },
        select: { id: true, platform: true, appVersion: true, lastSeenAt: true, createdAt: true },
      });
    });

    return this.rendu(ligne);
  }

  /* LE RETRAIT. Un appareil qui n'est pas le sien rend 404, jamais 403 :
   * répondre « interdit » confirmerait qu'il existe (spec technique §9.3), et
   * transformerait ce chemin en oracle sur les identifiants d'autrui.
   *
   * D'où le `deleteMany` avec `userId` dans le WHERE plutôt qu'un `findUnique`
   * suivi d'une comparaison : la propriété est une CONDITION DE L'ÉCRITURE,
   * pas une vérification qu'on peut oublier de faire. Zéro ligne touchée veut
   * dire « pas à vous, ou pas là » — et les deux se répondent pareil.
   */
  async retirer(userId: string, deviceId: string): Promise<void> {
    const { count } = await this.prisma.device.deleteMany({ where: { id: deviceId, userId } });
    if (count === 0) throw new AppError("not_found", "no such device");
  }
}

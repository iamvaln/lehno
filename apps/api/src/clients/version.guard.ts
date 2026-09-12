import { Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { contexteCourant } from "../tracking/contexte.js";
import { VersionsService } from "./versions.service.js";

/* « VOTRE APPLICATION EST TROP VIEILLE » — et rien d'autre.
 *
 * Elle ne refuse ni un compte ni un droit : elle dit qu'un binaire ne sait plus
 * parler à ce serveur. D'où le 426 et son code à part — un 403 se lirait comme
 * un problème de compte, et l'utilisateur chercherait au mauvais endroit.
 *
 * ELLE DORT DERRIÈRE UN PARAMÈTRE, et ce n'est pas de la prudence molle :
 * l'allumer alors qu'aucun build n'envoie encore `x-app-build` mettrait TOUT LE
 * MONDE dehors d'un coup, y compris les applications déjà installées. Le
 * paramètre se coupe en une minute ; un déploiement, non.
 */
const PARAMETRE = "version_guard_enabled";

/* LES MÊMES CHEMINS HORS GARDE QUE LE RESTE.
 *
 * `/public/*` : un lien de liste s'ouvre dans le navigateur de quelqu'un qui n'a
 * AUCUNE application installée. Lui demander de mettre à jour n'aurait aucun
 * sens, et fermerait le partage — qui est le cœur du produit.
 *
 * `/health` : l'appelant est la supervision, qui n'a pas de build. Et une
 * supervision qui recevrait 426 croirait l'API en panne. */
const OUVERTS = ["/public", "/health"];

/* Le paramètre se relit rarement : trente secondes suffisent pour qu'une coupure
   d'urgence prenne effet, et évitent une lecture par requête. */
const DUREE_CACHE_MS = 30_000;

@Injectable()
export class VersionGuard implements CanActivate {
  private allume: { valeur: boolean; jusqua: number } | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(VersionsService) private readonly versions: VersionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ path?: string; url?: string }>();
    const chemin = (req.path ?? req.url ?? "").split("?")[0]?.replace(/^\/v\d+/, "") ?? "";
    if (OUVERTS.some((o) => chemin === o || chemin.startsWith(`${o}/`))) return true;

    if (!(await this.actif())) return true;

    const c = contexteCourant();
    const exigence = await this.versions.exiger(c.clientType, c.appBuild);
    if (exigence.etat !== "a_mettre_a_jour") return true;

    /* LE DÉTAIL PORTE OÙ ALLER. Un écran qui dit « mettez à jour » sans lien
       n'est pas un écran, c'est un mur. La CAUSE part aussi — pour le journal,
       pas pour l'écran : les trois se ressemblent du point de vue de celui qui
       attend d'ouvrir son application. */
    throw new AppError("upgrade_required", "this app version is no longer served", {
      cause: exigence.cause,
      ...(exigence.version === null ? {} : { version: exigence.version }),
      ...(exigence.storeUrl === null ? {} : { storeUrl: exigence.storeUrl }),
    });
  }

  private async actif(): Promise<boolean> {
    if (this.allume !== null && this.allume.jusqua > Date.now()) return this.allume.valeur;

    /* ÉTEINT PAR DÉFAUT, et éteint aussi quand la base ne répond pas : une
       panne de lecture ne doit pas se traduire par « tout le monde dehors ».
       C'est le sens de la garde tout entière — elle ferme une porte, elle ne
       doit jamais la fermer par accident. */
    let valeur = false;
    try {
      const ligne = await this.prisma.systemParameter.findUnique({ where: { key: PARAMETRE } });
      valeur = ligne?.value === "true" || ligne?.value === "1";
    } catch {
      valeur = false;
    }
    this.allume = { valeur, jusqua: Date.now() + DUREE_CACHE_MS };
    return valeur;
  }
}

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

/* Le seul environnement où une version se périme. Voir les deux exemptions dans
   `canActivate` : hors production, il n'y a ni magasin à ouvrir ni binaire
   figé — seulement des gens qui reconstruisent. */
const ENVIRONNEMENT_JUGE = "prod";

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

    /* ── DEUX EXEMPTIONS, ET ELLES SONT LE CŒUR DE CETTE GARDE ─────────────────
     *
     * SANS CLIENT RECONNU, ON NE JUGE PAS. Le type et l'environnement viennent
     * de la paire présentée, pas des en-têtes — ceux-là sont déclaratifs. Sans
     * paire reconnue, on ne sait ni quelle plateforme ni quel environnement, et
     * décider « ce build est trop vieux » sur une déclaration reviendrait à
     * laisser le client choisir s'il veut être jugé.
     *
     * HORS PRODUCTION, ON NE JUGE PAS NON PLUS — et c'est ce qui débloque le
     * développement. Un build de développement, Expo Go, une diffusion interne
     * n'ont AUCUN numéro de build : `eas.json` porte `appVersionSource:
     * "remote"`, donc le numéro n'existe que dans les binaires qu'EAS produit.
     * Sans cette exemption, allumer cette garde mettrait dehors toute l'équipe
     * et tous les testeurs internes, avec un « mettez à jour » qu'aucun magasin
     * ne peut satisfaire.
     *
     * L'EXEMPTION SE DÉCIDE SUR L'ENVIRONNEMENT ENREGISTRÉ, jamais sur
     * `x-app-env`. Un build de production qui déclarerait `dev` ne s'exempterait
     * de rien : c'est la paire présentée qui tranche, et elle est en base. C'est
     * aussi pourquoi il existe SIX paires et non trois — l'environnement fait
     * partie de l'identité du client, pas de ce qu'il raconte. */
    if (c.clientVerdict !== "reconnu") return true;
    if (c.clientEnv !== ENVIRONNEMENT_JUGE) return true;

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

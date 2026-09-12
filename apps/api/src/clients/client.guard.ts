import { Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { AppError } from "../common/errors.js";
import { contexteCourant } from "../tracking/contexte.js";

/* « JE NE SAIS PAS QUI VOUS ÊTES. »
 *
 * La phase 1 lit les en-têtes et note ce qu'elle en conclut, sans rien refuser.
 * Celle-ci refuse — et c'est la seule différence entre les deux.
 *
 * ELLE DORT DERRIÈRE UN PARAMÈTRE, et ce n'est pas de la prudence molle :
 * l'allumer alors qu'aucun build n'envoie encore ses en-têtes mettrait TOUT LE
 * MONDE dehors d'un coup, y compris les applications déjà installées. On
 * l'allume quand le journal montre que les appels portent leur identité — c'est
 * exactement ce que la phase 1 sert à mesurer.
 *
 * LE MOTIF NE SORT PAS. Le client reçoit un refus unique ; dire laquelle des
 * deux valeurs est fausse apprendrait à un script lesquelles il a devinées. Les
 * cinq causes restent dans le contexte, donc dans le journal, où l'on veut tout
 * savoir.
 */
const PARAMETRE = "client_guard_enabled";

/* LES MÊMES CHEMINS HORS GARDE QUE LE RESTE.
 *
 * `/public/*` : un lien de liste s'ouvre dans le navigateur de quelqu'un qui n'a
 * AUCUNE application installée, donc aucune paire à présenter. Y poser la garde
 * fermerait le partage — qui est le cœur du produit.
 *
 * `/health` : l'appelant est la supervision, qui n'a pas de build. Un 403 lui
 * ferait croire l'API en panne.
 *
 * `/v1/auth/*` N'EN FAIT PAS PARTIE, et c'est tranché : une application
 * s'identifie AVANT de connecter quelqu'un. Ça veut dire que le tout premier
 * appel d'un build neuf doit déjà porter ses en-têtes — c'est voulu.
 */
const OUVERTS = ["/public", "/health"];

const DUREE_CACHE_MS = 30_000;

@Injectable()
export class ClientGuard implements CanActivate {
  private allume: { valeur: boolean; jusqua: number } | null = null;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ path?: string; url?: string }>();
    const chemin = (req.path ?? req.url ?? "").split("?")[0]?.replace(/^\/v\d+/, "") ?? "";
    if (OUVERTS.some((o) => chemin === o || chemin.startsWith(`${o}/`))) return true;

    if (!(await this.actif())) return true;

    /* `reconnu` SEUL PASSE. Le verdict nul veut dire que la résolution elle-même
       a échoué — une panne de base, par exemple. On refuse alors comme pour un
       inconnu : une garde qui s'ouvrirait sur une panne ne garde rien.

       C'est l'inverse du choix fait sur le paramètre lui-même, qui reste ÉTEINT
       si on ne peut pas le lire. La différence est volontaire : ne pas savoir
       s'il faut garder ⇒ on n'empêche rien ; savoir qu'il faut garder mais ne
       pas pouvoir identifier ⇒ on refuse. */
    const verdict = contexteCourant().clientVerdict;
    if (verdict === "reconnu") return true;

    /* UN CODE À PART DE `forbidden`, parce que l'écran doit pouvoir dire « cette
       application n'est pas reconnue » plutôt que « votre compte est refusé » —
       et parce que ce n'est PAS rattrapable par une reconnexion : le client ne
       doit ni renouveler son jeton ni réessayer. */
    throw new AppError("client_unknown", "unknown or unauthorised API client");
  }

  private async actif(): Promise<boolean> {
    if (this.allume !== null && this.allume.jusqua > Date.now()) return this.allume.valeur;

    /* ÉTEINT PAR DÉFAUT, et éteint aussi quand la base ne répond pas : une panne
       de lecture ne doit pas se traduire par « tout le monde dehors ». Une garde
       ferme une porte, elle ne doit jamais la fermer par accident. */
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

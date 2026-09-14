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

/* LES DEUX EN-TÊTES DE LA SUGGESTION, nommés ici et dans la spec mobile — « un
   en-tête » ne suffit pas à écrire un client, et c'est précisément ce qui
   manquait pour que la bannière soit reportable.

   Le lien accompagne la version : annoncer une version sans dire où la prendre
   est la même faute que « mettez à jour » sans lien, en plus poli. */
const ENTETE_VERSION = "x-app-update-available";
const ENTETE_LIEN = "x-app-update-url";

/* CE QUI PEUT ALLER DANS UN EN-TÊTE. Les deux valeurs viennent du registre,
   donc d'une saisie d'administration : `version` n'est contraint que par sa
   longueur, et rien n'y interdit un retour à la ligne.

   Node REFUSE une valeur d'en-tête qui en contient un — `ERR_INVALID_CHAR` —,
   et la garde tourne sur CHAQUE requête : une version enregistrée avec une
   frappe malheureuse ferait donc 500 sur tout le trafic, sans que le lien avec
   le registre saute aux yeux. On se tait plutôt que de poser l'en-tête : une
   bannière qui manque est un désagrément, une API qui tombe n'en est pas un. */
const POSABLE = /^[\x20-\x7e]{1,500}$/;

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

    const c = contexteCourant();

    /* SANS CLIENT RECONNU, ON NE JUGE PAS. Le type et l'environnement viennent
     * de la paire présentée, pas des en-têtes — ceux-là sont déclaratifs. Sans
     * paire reconnue, on ne sait ni quelle plateforme ni quel environnement, et
     * décider « ce build est trop vieux » sur une déclaration reviendrait à
     * laisser le client choisir s'il veut être jugé.
     *
     * TOUT CE QUI SUIT SE DÉCIDE SUR L'ENVIRONNEMENT ENREGISTRÉ, jamais sur
     * `x-app-env`. Un build de production qui déclarerait `dev` ne s'exempterait
     * de rien : c'est la paire présentée qui tranche, et elle est en base. C'est
     * aussi pourquoi il existe SIX paires et non trois — l'environnement fait
     * partie de l'identité du client, pas de ce qu'il raconte. */
    if (c.clientVerdict !== "reconnu") return true;

    /* HORS PRODUCTION ET SANS NUMÉRO, IL N'Y A RIEN À COMPARER — et c'est CE
     * test-là qui débloque le développement, pas l'environnement seul.
     *
     * `eas.json` porte `appVersionSource: "remote"` : le numéro n'existe que
     * dans les binaires qu'EAS produit. Expo Go, un build local, une diffusion
     * lancée à la main n'en ont aucun, et le client ne l'invente pas — « ce qui
     * est inconnu ne se transmet pas ».
     *
     * LES DEUX CONDITIONS ENSEMBLE, jamais l'absence de numéro seule : en
     * production, un appel SANS numéro reste jugé, comme avant. Sans ça,
     * retirer un en-tête deviendrait le moyen de contourner la garde — et c'est
     * le genre de trou qu'on ne remarque qu'en le cherchant. */
    const horsProduction = c.clientEnv !== ENVIRONNEMENT_JUGE;
    if (horsProduction && c.appBuild === null) return true;

    const exigence = await this.versions.exiger(c.clientType, c.appBuild);
    if (exigence.etat === "servie") return true;

    /* ── LE PARAMÈTRE NE GOUVERNE QUE LE REFUS ─────────────────────────────────
     *
     * Il était lu tout en haut, et il coupait donc la garde ENTIÈRE. La
     * suggestion, qui ne refuse rien, ne partait alors jamais : la bannière
     * n'aurait pu exister qu'une fois le refus allumé — c'est-à-dire une fois
     * qu'on accepte de mettre des gens dehors. Le plus doux des deux gestes
     * attendait le plus dur.
     *
     * ÉTEINT, ON SUGGÈRE AU LIEU DE FERMER. C'est la phase « on note, on ne
     * bloque pas » que le §8.3 du registre des versions proposait et qui
     * n'existait nulle part : les builds périmés reçoivent une bannière, on
     * regarde le parc bouger, puis on allume. Rien ne se perd — un build
     * déclassé ou sous `forcesUpdate` a de toute façon une version plus récente
     * vers laquelle envoyer.
     *
     * La lecture de base ne peut pas nous faire tomber ici : `registre()` avale
     * déjà sa propre panne et rend une liste vide, donc « servie ». */
    /* ── HORS PRODUCTION, ON SUGGÈRE MAIS ON NE REFUSE JAMAIS ─────────────────
     *
     * L'environnement gouverne le REFUS, comme le paramètre juste en dessous —
     * il ne gouvernait rien de moins que la garde entière, et la bannière était
     * donc hors de portée d'un build de recette « par construction ». Le mobile
     * ne pouvait l'éprouver nulle part : ni en dev, faute de numéro, ni en
     * recette, à cause de cette ligne.
     *
     * Ce que l'exemption protégeait — ne pas mettre l'équipe dehors — reste
     * entier : un build hors production ne peut PLUS être refusé, quoi qu'il
     * arrive. Il reçoit seulement l'en-tête, qui ne bloque rien. */
    if (exigence.etat === "suggeree" || horsProduction || !(await this.actif())) {
      this.suggerer(context, exigence.version, exigence.storeUrl);
      return true;
    }

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

  /* NON BLOQUANTE, ET ELLE LE RESTE JUSQU'AU BOUT : rien de ce qui suit ne peut
     faire échouer la requête. Une bannière qui manque est un désagrément ; une
     garde qui jette parce qu'un en-tête n'a pas pu se poser serait exactement ce
     que cette classe existe pour éviter. */
  private suggerer(context: ExecutionContext, version: string | null, lien: string | null): void {
    /* CE N'EST PAS `setHeader` QU'ON VÉRIFIE D'ABORD, MAIS `getResponse`. Le
       premier jet ne testait que `res?.setHeader`, et il tombait — appeler une
       méthode absente jette avant qu'on puisse en tester le résultat. Nest la
       fournit toujours en vrai ; cette garde tourne sur chaque requête, et
       supposer une forme est précisément ce qu'on ne peut pas se permettre
       ici. */
    const http = context.switchToHttp() as {
      getResponse?: () => { setHeader?: (n: string, v: string) => void } | undefined;
    };
    if (typeof http?.getResponse !== "function") return;
    const res = http.getResponse();
    if (typeof res?.setHeader !== "function") return;
    if (version !== null && POSABLE.test(version)) res.setHeader(ENTETE_VERSION, version);
    if (lien !== null && POSABLE.test(lien)) res.setHeader(ENTETE_LIEN, lien);
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

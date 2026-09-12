import { Inject, Injectable } from "@nestjs/common";
import type { TypeClient } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";

/* CE QU'ON ACCEPTE DE SERVIR, ET CE QU'ON INVITE À METTRE À JOUR.
 *
 * Une version publiée est une version ENREGISTRÉE. C'est une liste blanche, et
 * elle tend un piège : un build parti au magasin sans être enregistré — CI qui
 * échoue après la soumission, étape oubliée — bloquerait tous ses utilisateurs,
 * exactement ceux qui viennent de mettre à jour.
 *
 * CE QUI LE DÉSAMORCE : un build inconnu reçoit « mettez à jour », pas un refus
 * sec. C'est le seul geste sensé pour un client qu'on ne reconnaît pas, et le
 * pire cas d'un oubli devient « on invite à réinstaller » plutôt que
 * « l'application ne marche plus ».
 */

export type Exigence =
  | { etat: "servie" }
  /** Un build plus récent existe, sans que celui-ci soit périmé. Non bloquant. */
  | { etat: "suggeree"; version: string }
  | {
      etat: "a_mettre_a_jour";
      /** Pourquoi — pour le journal, jamais pour l'écran : le geste est le même. */
      cause: "inconnue" | "declassee" | "forcee";
      /** Ce vers quoi aller. Nul si le registre est vide pour cette plateforme. */
      version: string | null;
      storeUrl: string | null;
    };

type Ligne = {
  version: string;
  buildNumber: number;
  forcesUpdate: boolean;
  isRetired: boolean;
  storeUrl: string | null;
};

/* Le registre d'une plateforme change à chaque publication, c'est-à-dire
   rarement. Sans cache, une lecture par requête pour une liste de quelques
   lignes. Cinq minutes : une version qu'on vient d'enregistrer met au plus ce
   temps à être servie, et l'enregistrement précède toujours la soumission au
   magasin — donc personne n'attend. */
const DUREE_CACHE_MS = 5 * 60_000;

@Injectable()
export class VersionsService {
  private readonly cache = new Map<string, { lignes: Ligne[]; jusqua: number }>();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async exiger(plateforme: TypeClient | null, build: number | null): Promise<Exigence> {
    /* SANS PLATEFORME, ON NE DÉCIDE RIEN. Un appel qui ne dit pas d'où il vient
       n'a pas de registre à consulter — et l'inviter à mettre à jour sans savoir
       vers quoi serait un mur. C'est la garde des clients (phase 2) qui traite
       ce cas, pas celle-ci. */
    if (plateforme === null) return { etat: "servie" };

    const registre = await this.registre(plateforme);

    /* UN REGISTRE VIDE NE BLOQUE PERSONNE. C'est l'état d'un serveur neuf, et
       d'un serveur dont on vient d'ouvrir une plateforme. Refuser ici mettrait
       tout le monde dehors le jour de la mise en service — le contraire de ce
       qu'on veut.

       Et un registre dont TOUT est déclassé ne bloque pas non plus : il n'y
       aurait vers quoi renvoyer personne. */
    if (registre.length === 0) return { etat: "servie" };

    /* LA CIBLE EST LE PLUS RÉCENT NON DÉCLASSÉ, jamais `registre[0]`. Inviter
       quelqu'un à installer un build qu'on refuse le ferait boucler : il met à
       jour, on le refuse encore, et l'écran ne dit pas pourquoi. */
    const dernier = registre.find((l) => !l.isRetired);
    if (dernier === undefined) return { etat: "servie" };

    /* UN BUILD ILLISIBLE OU INCONNU : on invite. Le client ne sait pas ce qu'il
       est pour nous, la seule chose utile est de le renvoyer vers ce qu'on
       connaît. */
    const connu = build === null ? undefined : registre.find((l) => l.buildNumber === build);
    if (connu === undefined) return this.inviter("inconnue", dernier);
    if (connu.isRetired) return this.inviter("declassee", dernier);

    /* LE PLUS RÉCENT QUI FORCE, et tout ce qui est en dessous est périmé. C'est
       l'inverse d'un plancher : on ne relève rien, on marque la release qui a
       cassé. */
    const plancher = registre.find((l) => l.forcesUpdate && !l.isRetired);
    if (plancher !== undefined && connu.buildNumber < plancher.buildNumber)
      return this.inviter("forcee", dernier);

    /* Une suggestion, pas une exigence : l'écran montre une bannière discrète et
       n'interrompt rien. Un build déclassé ne peut pas être la cible. */
    if (dernier.buildNumber > connu.buildNumber)
      return { etat: "suggeree", version: dernier.version };

    return { etat: "servie" };
  }

  /** À appeler quand l'administration touche au registre. */
  oublier(plateforme: TypeClient): void {
    this.cache.delete(plateforme);
  }

  private inviter(cause: "inconnue" | "declassee" | "forcee", dernier: Ligne): Exigence {
    return {
      etat: "a_mettre_a_jour",
      cause,
      version: dernier.version,
      storeUrl: dernier.storeUrl,
    };
  }

  /** Du build le plus récent au plus ancien — c'est l'ordre dont tout dépend. */
  private async registre(plateforme: TypeClient): Promise<Ligne[]> {
    const connu = this.cache.get(plateforme);
    if (connu !== undefined && connu.jusqua > Date.now()) return connu.lignes;

    /* Une panne de base ne doit pas mettre tout le monde à la porte : sans
       registre lisible, on sert. Et on NE MET PAS l'échec en cache, sinon une
       coupure d'une seconde ouvrirait la porte cinq minutes. */
    let lignes: Ligne[];
    try {
      lignes = await this.prisma.appVersion.findMany({
        where: { platform: plateforme as never },
        orderBy: { buildNumber: "desc" },
        select: {
          version: true, buildNumber: true, forcesUpdate: true,
          isRetired: true, storeUrl: true,
        },
      });
    } catch {
      return [];
    }

    this.cache.set(plateforme, { lignes, jusqua: Date.now() + DUREE_CACHE_MS });
    return lignes;
  }
}

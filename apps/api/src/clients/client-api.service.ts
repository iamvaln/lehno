import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { TypeClient, EnvClient } from "@lehno/contracts";
import { PrismaService } from "../prisma/prisma.service.js";

/* Résoudre le client d'une requête : qui appelle, depuis quel build.
 *
 * CE QUE LA CLÉ VAUT, ET CE QU'ELLE NE VAUT PAS. Une clé livrée dans un binaire
 * mobile ou un paquet web N'EST PAS UN SECRET — elle s'extrait d'un `.ipa` ou
 * d'un `Ctrl-U`. Ce service ne prétend donc pas authentifier : il IDENTIFIE, et
 * la frontière de sécurité reste le jeton de l'utilisateur.
 *
 * Ce qu'elle apporte quand même, et qui justifie qu'elle existe : elle se
 * RÉVOQUE sans changer l'identifiant, donc les chiffres restent comparables d'un
 * trimestre à l'autre ; elle relève la barre ; et elle permet de couper un
 * client sans couper les autres.
 */

/** Ce qu'un client a envoyé — avant qu'on ait dit s'il est connu. */
export type Annonce = {
  clientId: string | null;
  clientKey: string | null;
  clientType: TypeClient | null;
};

export type Verdict =
  | {
      etat: "reconnu";
      clientId: string;
      clientType: TypeClient;
      /* L'ENVIRONNEMENT ENREGISTRÉ, pas celui que l'en-tête déclare.
         C'est lui qui décide si le registre des versions s'applique — un build
         de production qui enverrait `x-app-env: dev` ne s'exempterait de rien,
         puisque c'est la PAIRE présentée qui tranche, et qu'elle est en base. */
      environment: EnvClient;
    }
  /* Un motif par cause, et il ne sort JAMAIS vers le client : celui-ci reçoit un
     refus unique. Dire laquelle des deux valeurs est fausse apprendrait à un
     script lesquelles il a devinées. Ici, on veut tout savoir. */
  | { etat: "absent" | "inconnu" | "coupe" | "cle_fausse" | "type_discordant" };

/* SOIXANTE SECONDES, ET LES ÉCHECS AUSSI.
 *
 * Sans cache, une lecture en base par requête pour un objet qui change une fois
 * par trimestre. Et sans cache des échecs, un `client_id` inconnu répété ferait
 * une lecture à chaque fois — c'est précisément le profil d'un script qui
 * tâtonne, donc le cas où le cache sert le plus.
 *
 * L'invalidation explicite existe parce que soixante secondes d'attente pour
 * révoquer une clé compromise, c'est cinquante-neuf de trop. */
const DUREE_CACHE_MS = 60_000;

type Ligne = {
  clientId: string;
  clientType: TypeClient;
  environment: EnvClient;
  keyHash: string;
  isActive: boolean;
};

@Injectable()
export class ClientApiService {
  private readonly cache = new Map<string, { ligne: Ligne | null; jusqua: number }>();

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async resoudre(annonce: Annonce): Promise<Verdict> {
    if (annonce.clientId === null || annonce.clientKey === null) return { etat: "absent" };

    const ligne = await this.lire(annonce.clientId);
    if (ligne === null) return { etat: "inconnu" };
    if (!ligne.isActive) return { etat: "coupe" };
    if (!memeCle(annonce.clientKey, ligne.keyHash)) return { etat: "cle_fausse" };

    /* LE TYPE DÉCLARÉ DOIT CONCORDER AVEC CELUI ENREGISTRÉ. Ce n'est pas une
       redondance : un `x-client-type` qui ne correspond pas dit qu'une clé
       circule hors de son build, et c'est exactement ce qu'on veut voir. */
    if (annonce.clientType !== ligne.clientType) return { etat: "type_discordant" };

    return {
      etat: "reconnu", clientId: ligne.clientId,
      clientType: ligne.clientType, environment: ligne.environment,
    };
  }

  /** À appeler quand l'administration coupe un client ou tourne sa clé. */
  oublier(clientId: string): void {
    this.cache.delete(clientId);
  }

  private async lire(clientId: string): Promise<Ligne | null> {
    const connu = this.cache.get(clientId);
    if (connu !== undefined && connu.jusqua > Date.now()) return connu.ligne;

    /* Une panne de base ne doit pas faire échouer la requête : ce service
       identifie, il ne garde rien en phase 1. On rend « inconnu » et la ligne de
       journal le dira — mais on ne met PAS ça en cache, sinon une coupure d'une
       seconde ferait mentir le journal pendant une minute. */
    let ligne: Ligne | null;
    try {
      ligne = await this.prisma.apiClient.findUnique({
        where: { clientId },
        select: {
          clientId: true, clientType: true, environment: true,
          keyHash: true, isActive: true,
        },
      }) as Ligne | null;
    } catch {
      return null;
    }

    this.cache.set(clientId, { ligne, jusqua: Date.now() + DUREE_CACHE_MS });
    return ligne;
  }
}

/** Le haché d'une clé. SHA-256 nu — voir le commentaire du modèle : une clé
 *  engendrée fait trente-deux octets aléatoires, il n'y a rien à deviner par
 *  force brute, et un hachage lent ajouterait des millisecondes à CHAQUE
 *  requête sans rien acheter. */
export function hacherLaCle(cle: string): string {
  return createHash("sha256").update(cle, "utf8").digest("hex");
}

/** Une clé neuve. Trente-deux octets, en base64url : lisible, collable, et sans
 *  caractère qui casserait un en-tête HTTP. */
export function engendrerUneCle(): string {
  return randomBytes(32).toString("base64url");
}

/* EN TEMPS CONSTANT. Comparer deux chaînes avec `===` s'arrête au premier octet
   différent, et le temps de réponse dit alors combien d'octets étaient justes.
   Les deux hachés font toujours la même longueur, donc `timingSafeEqual` ne peut
   pas lever — mais on le garde sous condition, parce qu'une ligne corrompue en
   base ferait tomber le serveur au lieu de refuser un appel. */
function memeCle(cleEnvoyee: string, hacheAttendu: string): boolean {
  const envoye = Buffer.from(hacherLaCle(cleEnvoyee), "utf8");
  const attendu = Buffer.from(hacheAttendu, "utf8");
  if (envoye.length !== attendu.length) return false;
  return timingSafeEqual(envoye, attendu);
}

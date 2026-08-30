/* Le stockage des fichiers, derrière un port.
 *
 * Cinq surfaces l'emploient — portraits, avatars, images de souhaits, reçus de
 * paiement, archives d'export —, et aucune ne doit connaître le fournisseur.
 * C'est la même forme que le courrier et la mesure, et pour la même raison :
 * mille cinq cents tests ne peuvent pas dépendre d'un compartiment distant.
 *
 * CE QU'ON MANIPULE EST UNE CLÉ, jamais une URL. Une URL présignée expire ; la
 * ranger en base donnerait des liens morts, et lierait la donnée au
 * fournisseur. Les colonnes s'appellent d'ailleurs déjà `proofKey`.
 */

/** Les préfixes du compartiment. Un seul seau, cinq territoires. */
export const PREFIXES = ["portraits", "avatars", "souhaits", "recus", "exports"] as const;
export type Prefixe = (typeof PREFIXES)[number];

export type Depot = {
  /** La clé sous laquelle le fichier se range. Jamais devinable — voir `cle()`. */
  cle: string;
  /** L'URL à laquelle DÉPOSER, valable quelques minutes. */
  url: string;
  expireDans: number;
};

export interface StockagePort {
  /**
   * Une URL pour DÉPOSER, sans passer par le serveur.
   *
   * Un portrait de deux mégaoctets qui traverse l'API occupe une connexion pour
   * rien, et un reçu déposé depuis un téléphone en zone lente la tiendrait
   * longtemps.
   */
  deposer(prefixe: Prefixe, typeMime: string): Promise<Depot>;

  /**
   * Une URL pour LIRE, valable quelques minutes.
   *
   * Jamais de compartiment public : un lien partagé une fois resterait ouvert
   * pour toujours. C'est le serveur qui décide, à chaque lecture, si celui qui
   * demande a le droit.
   */
  lire(cle: string, secondes?: number): Promise<string>;

  /** Écrire depuis le serveur — le portrait rendu par le modèle passe par là. */
  ecrire(prefixe: Prefixe, contenu: Buffer, typeMime: string): Promise<string>;

  /** Effacer. Les reçus s'en vont ainsi une fois la demande traitée. */
  effacer(cle: string): Promise<void>;
}

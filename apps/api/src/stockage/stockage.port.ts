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

/** Les préfixes du compartiment. Un seul seau, sept territoires. */
/* `sources` EST LE SEUL PRÉFIXE DONT LE CONTENU EST DESTINÉ À DISPARAÎTRE.
 *
 * Les photos qu'un utilisateur dépose pour qu'on s'en inspire y vivent le temps
 * de la génération, et pas une minute de plus : « l'image est transmise à un
 * service qui la transforme, et elle n'est pas conservée ; après traitement la
 * source est effacée » (spec portrait §2.4). C'est une promesse faite à l'écran
 * au moment du dépôt, donc elle doit s'exécuter.
 *
 * Un préfixe à part, et non `portraits` : le jour où l'on posera une règle de
 * cycle de vie côté R2, elle portera sur celui-ci seul — poser « efface après
 * sept jours » sur `portraits` effacerait ce que les gens ont payé. */

/* `essais` SUIT LA MÊME RÈGLE, et la suivait mal : les images des essais
 * d'administration se rangeaient sous `portraits`, avec les portraits payés.
 *
 * Une séance de réglage en produit trente, et rien ne les distinguait de ce
 * qu'un client a acheté. La règle de cycle de vie qu'appelle le paragraphe
 * ci-dessus était donc IMPOSABLE : posée sur `portraits`, elle aurait emporté
 * les deux ; pas posée, les essais s'accumulent sans fin.
 *
 * Les clés déjà écrites ne bougent pas — elles sont rangées entières dans
 * `studio_trial.output`, et se relisent telles quelles. Ce préfixe ne vaut donc
 * que pour la suite, et le ménage du passé se fera par une passe qui saura
 * lesquelles viennent d'un essai. */
export const PREFIXES = [
  "portraits", "avatars", "souhaits", "recus", "exports", "sources", "essais",
] as const;
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

  /**
   * Lire les OCTETS depuis le serveur.
   *
   * Distinct de `lire`, qui rend une URL pour le navigateur. Le serveur qui
   * doit inspecter ce qu'on vient de déposer — vérifier le type d'après le
   * contenu, recomposer une image — n'a pas à passer par une URL signée de son
   * propre compartiment : ce serait un aller-retour réseau pour lire chez soi.
   */
  contenu(cle: string): Promise<Buffer>;

  /** Écrire depuis le serveur — le portrait rendu par le modèle passe par là. */
  ecrire(prefixe: Prefixe, contenu: Buffer, typeMime: string): Promise<string>;

  /** Effacer. Les reçus s'en vont ainsi une fois la demande traitée. */
  effacer(cle: string): Promise<void>;
}

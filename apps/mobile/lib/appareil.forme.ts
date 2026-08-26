/* La forme de l'identifiant d'appareil, séparée de ce qui le fabrique.
 *
 * Les modules natifs — trousseau, source d'aléa — sont écrits en Flow et ne se
 * chargent pas sous Vitest. La règle du port vaut ici comme pour les
 * primitives : ce qui décide vit dans un fichier pur, ce qui exécute reste
 * mince. L'aléa entre donc en argument plutôt que d'être puisé.
 */

const FORME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Le contrat le borne à 128 caractères ; la forme le borne à 36.
export function estUnIdentifiantDAppareil(valeur: string): boolean {
  return FORME.test(valeur) && valeur.length <= 128;
}

/* Un identifiant universel de version 4, composé de seize octets d'aléa. Les
   deux bits de version et de variante s'y posent — sans eux, la chaîne aurait
   la bonne longueur sans être un identifiant valide. */
export function uuidDepuis(octets: Uint8Array): string {
  if (octets.length < 16) throw new Error("seize octets sont nécessaires");
  const o = Uint8Array.from(octets.slice(0, 16));
  o[6] = (o[6]! & 0x0f) | 0x40;
  o[8] = (o[8]! & 0x3f) | 0x80;
  const hex = [...o].map((n) => n.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""), hex.slice(4, 6).join(""), hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""), hex.slice(10, 16).join(""),
  ].join("-");
}

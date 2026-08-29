import * as SecureStore from "expo-secure-store";
import { estUnIdentifiantDAppareil, uuidDepuis } from "./appareil.forme.js";

/* L'identifiant d'appareil.
 *
 * Il borne le nombre de comptes créés depuis un même téléphone : il doit donc
 * survivre à une fermeture de l'application, sinon le plafond ne borne rien.
 *
 * Mais il reste propre à l'INSTALLATION, pas à la personne ni au matériel. Un
 * identifiant matériel traverserait les désinstallations et suivrait quelqu'un
 * d'un compte à l'autre : ce n'est pas ce qu'on demande ici, et les magasins le
 * refusent pour cet usage.
 *
 * Il vit au trousseau, avec les jetons : un fichier ordinaire se lit, et un
 * plafond qu'on peut remettre à zéro n'en est pas un.
 */

const CLE = "lehno.appareil";

/* Seize octets d'aléa ordinaire, et c'est assez.
 *
 * L'identifiant est FABRIQUÉ PAR LE CLIENT : le serveur ne peut donc pas s'y
 * fier pour autre chose que distinguer deux installations. Un aléa
 * cryptographique ne rendrait pas plus difficile d'en forger un — il suffit de
 * poster ce qu'on veut. Seule l'unicité compte, et Math.random la donne pour
 * 2^128 possibilités.
 *
 * En prime, cela retire un module natif : dans une application native, en
 * ajouter un impose une reconstruction, et ce n'était pas un prix justifié. */
function seizeOctets(): Uint8Array {
  return Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
}

export async function identifiantDeLAppareil(): Promise<string> {
  const connu = await SecureStore.getItemAsync(CLE);
  if (connu && estUnIdentifiantDAppareil(connu)) return connu;

  const neuf = uuidDepuis(seizeOctets());
  await SecureStore.setItemAsync(CLE, neuf);
  // On relit : deux appels concurrents au premier lancement pourraient en
  // forger deux, et le compte doit porter celui qui a été écrit.
  return (await SecureStore.getItemAsync(CLE)) ?? neuf;
}

/* Ces aides vivent À PART de `liste.ts`, et il faut qu'elles y restent.
 *
 * Elles sont les seules choses que le composant client emprunte au chargeur.
 * Tant qu'elles habitaient le même module, l'importer tirait au navigateur le
 * schéma Zod de la liste — et avec lui Zod entier : 29 ko de JS sur la page
 * publique la plus visitée, vue par des gens qui ne connaissent pas encore
 * Lehno et souvent sur un forfait compté. Les séparer les a ramenés à 4.
 *
 * Les refondre « pour ranger » referait la fuite, sans que rien ne le dise :
 * aucune suite ne mesure le poids d'un paquet.
 */

/* Le jeton de visite : présenté dans `x-lehno-reservation`, il fait reconnaître
 * SES réservations, et celles-là seulement.
 *
 * Il vit dans le stockage local plutôt que dans un cookie : il ne vaut pas
 * session de compte, et un cookie partirait avec chaque appel, y compris ceux
 * qui n'ont rien à voir. Un accès au stockage peut lever — navigation privée,
 * site data bloqué —, d'où les gardes : la page doit rester juste sans lui,
 * elle montrera seulement « réservé » là où elle aurait dit « par vous ». */
const CLE_JETON = "lehno.reservation";

export function jetonDeVisite(): string | null {
  try {
    return globalThis.localStorage?.getItem(CLE_JETON) ?? null;
  } catch {
    return null;
  }
}

export function garderJetonDeVisite(jeton: string): void {
  try {
    globalThis.localStorage?.setItem(CLE_JETON, jeton);
  } catch {
    // Rien à rattraper : le visiteur perdra la marque de ses réservations au
    // rechargement, et c'est tout. La réservation, elle, est déjà prise.
  }
}

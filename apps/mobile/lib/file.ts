/* LA FILE D'ÉCRITURES — « 3 actions repartiront au retour du réseau ».
 *
 * LA CONTRAINTE QUI LA FAÇONNE : deux points d'écriture sur trente-quatre
 * acceptent une clé d'idempotence — la génération et le démarrage d'un
 * paiement. Partout ailleurs, rejouer un POST crée un SECOND objet : deuxième
 * note, deuxième fiche, deuxième souhait.
 *
 * D'où la règle unique de ce module : ON NE MET EN FILE QUE CE QUI N'EST
 * JAMAIS PARTI.
 *
 * Si l'appareil est su hors connexion AVANT l'envoi, la requête n'a pas quitté
 * le téléphone : le serveur ne l'a pas vue, la rejouer ne peut rien dupliquer.
 * C'est sûr sans rien changer au serveur.
 *
 * Si la requête est PARTIE et que l'issue est inconnue — délai dépassé, réponse
 * perdue — elle ne va pas en file. Le serveur l'a peut-être exécutée. On le dit
 * à la personne, qui décidera. C'est exactement ce que la copie promet :
 * « 3 actions repartiront » compte les actions RETENUES, pas les douteuses.
 */

/* CE QUI NE SE DIFFÈRE JAMAIS, même retenu.
 *
 * L'ARGENT d'abord. Rejouer un versement des heures plus tard, sans personne
 * devant l'écran, engage une somme que personne ne revoit partir — et le
 * réseau peut revenir la nuit, l'application en poche.
 *
 * L'IRRÉVERSIBLE ensuite : fermer un compte ne se différe pas. Quelqu'un qui a
 * changé d'avis dans le tunnel verrait son compte partir au retour du réseau.
 *
 * LA SESSION enfin. Se déconnecter doit aboutir tout de suite et localement —
 * c'est déjà le cas, et différer la révocation serveur vaut mieux que retenir
 * quelqu'un sur un compte qu'il veut quitter.
 */
const JAMAIS: readonly RegExp[] = [
  /^\/me\/payments/,
  /^\/me\/payment-methods/,
  /^\/me\/credit-bundles/,
  /^\/me\/account\/deletion/,
  /^\/me\/account$/,
  /^\/auth\//,
];

const ECRITURES = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export function estDifferable(chemin: string, methode: string): boolean {
  if (!ECRITURES.has(methode.toUpperCase())) return false;
  return !JAMAIS.some((m) => m.test(chemin));
}

export interface Action {
  /* Un identifiant à nous, posé à la mise en file. Il ne sert PAS
     d'idempotence au serveur — il n'en veut pas — mais à retirer exactement
     l'action qu'on vient de rejouer, sans se tromper de voisine quand deux
     actions se ressemblent trait pour trait. */
  id: string;
  chemin: string;
  methode: string;
  corps: string | null;
  poseeLe: string;
}

/* L'ORDRE EST STRICT, ET L'ÉCHEC ARRÊTE.
 *
 * Une action qui échoue au rejeu arrête la file au lieu d'être sautée : une
 * note adressée à une fiche dont la création vient d'échouer n'atterrirait
 * nulle part, et la suivante non plus. On aurait alors une file qui se vide en
 * perdant la moitié de ce qu'elle portait, sans que rien ne le dise.
 *
 * Mieux vaut une file bloquée qu'on voit — le compte reste affiché — qu'une
 * file propre qui a mangé le travail de quelqu'un.
 */
export type Issue = "reussie" | "arrete";

export function suivantes(file: readonly Action[], issue: Issue): Action[] {
  // Réussie : la tête part, le reste suit. Arrêtée : rien ne bouge.
  return issue === "reussie" ? file.slice(1) : [...file];
}

/* CE QUE LA BANNIÈRE DIT, et pourquoi le compte compte.
 *
 * Zéro action retenue : « vos notes et vos dates restent consultables » — on
 * rassure sur la lecture. Une ou plus : « N actions repartiront » — on rassure
 * sur ce qu'on a écrit, qui est l'inquiétude la plus vive des deux.
 *
 * Le second message REMPLACE le premier plutôt que de s'y ajouter : deux
 * phrases empilées sur un bandeau ne se lisent pas, et celle qui compte est
 * celle qui parle de ce qu'on vient de faire.
 */
export function messageDuBandeau(
  enAttente: number,
  simple: string,
  avecFile: (n: number) => string,
): string {
  return enAttente > 0 ? avecFile(enAttente) : simple;
}
